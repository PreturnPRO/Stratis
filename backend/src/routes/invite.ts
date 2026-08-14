import { Router } from "express";
import type { InvitePreview, InviteWithLink } from "@shared/types";
import { requireAuth, requireRole } from "../auth/middleware";
import { inviteLimiter } from "../middleware/rateLimit";
import { signGuestToken } from "../auth/jwt";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import {
  checkInvite,
  createInvite,
  findInviteByToken,
  inviteUrl,
  redeemInvite,
  toInviteRecord,
  type GuestRole,
  type InviteRow,
} from "../lib/invites";
import { effectivePlan, hasFeature } from "../lib/plans";
import { invalidateAccount } from "../lib/accountState";
import { track } from "../lib/analytics";

export const inviteRouter = Router();

/**
 * Create a link into one meeting.
 *
 * Workspace links are gone with the workspace: there is nothing to be invited
 * *to* any more. Every link is for a session, and everyone who follows one
 * arrives as a guest of that session — which is why the role is fixed here
 * rather than read from the request.
 */
inviteRouter.post("/", requireAuth, requireRole("facilitator"), async (req, res) => {
  try {
    const kind = "session" as const;
    const role: GuestRole = "participant";

    const plan = req.account!.plan;
    let meetingId: string | null = null;

    if (!hasFeature(plan, "session_invites")) {
      return res.status(402).json({
        ok: false,
        error: `Meeting links are not included in ${plan.name}`,
        data: { feature: "session_invites", plan: plan.id },
      });
    }

    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : null;
    if (!sessionId) {
      return res.status(400).json({ ok: false, error: "sessionId is required" });
    }

    const session = await db.query<{ id: string; meeting_id: string; org_id: string }>(
      `SELECT s.id, s.meeting_id, m.org_id
       FROM sessions s JOIN meetings m ON m.id = s.meeting_id
       WHERE s.id = $1`,
      [sessionId],
    );
    const sessionRow = session.rows[0];
    if (!sessionRow || sessionRow.org_id !== req.auth!.orgId) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }
    meetingId = sessionRow.meeting_id;

    const allowGuest = Boolean(req.body?.allowGuest) && hasFeature(plan, "guest_access");
    if (req.body?.allowGuest && !allowGuest) {
      return res.status(402).json({
        ok: false,
        error: `Guest access is not included in ${plan.name}`,
        data: { feature: "guest_access", plan: plan.id },
      });
    }

    const rawMaxUses = Number(req.body?.maxUses);
    const maxUses = Number.isFinite(rawMaxUses) && rawMaxUses > 0 ? Math.min(Math.floor(rawMaxUses), 500) : null;

    const rawHours = Number(req.body?.expiresInHours);
    const expiresInHours = Number.isFinite(rawHours) && rawHours > 0 ? Math.min(Math.floor(rawHours), 24 * 90) : null;

    const { row, token } = await createInvite({
      orgId: req.auth!.orgId,
      kind,
      role,
      sessionId,
      meetingId,
      email: typeof req.body?.email === "string" ? req.body.email.trim() || null : null,
      label: typeof req.body?.label === "string" ? req.body.label.trim() || null : null,
      allowGuest,
      maxUses,
      expiresInHours,
      createdBy: req.auth!.sub,
    });

    track({
      event: "invite_created",
      orgId: req.auth!.orgId,
      userId: req.auth!.sub,
      sessionId,
      props: { kind, role, allowGuest },
    });

    const out: InviteWithLink = {
      ...toInviteRecord(row),
      token,
      url: inviteUrl(token),
    };
    res.status(201).json({ ok: true, data: { invite: out } });
  } catch (error) {
    console.error("Invite create error:", error);
    res.status(500).json({ ok: false, error: "Could not create the invite link" });
  }
});

