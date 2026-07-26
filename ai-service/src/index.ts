import { env } from "../../backend/src/config/env";
import type {
  AIProvider,
  ChatMessage,
  CompletionResult,
} from "./providers/types";
import { groqProvider } from "./providers/groq";
import { ollamaProvider } from "./providers/ollama";
import { mockProvider } from "./providers/mock";
import { typhoonProvider } from "./providers/typhoon";
import { geminiProvider } from "./providers/gemini";
import {
  SYSTEM_PROMPT_JSON,
  SYSTEM_PROMPT_LIVE_CARD,
  SYSTEM_PROMPT_DOC_PATCH,
  SYSTEM_PROMPT_DECISION_EXTRACT,
  parseStructured,
  parseLiveCard,
  parseDocumentPatch,
  parseDecisionExtract,
  type ParseResult,
  type LiveCardParseResult,
  type DocPatchParseResult,
  type DecisionExtractParseResult,
} from "./schema";
import type {
  AIStructuredResponse,
  LiveCardOutput,
  DocumentPatchOutput,
  DecisionExtractOutput,
} from "../../shared/types";
import { createFence, UNTRUSTED_CONTENT_RULE } from "./untrusted";

export { createFence, UNTRUSTED_CONTENT_RULE } from "./untrusted";

/**
 * Every system prompt carries the untrusted-content rule. Meeting material is
 * fenced in the user message; this is where the model is told what that fence
 * means.
 */
function hardened(systemPrompt: string): string {
  return `${systemPrompt}\n\n${UNTRUSTED_CONTENT_RULE}`;
}

export type { ChatMessage, CompletionResult } from "./providers/types";
export {
  SYSTEM_PROMPT_JSON,
  SYSTEM_PROMPT_LIVE_CARD,
  SYSTEM_PROMPT_DOC_PATCH,
  SYSTEM_PROMPT_DECISION_EXTRACT,
  parseStructured,
  parseLiveCard,
  parseDocumentPatch,
  parseDecisionExtract,
} from "./schema";
export type {
  ParseResult,
  LiveCardParseResult,
  DocPatchParseResult,
  DecisionExtractParseResult,
} from "./schema";

let warnedMockFallback = false;
function mockFallback(wanted: string, missingKey: string): AIProvider {
  if (!warnedMockFallback) {
    warnedMockFallback = true;
    console.error(
      `[ai] AI_PROVIDER=${wanted} but ${missingKey} is not set — every AI call ` +
        `(live cards, summaries, document patches) is being served by the ` +
        `deterministic MOCK provider. Set ${missingKey} on this service to get ` +
        `real model output.`,
    );
  }
  return mockProvider;
}

export function selectProvider(): AIProvider {
  switch (env.ai.provider) {
    case "ollama":
      return ollamaProvider;
    case "mock":
      return mockProvider;
    case "typhoon":
      return env.ai.typhoon.apiKey
        ? typhoonProvider
        : mockFallback("typhoon", "TYPHOON_API_KEY");
    case "gemini":
      return env.ai.gemini.apiKey
        ? geminiProvider
        : mockFallback("gemini", "GEMINI_API_KEY");
    case "groq":
    default:
      return env.ai.groq.apiKey
        ? groqProvider
        : mockFallback("groq", "GROQ_API_KEY");
  }
}

export async function complete(
  messages: ChatMessage[],
): Promise<CompletionResult> {
  const provider = selectProvider();
  return provider.complete(messages);
}

export async function firstCall(): Promise<CompletionResult> {
  const provider = selectProvider();
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "You are Stratis, a concise meeting decision assistant.",
    },
    {
      role: "user",
      content: "Reply with one short sentence confirming you are online.",
    },
  ];

  console.log(`[ai] first call via provider="${provider.name}" model-check…`);
  const result = await provider.complete(messages);
  console.log("[ai] raw response:", JSON.stringify(result.raw, null, 2));
  console.log(`[ai] text: ${result.text}`);
  return result;
}

export async function structuredCall(
  input: string,
): Promise<
  | { ok: true; provider: string; data: AIStructuredResponse; raw: unknown }
  | {
      ok: false;
      provider: string;
      error: string;
      rawText: string;
      raw: unknown;
    }
> {
  const provider = selectProvider();
  const messages: ChatMessage[] = [
    { role: "system", content: hardened(SYSTEM_PROMPT_JSON) },
    { role: "user", content: input },
  ];

  const result = await provider.complete(messages);
  const parsed: ParseResult = parseStructured(result.text);

  if (!parsed.ok) {
    console.warn(`[ai] structured validation failed: ${parsed.error}`);
    return {
      ok: false,
      provider: provider.name,
      error: parsed.error,
      rawText: result.text,
      raw: result.raw,
    };
  }
  return {
    ok: true,
    provider: provider.name,
    data: parsed.data,
    raw: result.raw,
  };
}

export interface LiveContext {
  sessionId: string;
  goal?: string | null;
  brief?: string | null;
  rollingSummary?: string | null;
  surfacedQuestions?: string[];
  recentTranscript: string;
  projectDocument?: string | null;
}

function liveContextPrompt(ctx: LiveContext): string {
  const fence = createFence();
  const sections: string[] = [];

  if (ctx.projectDocument?.trim()) {
    sections.push(
      "Prior project context (from the project's existing PM document — background only; don't re-decide what's already settled here, only build on or revisit it if the transcript explicitly raises it):",
      fence.block("PROJECT DOCUMENT", ctx.projectDocument),
    );
  }

  sections.push(
    fence.block("MEETING GOAL", ctx.goal, "(not provided)"),
    fence.block("AGENDA BRIEF", ctx.brief, "(not provided)"),
    fence.block("ROLLING MEMORY", ctx.rollingSummary, "(empty)"),
    "Questions already surfaced this meeting (open or answered) — never repeat or rephrase any of these:",
    fence.list("SURFACED QUESTIONS", ctx.surfacedQuestions),
    "Recent transcript (most recent last):",
    fence.block("TRANSCRIPT", ctx.recentTranscript, "(silence)"),
  );

  return sections.join("\n\n");
}

