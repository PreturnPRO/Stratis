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
  patch_json: string | any | null;
  created_at: string;
}

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

    // The history has to ship with the generate response too. The post-meeting
    // review arrives here, not through GET /:projectId, so without it the
    // Versions rail renders empty and the facilitator cannot open a single
    // earlier version of the document they are being asked to amend.
    const versions = existing ? await getVersions(existing.id) : [];

    res.json({
      ok: true,
      data: {
        projectId: meta.project_id,
        document: { ...currentState, version: baseVersion },
        versions,
        proposed: result.data,
        provider: result.provider,
      },
    });
  } catch (err) {
    next(err);
  }
});

documentRouter.post("/session/:sessionId/commit", requireAuth, async (req, res, next) => {
  try {
    const meta = await getSessionMeta(req.params.sessionId);
    if (!meta) return res.status(404).json({ ok: false, error: "Session not found" });
    if (!canAccess(meta, req.auth!.role, req.auth!.sub, req.auth!.orgId)) {
      return res.status(403).json({ ok: false, error: "You do not have access to this session" });
    }

    const patches: DocumentPatchDTO[] = Array.isArray(req.body?.patches) ? req.body.patches : [];
    const changeSummary = typeof req.body?.overall_change_summary === "string" ? req.body.overall_change_summary : "";

    if (patches.length === 0) {
      return res.status(400).json({ ok: false, error: "No approved patches to commit" });
    }

    const timestamp = now();
    const existing = await getDocumentRow(meta.org_id, meta.project_id);
    const currentState = existing ? rowToDocument(existing).state : emptyState();
    const nextState = applyPatches(currentState, patches);
    const nextVersion = (existing?.version ?? 0) + 1;

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

    const orgUsers = await db.query<{ id: string }>(
      "SELECT id FROM users WHERE org_id = $1",
      [meta.org_id]
    );

    const { pushNotification } = await import("../realtime/hub");

    for (const u of orgUsers.rows) {
      const notificationId = newId("ntf");
      const notificationPayload = {
        id: notificationId,
        user_id: u.id,
        session_id: meta.session_id,
        kind: "summary",
        title: `${meta.meeting_title} — document v${nextVersion}`,
        body: changeSummary || `PM document updated to v${nextVersion}.`,
        read: false,
        created_at: timestamp
      };

      await db.query(
        `INSERT INTO notifications (id, user_id, session_id, kind, title, body, read, created_at)
         VALUES ($1, $2, $3, 'summary', $4, $5, FALSE, $6)`,
        [
          notificationPayload.id,
          notificationPayload.user_id,
          notificationPayload.session_id,
          notificationPayload.title,
          notificationPayload.body,
          notificationPayload.created_at
        ]
      );

      pushNotification(u.id, notificationPayload);
    }

    const row = await getDocumentRow(meta.org_id, meta.project_id);
    const versions = await getVersions(documentId);

    res.json({ ok: true, data: { document: rowToDocument(row!), versions }, });
  } catch (err) {
    next(err);
  }
});

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

documentRouter.delete("/:projectId", requireAuth, async (req, res, next) => {
  try {
    if (req.auth!.role === "participant") {
      return res.status(403).json({ ok: false, error: "Only a facilitator can delete the document" });
    }

    const row = await getDocumentRow(req.auth!.orgId, req.params.projectId);
    if (!row) return res.status(404).json({ ok: false, error: "No document for this project" });

    await db.query(`DELETE FROM documents WHERE id = $1`, [row.id]);

    res.json({ ok: true, data: { deleted: true, projectId: req.params.projectId } });
  } catch (err) {
    next(err);
  }
});

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