inviteRouter.get("/", requireAuth, requireRole("facilitator"), async (req, res) => {
  try {
    const params: unknown[] = [req.auth!.orgId];
    let where = "org_id = $1";

    // You see the links you made. Nobody sees the whole workspace's any more:
    // that was the admin's view, and widening it to every facilitator would
    // hand each of them the others' live join links.
    where += " AND created_by = $2";
    params.push(req.auth!.sub);
    if (typeof req.query.sessionId === "string") {
      params.push(req.query.sessionId);
      where += ` AND session_id = $${params.length}`;
    }

    const result = await db.query<InviteRow>(
      `SELECT * FROM invites WHERE ${where} ORDER BY created_at DESC LIMIT 100`,
      params,
    );
    res.json({ ok: true, data: { invites: result.rows.map(toInviteRecord) } });
  } catch (error) {
    console.error("Invite list error:", error);
    res.status(500).json({ ok: false, error: "Could not load invite links" });
  }
});

inviteRouter.post("/:id/revoke", requireAuth, requireRole("facilitator"), async (req, res) => {
  try {
    const result = await db.query<InviteRow>(`SELECT * FROM invites WHERE id = $1`, [req.params.id]);
    const row = result.rows[0];
    if (!row || row.org_id !== req.auth!.orgId) {
      return res.status(404).json({ ok: false, error: "Invite not found" });
    }
    if (row.created_by !== req.auth!.sub) {
      return res.status(403).json({ ok: false, error: "You cannot revoke this invite" });
    }

    await db.query(`UPDATE invites SET revoked_at = $1 WHERE id = $2`, [now(), row.id]);
    res.json({ ok: true, data: { revoked: true, inviteId: row.id } });
  } catch (error) {
    console.error("Invite revoke error:", error);
    res.status(500).json({ ok: false, error: "Could not revoke the invite" });
  }
});

/**
 * Unauthenticated preview. Deliberately thin: it says what the link is for and
 * whether it still works, and nothing that would leak workspace contents to
 * whoever holds a guessed URL.
 */
inviteRouter.get("/preview/:token", inviteLimiter, async (req, res) => {
  try {
    const row = await findInviteByToken(req.params.token);
    const check = checkInvite(row);

    if (!check.ok) {
      const preview: InvitePreview = {
        kind: "session",
        role: "participant",
        orgName: "",
        meetingTitle: null,
        sessionStatus: null,
        allowGuest: false,
        requiresAccount: true,
        expiresAt: null,
        valid: false,
        reason: check.reason,
      };
      return res.json({ ok: true, data: { preview } });
    }

    const invite = check.invite;
    const org = await db.query<{ name: string }>(`SELECT name FROM organizations WHERE id = $1`, [
      invite.org_id,
    ]);

    let meetingTitle: string | null = null;
    let sessionStatus: InvitePreview["sessionStatus"] = null;
    if (invite.session_id) {
      const session = await db.query<{ status: InvitePreview["sessionStatus"]; title: string }>(
        `SELECT s.status, m.title
         FROM sessions s JOIN meetings m ON m.id = s.meeting_id
         WHERE s.id = $1`,
        [invite.session_id],
      );
      meetingTitle = session.rows[0]?.title ?? null;
      sessionStatus = session.rows[0]?.status ?? null;
    }

    const preview: InvitePreview = {
      kind: invite.kind,
      role: invite.role,
      orgName: org.rows[0]?.name ?? "a Stratis workspace",
      meetingTitle,
      sessionStatus,
      allowGuest: invite.allow_guest,
      requiresAccount: !invite.allow_guest,
      expiresAt: invite.expires_at,
      valid: true,
    };
    res.json({ ok: true, data: { preview } });
  } catch (error) {
    console.error("Invite preview error:", error);
    res.status(500).json({ ok: false, error: "Could not read that invite link" });
  }
});

/**
 * Accept as a signed-in account.
 *
 * A workspace invite moves the user into the inviting org. That is a real
 * change of data ownership, so it is refused for anyone who already belongs to
 * a workspace with content in it — those users have to be handled by hand
 * rather than silently detached from their own meetings.
 */
