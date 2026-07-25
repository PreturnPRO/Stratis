
export type MeetingLanguageMode = "mixed" | "th" | "en";

export const MEETING_LANGUAGE_MODES: readonly MeetingLanguageMode[] = ["mixed", "th", "en"];

export const DEFAULT_LANGUAGE_MODE: MeetingLanguageMode = "mixed";

export function isMeetingLanguageMode(value: unknown): value is MeetingLanguageMode {
  return typeof value === "string" && (MEETING_LANGUAGE_MODES as readonly string[]).includes(value);
}

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
