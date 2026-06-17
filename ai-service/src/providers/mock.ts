// Mock provider (S1-T03-B) — deterministic, offline, no network. Lets the first
// AI call succeed with zero setup, and keeps CI/tests independent of any key.
import type { AIProvider, ChatMessage, CompletionResult } from "./types";

export const mockProvider: AIProvider = {
  name: "mock",
  async complete(messages: ChatMessage[]): Promise<CompletionResult> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const echo = lastUser?.content?.slice(0, 120) ?? "";

    // Live card gateway (schema spec §6): emit a valid live_card_output so the
    // live pipeline is exercisable offline / in CI with no key.
    const wantsLiveCard = messages.some(
      (m) => m.role === "system" && m.content.includes('"output_type": "live_card_output"')
    );
    if (wantsLiveCard) {
      const text = JSON.stringify({
        output_type: "live_card_output",
        chunk_signal: "IMPORTANT",
        rolling_memory_update: `Mock memory: the team touched on "${echo}".`,
        cards: [
          {
            card_type: "MISSING_DECISION",
            title: "Ownership not assigned",
            brief_description: "The topic was discussed but no owner was named.",
            suggested_question: "Who will own this before the next meeting?",
            urgency: "MEDIUM",
            reason_now: "The conversation appears to be closing without a decision.",
            confidence: 0.7,
          },
        ],
      });
      return { text, provider: "mock", raw: { mock: true, liveCard: true, text } };
    }

    // S1-T03-C: when asked for structured output, emit valid JSON so the
    // parse+validate path is exercisable offline / in CI with no key.
    const wantsJson = messages.some(
      (m) => m.role === "system" && m.content.includes("STRUCTURED DATA ONLY")
    );
    if (wantsJson) {
      const text = JSON.stringify({
        blocks: [
          {
            type: "SummaryBlock",
            title: "Mock summary",
            content: `Mock structured output. Heard: "${echo}".`,
            metadata: { status: "VALIDATED" },
          },
          {
            type: "QuestionSuggestion",
            title: "Set a real provider?",
            content: "Set AI_PROVIDER=groq with GROQ_API_KEY (or run Ollama) for a real model.",
          },
        ],
      });
      return { text, provider: "mock", raw: { mock: true, structured: true, text } };
    }

    const text = `🧪 [mock provider] AI pipeline reachable. Heard: "${echo}". Set AI_PROVIDER=groq with a GROQ_API_KEY (or run Ollama) for a real model.`;
    return {
      text,
      provider: "mock",
      raw: { mock: true, receivedMessages: messages.length, text },
    };
  },
};
