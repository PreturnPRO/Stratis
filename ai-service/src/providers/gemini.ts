import { env } from "../../../backend/src/config/env";
import { fetchWithTimeout, type AIProvider, type ChatMessage, type CompletionResult } from "./types";

export const geminiProvider: AIProvider = {
  name: "gemini",
  async complete(messages: ChatMessage[]): Promise<CompletionResult> {
    const { apiKey, model, baseUrl } = env.ai.gemini;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set in the environment variables.");
    }

    const res = await fetchWithTimeout(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1, // A low temperature is critical to strictly respect our JSON schema guidelines [288]
        }),
      },
      env.ai.timeoutMs
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const payload = await res.json() as any;
    const text = payload.choices?.[0]?.message?.content ?? "";

    return {
      text,
      provider: "gemini",
      raw: payload,
    };
  },
};