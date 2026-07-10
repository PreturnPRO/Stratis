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
            card_type: "UNRESOLVED_ASSUMPTION",
            title: "Assumption stated as fact",
            brief_description: "A key claim was treated as settled without anything in the discussion confirming it.",
            suggested_question: "What evidence do we have that this holds — and what changes in the plan if it doesn't?",
            urgency: "MEDIUM",
            reason_now: "The next agenda item builds on this assumption.",
            confidence: 0.7,
          },
        ],
      });
      return { text, provider: "mock", raw: { mock: true, liveCard: true, text } };
    }

    // Document patch gateway (schema spec §7): emit a valid document_patch_output.
    const wantsDocPatch = messages.some(
      (m) => m.role === "system" && m.content.includes("PM document after a meeting")
    );
    if (wantsDocPatch) {
      const text = JSON.stringify({
        overall_change_summary: `Mock update from this meeting. Heard: "${echo}".`,
        patches: [
          {
            client_patch_id: "patch_1",
            operation: "replace_section",
            section_key: "current_status",
            section_title: "Current Status",
            new_content: `Updated from the latest meeting. Discussion touched on: ${echo}`,
            reason: "Mock patch — set a real AI provider for genuine document updates.",
            confidence: 0.7,
            review_priority: "MEDIUM",
          },
        ],
        rejected_suggestions: [],
      });
      return { text, provider: "mock", raw: { mock: true, docPatch: true, text } };
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
