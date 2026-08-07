
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionResult {
  text: string;
  provider: string;
  raw: unknown;
}

export interface CompleteOptions {
  timeoutMs?: number;
}

export interface AIProvider {
  name: string;
  complete(messages: ChatMessage[], opts?: CompleteOptions): Promise<CompletionResult>;
}

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
