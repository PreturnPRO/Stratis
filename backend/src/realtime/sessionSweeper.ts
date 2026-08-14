
import { db } from "../db/database";
import { endSession } from "../routes/session";
import { facilitatorCount } from "./hub";
import { lastAudioAt, isSessionStale } from "./liveness";

const SWEEP_INTERVAL_MS = 60_000;
const IDLE_LIMIT_MS = 900_000;

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * When this process started listening.
 *
 * Both liveness signals — connected facilitators and last-audio — live in
 * memory, so immediately after a restart every running meeting looks abandoned:
 * no sockets have reconnected yet and no audio has arrived, so the sweeper
 * falls back to started_at and ends a meeting that has been going for forty
 * minutes. The client reconnects three seconds later and keeps streaming into a
 * session the server has already closed, so the rest of the meeting is
 * transcribed to nowhere and the checkpoint was built from half a conversation.
 *
 * So the sweeper stays quiet until clients have had time to come back.
 */
const bootedAt = Date.now();
const GRACE_AFTER_BOOT_MS = Math.max(IDLE_LIMIT_MS, 2 * SWEEP_INTERVAL_MS);

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
  if (now - bootedAt < GRACE_AFTER_BOOT_MS) return;

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
      // Bill to the last moment audio arrived, not to the moment the sweeper
      // noticed. The gap between those is the idle limit plus up to a sweep
      // interval — 16 minutes charged for silence, against a free tier that
      // only has 30.
      const lastHeard = lastAudioAt(row.id);
      await endSession(row.id, lastHeard ? new Date(lastHeard).toISOString() : undefined);
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
