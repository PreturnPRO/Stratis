// Document patch gateway (schema spec §7) — the PM document is the project's
// source of truth. After a meeting the AI proposes section patches; the
// facilitator approves/edits/rejects them; approved patches commit the next
// document version. document_versions is the git-style change log.
import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import { documentPatchCall, type DocPatchContext } from "@ai/index";
import {
  PM_SECTIONS,
  type DocumentPatchDTO,
  type PmDocumentState,
  type PmDocumentVersion,
  type PmSectionKey,
} from "@shared/types";
import { emptyState, rowToDocument, renderDocument, getDocumentRow, type DocumentRow } from "../lib/pmDocument";

export const documentRouter = Router();

interface SessionMetaRow {
  session_id: string;
  facilitator_id: string;
  project_id: string;
  org_id: string;
  meeting_title: string;
}

interface VersionRow {
  id: string;
  version: number;
  session_id: string | null;
  patch_json: string | any | null; // Handle pg JSONB auto-parsing
  created_at: string;
}

/** Apply approved patches to a document state (schema spec §7.5). */
function applyPatches(state: PmDocumentState, patches: DocumentPatchDTO[]): PmDocumentState {
  const next: PmDocumentState = { sections: { ...state.sections } };
  for (const p of patches) {
    const key = p.section_key as PmSectionKey;
    const existing = next.sections[key] ?? { title: p.section_title, content: "" };
    const title = p.section_title?.trim() || existing.title;
    const content =
      p.operation === "append_to_section" && existing.content.trim()
        ? `${existing.content}\n\n${p.new_content}`
        : p.new_content;
    next.sections[key] = { title, content };
  }
  return next;
}

async function getSessionMeta(sessionId: string): Promise<SessionMetaRow | undefined> {
  const result = await db.query<SessionMetaRow>(
    `
    SELECT s.id AS session_id, s.facilitator_id AS facilitator_id,
           m.project_id AS project_id, m.org_id AS org_id, m.title AS meeting_title
    FROM sessions s
    JOIN meetings m ON m.id = s.meeting_id
    WHERE s.id = $1
    `,
    [sessionId]
  );
  return result.rows[0];
}

async function getVersions(documentId: string): Promise<PmDocumentVersion[]> {
  const result = await db.query<VersionRow>(
    `SELECT id, version, session_id, patch_json, created_at
     FROM document_versions WHERE document_id = $1 ORDER BY version DESC`,
    [documentId]
  );

  return result.rows.map((v) => {
    let changeSummary = "";
    try {
      const patchObj = typeof v.patch_json === "string" ? JSON.parse(v.patch_json) : v.patch_json;
      changeSummary = patchObj ? (patchObj.overall_change_summary ?? "") : "";
    } catch {
      changeSummary = "";
    }
    return {
      id: v.id,
      version: v.version,
      sessionId: v.session_id,
      changeSummary,
      createdAt: v.created_at,
    };
  });
}

function canAccess(meta: SessionMetaRow, role: string, userId: string, orgId: string): boolean {
  if (meta.org_id !== orgId) return false;
  if (role === "admin") return true;
  return meta.facilitator_id === userId;
}

/**
 * POST /api/document/session/:sessionId/generate
 * Propose PM-document patches from this session's transcript. Transient — does
 * not commit; the facilitator reviews before /commit.
 */
