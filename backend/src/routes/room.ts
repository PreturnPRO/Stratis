import { Router } from "express";
import { requireAuth, requireGuest } from "../auth/middleware";
import { signGuestToken } from "../auth/jwt";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import {
  checkInvite,
  ensureSessionRoomCode,
  findInviteByCode,
  redeemInvite,
} from "../lib/invites";
import { getDecisions } from "../lib/decisions";
import { effectivePlan, hasFeature } from "../lib/plans";
import { inviteLimiter } from "../middleware/rateLimit";
import { AUTH_ERROR_CODES } from "@shared/types";

/**
 * The room code flow.
 *
 * A facilitator reads out six characters; everyone else opens the app, types
 * them, gives a name, and sees the same checkpoint the facilitator is looking
 * at. They can tick the decisions that match what they heard and flag the ones
 * that do not, with a note.
 *
 * What they cannot do is edit. The facilitator still owns every word of the
 * decision record — the room's input arrives as a signal beside it, never as a
 * write to it. That is the whole reason this needs no conflict resolution.
 */
export const roomRouter = Router();

interface SessionRow {
  id: string;
  status: "created" | "active" | "ended";
  org_id: string;
  facilitator_id: string;
  meeting_title: string | null;
}

async function sessionForRoom(sessionId: string): Promise<SessionRow | undefined> {
  const result = await db.query<SessionRow>(
    `SELECT s.id, s.status, s.facilitator_id, m.org_id, m.title AS meeting_title
     FROM sessions s
     JOIN meetings m ON m.id = s.meeting_id
     WHERE s.id = $1`,
    [sessionId],
  );
  return result.rows[0];
}

/** Mint (or re-read) the code for a session the caller is running. */
roomRouter.post("/session/:sessionId/code", requireAuth, async (req, res, next) => {
  try {
    const session = await sessionForRoom(req.params.sessionId);
    if (!session) return res.status(404).json({ ok: false, error: "Session not found" });

    if (session.org_id !== req.auth!.orgId) {
      return res.status(403).json({ ok: false, error: "You do not have access to this session" });
    }
    // No admin bypass, matching session/transcript/summary/document. Minting a
    // code for a colleague's meeting was a way to read their decision record
    // through the guest endpoint — the same record the account routes refuse
    // an admin outright.
    if (session.facilitator_id !== req.auth!.sub) {
      return res
        .status(403)
        .json({ ok: false, error: "Only the facilitator can open the room" });
    }
    if (session.status === "ended") {
      return res.status(409).json({ ok: false, error: "This meeting has already ended" });
    }

    // The room code is a session invite that admits guests, so it has to clear
    // the same two gates the invite route clears. Minting it without this check
    // handed every Free workspace the paid guest_access and session_invites
    // features through a different door.
    const orgRow = await db.query<{ plan: string | null; plan_status: string | null; plan_expires_at: string | null }>(
      `SELECT plan, plan_status, plan_expires_at FROM organizations WHERE id = $1`,
      [session.org_id],
    );
    const plan = effectivePlan(orgRow.rows[0]?.plan ?? null, orgRow.rows[0]?.plan_status ?? null, orgRow.rows[0]?.plan_expires_at ?? null);

    for (const feature of ["session_invites", "guest_access"] as const) {
      if (!hasFeature(plan, feature)) {
        return res.status(402).json({
          ok: false,
          error: `Opening the room to participants is not included in ${plan.name}`,
          code: AUTH_ERROR_CODES.planRequired,
          data: { feature, plan: plan.id },
        });
      }
    }

    const { code } = await ensureSessionRoomCode({
      orgId: session.org_id,
      sessionId: session.id,
      createdBy: req.auth!.sub,
    });

    res.json({ ok: true, data: { code } });
  } catch (err) {
    next(err);
  }
});

/**
 * What the room said, for the facilitator running it: a tally per decision and
 * the notes behind every flag. The notes are the point — a count says something
 * is wrong, a note says what.
 */
roomRouter.get("/session/:sessionId/reactions", requireAuth, async (req, res, next) => {
  try {
    const session = await sessionForRoom(req.params.sessionId);
    if (!session) return res.status(404).json({ ok: false, error: "Session not found" });
    if (session.org_id !== req.auth!.orgId) {
      return res.status(403).json({ ok: false, error: "You do not have access to this session" });
    }
    // No admin bypass, matching session/transcript/summary/document. Minting a
    // code for a colleague's meeting was a way to read their decision record
    // through the guest endpoint — the same record the account routes refuse
    // an admin outright.
    if (session.facilitator_id !== req.auth!.sub) {
      return res.status(403).json({ ok: false, error: "Only the facilitator can see this" });
    }

    const rows = await db.query<{
      decision_id: string;
      kind: "agree" | "flag";
      actor_name: string;
      note: string | null;
    }>(
      `SELECT decision_id, kind, actor_name, note
       FROM decision_reactions WHERE session_id = $1 ORDER BY created_at ASC`,
      [req.params.sessionId],
    );

    const byDecision: Record<
      string,
      { agree: number; flag: number; flags: Array<{ name: string; note: string | null }> }
    > = {};

    for (const row of rows.rows) {
      const entry = (byDecision[row.decision_id] ??= { agree: 0, flag: 0, flags: [] });
      entry[row.kind] += 1;
      if (row.kind === "flag") entry.flags.push({ name: row.actor_name, note: row.note });
    }

    res.json({ ok: true, data: { reactions: byDecision } });
  } catch (err) {
    next(err);
  }
});

