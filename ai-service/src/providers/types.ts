// Provider abstraction (S1-T03-B). A provider turns chat messages into a raw
// text completion. Keeping this interface tiny lets us swap Groq (free hosted),
// Ollama (local + fine-tunable), or a mock without touching callers.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionResult {
  /** Raw text returned by the model. */
  text: string;
  /** Which provider produced it (for logging). */
  provider: string;
  /** Full untouched provider response (logged in S1-T03-B). */
  raw: unknown;
}

export interface AIProvider {
  name: string;
  complete(messages: ChatMessage[]): Promise<CompletionResult>;
}

/** fetch with an abort-based timeout so a hung provider can't block forever. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}
