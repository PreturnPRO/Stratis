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
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1, // precision focus
          max_tokens: 4096,  // large prediction limit
        }),
      },
      env.ai.timeoutMs
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Typhoon API error: ${res.status} ${errorText}`);
    }

    // Type-assertion cast: satisfies strict compilation parameters by defining the expected envelope shape
    const payload = (await res.json()) as {
      choices?: {
        message?: {
          content?: string;
        };
      }[];
    };
    
    // Bracket-free destructuring safely extracts the first array item
    const [firstChoice] = payload.choices ?? [];
    const text = firstChoice?.message?.content ?? "";
    
    return { text, provider: "typhoon", raw: payload };
  },
};
