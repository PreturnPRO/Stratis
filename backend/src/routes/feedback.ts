import { Router } from "express";
import type { FeedbackKind } from "@shared/types";
import { optionalAuth } from "../auth/middleware";
import { db } from "../db/database";
import { env } from "../config/env";
import { newId, now } from "../lib/ids";
import { track } from "../lib/analytics";

export const feedbackRouter = Router();

const KINDS: FeedbackKind[] = ["bug", "idea", "praise", "nps", "general"];

/**
 * Beta feedback. Accepts anonymous and guest submissions — the beta team
 * includes people who join by link and never sign in, and their word is worth
 * as much as anyone's.
 */
feedbackRouter.post("/", optionalAuth, async (req, res) => {
  try {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) return res.status(400).json({ ok: false, error: "Tell us what happened" });
    if (message.length > 4000) {
      return res.status(400).json({ ok: false, error: "That is longer than we can store — trim it a little" });
    }

    const kind: FeedbackKind = KINDS.includes(req.body?.kind) ? req.body.kind : "general";

    const rawRating = Number(req.body?.rating);
    const rating = Number.isFinite(rawRating) && rawRating >= 0 && rawRating <= 10 ? Math.round(rawRating) : null;

    const sessionId =
      typeof req.body?.sessionId === "string" ? req.body.sessionId : req.guest?.sessionId ?? null;

    // A guest has no org of their own, so without this their feedback lands
    // with org_id NULL and the admin inbox — which filters by org — never shows
    // it. Derive the workspace from the session they were invited to.
    let orgId = req.auth?.orgId ?? null;
    if (!orgId && sessionId) {
      const owner = await db.query<{ org_id: string }>(
        `SELECT m.org_id FROM sessions s JOIN meetings m ON m.id = s.meeting_id WHERE s.id = $1`,
        [sessionId],
      );
      orgId = owner.rows[0]?.org_id ?? null;
    }

    const id = newId("fb");
    await db.query(
      `INSERT INTO feedback (id, org_id, user_id, session_id, kind, rating, message, surface, app_version, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'new',$10)`,
      [
        id,
        orgId,
        req.auth?.sub ?? null,
        sessionId,
        kind,
        rating,
        message,
        typeof req.body?.surface === "string" ? req.body.surface.slice(0, 60) : null,
        typeof req.body?.appVersion === "string" ? req.body.appVersion.slice(0, 40) : env.appVersion,
        now(),
      ],
    );

    track({
      event: "feedback_opened",
      orgId,
      userId: req.auth?.sub ?? null,
      guestId: req.guest?.sub ?? null,
      props: { kind, hasRating: rating !== null },
    });

    res.status(201).json({ ok: true, data: { id } });
  } catch (error) {
    console.error("Feedback submit error:", error);
    res.status(500).json({ ok: false, error: "Could not send that feedback" });
  }
});