/**
 * What a code is for, before anyone commits a name to it. Deliberately thin —
 * a guessed code learns the meeting title and nothing else.
 */
roomRouter.get("/:code", inviteLimiter, async (req, res, next) => {
  try {
    const invite = await findInviteByCode(req.params.code);
    const check = checkInvite(invite);
    if (!check.ok) return res.status(410).json({ ok: false, error: check.reason });

    const sessionId = check.invite.session_id;
    if (!sessionId) {
      return res.status(409).json({ ok: false, error: "This code is not attached to a meeting" });
    }

    const session = await sessionForRoom(sessionId);
    if (!session) return res.status(404).json({ ok: false, error: "Meeting not found" });

    res.json({
      ok: true,
      data: {
        meetingTitle: session.meeting_title ?? "Meeting",
        status: session.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Join the room by code. Returns a guest token scoped to this one session. */
roomRouter.post("/:code/join", inviteLimiter, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ ok: false, error: "Tell the room your name first" });
    if (name.length > 60) {
      return res.status(400).json({ ok: false, error: "That name is too long" });
    }

    const invite = await findInviteByCode(req.params.code);
    const check = checkInvite(invite);
    if (!check.ok) return res.status(410).json({ ok: false, error: check.reason });
    if (!check.invite.allow_guest) {
      return res.status(403).json({ ok: false, error: "This code needs an account to join" });
    }

    const sessionId = check.invite.session_id;
    if (!sessionId) {
      return res.status(409).json({ ok: false, error: "This code is not attached to a meeting" });
    }

    const session = await sessionForRoom(sessionId);
    if (!session) return res.status(404).json({ ok: false, error: "Meeting not found" });
    if (session.status === "ended") {
      return res.status(409).json({ ok: false, error: "This meeting has already ended" });
    }

    const guestId = newId("gst");
    await redeemInvite({
      inviteId: check.invite.id,
      guestId,
      displayName: name,
    });

    const token = signGuestToken({ sub: guestId, sessionId, name });

    res.json({
      ok: true,
      data: {
        token,
        sessionId,
        displayName: name,
        meetingTitle: session.meeting_title ?? "Meeting",
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * The room's view of the checkpoint: the decisions, plus this guest's own
 * reaction to each. Read-only — `text`, `owner` and `dueDate` are shown, and
 * nothing here writes them.
 */
roomRouter.get("/session/:sessionId/checkpoint", requireGuest, async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    if (req.guest!.sessionId !== sessionId) {
      return res.status(403).json({ ok: false, error: "This link is for a different meeting" });
    }

    const decisions = (await getDecisions(sessionId)).filter((d) => !d.dismissed);

    const reactions = await db.query<{
      decision_id: string;
      kind: "agree" | "flag";
      actor_id: string;
    }>(`SELECT decision_id, kind, actor_id FROM decision_reactions WHERE session_id = $1`, [
      sessionId,
    ]);

    const tally = new Map<string, { agree: number; flag: number; mine: string | null }>();
    for (const d of decisions) tally.set(d.id, { agree: 0, flag: 0, mine: null });
    for (const r of reactions.rows) {
      const entry = tally.get(r.decision_id);
      if (!entry) continue;
      entry[r.kind] += 1;
      if (r.actor_id === req.guest!.sub) entry.mine = r.kind;
    }

    res.json({
      ok: true,
      data: {
        decisions: decisions.map((d) => ({
          id: d.id,
          text: d.text,
          owner: d.owner,
          dueDate: d.dueDate,
          status: d.status,
          reactions: tally.get(d.id) ?? { agree: 0, flag: 0, mine: null },
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Tick or flag one decision. One reaction per person per decision. */
roomRouter.post("/session/:sessionId/reaction", requireGuest, async (req, res, next) => {
  try {
    const sessionId = req.params.sessionId;
    if (req.guest!.sessionId !== sessionId) {
      return res.status(403).json({ ok: false, error: "This link is for a different meeting" });
    }

    const decisionId = typeof req.body?.decisionId === "string" ? req.body.decisionId : "";
    const kind = req.body?.kind;
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : null;

    if (!decisionId || (kind !== "agree" && kind !== "flag" && kind !== null)) {
      return res
        .status(400)
        .json({ ok: false, error: "decisionId and kind ('agree', 'flag' or null) are required" });
    }

    // The decision has to belong to the session the guest token names, or a
    // guest could react to another meeting's checkpoint by id.
    const owned = await db.query<{ id: string }>(
      `SELECT id FROM decisions WHERE id = $1 AND session_id = $2`,
      [decisionId, sessionId],
    );
    if (owned.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "That decision is not in this meeting" });
    }

    if (kind === null) {
      await db.query(`DELETE FROM decision_reactions WHERE decision_id = $1 AND actor_id = $2`, [
        decisionId,
        req.guest!.sub,
      ]);
      return res.json({ ok: true, data: { decisionId, kind: null } });
    }

    await db.query(
      `INSERT INTO decision_reactions
         (id, decision_id, session_id, actor_id, actor_name, kind, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (decision_id, actor_id)
       DO UPDATE SET kind = EXCLUDED.kind, note = EXCLUDED.note, created_at = EXCLUDED.created_at`,
      [
        newId("rxn"),
        decisionId,
        sessionId,
        req.guest!.sub,
        req.guest!.name,
        kind,
        note,
        now(),
      ],
    );

    res.json({ ok: true, data: { decisionId, kind } });
  } catch (err) {
    next(err);
  }
});
