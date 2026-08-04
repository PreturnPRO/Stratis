import { Router } from "express";
import { optionalAuth } from "../auth/middleware";
import { track } from "../lib/analytics";

export const trackRouter = Router();

/** Events accepted from the browser. An allowlist, so a stray call or a bored
 *  tester cannot fill the table with arbitrary event names. */
const CLIENT_EVENTS = new Set([
  "app_opened",
  "page_viewed",
  "meeting_created",
  "session_started",
  "session_ended",
  "recording_started",
  "recording_stopped",
  "suggestion_shown",
  "suggestion_answered",
  "suggestion_dismissed",
  "checkpoint_opened",
  "checkpoint_decision_edited",
  "checkpoint_completed",
  "summary_viewed",
  "summary_sent",
  "document_patch_reviewed",
  "invite_link_copied",
  "join_page_viewed",
  "pricing_viewed",
  "upgrade_clicked",
  "settings_changed",
  "profile_updated",
  "feedback_opened",
  "update_reload_prompted",
  "update_reload_accepted",
]);

const MAX_BATCH = 20;

trackRouter.post("/", optionalAuth, (req, res) => {
  const raw = Array.isArray(req.body?.events) ? req.body.events : [req.body];
  const events = raw.slice(0, MAX_BATCH);

  let accepted = 0;
  for (const item of events) {
    const name = typeof item?.event === "string" ? item.event : "";
    if (!CLIENT_EVENTS.has(name)) continue;

    track({
      event: name,
      orgId: req.auth?.orgId ?? null,
      userId: req.auth?.sub ?? null,
      guestId: req.guest?.sub ?? null,
      sessionId:
        typeof item?.sessionId === "string" ? item.sessionId : req.guest?.sessionId ?? null,
      surface: typeof item?.surface === "string" ? item.surface : null,
      props: typeof item?.props === "object" && item.props !== null ? item.props : null,
      appVersion: typeof item?.appVersion === "string" ? item.appVersion : null,
    });
    accepted += 1;
  }

  // 202: the write is queued, not confirmed. The client must never wait on it.
  res.status(202).json({ ok: true, data: { accepted } });
});