inviteRouter.post("/:token/accept", requireAuth, async (req, res) => {
  try {
    const row = await findInviteByToken(req.params.token);
    const check = checkInvite(row);
    if (!check.ok) return res.status(410).json({ ok: false, error: check.reason });

    const invite = check.invite;
    const userId = req.auth!.sub;

    if (invite.kind === "session") {
      if (!invite.session_id) {
        return res.status(409).json({ ok: false, error: "This session invite is incomplete" });
      }

      const existing = await db.query(
        `SELECT id FROM session_participants WHERE session_id = $1 AND user_id = $2`,
        [invite.session_id, userId],
      );

      if (existing.rows.length === 0) {
        const user = await db.query<{ name: string }>(`SELECT name FROM users WHERE id = $1`, [userId]);
        await db.query(
          `INSERT INTO session_participants (id, session_id, user_id, display_name, role, joined_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            newId("sp"),
            invite.session_id,
            userId,
            user.rows[0]?.name ?? "Participant",
            invite.role,
            now(),
          ],
        );
        await redeemInvite({ inviteId: invite.id, userId });
      }

      track({
        event: "invite_accepted",
        orgId: invite.org_id,
        userId,
        sessionId: invite.session_id,
        props: { kind: "session" },
      });

      return res.json({
        ok: true,
        data: { kind: "session", sessionId: invite.session_id, meetingId: invite.meeting_id },
      });
    }

  } catch (error) {
    console.error("Invite accept error:", error);
    res.status(500).json({ ok: false, error: "Could not accept that invite" });
  }
});

/**
 * Join a session as a guest — no account, no org membership.
 *
 * The returned token is scoped to one session and expires in hours, not days.
 * A guest is not a user row on purpose: they cannot be granted a role, cannot
 * appear in the workspace, and cannot outlive the meeting they were invited to.
 */
inviteRouter.post("/:token/guest", inviteLimiter, async (req, res) => {
  try {
    const row = await findInviteByToken(req.params.token);
    const check = checkInvite(row);
    if (!check.ok) return res.status(410).json({ ok: false, error: check.reason });

    const invite = check.invite;
    if (invite.kind !== "session" || !invite.session_id) {
      return res.status(400).json({ ok: false, error: "This link does not open a meeting" });
    }
    if (!invite.allow_guest) {
      return res.status(403).json({
        ok: false,
        error: "This meeting requires a Stratis account",
        data: { requiresAccount: true },
      });
    }

    const displayName =
      typeof req.body?.name === "string" && req.body.name.trim()
        ? req.body.name.trim().slice(0, 60)
        : "";
    if (!displayName) return res.status(400).json({ ok: false, error: "Please enter your name" });

    const guestId = newId("gst");
    const ts = now();

    await db.query(
      `INSERT INTO session_guests (id, session_id, invite_id, display_name, email, created_at, last_seen_at)
       VALUES ($1,$2,$3,$4,$5,$6,$6)`,
      [
        guestId,
        invite.session_id,
        invite.id,
        displayName,
        typeof req.body?.email === "string" ? req.body.email.trim() || null : null,
        ts,
      ],
    );

    await db.query(
      `INSERT INTO session_participants (id, session_id, guest_id, display_name, role, joined_at)
       VALUES ($1,$2,$3,$4,'guest',$5)`,
      [newId("sp"), invite.session_id, guestId, displayName, ts],
    );

    await redeemInvite({ inviteId: invite.id, guestId, displayName });

    track({
      event: "guest_joined",
      orgId: invite.org_id,
      guestId,
      sessionId: invite.session_id,
    });

    const token = signGuestToken({
      sub: guestId,
      sessionId: invite.session_id,
      name: displayName,
    });

    res.status(201).json({
      ok: true,
      data: {
        guest: { guestId, sessionId: invite.session_id, displayName, token },
      },
    });
  } catch (error) {
    console.error("Guest join error:", error);
    res.status(500).json({ ok: false, error: "Could not join as a guest" });
  }
});
