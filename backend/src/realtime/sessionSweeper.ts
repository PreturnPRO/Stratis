// Idle-session sweeper (meeting-reliability spec, component 3).
//
// A facilitator who closes the lid without pressing End leaves the session
// 'active' forever: the post-meeting summary never fires and /session/recover
// keeps resurfacing it. This interval finds active sessions with no live
// facilitator socket that have been silent past the idle limit and ends them
// via the same endSession() the manual End route uses.

import { db } from "../db/database";
import { endSession } from "../routes/session";
import { facilitatorCount } from "./hub";
import { lastAudioAt, isSessionStale } from "./liveness";

const SWEEP_INTERVAL_MS = 60_000;
// Deliberately generous so a meeting on a coffee break is never killed.
const IDLE_LIMIT_MS = 900_000; // 15 min

let timer: ReturnType<typeof setInterval> | null = null;

function toMs(value: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

interface ActiveSessionRow {
  id: string;
  started_at: string | null;
  created_at: string | null;
}

async function sweepOnce(now: number = Date.now()): Promise<void> {
  let rows: ActiveSessionRow[];
  try {
    const result = await db.query<ActiveSessionRow>(
      `SELECT id, started_at, created_at FROM sessions WHERE status = 'active'`,
    );
    rows = result.rows;
  } catch (err) {
    console.error("[session:sweeper] Failed to query active sessions:", err);
    return;
  }

  for (const row of rows) {
    const stale = isSessionStale({
      facilitatorCount: facilitatorCount(row.id),
      lastAudioAt: lastAudioAt(row.id),
      startedAt: toMs(row.started_at) ?? toMs(row.created_at),
      now,
      idleLimitMs: IDLE_LIMIT_MS,
    });
    if (!stale) continue;

    try {
      await endSession(row.id);
      console.log(`[session:sweeper] Auto-ended idle session ${row.id}`);
    } catch (err) {
      console.error(`[session:sweeper] Failed to auto-end ${row.id}:`, err);
    }
  }
}

export function startSessionSweeper(): void {
  if (timer) return;
  timer = setInterval(() => {
    void sweepOnce();
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  console.log(
    `[session:sweeper] started (interval ${SWEEP_INTERVAL_MS}ms, idle limit ${IDLE_LIMIT_MS}ms)`,
  );
}

export function stopSessionSweeper(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
