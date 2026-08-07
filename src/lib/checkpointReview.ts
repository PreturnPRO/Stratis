/**
 * Which extracted decisions the facilitator has actually laid eyes on.
 *
 * Nothing in the schema records "reviewed" — decisions carry source, dismissed
 * and updated_at, none of which mean a human read the row. This is a
 * meeting-scoped memory of ids seen in the checkpoint panel, kept client-side:
 * it only has to survive a refresh during one ~40 minute session, which is not
 * worth a column.
 */

export interface ReviewableDecision {
  id: string;
  dismissed?: boolean;
}

export function reviewStorageKey(sessionId: string): string {
  return `stratis:checkpoint-seen:${sessionId}`;
}

/** Live decisions the facilitator has not seen in the panel yet. */
export function unreviewedIds(decisions: ReviewableDecision[], seen: string[]): string[] {
  const seenSet = new Set(seen);
  return decisions.filter((d) => !d.dismissed && !seenSet.has(d.id)).map((d) => d.id);
}

export interface InterruptInput {
  /** Live decisions not yet seen in the panel. */
  unreviewed: number;
  /** An extraction is in flight, so "nothing new" cannot be trusted yet. */
  extracting: boolean;
  /** The panel has been opened at least once this session. */
  everOpened: boolean;
}

/**
 * Whether ending the meeting should surface the checkpoint first.
 *
 * Interrupting while extraction is still running is deliberate: that is exactly
 * the case where unseen decisions are seconds away, so skipping would defeat
 * the layer in the moment it matters most. The End action inside the layer is
 * never blocked on that call finishing.
 */
export function shouldInterruptEnd({ unreviewed, extracting, everOpened }: InterruptInput): boolean {
  if (extracting) return true;
  if (!everOpened) return true;
  return unreviewed > 0;
}

export function loadSeen(sessionId: string): string[] {
  try {
    const raw = window.localStorage.getItem(reviewStorageKey(sessionId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function saveSeen(sessionId: string, ids: string[]): void {
  try {
    window.localStorage.setItem(reviewStorageKey(sessionId), JSON.stringify(ids));
  } catch {
    // A full or blocked store must never stop a meeting from ending.
  }
}
