// AI structured-output contract (S1-T03-C).
//
// Goal: the model must return JSON ONLY — no markdown, no prose — matching
// `AIStructuredResponse`. This file owns three things:
//   1. SYSTEM_PROMPT_JSON — instructs the model to emit only that shape.
//   2. parseStructured()   — strips stray fences, JSON.parses, validates.
//   3. helpers the route uses to turn raw model text into typed blocks.
//
// No external validator (zod/ajv) — the repo carries zero extra deps, so the
// check is hand-written and total. Same spirit as the old prototype's
// aiService.parse step, but the shape is locked and validation is strict.
import type {
  AIBlock,
  AIBlockType,
  AIStructuredResponse,
  ChunkSignal,
  LiveCardDTO,
  LiveCardType,
  LiveCardUrgency,
  LiveCardOutput,
  DocumentPatchDTO,
  DocumentPatchOutput,
  PatchOperation,
  PmSectionKey,
  ReviewPriority,
} from "../../shared/types";

const BLOCK_TYPES: readonly AIBlockType[] = [
  "TextBlock",
  "DecisionNode",
  "SummaryBlock",
  "QuestionSuggestion",
];

/** System prompt that forces JSON-only output in the locked shape. */
export const SYSTEM_PROMPT_JSON = `You are Stratis, a meeting decision assistant.
You output STRUCTURED DATA ONLY. Never write markdown, prose, or commentary.

Return EXACTLY one JSON object with this shape and nothing else:

{
  "blocks": [
    {
      "type": "TextBlock" | "DecisionNode" | "SummaryBlock" | "QuestionSuggestion",
      "title": "short label",
      "content": "the block body in plain text",
      "metadata": { "status": "...", "options": ["..."], "priority": "low|med|high" }
    }
  ]
}

Rules:
- Output JSON only. No \`\`\` fences, no leading or trailing text.
- "blocks" must be a non-empty array. Each block needs type, title, content.
- "metadata" is optional; include only fields you actually use.
- Use DecisionNode (with metadata.options) when the room must choose.
- Use QuestionSuggestion to surface the single most useful unanswered question.
- Keep title under 80 chars; keep content tight.`;

/** Result of validating raw model text against the contract. */
export type ParseResult =
  | { ok: true; data: AIStructuredResponse }
  | { ok: false; error: string };

