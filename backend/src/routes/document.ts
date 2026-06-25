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
  type PmDocument,
  type PmDocumentState,
  type PmDocumentVersion,
  type PmSectionKey,
} from "@shared/types";

export const documentRouter = Router();

interface SessionMetaRow {
  session_id: string;
  facilitator_id: string;
  project_id: string;
  org_id: string;
  meeting_title: string;
}

interface DocumentRow {
  id: string;
  project_id: string;
  org_id: string;
  state_json: string | any; // Type 'any' to handle pg driver auto-parsing JSONB
  version: number;
  created_at: string;
  updated_at: string;
}

interface VersionRow {
  id: string;
  version: number;
  session_id: string | null;
  patch_json: string | any | null; // Handle pg JSONB auto-parsing
  created_at: string;
}

/** Empty PM document state with the canonical sections (schema spec §7.3). */
function emptyState(): PmDocumentState {
  const sections = {} as PmDocumentState["sections"];
  for (const s of PM_SECTIONS) sections[s.key] = { title: s.title, content: "" };
  return { sections };
}

function rowToDocument(row: DocumentRow): PmDocument {
  // If the pg driver auto-parses the JSONB column, it will be an object.
  // If it's retrieved as text, we parse it.
  const state = typeof row.state_json === "string" ? JSON.parse(row.state_json) : row.state_json;
  return {
    id: row.id,
    projectId: row.project_id,
    orgId: row.org_id,
    state: state as PmDocumentState,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function renderDocument(state: PmDocumentState): string {
  return PM_SECTIONS.map((s) => {
    const sec = state.sections[s.key];
    return `## ${sec?.title ?? s.title}\n${sec?.content?.trim() || "(empty)"}`;
  }).join("\n\n");
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

async function getDocumentRow(orgId: string, projectId: string): Promise<DocumentRow | undefined> {
  const result = await db.query<DocumentRow>(
    `SELECT * FROM documents WHERE org_id = $1 AND project_id = $2`,
    [orgId, projectId]
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
       VALUES ($1, $2, $3, 'summary', $4, $5, 0, $6)`,
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