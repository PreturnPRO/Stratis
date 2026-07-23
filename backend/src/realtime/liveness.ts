// Per-session liveness signals for the meeting-reliability sweeper.
//
// markAudio() is called by the hub on each inbound audio frame; lastAudioAt()
// + isSessionStale() are read by sessionSweeper.ts to auto-end sessions that
// were abandoned without pressing End (spec component 3). Facilitator socket
// presence is owned by hub.ts and passed in as facilitatorCount — this module
// deliberately does not import the hub, keeping the dependency one-way.

const lastAudio = new Map<string, number>();

export function markAudio(sessionId: string, at: number = Date.now()): void {
  lastAudio.set(sessionId, at);
}

export function lastAudioAt(sessionId: string): number | null {
  return lastAudio.get(sessionId) ?? null;
}

export function forgetSession(sessionId: string): void {
  lastAudio.delete(sessionId);
}

export interface StaleInput {
  /** Live facilitator WebSocket connections for the session. */
  facilitatorCount: number;
  /** Last inbound audio frame time (ms), or null if none received. */
  lastAudioAt: number | null;
  /** Session started_at/created_at (ms), the fallback when no audio yet. */
  startedAt: number | null;
  now: number;
  idleLimitMs: number;
}

/**
 * A session is stale (safe to auto-end) when no facilitator socket is connected
 * AND it has been quiet past the idle limit. "Quiet" is measured from the last
 * audio frame, or — before any audio — from when the session started, so a
 * just-started session awaiting its socket is never killed. With no basis to
 * judge (no audio, no start time) we leave it alone.
 */
export function isSessionStale(input: StaleInput): boolean {
  if (input.facilitatorCount > 0) return false;
  const reference = input.lastAudioAt ?? input.startedAt;
  if (reference === null) return false;
  return input.now - reference > input.idleLimitMs;
}