export async function liveCardCall(
  ctx: LiveContext,
): Promise<
  | { ok: true; provider: string; data: LiveCardOutput; raw: unknown }
  | {
      ok: false;
      provider: string;
      error: string;
      rawText: string;
      raw: unknown;
    }
> {
  const provider = selectProvider();
  const messages: ChatMessage[] = [
    { role: "system", content: hardened(SYSTEM_PROMPT_LIVE_CARD) },
    { role: "user", content: liveContextPrompt(ctx) },
  ];

  const result = await provider.complete(messages);
  const parsed: LiveCardParseResult = parseLiveCard(result.text);

  if (!parsed.ok) {
    console.warn(`[ai] live card validation failed: ${parsed.error}`);
    return {
      ok: false,
      provider: provider.name,
      error: parsed.error,
      rawText: result.text,
      raw: result.raw,
    };
  }
  return {
    ok: true,
    provider: provider.name,
    data: { ...parsed.data, session_id: ctx.sessionId },
    raw: result.raw,
  };
}

export interface DocPatchContext {
  sessionId: string;
  projectId: string;
  baseVersion: number;
  currentDocument: string;
  transcript: string;
  rollingSummary?: string | null;
}

function docPatchPrompt(ctx: DocPatchContext): string {
  const fence = createFence();
  return [
    `Project: ${ctx.projectId}`,
    `Current PM document (version ${ctx.baseVersion}):`,
    fence.block("CURRENT DOCUMENT", ctx.currentDocument, "(empty — first version)"),
    fence.block("ROLLING MEMORY", ctx.rollingSummary),
    "Meeting transcript:",
    fence.block("TRANSCRIPT", ctx.transcript, "(no transcript)"),
  ].join("\n\n");
}

export async function documentPatchCall(
  ctx: DocPatchContext,
): Promise<
  | { ok: true; provider: string; data: DocumentPatchOutput; raw: unknown }
  | {
      ok: false;
      provider: string;
      error: string;
      rawText: string;
      raw: unknown;
    }
> {
  const provider = selectProvider();
  const messages: ChatMessage[] = [
    { role: "system", content: hardened(SYSTEM_PROMPT_DOC_PATCH) },
    { role: "user", content: docPatchPrompt(ctx) },
  ];

  const result = await provider.complete(messages);
  const parsed: DocPatchParseResult = parseDocumentPatch(result.text);

  if (!parsed.ok) {
    console.warn(`[ai] document patch validation failed: ${parsed.error}`);
    return {
      ok: false,
      provider: provider.name,
      error: parsed.error,
      rawText: result.text,
      raw: result.raw,
    };
  }
  return {
    ok: true,
    provider: provider.name,
    data: {
      ...parsed.data,
      output_type: "document_patch_output",
      session_id: ctx.sessionId,
      project_id: ctx.projectId,
      base_document_version: ctx.baseVersion,
    },
    raw: result.raw,
  };
}

const EXTRACT_TIMEOUT_MS = 90_000;

export interface DecisionExtractContext {
  sessionId: string;
  goal?: string | null;
  transcript: string;
  rollingSummary?: string | null;
  confirmedDecisions?: string[];
}

function decisionExtractPrompt(ctx: DecisionExtractContext): string {
  const fence = createFence();
  const today = new Date().toISOString().slice(0, 10);
  const hasConfirmed = (ctx.confirmedDecisions ?? []).some((d) => d.trim());
  return [
    `Today's date is ${today}. Resolve any spoken date to a full ISO date on or after today.`,
    fence.block("MEETING GOAL", ctx.goal, "(not provided)"),
    fence.block("ROLLING MEMORY", ctx.rollingSummary),
    ...(hasConfirmed
      ? [
          "Decisions ALREADY CONFIRMED by the facilitator — do NOT include these in your output, in any wording:",
          fence.list("CONFIRMED DECISIONS", ctx.confirmedDecisions),
        ]
      : []),
    "Full meeting transcript:",
    fence.block("TRANSCRIPT", ctx.transcript, "(no transcript)"),
  ].join("\n\n");
}

export async function extractDecisionsCall(
  ctx: DecisionExtractContext,
): Promise<
  | { ok: true; provider: string; data: DecisionExtractOutput; raw: unknown }
  | {
      ok: false;
      provider: string;
      error: string;
      rawText: string;
      raw: unknown;
    }
> {
  const provider = selectProvider();
  const messages: ChatMessage[] = [
    { role: "system", content: hardened(SYSTEM_PROMPT_DECISION_EXTRACT) },
    { role: "user", content: decisionExtractPrompt(ctx) },
  ];

  const result = await provider.complete(messages, { timeoutMs: EXTRACT_TIMEOUT_MS });
  const parsed: DecisionExtractParseResult = parseDecisionExtract(result.text);

  if (!parsed.ok) {
    console.warn(`[ai] decision extract validation failed: ${parsed.error}`);
    return {
      ok: false,
      provider: provider.name,
      error: parsed.error,
      rawText: result.text,
      raw: result.raw,
    };
  }
  return {
    ok: true,
    provider: provider.name,
    data: { ...parsed.data, session_id: ctx.sessionId },
    raw: result.raw,
  };
}
