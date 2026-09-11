/**
 * Whether the microphone is still delivering audio, and what to do when it is not.
 *
 * `usePcmStream` never listened for the track ending, the device going away, or
 * the audio context stopping. A Bluetooth headset switching profile, a USB
 * microphone unplugged, a laptop lid closed — capture ended, the status stayed
 * "streaming", and the header kept saying LIVE over a meeting nobody was
 * hearing.
 *
 * Pure so every transition is testable without a microphone. The hook feeds it
 * events and carries out the action it returns.
 *
 * Recovery never ends a recording. `lost` is shown as lost and stays one press
 * of Try again away: nothing ends a recording except the person who started it.
 */

export type CaptureStatus = "live" | "recovering" | "lost";

/** No frame for this long while live means capture has stopped, whatever the track reports. */
export const WATCHDOG_MS = 5_000;
/** How long a resumed context gets to deliver frames before it is reopened instead. */
export const RESUME_GRACE_MS = 1_000;
/** Waits after the 1st, 2nd, 3rd and 4th failed reopen. */
export const REOPEN_BACKOFF_MS = [1_000, 2_000, 4_000, 4_000] as const;
/** The failure after the last wait is final until someone retries. */
export const MAX_REOPEN_ATTEMPTS = REOPEN_BACKOFF_MS.length + 1;

export interface CaptureHealth {
  status: CaptureStatus;
  /** When the current status — or the current reopen attempt — began. */
  since: number;
  /** Reopen attempts in this recovery. */
  attempts: number;
  /** When the next reopen may start. Null while one runs, or when none is due. */
  nextAttemptAt: number | null;
  reopening: boolean;
}

export type CaptureEvent =
  | { type: "tick"; at: number; lastFrameAt: number }
  | { type: "track-ended"; at: number }
  | { type: "context-suspended"; at: number }
  | { type: "reopen-succeeded"; at: number }
  | { type: "reopen-failed"; at: number }
  | { type: "retry"; at: number };

export type CaptureAction = "none" | "resume-context" | "reopen";

interface Step {
  health: CaptureHealth;
  action: CaptureAction;
}

export function initialHealth(at: number): CaptureHealth {
  return { status: "live", since: at, attempts: 0, nextAttemptAt: null, reopening: false };
}

function beginReopen(at: number, attempts: number): Step {
  return {
    health: { status: "recovering", since: at, attempts, nextAttemptAt: null, reopening: true },
    action: "reopen",
  };
}

export function stepHealth(health: CaptureHealth, event: CaptureEvent): Step {
  const unchanged: Step = { health, action: "none" };

  switch (health.status) {
    case "live": {
      if (event.type === "track-ended") return beginReopen(event.at, 1);
      if (event.type === "context-suspended") {
        return {
          health: {
            status: "recovering",
            since: event.at,
            attempts: 0,
            nextAttemptAt: event.at + RESUME_GRACE_MS,
            reopening: false,
          },
          action: "resume-context",
        };
      }
      if (
        event.type === "tick" &&
        event.at - Math.max(event.lastFrameAt, health.since) > WATCHDOG_MS
      ) {
        return beginReopen(event.at, 1);
      }
      return unchanged;
    }

    case "recovering": {
      if (event.type === "reopen-succeeded") return { health: initialHealth(event.at), action: "none" };
      if (event.type === "reopen-failed") {
        if (health.attempts >= MAX_REOPEN_ATTEMPTS) {
          return {
            health: { ...health, status: "lost", since: event.at, nextAttemptAt: null, reopening: false },
            action: "none",
          };
        }
        return {
          health: {
            ...health,
            reopening: false,
            nextAttemptAt: event.at + REOPEN_BACKOFF_MS[health.attempts - 1],
          },
          action: "none",
        };
      }
      if (event.type === "tick" && !health.reopening) {
        if (event.lastFrameAt > health.since) return { health: initialHealth(event.at), action: "none" };
        if (health.nextAttemptAt !== null && event.at >= health.nextAttemptAt) {
          return beginReopen(event.at, health.attempts + 1);
        }
      }
      return unchanged;
    }

    case "lost":
      return event.type === "retry" ? beginReopen(event.at, 1) : unchanged;
  }
}
