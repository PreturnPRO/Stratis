// Typhoon provider (S1-T03-B) — OpenTyphoon API using their latest 30B flagship model.
// OpenAI-compatible chat completions endpoint. Uses native fetch (Node 18+).
import { env } from "../../../backend/src/config/env";
import { fetchWithTimeout, type AIProvider, type ChatMessage, type CompletionResult } from "./types";

export const typhoonProvider: AIProvider = {
  name: "typhoon",
  async complete(messages: ChatMessage[]): Promise<CompletionResult> {
    const { apiKey, model, baseUrl } = env.ai.typhoon;
    if (!apiKey) throw new Error("TYPHOON_API_KEY is not set");

    const res = await fetchWithTimeout(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        // OpenTyphoon supports the OpenAI-compatible response_format 
        // to guarantee JSON struct returned without prose wrapping.
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          response_format: { type: "json_object" },
        }),
      },
      env.ai.timeoutMs
    );

    const raw: any = await res.json();
    if (!res.ok) {
      throw new Error(`Typhoon error ${res.status}: ${JSON.stringify(raw)}`);
    }
    const text: string = raw?.choices?.[0]?.message?.content ?? "";
    return { text, provider: "typhoon", raw };
  },
};