import { Router } from "express";
import bcrypt from "bcryptjs";
import type {
  AccountStatus,
  AuthResponse,
  Role,
  SignupRequest,
  LoginRequest,
  User,
} from "@shared/types";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import { signToken } from "./jwt";
import { requireAuth } from "./middleware";
import { authLimiter } from "../middleware/rateLimit";
import { consumeInviteForSignup, peekWorkspaceInvite } from "../lib/invites";
import { effectivePlan } from "../lib/plans";
import { enforceSeatQuota } from "../lib/entitlements";
import { env } from "../config/env";

export const authRouter = Router();

interface UserRow {
  id: string; org_id: string; email: string; name: string;
  password_hash: string | null; role: Role; created_at: string;
  status?: AccountStatus; status_reason?: string | null;
  auth_provider?: "password" | "google"; avatar_url?: string | null;
}

const toUser = (r: UserRow): User => ({
  id: r.id, orgId: r.org_id, email: r.email, name: r.name,
  role: r.role, createdAt: r.created_at,
  status: r.status ?? "active",
  authProvider: r.auth_provider ?? "password",
  avatarUrl: r.avatar_url ?? null,
});

const VALID_ROLES: Role[] = ["facilitator", "participant", "admin"];

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * One spelling of an address, everywhere. Postgres compares TEXT case- and
 * space-sensitively, so "Owen@x.com " and "owen@x.com" were two accounts on
 * signup and a failed login for the same person afterwards. The admin create
 * path already normalised; these two did not.
 */
const normalizeEmail = (raw: unknown): string =>
  typeof raw === "string" ? raw.trim().toLowerCase() : "";

/**
 * Which sign-in methods this deployment actually has. The login screen reads
 * this instead of hard-coding a Google button that would 503 wherever the
 * OAuth credentials are not set.
 */
authRouter.get("/providers", (_req, res) => {
  res.json({ ok: true, data: { password: true, google: env.google.enabled } });
});

authRouter.post("/signup", authLimiter, async (req, res) => {
  try {
    const { password, name, role, orgName } = (req.body ?? {}) as SignupRequest;
    const email = normalizeEmail((req.body ?? {}).email);
    const inviteToken = typeof (req.body ?? {}).invite === "string" ? req.body.invite : "";

    if (!email || !password || !name) {
      return res.status(400).json({ ok: false, error: "email, password and name are required" });
    }
    if (!EMAIL_SHAPE.test(email)) {
      return res.status(400).json({ ok: false, error: "That does not look like an email address" });
    }
    if (password.length < 8) {
      return res.status(400).json({ ok: false, error: "Use at least 8 characters" });
    }

    const existingResult = await db.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [email]);
    const existing = existingResult.rows[0];

    if (existing) return res.status(409).json({ ok: false, error: "Email already registered" });

    const ts = now();

    // With an invite, the workspace and the role both come from the link — a
    // self-declared `role` in the request body must never be able to grant
    // more than the inviter chose.
    let orgId: string;
    let chosenRole: Role;
    let invitedBy: string | null = null;

    if (inviteToken) {
      const check = await peekWorkspaceInvite(inviteToken);
      if (!check.ok) return res.status(410).json({ ok: false, error: check.reason });

      const orgRow = await db.query<{ plan: string | null; plan_status: string | null; plan_expires_at: string | null }>(
        `SELECT plan, plan_status, plan_expires_at FROM organizations WHERE id = $1`,
        [check.invite.org_id],
      );
      const plan = effectivePlan(orgRow.rows[0]?.plan ?? null, orgRow.rows[0]?.plan_status ?? null, orgRow.rows[0]?.plan_expires_at ?? null);
      const seatError = await enforceSeatQuota(check.invite.org_id, plan);
      if (seatError) return res.status(402).json({ ok: false, error: seatError });

      orgId = check.invite.org_id;
      chosenRole = check.invite.role;
      invitedBy = check.invite.created_by;
    } else {
      chosenRole = role && VALID_ROLES.includes(role) ? role : "facilitator";
      orgId = newId("org");
      await db.query(
        `INSERT INTO organizations (id,name,created_at) VALUES ($1,$2,$3)`,
        [orgId, orgName?.trim() || `${name}'s workspace`, ts]
      );
    }

    const id = newId("usr");
    // Async, not hashSync: bcrypt at cost 10 blocks the event loop for ~100ms,
    // and this process is also streaming meeting audio to STT on the same loop.
    const hash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users (id,org_id,email,name,password_hash,role,created_at,invited_by,last_active_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$7)`,
      [id, orgId, email, name, hash, chosenRole, ts, invitedBy]
    );

    if (inviteToken) await consumeInviteForSignup(inviteToken, id, name);

    const user = toUser({
      id, org_id: orgId, email, name, password_hash: hash, role: chosenRole, created_at: ts,
    });
    const token = signToken({ sub: id, orgId, role: chosenRole });
    const out: AuthResponse = { token, user };
    res.status(201).json({ ok: true, data: out });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ ok: false, error: "Internal server error during signup" });
  }
});

authRouter.post("/login", authLimiter, async (req, res) => {
  try {
    const { password } = (req.body ?? {}) as LoginRequest;
    const email = normalizeEmail((req.body ?? {}).email);
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email and password are required" });
    }

    // LOWER(email) rather than email: accounts created before normalisation —
    // and by the admin path, which always lowercased — must still sign in.
    const queryResult = await db.query(`SELECT * FROM users WHERE LOWER(email) = $1`, [email]);
    const row = queryResult.rows[0] as UserRow | undefined;

    // A Google-only account has no password hash. Comparing against an empty
    // string would be a slow no, so answer it as what it is: the wrong door.
    if (row && !row.password_hash) {
      return res.status(409).json({
        ok: false,
        error: "This account signs in with Google",
        data: { useGoogle: true },
      });
    }

    if (!row || !(await bcrypt.compare(password, row.password_hash!))) {
      return res.status(401).json({ ok: false, error: "Invalid email or password" });
    }

    if (row.status === "revoked" || row.status === "suspended") {
      return res.status(403).json({
        ok: false,
        error: row.status_reason || `This account is ${row.status}`,
      });
    }

    await db.query(`UPDATE users SET last_active_at = $1 WHERE id = $2`, [now(), row.id]);

    const token = signToken({ sub: row.id, orgId: row.org_id, role: row.role });
    const out: AuthResponse = { token, user: toUser(row) };
    res.json({ ok: true, data: out });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ ok: false, error: "Internal server error during login" });
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const queryResult = await db.query(`SELECT * FROM users WHERE id = $1`, [req.auth!.sub]);
    const row = queryResult.rows[0] as UserRow | undefined;
    
    if (!row) return res.status(404).json({ ok: false, error: "User not found" });
    res.json({ ok: true, data: toUser(row) });

  } catch (error) {
    console.error("Fetch 'me' error:", error);
    res.status(500).json({ ok: false, error: "Internal server error fetching user data" });
  }
});
