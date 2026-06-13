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
import { SYSTEM_PROMPT_JSON, parseStructured, type ParseResult } from "./schema";
import type { AIStructuredResponse } from "../../shared/types";

export type { ChatMessage, CompletionResult } from "./providers/types";
export { SYSTEM_PROMPT_JSON, parseStructured } from "./schema";
export type { ParseResult } from "./schema";

/** Pick the active provider. groq with no key falls back to mock so the call
 *  always confirms. */
export function selectProvider(): AIProvider {
  switch (env.ai.provider) {
    case "ollama":
      return ollamaProvider;
    case "mock":
      return mockProvider;
    case "groq":
    default:
      return env.ai.groq.apiKey ? groqProvider : mockProvider;
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
