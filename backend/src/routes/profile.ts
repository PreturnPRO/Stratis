import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  DEFAULT_USER_SETTINGS,
  type AccountStatus,
  type AuthProvider,
  type Role,
  type User,
  type UserSettings,
} from "@shared/types";
import { requireAuth } from "../auth/middleware";
import { db } from "../db/database";
import { invalidateAccount, revokeUserTokens } from "../lib/accountState";
import { track } from "../lib/analytics";

export const profileRouter = Router();

interface ProfileRow {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
  status: AccountStatus;
  auth_provider: AuthProvider;
  avatar_url: string | null;
  job_title: string | null;
  bio: string | null;
  timezone: string | null;
  locale: string;
  settings_json: UserSettings | null;
  last_active_at: string | null;
  password_hash: string | null;
}

function toProfile(row: ProfileRow): User {
  return {
    id: row.id,
    orgId: row.org_id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    status: row.status,
    authProvider: row.auth_provider,
    avatarUrl: row.avatar_url,
    jobTitle: row.job_title,
    bio: row.bio,
    timezone: row.timezone,
    locale: row.locale,
    // Defaults are merged server-side so every client sees the same resolved
    // settings and no screen has to know what an unset field means.
    settings: { ...DEFAULT_USER_SETTINGS, ...(row.settings_json ?? {}) },
    lastActiveAt: row.last_active_at,
  };
}

async function readProfile(userId: string): Promise<ProfileRow | undefined> {
  const result = await db.query<ProfileRow>(`SELECT * FROM users WHERE id = $1`, [userId]);
  return result.rows[0];
}

profileRouter.get("/", requireAuth, async (req, res) => {
  try {
    const row = await readProfile(req.auth!.sub);
    if (!row) return res.status(404).json({ ok: false, error: "Account not found" });

    const org = await db.query<{ name: string; plan: string; is_beta: boolean }>(
      `SELECT name, plan, is_beta FROM organizations WHERE id = $1`,
      [row.org_id],
    );

    res.json({
      ok: true,
      data: {
        profile: toProfile(row),
        organization: {
          id: row.org_id,
          name: org.rows[0]?.name ?? "",
          plan: org.rows[0]?.plan ?? "free",
          isBeta: Boolean(org.rows[0]?.is_beta),
        },
        canSetPassword: row.auth_provider === "google" && !row.password_hash,
      },
    });
  } catch (error) {
    console.error("Profile read error:", error);
    res.status(500).json({ ok: false, error: "Could not load your profile" });
  }
});

const MAX_AVATAR_BYTES = 512 * 1024;

/**
 * `avatar_url` accepts an https URL or a small data: URI. There is no file
 * upload service in this build, so an inline image is the honest option — and
 * it is capped, because a megabyte of base64 on every profile read is not.
 */
function validateAvatar(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "avatarUrl must be a string or null" };
  if (value.startsWith("https://")) return { ok: true, value };
  if (value.startsWith("data:image/")) {
    if (value.length > MAX_AVATAR_BYTES) {
      return { ok: false, error: "That image is too large — keep it under 500 KB" };
    }
    return { ok: true, value };
  }
  return { ok: false, error: "avatarUrl must be an https URL or an inline image" };
}

profileRouter.patch("/", requireAuth, async (req, res) => {
  try {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (typeof req.body?.name === "string") {
      const name = req.body.name.trim();
      if (!name) return res.status(400).json({ ok: false, error: "Name cannot be empty" });
      updates.push(`name = $${idx++}`);
      params.push(name.slice(0, 80));
    }

    for (const [field, column, max] of [
      ["jobTitle", "job_title", 80],
      ["bio", "bio", 400],
      ["timezone", "timezone", 60],
      ["locale", "locale", 10],
    ] as const) {
      const value = req.body?.[field];
      if (typeof value === "string" || value === null) {
        updates.push(`${column} = $${idx++}`);
        params.push(typeof value === "string" ? value.trim().slice(0, max) || null : null);
      }
    }

    if ("avatarUrl" in (req.body ?? {})) {
      const avatar = validateAvatar(req.body.avatarUrl);
      if (!avatar.ok) return res.status(400).json({ ok: false, error: avatar.error });
      updates.push(`avatar_url = $${idx++}`);
      params.push(avatar.value);
    }

    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: "No supported fields provided" });
    }

    params.push(req.auth!.sub);
    await db.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}`, params);

    track({ event: "profile_updated", orgId: req.auth!.orgId, userId: req.auth!.sub });

    const row = await readProfile(req.auth!.sub);
    res.json({ ok: true, data: { profile: row ? toProfile(row) : null } });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ ok: false, error: "Could not save your profile" });
  }
});

profileRouter.get("/settings", requireAuth, async (req, res) => {
  try {
    const row = await readProfile(req.auth!.sub);
    if (!row) return res.status(404).json({ ok: false, error: "Account not found" });
    res.json({
      ok: true,
      data: { settings: { ...DEFAULT_USER_SETTINGS, ...(row.settings_json ?? {}) } },
    });
  } catch (error) {
    console.error("Settings read error:", error);
    res.status(500).json({ ok: false, error: "Could not load your settings" });
  }
});

const SETTING_KEYS = Object.keys(DEFAULT_USER_SETTINGS) as (keyof UserSettings)[];

profileRouter.patch("/settings", requireAuth, async (req, res) => {
  try {
    const row = await readProfile(req.auth!.sub);
    if (!row) return res.status(404).json({ ok: false, error: "Account not found" });

    const incoming = (req.body ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...(row.settings_json ?? {}) };

    // Merged against a key allowlist rather than replaced wholesale: a client
    // sending one toggle must not be able to blank the rest, or to store keys
    // nothing reads.
    for (const key of SETTING_KEYS) {
      if (!(key in incoming)) continue;
      const value = incoming[key];
      const expected = typeof DEFAULT_USER_SETTINGS[key];
      if (typeof value !== expected) {
        return res.status(400).json({ ok: false, error: `${key} must be a ${expected}` });
      }
      next[key] = value;
    }

    await db.query(`UPDATE users SET settings_json = $1 WHERE id = $2`, [next, req.auth!.sub]);
    track({
      event: "settings_changed",
      orgId: req.auth!.orgId,
      userId: req.auth!.sub,
      props: { keys: Object.keys(incoming).slice(0, 10) },
    });

    res.json({ ok: true, data: { settings: { ...DEFAULT_USER_SETTINGS, ...next } } });
  } catch (error) {
    console.error("Settings update error:", error);
    res.status(500).json({ ok: false, error: "Could not save your settings" });
  }
});

profileRouter.post("/password", requireAuth, async (req, res) => {
  try {
    const row = await readProfile(req.auth!.sub);
    if (!row) return res.status(404).json({ ok: false, error: "Account not found" });

    const current = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
    const next = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

    if (next.length < 8) {
      return res.status(400).json({ ok: false, error: "Use at least 8 characters" });
    }

    // A Google-only account has no password to confirm — this is the path that
    // adds one, so it must not demand the password that does not exist yet.
    if (row.password_hash) {
      if (!current || !bcrypt.compareSync(current, row.password_hash)) {
        return res.status(403).json({ ok: false, error: "Current password is incorrect" });
      }
    }

    await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      bcrypt.hashSync(next, 10),
      row.id,
    ]);

    // Changing a password ends every other session holding the old one.
    await revokeUserTokens(row.id);
    invalidateAccount(row.id);

    res.json({
      ok: true,
      data: { updated: true, reauthRequired: true },
    });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ ok: false, error: "Could not change your password" });
  }
});
