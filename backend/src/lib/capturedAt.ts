/**
 * When a clip was actually spoken, if the client's word for it can be trusted.
 *
 * Audio held through a dropped connection is uploaded after the reconnect.
 * Saving it at the server's clock would put those words after the lines that
 * followed them. So the client says when the audio was captured, and the server
 * believes it only inside the session — not before it started, not after now.
 * Anything else returns `undefined`, and the caller uses its own clock.
 */
export function clampCapturedAt(
  raw: unknown,
  sessionStartedAt: string | Date | null | undefined,
  nowMs: number,
): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = Date.parse(raw);
  if (!Number.isFinite(t) || t > nowMs) return undefined;
  if (!sessionStartedAt) return undefined;
  const startMs = new Date(sessionStartedAt).getTime();
  if (!Number.isFinite(startMs) || t < startMs) return undefined;
  return new Date(t).toISOString();
}
