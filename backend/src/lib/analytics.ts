import { db } from "../db/database";
import { env } from "../config/env";
import { newId, now } from "./ids";

export interface TrackInput {
  event: string;
  orgId?: string | null;
  userId?: string | null;
  guestId?: string | null;
  sessionId?: string | null;
  surface?: string | null;
  props?: Record<string, unknown> | null;
  appVersion?: string | null;
}

/**
 * Fire-and-forget event write.
 *
 * Never awaited by the request that produced it and never allowed to throw:
 * telemetry exists to observe the beta, and an analytics failure must never be
 * able to fail a meeting. Errors are logged once and dropped.
 */
export function track(input: TrackInput): void {
  void writeEvent(input).catch((error) => {
    console.warn("[analytics] dropped event:", input.event, error?.message ?? error);
  });
}

/**
 * Cap on what a client may attach to an event. Telemetry must not become a
 * side channel for meeting content, so the payload is size-bounded and the
 * caller is expected to send identifiers and counts, never transcript text.
 */
const MAX_PROPS_BYTES = 2048;

function safeProps(props: Record<string, unknown> | null | undefined) {
  if (!props) return null;
  try {
    const json = JSON.stringify(props);
    if (json.length > MAX_PROPS_BYTES) {
      return { _truncated: true, _bytes: json.length };
    }
    return props;
  } catch {
    return null;
  }
}

export async function writeEvent(input: TrackInput): Promise<void> {
  await db.query(
    `INSERT INTO analytics_events
       (id, org_id, user_id, guest_id, session_id, event, surface, props_json, app_version, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      newId("evt"),
      input.orgId ?? null,
      input.userId ?? null,
      input.guestId ?? null,
      input.sessionId ?? null,
      input.event.slice(0, 80),
      input.surface?.slice(0, 60) ?? null,
      safeProps(input.props),
      input.appVersion ?? env.appVersion,
      now(),
    ],
  );
}
