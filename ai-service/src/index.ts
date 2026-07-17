// AI service entry (S1-T03-B).
// Selects a provider from env and exposes:
//   - complete(messages) : low-level chat completion
//   - firstCall()        : sends a HARDCODED test prompt, logs the raw response,
//                          and confirms the API integration works.
//
// Scope note: turning responses into validated JSON blocks is S1-T03-C; this
// task only proves we can reach a model and get a response back.
import { env } from "../../backend/src/config/env";
import type { AIProvider, ChatMessage, CompletionResult } from "./providers/types";
import { groqProvider } from "./providers/groq";
import { ollamaProvider } from "./providers/ollama";
import { mockProvider } from "./providers/mock";
import { typhoonProvider } from "./providers/typhoon";
import {
  SYSTEM_PROMPT_JSON,
  SYSTEM_PROMPT_LIVE_CARD,
  SYSTEM_PROMPT_DOC_PATCH,
  parseStructured,
  parseLiveCard,
  parseDocumentPatch,
  type ParseResult,
  type LiveCardParseResult,
  type DocPatchParseResult,
} from "./schema";
import type {
  AIStructuredResponse,
  LiveCardOutput,
  DocumentPatchOutput,
} from "../../shared/types";

export type { ChatMessage, CompletionResult } from "./providers/types";
export {
  SYSTEM_PROMPT_JSON,
  SYSTEM_PROMPT_LIVE_CARD,
  SYSTEM_PROMPT_DOC_PATCH,
  parseStructured,
  parseLiveCard,
  parseDocumentPatch,
} from "./schema";
export type { ParseResult, LiveCardParseResult, DocPatchParseResult } from "./schema";

/** Pick the active provider. Providers with no key fall back to mock so the call
 * always confirms — but the downgrade must be LOUD: silently serving mock
 * cards/summaries in a real meeting reads as "the product is broken". */
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
    case "groq":
    default:
      return env.ai.groq.apiKey
        ? groqProvider
        : mockFallback("groq", "GROQ_API_KEY");
  }
}

export async function complete(messages: ChatMessage[]): Promise<CompletionResult> {
  const provider = selectProvider();
  return provider.complete(messages);
}

/** S1-T03-B: hardcoded test prompt → confirm response → log raw output. */
export async function firstCall(): Promise<CompletionResult> {
  const provider = selectProvider();
  const messages: ChatMessage[] = [
    { role: "system", content: "You are Stratis, a concise meeting decision assistant." },
    { role: "user", content: "Reply with one short sentence confirming you are online." },
  ];

  console.log(`[ai] first call via provider="${provider.name}" model-check…`);
  const result = await provider.complete(messages);
  // Log the RAW provider response, as the task requires.
  console.log("[ai] raw response:", JSON.stringify(result.raw, null, 2));
  console.log(`[ai] text: ${result.text}`);
  return result;
}

/**
 * S1-T03-C: ask the model for JSON-only output, then validate it against the
 * locked schema BEFORE returning. Callers receive a discriminated result and
 * must never pass an unvalidated payload downstream.
 */
export async function structuredCall(input: string): Promise<
  | { ok: true; provider: string; data: AIStructuredResponse; raw: unknown }
  | { ok: false; provider: string; error: string; rawText: string; raw: unknown }
> {
  const provider = selectProvider();
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT_JSON },
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
  return { ok: true, provider: provider.name, data: parsed.data, raw: result.raw };
}

/** Context the live meeting AI receives each chunk (schema spec §6.4). */
export interface LiveContext {
  sessionId: string;
  goal?: string | null;
  brief?: string | null;
  rollingSummary?: string | null;
  // Every question already surfaced to the facilitator this session — open AND
  // answered — so the model never re-raises a gap it has already flagged.
  surfacedQuestions?: string[];
  recentTranscript: string;
  // Rendered PM document from a prior meeting on this project, when this
  // meeting continues an existing project rather than starting fresh.
  projectDocument?: string | null;
}

function liveContextPrompt(ctx: LiveContext): string {
  const surfacedQs = ctx.surfacedQuestions?.length
    ? ctx.surfacedQuestions.map((q) => `- ${q}`).join("\n")
    : "(none)";

  const sections: string[] = [];

  if (ctx.projectDocument?.trim()) {
    sections.push(
      `Prior project context (from the project's existing PM document — background only; don't re-decide what's already settled here, only build on or revisit it if the transcript explicitly raises it):\n${ctx.projectDocument.trim()}`,
    );
  }

  sections.push(
    `Meeting goal: ${ctx.goal?.trim() || "(not provided)"}`,
    `Agenda / brief: ${ctx.brief?.trim() || "(not provided)"}`,
    `Rolling memory so far: ${ctx.rollingSummary?.trim() || "(empty)"}`,
    `Questions already surfaced this meeting (open or answered) — never repeat or rephrase any of these:\n${surfacedQs}`,
    `Recent transcript (most recent last):\n${ctx.recentTranscript.trim() || "(silence)"}`,
  );

  return sections.join("\n\n");
}

/**
 * Live meeting gateway: classify the latest transcript window and surface
 * facilitator cards. Returns a validated `live_card_output` (session_id injected).
 */
export async function liveCardCall(ctx: LiveContext): Promise<
  | { ok: true; provider: string; data: LiveCardOutput; raw: unknown }
  | { ok: false; provider: string; error: string; rawText: string; raw: unknown }
> {
  const provider = selectProvider();
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT_LIVE_CARD },
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

/** Context the post-meeting document AI receives (schema spec §7). */
export interface DocPatchContext {
  sessionId: string;
  projectId: string;
  baseVersion: number;
  currentDocument: string; // rendered current sections, or "(empty)"
  transcript: string;
  rollingSummary?: string | null;
}

function docPatchPrompt(ctx: DocPatchContext): string {
  return [
    `Project: ${ctx.projectId}`,
    `Current PM document (version ${ctx.baseVersion}):\n${ctx.currentDocument.trim() || "(empty — first version)"}`,
    `Rolling memory: ${ctx.rollingSummary?.trim() || "(none)"}`,
    `Meeting transcript:\n${ctx.transcript.trim() || "(no transcript)"}`,
  ].join("\n\n");
}

/**
 * Post-meeting gateway: propose section patches to the PM document. Returns a
 * validated `document_patch_output` (backend injects ids/version). Patches may
 * be empty when the meeting changed nothing about project state.
 */
export async function documentPatchCall(ctx: DocPatchContext): Promise<
  | { ok: true; provider: string; data: DocumentPatchOutput; raw: unknown }
  | { ok: false; provider: string; error: string; rawText: string; raw: unknown }
> {
  const provider = selectProvider();
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT_DOC_PATCH },
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
