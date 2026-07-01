// Shared PM-document read helpers — used by both the document review routes
// (backend/src/routes/document.ts) and the live meeting AI context builder
// (backend/src/routes/transcript.ts), which needs read-only access to a
// project's current document without duplicating this logic.
import { db } from "../db/database";
import { PM_SECTIONS, type PmDocument, type PmDocumentState } from "@shared/types";

export interface DocumentRow {
  id: string;
  project_id: string;
  org_id: string;
  state_json: string | any; // Type 'any' to handle pg driver auto-parsing JSONB
  version: number;
  created_at: string;
  updated_at: string;
}

/** Empty PM document state with the canonical sections (schema spec §7.3). */
export function emptyState(): PmDocumentState {
  const sections = {} as PmDocumentState["sections"];
  for (const s of PM_SECTIONS) sections[s.key] = { title: s.title, content: "" };
  return { sections };
}

export function rowToDocument(row: DocumentRow): PmDocument {
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

export function renderDocument(state: PmDocumentState): string {
  return PM_SECTIONS.map((s) => {
    const sec = state.sections[s.key];
    return `## ${sec?.title ?? s.title}\n${sec?.content?.trim() || "(empty)"}`;
  }).join("\n\n");
}

export async function getDocumentRow(orgId: string, projectId: string): Promise<DocumentRow | undefined> {
  const result = await db.query<DocumentRow>(
    `SELECT * FROM documents WHERE org_id = $1 AND project_id = $2`,
    [orgId, projectId]
  );
  return result.rows[0];
}
