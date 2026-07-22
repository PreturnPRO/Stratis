import { env } from "../../../backend/src/config/env";
import { fetchWithTimeout, type AIProvider, type ChatMessage, type CompletionResult, type CompleteOptions } from "./types";

export const geminiProvider: AIProvider = {
  name: "gemini",
  async complete(messages: ChatMessage[], opts?: CompleteOptions): Promise<CompletionResult> {
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
          // Gemini 3 models think before answering; default effort runs past
          // AI_TIMEOUT_MS on live-card prompts. Low effort keeps latency
          // inside the live-meeting budget.
          reasoning_effort: "low",
        }),
      },
      opts?.timeoutMs ?? env.ai.timeoutMs
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