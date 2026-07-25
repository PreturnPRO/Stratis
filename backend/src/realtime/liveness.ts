
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
  facilitatorCount: number;
  lastAudioAt: number | null;
  startedAt: number | null;
  now: number;
  idleLimitMs: number;
}

export function isSessionStale(input: StaleInput): boolean {
  if (input.facilitatorCount > 0) return false;
  const reference = input.lastAudioAt ?? input.startedAt;
  if (reference === null) return false;
  return input.now - reference > input.idleLimitMs;
}
