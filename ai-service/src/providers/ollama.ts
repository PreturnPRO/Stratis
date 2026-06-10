// Ollama provider (S1-T03-B) — fully local, free, and the model you can
// fine-tune yourself later. Talks to a local Ollama server's /api/chat.
import { env } from "../../../backend/src/config/env";
import { fetchWithTimeout, type AIProvider, type ChatMessage, type CompletionResult } from "./types";

export const ollamaProvider: AIProvider = {
  name: "ollama",
  async complete(messages: ChatMessage[]): Promise<CompletionResult> {
    const { baseUrl, model } = env.ai.ollama;
    const res = await fetchWithTimeout(
      `${baseUrl}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: false }),
      },
      env.ai.timeoutMs
    );

    const raw: any = await res.json();
    if (!res.ok) {
      throw new Error(`Ollama error ${res.status}: ${JSON.stringify(raw)}`);
    }
    const text: string = raw?.message?.content ?? "";
    return { text, provider: "ollama", raw };
  },
};