documentRouter.post("/session/:sessionId/generate", requireAuth, async (req, res, next) => {
  try {
    const meta = await getSessionMeta(req.params.sessionId);
    if (!meta) return res.status(404).json({ ok: false, error: "Session not found" });
    if (!canAccess(meta, req.auth!.role, req.auth!.sub, req.auth!.orgId)) {
      return res.status(403).json({ ok: false, error: "You do not have access to this session" });
    }

    const transcriptsResult = await db.query<{ speaker: string; text: string }>(
      `SELECT speaker, text FROM transcripts WHERE session_id = $1 ORDER BY timestamp ASC`,
      [meta.session_id]
    );
    const transcripts = transcriptsResult.rows;

    if (transcripts.length === 0) {
      return res.status(409).json({ ok: false, error: "No transcript rows for this session" });
    }

    const rollingResult = await db.query<{ rolling_summary: string | null }>(
      `SELECT rolling_summary FROM sessions WHERE id = $1`,
      [meta.session_id]
    );
    const rolling = rollingResult.rows[0];

    const existing = await getDocumentRow(meta.org_id, meta.project_id);
    const currentState = existing ? rowToDocument(existing).state : emptyState();
    const baseVersion = existing?.version ?? 0;

    const ctx: DocPatchContext = {
      sessionId: meta.session_id,
      projectId: meta.project_id,
      baseVersion,
      currentDocument: renderDocument(currentState),
      transcript: transcripts.map((t) => `${t.speaker}: ${t.text}`).join("\n"),
      rollingSummary: rolling?.rolling_summary ?? null,
    };

    const result = await documentPatchCall(ctx);
    if (!result.ok) {
      return res.status(422).json({
        ok: false,
        error: `Document AI output failed validation: ${result.error}`,
        data: { provider: result.provider, rawText: result.rawText },
      });
    }

    res.json({
      ok: true,
      data: {
        projectId: meta.project_id,
        document: { ...currentState, version: baseVersion },
        proposed: result.data,
        provider: result.provider,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/document/session/:sessionId/commit
 * Apply the facilitator-approved (possibly edited) patches → next version.
 * body: { patches: DocumentPatchDTO[], overall_change_summary: string }
 */
documentRouter.post("/session/:sessionId/commit", requireAuth, async (req, res, next) => {
  try {
    const meta = await getSessionMeta(req.params.sessionId);
    if (!meta) return res.status(404).json({ ok: false, error: "Session not found" });
    if (!canAccess(meta, req.auth!.role, req.auth!.sub, req.auth!.orgId)) {
      return res.status(403).json({ ok: false, error: "You do not have access to this session" });
    }

    const patches: DocumentPatchDTO[] = Array.isArray(req.body?.patches) ? req.body.patches : [];
    const changeSummary =
      typeof req.body?.overall_change_summary === "string" ? req.body.overall_change_summary : "";

    if (patches.length === 0) {
      return res.status(400).json({ ok: false, error: "No approved patches to commit" });
    }

    const timestamp = now();
    const existing = await getDocumentRow(meta.org_id, meta.project_id);
    const currentState = existing ? rowToDocument(existing).state : emptyState();
    const nextState = applyPatches(currentState, patches);
    const nextVersion = (existing?.version ?? 0) + 1;
    
    // Explicitly stringify for the PG query to insert into JSONB
    const stateJson = JSON.stringify(nextState);

    let documentId: string;
    if (existing) {
      documentId = existing.id;
      await db.query(
        `UPDATE documents SET state_json = $1, version = $2, updated_at = $3 WHERE id = $4`,
        [stateJson, nextVersion, timestamp, documentId]
      );
    } else {
      documentId = newId("doc");
      await db.query(
        `INSERT INTO documents (id, project_id, org_id, state_json, version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [documentId, meta.project_id, meta.org_id, stateJson, nextVersion, timestamp, timestamp]
      );
    }

    // git-style version log: store the committed state + the patch payload.
    await db.query(
      `INSERT INTO document_versions (id, document_id, session_id, version, state_json, patch_json, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        newId("dver"),
        documentId,
        meta.session_id,
        nextVersion,
        stateJson,
        JSON.stringify({ overall_change_summary: changeSummary, patches }),
        req.auth!.sub,
        timestamp,
      ]
    );

    // Surface on the dashboard recent-summaries feed (kind='summary').
    await db.query(
      `INSERT INTO notifications (id, user_id, session_id, kind, title, body, read, created_at)
       VALUES ($1, $2, $3, 'summary', $4, $5, FALSE, $6)`,
      [
        newId("ntf"),
        req.auth!.sub,
        meta.session_id,
        `${meta.meeting_title} — document v${nextVersion}`,
        changeSummary || `PM document updated to v${nextVersion}.`,
        timestamp,
      ]
    );

    const row = await getDocumentRow(meta.org_id, meta.project_id);
    const versions = await getVersions(documentId);

    res.json({
      ok: true,
      data: { document: rowToDocument(row!), versions },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/document/:projectId/section
 * Manual facilitator edit of a single section's content. Does not create a new
 * version (a meeting commit does that) — it's an in-place correction.
 * body: { sectionKey: PmSectionKey, content: string }
 */
documentRouter.patch("/:projectId/section", requireAuth, async (req, res, next) => {
  try {
    if (req.auth!.role === "participant") {
      return res.status(403).json({ ok: false, error: "Only a facilitator can edit the document" });
    }

    const sectionKey =
      typeof req.body?.sectionKey === "string" ? (req.body.sectionKey as PmSectionKey) : ("" as PmSectionKey);
    const content = typeof req.body?.content === "string" ? req.body.content : "";

    const known = PM_SECTIONS.find((s) => s.key === sectionKey);
    if (!known) {
      return res.status(400).json({ ok: false, error: "Invalid sectionKey" });
    }

    const row = await getDocumentRow(req.auth!.orgId, req.params.projectId);
    if (!row) return res.status(404).json({ ok: false, error: "No document for this project" });

    const doc = rowToDocument(row);
    const existing = doc.state.sections[sectionKey] ?? { title: known.title, content: "" };
    const nextState: PmDocumentState = {
      sections: { ...doc.state.sections, [sectionKey]: { title: existing.title, content } },
    };

    await db.query(
      `UPDATE documents SET state_json = $1, updated_at = $2 WHERE id = $3`,
      [JSON.stringify(nextState), now(), row.id],
    );

    const updated = await getDocumentRow(req.auth!.orgId, req.params.projectId);
    res.json({ ok: true, data: { document: rowToDocument(updated!) } });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/document/:projectId — remove the PM document + version history. */
documentRouter.delete("/:projectId", requireAuth, async (req, res, next) => {
  try {
    if (req.auth!.role === "participant") {
      return res.status(403).json({ ok: false, error: "Only a facilitator can delete the document" });
    }

    const row = await getDocumentRow(req.auth!.orgId, req.params.projectId);
    if (!row) return res.status(404).json({ ok: false, error: "No document for this project" });

    // document_versions has ON DELETE CASCADE, so versions go with the document.
    await db.query(`DELETE FROM documents WHERE id = $1`, [row.id]);

    res.json({ ok: true, data: { deleted: true, projectId: req.params.projectId } });
  } catch (err) {
    next(err);
  }
});

/** GET /api/document/:projectId/version/:version — a historical version's full state. */
documentRouter.get("/:projectId/version/:version", requireAuth, async (req, res, next) => {
  try {
    const row = await getDocumentRow(req.auth!.orgId, req.params.projectId);
    if (!row) return res.status(404).json({ ok: false, error: "No document for this project" });

    const versionNum = Number(req.params.version);
    const vres = await db.query<{ state_json: string | any; version: number; created_at: string }>(
      `SELECT state_json, version, created_at FROM document_versions WHERE document_id = $1 AND version = $2`,
      [row.id, versionNum],
    );
    const v = vres.rows[0];
    if (!v) return res.status(404).json({ ok: false, error: "Version not found" });

    const state = typeof v.state_json === "string" ? JSON.parse(v.state_json) : v.state_json;
    res.json({ ok: true, data: { version: v.version, state, createdAt: v.created_at } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/document/:projectId/restore — facilitator reverts the document to a
 * past version. Git-style: writes the old state as a NEW version, keeping history.
 * body: { version: number }
 */
documentRouter.post("/:projectId/restore", requireAuth, async (req, res, next) => {
  try {
    if (req.auth!.role === "participant") {
      return res.status(403).json({ ok: false, error: "Only a facilitator can restore a version" });
    }

    const targetVersion = Number(req.body?.version);
    if (!Number.isInteger(targetVersion) || targetVersion < 1) {
      return res.status(400).json({ ok: false, error: "Invalid version" });
    }

    const row = await getDocumentRow(req.auth!.orgId, req.params.projectId);
    if (!row) return res.status(404).json({ ok: false, error: "No document for this project" });

    const verResult = await db.query<{ state_json: string | any }>(
      `SELECT state_json FROM document_versions WHERE document_id = $1 AND version = $2`,
      [row.id, targetVersion]
    );
    const ver = verResult.rows[0];
    if (!ver) return res.status(404).json({ ok: false, error: "Version not found" });

    const restoredState =
      typeof ver.state_json === "string" ? ver.state_json : JSON.stringify(ver.state_json);
    const nextVersion = row.version + 1;
    const timestamp = now();
    const summary = `Restored content from v${targetVersion}`;

    await db.query(
      `UPDATE documents SET state_json = $1, version = $2, updated_at = $3 WHERE id = $4`,
      [restoredState, nextVersion, timestamp, row.id]
    );
    await db.query(
      `INSERT INTO document_versions (id, document_id, session_id, version, state_json, patch_json, created_by, created_at)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7)`,
      [
        newId("dver"),
        row.id,
        nextVersion,
        restoredState,
        JSON.stringify({ overall_change_summary: summary, patches: [] }),
        req.auth!.sub,
        timestamp,
      ]
    );

    const updated = await getDocumentRow(req.auth!.orgId, req.params.projectId);
    const versions = await getVersions(row.id);
    res.json({ ok: true, data: { document: rowToDocument(updated!), versions } });
  } catch (err) {
    next(err);
  }
});

/** GET /api/document/:projectId — current PM document + version history. */
documentRouter.get("/:projectId", requireAuth, async (req, res, next) => {
  try {
    const row = await getDocumentRow(req.auth!.orgId, req.params.projectId);
    if (!row) return res.status(404).json({ ok: false, error: "No document for this project yet" });
    
    const versions = await getVersions(row.id);
    
    res.json({
      ok: true,
      data: { document: rowToDocument(row), versions },
    });
  } catch (err) {
    next(err);
  }
});

export default documentRouter;