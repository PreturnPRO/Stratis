/**
 * Whether a guest link may still be used, decided from the session row alone.
 *
 * Pulled out of `requireGuest` so it can be tested without a database or an
 * Express request. The rule it encodes is the one that was missing entirely: a
 * guest token lives 12 hours, the decision record keeps changing after the
 * meeting, and revoking a room code used to do nothing to the tokens it had
 * already produced.
 */

export interface GuestSessionRow {
  /** The session the token names. */
  status: "created" | "active" | "ended";
  /** True when every invite for this session has been revoked. */
  revoked: boolean;
}

export type GuestDecision =
  | { allow: true }
  | { allow: false; status: number; error: string };

export function decideGuestAccess(row: GuestSessionRow | undefined): GuestDecision {
  // The session is gone — deleted, or a token for something that never
  // existed. Same answer as an unknown link.
  if (!row) {
    return { allow: false, status: 401, error: "That meeting is no longer available" };
  }

  // Revocation is checked before the meeting's own state, because "the
  // organiser took this away" is the more useful thing to be told: an ended
  // meeting is expected, a withdrawn room is not.
  if (row.revoked) {
    return { allow: false, status: 401, error: "The organiser closed this room" };
  }

  // 410 rather than 401: the link was fine, the meeting is over. The room
  // screen uses that difference to stop polling and keep the last decisions on
  // screen instead of blanking them.
  if (row.status === "ended") {
    return { allow: false, status: 410, error: "This meeting has ended" };
  }

  return { allow: true };
}
