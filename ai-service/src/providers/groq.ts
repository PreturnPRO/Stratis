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
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.1, // precision focus: eliminates formatting drift
          max_tokens: 4096,  // ample token window to prevent JSON structure truncation
          response_format: { type: "json_object" } // hard constraint for json compliance
        }),
      },
      env.ai.timeoutMs
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Groq API error: ${res.status} ${errorText}`);
    }

    const payload = await res.json();
    
    // Bracket-free destructuring safely extracts the first array item
    const [firstChoice] = payload.choices ?? [];
    const text = firstChoice?.message?.content ?? "";
    
    return { text, provider: "groq", raw: payload };
  },
};