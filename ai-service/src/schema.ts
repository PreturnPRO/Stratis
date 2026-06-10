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
