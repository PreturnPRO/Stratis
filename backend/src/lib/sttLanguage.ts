
export type MeetingLanguageMode = "mixed" | "th" | "en";

export const MEETING_LANGUAGE_MODES: readonly MeetingLanguageMode[] = ["mixed", "th", "en"];

export const DEFAULT_LANGUAGE_MODE: MeetingLanguageMode = "mixed";

export function isMeetingLanguageMode(value: unknown): value is MeetingLanguageMode {
  return typeof value === "string" && (MEETING_LANGUAGE_MODES as readonly string[]).includes(value);
}

// "en" deliberately EXCLUDES th-TH: that exclusion is the actual fix for Thai
// words being hallucinated into English transcripts (which then poisoned the
// rolling memory and the summary). Multiple codes are what enable Chirp 2's
// code-switching, so a single-language list is a real choice, not an oversight.
export function langCodesFor(mode: MeetingLanguageMode): string[] {
  switch (mode) {
    case "en":
      return ["en-US"];
    case "th":
      return ["th-TH"];
    case "mixed":
    default:
      return ["th-TH", "en-US"];
  }
}

export function resolveLangCodes(value: unknown, fallback: string[]): string[] {
  return isMeetingLanguageMode(value) ? langCodesFor(value) : fallback;
}
