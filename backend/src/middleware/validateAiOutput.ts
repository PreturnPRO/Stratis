import type { Request, Response, NextFunction } from "express";
import type {
  AIBlock,
  AIBlockType,
  AIStructuredResponse,
} from "@shared/types";

const BLOCK_TYPES: readonly AIBlockType[] = [
  "TextBlock",
  "DecisionNode",
  "SummaryBlock",
  "QuestionSuggestion",
];

export type AiOutputValidationResult =
  | { ok: true; data: AIStructuredResponse }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateMetadata(
  type: AIBlockType,
  metadata: unknown,
  index: number
): string | null {
  if (metadata === undefined) return null;

  if (!isRecord(metadata)) {
    return `blocks[${index}].metadata must be an object`;
  }

  if (type === "DecisionNode") {
    const options = metadata.options;
    if (
      options !== undefined &&
      (!Array.isArray(options) || options.some((v) => typeof v !== "string"))
    ) {
      return `blocks[${index}].metadata.options must be an array of strings`;
    }
  }

  if (type === "QuestionSuggestion") {
    const priority = metadata.priority;
    if (
      priority !== undefined &&
      priority !== "low" &&
      priority !== "med" &&
      priority !== "high"
    ) {
      return `blocks[${index}].metadata.priority must be low, med, or high`;
    }
  }

  return null;
}

function validateBlock(value: unknown, index: number): AIBlock | string {
  if (!isRecord(value)) return `blocks[${index}] must be an object`;

  const type = value.type;
  const title = value.title;
  const content = value.content;

  if (!BLOCK_TYPES.includes(type as AIBlockType)) {
    return `blocks[${index}].type must be one of ${BLOCK_TYPES.join(", ")}`;
  }

  if (typeof title !== "string" || title.trim() === "") {
    return `blocks[${index}].title must be a non-empty string`;
  }

  if (title.length > 80) {
    return `blocks[${index}].title must be 80 characters or fewer`;
  }

  if (typeof content !== "string" || content.trim() === "") {
    return `blocks[${index}].content must be a non-empty string`;
  }

  const metadataError = validateMetadata(
    type as AIBlockType,
    value.metadata,
    index
  );

  if (metadataError) return metadataError;

  const block: AIBlock = {
    type: type as AIBlockType,
    title,
    content,
  };

  if (value.metadata !== undefined) {
    block.metadata = value.metadata as AIBlock["metadata"];
  }

  return block;
}

export function validateAiOutput(value: unknown): AiOutputValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: "AI output must be a JSON object" };
  }

  if (!Array.isArray(value.blocks)) {
    return { ok: false, error: 'AI output must include "blocks" array' };
  }

  if (value.blocks.length === 0) {
    return { ok: false, error: '"blocks" must not be empty' };
  }

  const blocks: AIBlock[] = [];

  for (let i = 0; i < value.blocks.length; i++) {
    const block = validateBlock(value.blocks[i], i);
    if (typeof block === "string") {
      return { ok: false, error: block };
    }
    blocks.push(block);
  }

  return { ok: true, data: { blocks } };
}

/**
 * Express middleware for routes that receive AI output in req.body.output.
 * Useful for tests/admin/debug routes.
 */
export function validateAiOutputMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const result = validateAiOutput(req.body?.output ?? req.body);

  if (!result.ok) {
    return res.status(422).json({
      ok: false,
      error: `AI output failed validation: ${result.error}`,
    });
  }

  res.locals.aiOutput = result.data;
  next();
}