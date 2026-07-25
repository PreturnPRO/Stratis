
export interface StreamHealthInput {
  now: number;
  streamStartedAt: number;
  lastDataAt: number | null;
  rotateAfterMs: number;
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
  openingStartedAt: number | null;
  timeoutMs: number;
}

export function isOpenWedged(i: OpenWedgeInput): boolean {
  if (i.openingStartedAt === null) return false;
  return i.now - i.openingStartedAt > i.timeoutMs;
}

export function openBackoffMs(
  consecutiveFailures: number,
  baseMs = 2_000,
  maxMs = 30_000,
): number {
  if (consecutiveFailures <= 0) return 0;
  return Math.min(baseMs * 2 ** (consecutiveFailures - 1), maxMs);
}
