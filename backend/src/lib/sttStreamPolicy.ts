// Pure lifecycle policy for the streaming STT gRPC stream (sttStream.ts).
// Extracted (liveness.ts pattern) so the wedge/rotation rules are unit-testable
// without touching the Google client.
//
// Why this exists: a mid-meeting stream can die silently — a hung open attempt,
// or a stream that stays "open" but never yields results — while PCM frames keep
// flowing. Before this policy the only recovery was the facilitator toggling the
// mic (hub stt:stop/stt:start builds a fresh handle). These rules automate that.

export interface StreamHealthInput {
  now: number;
  /** When the current gRPC stream was opened. */
  streamStartedAt: number;
  /** Last interim/final result from Google on this stream; null = none yet. */
  lastDataAt: number | null;
  /** Proactive age rotation (Google hard-closes at ~305s). */
  rotateAfterMs: number;
  /** Frames flowing but zero results for this long → assume the stream is dead.
   * Rotating a healthy-but-silent-room stream is harmless: nothing is buffered
   * mid-utterance in silence, and the next write reopens immediately. */
  stallAfterMs: number;
}

export type StreamAction = "keep" | "rotate";

export function streamAction(i: StreamHealthInput): StreamAction {
  if (i.now - i.streamStartedAt > i.rotateAfterMs) return "rotate";
  const lastSignOfLife = i.lastDataAt ?? i.streamStartedAt;
  if (i.now - lastSignOfLife > i.stallAfterMs) return "rotate";
  return "keep";
}

export interface OpenWedgeInput {
  now: number;
  /** When the in-flight open attempt started; null = no attempt in flight. */
  openingStartedAt: number | null;
  timeoutMs: number;
}

/** True when a single-flight open attempt has hung past its budget and must be
 * abandoned (drop the promise, let the next write start a fresh attempt). */
export function isOpenWedged(i: OpenWedgeInput): boolean {
  if (i.openingStartedAt === null) return false;
  return i.now - i.openingStartedAt > i.timeoutMs;
}

/** Exponential backoff between reopen attempts after consecutive failures, so
 * a quota/outage blip is retried without hammering Google. */
export function openBackoffMs(
  consecutiveFailures: number,
  baseMs = 2_000,
  maxMs = 30_000,
): number {
  if (consecutiveFailures <= 0) return 0;
  return Math.min(baseMs * 2 ** (consecutiveFailures - 1), maxMs);
}