/** Remove markdown code fences the model may add despite instructions. */
function stripFences(raw: string): string {
  return raw.replace(/```(?:json)?/gi, "").trim();
}

/** Narrow an unknown value to a validated AIBlock, or explain why not. */
function validateBlock(value: unknown, index: number): AIBlock | string {
  if (typeof value !== "object" || value === null) {
    return `blocks[${index}] is not an object`;
  }
  const b = value as Record<string, unknown>;

  if (!BLOCK_TYPES.includes(b.type as AIBlockType)) {
    return `blocks[${index}].type "${String(b.type)}" is not one of ${BLOCK_TYPES.join(", ")}`;
  }
  if (typeof b.title !== "string" || b.title.trim() === "") {
    return `blocks[${index}].title must be a non-empty string`;
  }
  if (typeof b.content !== "string" || b.content.trim() === "") {
    return `blocks[${index}].content must be a non-empty string`;
  }
  if (
    b.metadata !== undefined &&
    (typeof b.metadata !== "object" || b.metadata === null || Array.isArray(b.metadata))
  ) {
    return `blocks[${index}].metadata must be an object when present`;
  }

  const block: AIBlock = {
    type: b.type as AIBlockType,
    title: b.title,
    content: b.content,
  };
  if (b.metadata !== undefined) {
    block.metadata = b.metadata as AIBlock["metadata"];
  }
  return block;
}

/**
 * Parse + validate raw model text into the locked structure.
 * Returns a discriminated result — callers must check `ok` before passing on.
 */
export function parseStructured(raw: string): ParseResult {
  const cleaned = stripFences(raw);
  if (cleaned === "") return { ok: false, error: "model returned empty output" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return { ok: false, error: `not valid JSON: ${(err as Error).message}` };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "top-level value must be a JSON object" };
  }

  const root = parsed as Record<string, unknown>;
  if (!Array.isArray(root.blocks)) {
    return { ok: false, error: '"blocks" must be an array' };
  }
  if (root.blocks.length === 0) {
    return { ok: false, error: '"blocks" must not be empty' };
  }

  const blocks: AIBlock[] = [];
  for (let i = 0; i < root.blocks.length; i++) {
    const result = validateBlock(root.blocks[i], i);
    if (typeof result === "string") return { ok: false, error: result };
    blocks.push(result);
  }

  return { ok: true, data: { blocks } };
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE CARD OUTPUT (schema spec §6) — the live meeting gateway.
// ─────────────────────────────────────────────────────────────────────────────

const LIVE_CARD_TYPES: readonly LiveCardType[] = [
  "QUESTION_SUGGESTION",
  "DRIFT_ALERT",
  "MISSING_DECISION",
  "UNRESOLVED_ASSUMPTION",
];
const URGENCIES: readonly LiveCardUrgency[] = ["LOW", "MEDIUM", "HIGH"];
const CHUNK_SIGNALS: readonly ChunkSignal[] = ["IMPORTANT", "LOW_SIGNAL", "IGNORE"];

/** System prompt forcing JSON-only `live_card_output` for the live meeting AI. */
export const SYSTEM_PROMPT_LIVE_CARD = `You are Stratis, a silent AI co-facilitator listening to a live meeting.
You output STRUCTURED DATA ONLY. Never write markdown, prose, or commentary.

You receive the meeting goal, an agenda/brief, a rolling memory of the conversation
so far, the unresolved questions, and the most recent transcript. Classify the
recent transcript and surface facilitator-only cards ONLY when they add value.

Return EXACTLY one JSON object with this shape and nothing else:

{
  "output_type": "live_card_output",
  "chunk_signal": "IMPORTANT" | "LOW_SIGNAL" | "IGNORE",
  "rolling_memory_update": "one-sentence compressed update, or empty string",
  "cards": [
    {
      "card_type": "QUESTION_SUGGESTION" | "DRIFT_ALERT" | "MISSING_DECISION" | "UNRESOLVED_ASSUMPTION",
      "title": "short card title",
      "brief_description": "what you noticed",
      "suggested_question": "the question the facilitator may ask",
      "urgency": "LOW" | "MEDIUM" | "HIGH",
      "reason_now": "why this matters at this moment",
      "confidence": 0.0
    }
  ]
}

Rules:
- Output JSON only. No \`\`\` fences, no leading or trailing text.
- "cards" may be EMPTY ([]) — do not invent friction. Stay silent on minor tangents.
- A preference is not a decision; only flag MISSING_DECISION when the room is closing without an explicit decision.
- "confidence" is 0..1. Keep titles under 80 chars.`;

export type LiveCardParseResult =
  | { ok: true; data: Omit<LiveCardOutput, "session_id"> }
  | { ok: false; error: string };

function validateLiveCard(value: unknown, index: number): LiveCardDTO | string {
  if (typeof value !== "object" || value === null) {
    return `cards[${index}] is not an object`;
  }
  const c = value as Record<string, unknown>;

  if (!LIVE_CARD_TYPES.includes(c.card_type as LiveCardType)) {
    return `cards[${index}].card_type "${String(c.card_type)}" is invalid`;
  }
  if (typeof c.title !== "string" || c.title.trim() === "") {
    return `cards[${index}].title must be a non-empty string`;
  }
  if (typeof c.brief_description !== "string") {
    return `cards[${index}].brief_description must be a string`;
  }
  if (!URGENCIES.includes(c.urgency as LiveCardUrgency)) {
    return `cards[${index}].urgency "${String(c.urgency)}" is invalid`;
  }
  if (
    c.confidence !== undefined &&
    (typeof c.confidence !== "number" || c.confidence < 0 || c.confidence > 1)
  ) {
    return `cards[${index}].confidence must be a number in 0..1`;
  }

  const card: LiveCardDTO = {
    card_type: c.card_type as LiveCardType,
    title: c.title,
    brief_description: c.brief_description,
    urgency: c.urgency as LiveCardUrgency,
  };
  if (typeof c.suggested_question === "string") card.suggested_question = c.suggested_question;
  if (typeof c.reason_now === "string") card.reason_now = c.reason_now;
  if (typeof c.confidence === "number") card.confidence = c.confidence;
  return card;
}

/** Parse + validate raw model text into a `live_card_output` (minus session_id,
 *  which the backend injects). Cards may be empty. */
export function parseLiveCard(raw: string): LiveCardParseResult {
  const cleaned = stripFences(raw);
  if (cleaned === "") return { ok: false, error: "model returned empty output" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return { ok: false, error: `not valid JSON: ${(err as Error).message}` };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "top-level value must be a JSON object" };
  }

  const root = parsed as Record<string, unknown>;
  if (!CHUNK_SIGNALS.includes(root.chunk_signal as ChunkSignal)) {
    return { ok: false, error: `chunk_signal "${String(root.chunk_signal)}" is invalid` };
  }
  if (!Array.isArray(root.cards)) {
    return { ok: false, error: '"cards" must be an array' };
  }

  const cards: LiveCardDTO[] = [];
  for (let i = 0; i < root.cards.length; i++) {
    const result = validateLiveCard(root.cards[i], i);
    if (typeof result === "string") return { ok: false, error: result };
    cards.push(result);
  }

  const rolling =
    typeof root.rolling_memory_update === "string" ? root.rolling_memory_update : "";

  return {
    ok: true,
    data: {
      output_type: "live_card_output",
      chunk_signal: root.chunk_signal as ChunkSignal,
      rolling_memory_update: rolling,
      cards,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT PATCH OUTPUT (schema spec §7) — the post-meeting PM-document gateway.
// ─────────────────────────────────────────────────────────────────────────────

const PATCH_OPERATIONS: readonly PatchOperation[] = [
  "replace_section",
  "append_to_section",
  "insert_section",
];
const PM_SECTION_KEYS: readonly PmSectionKey[] = [
  "project_brief",
  "current_status",
  "current_project_direction",
  "active_risks",
  "key_constraints",
  "context_needed_for_next_meeting",
];
const REVIEW_PRIORITIES: readonly ReviewPriority[] = ["LOW", "MEDIUM", "HIGH"];

/** System prompt forcing JSON-only `document_patch_output` after a meeting. */
export const SYSTEM_PROMPT_DOC_PATCH = `You are Stratis, updating a project's PM document after a meeting.
You output STRUCTURED DATA ONLY. Never write markdown, prose, or commentary.

You receive the current PM document (its sections) and the meeting transcript +
rolling memory. Propose section-based patches that bring the document to the
current project state. The PM document is the source of truth: keep it clean,
professional, and current — not a log of every decision.

Return EXACTLY one JSON object with this shape and nothing else:

{
  "overall_change_summary": "human-readable summary of what changed",
  "patches": [
    {
      "client_patch_id": "patch_1",
      "operation": "replace_section" | "append_to_section" | "insert_section",
      "section_key": "project_brief" | "current_status" | "current_project_direction" | "active_risks" | "key_constraints" | "context_needed_for_next_meeting",
      "section_title": "Human title for the section",
      "new_content": "the markdown content for the section",
      "reason": "why this change, citing the meeting",
      "confidence": 0.0,
      "review_priority": "LOW" | "MEDIUM" | "HIGH"
    }
  ],
  "rejected_suggestions": [
    { "title": "thing considered", "reason_rejected": "why it does not belong in the PM document" }
  ]
}

Rules:
- Output JSON only. No \`\`\` fences, no leading or trailing text.
- If the current PM document is empty / first version (sections show "(empty)"), EVERYTHING is new: you MUST emit a patch for every section the transcript gives you material for. Do not return empty patches for an empty document.
- "patches" may be EMPTY ([]) ONLY when the document already has content and this meeting changed nothing about project state.
- Only patch sections that genuinely changed. Do not restate unchanged sections.
- Put trivial action items that do not affect project state into rejected_suggestions.
- "confidence" is 0..1.`;

export type DocPatchParseResult =
  | {
      ok: true;
      data: Pick<DocumentPatchOutput, "overall_change_summary" | "patches" | "rejected_suggestions">;
    }
  | { ok: false; error: string };

function validatePatch(value: unknown, index: number): DocumentPatchDTO | string {
  if (typeof value !== "object" || value === null) {
    return `patches[${index}] is not an object`;
  }
  const p = value as Record<string, unknown>;

  if (!PATCH_OPERATIONS.includes(p.operation as PatchOperation)) {
    return `patches[${index}].operation "${String(p.operation)}" is invalid`;
  }
  if (!PM_SECTION_KEYS.includes(p.section_key as PmSectionKey)) {
    return `patches[${index}].section_key "${String(p.section_key)}" is invalid`;
  }
  if (typeof p.new_content !== "string" || p.new_content.trim() === "") {
    return `patches[${index}].new_content must be a non-empty string`;
  }
  if (
    p.confidence !== undefined &&
    (typeof p.confidence !== "number" || p.confidence < 0 || p.confidence > 1)
  ) {
    return `patches[${index}].confidence must be a number in 0..1`;
  }

  const patch: DocumentPatchDTO = {
    client_patch_id: typeof p.client_patch_id === "string" ? p.client_patch_id : `patch_${index + 1}`,
    operation: p.operation as PatchOperation,
    section_key: p.section_key as PmSectionKey,
    section_title: typeof p.section_title === "string" ? p.section_title : "",
    new_content: p.new_content,
  };
  if (typeof p.reason === "string") patch.reason = p.reason;
  if (typeof p.confidence === "number") patch.confidence = p.confidence;
  if (REVIEW_PRIORITIES.includes(p.review_priority as ReviewPriority)) {
    patch.review_priority = p.review_priority as ReviewPriority;
  }
  return patch;
}

/** Parse + validate raw model text into document patches (backend injects
 *  session_id / project_id / base_document_version). Patches may be empty. */
export function parseDocumentPatch(raw: string): DocPatchParseResult {
  const cleaned = stripFences(raw);
  if (cleaned === "") return { ok: false, error: "model returned empty output" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return { ok: false, error: `not valid JSON: ${(err as Error).message}` };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "top-level value must be a JSON object" };
  }

  const root = parsed as Record<string, unknown>;
  if (!Array.isArray(root.patches)) {
    return { ok: false, error: '"patches" must be an array' };
  }

  const patches: DocumentPatchDTO[] = [];
  for (let i = 0; i < root.patches.length; i++) {
    const result = validatePatch(root.patches[i], i);
    if (typeof result === "string") return { ok: false, error: result };
    patches.push(result);
  }

  const rejected: DocumentPatchOutput["rejected_suggestions"] = Array.isArray(root.rejected_suggestions)
    ? (root.rejected_suggestions as unknown[])
        .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
        .map((r) => ({
          title: typeof r.title === "string" ? r.title : "",
          reason_rejected: typeof r.reason_rejected === "string" ? r.reason_rejected : "",
        }))
    : [];

  return {
    ok: true,
    data: {
      overall_change_summary:
        typeof root.overall_change_summary === "string" ? root.overall_change_summary : "",
      patches,
      rejected_suggestions: rejected,
    },
  };
}
