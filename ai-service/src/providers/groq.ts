// Groq provider (S1-T03-B) — free hosted Llama 3.3 70B via the OpenAI-compatible
// chat completions endpoint. Uses native fetch (Node 18+), no SDK dependency.
import { env } from "../../../backend/src/config/env";
import { fetchWithTimeout, type AIProvider, type ChatMessage, type CompletionResult } from "./types";

export const groqProvider: AIProvider = {
  name: "groq",
  async complete(messages: ChatMessage[]): Promise<CompletionResult> {
    const { apiKey, model, baseUrl } = env.ai.groq;
    if (!apiKey) throw new Error("GROQ_API_KEY is not set");

    const res = await fetchWithTimeout(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, temperature: 0.4 }),
      },
      env.ai.timeoutMs
    );

    const raw: any = await res.json();
    if (!res.ok) {
      throw new Error(`Groq error ${res.status}: ${JSON.stringify(raw)}`);
    }
    const text: string = raw?.choices?.[0]?.message?.content ?? "";
    return { text, provider: "groq", raw };
  },
};
