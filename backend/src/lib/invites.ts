import { createHash, randomBytes } from "node:crypto";
import type { InviteKind, InviteRecord, Role } from "@shared/types";
import { db } from "../db/database";
import { env } from "../config/env";
import { newId, now } from "./ids";

export interface InviteRow {
  id: string;
  org_id: string;
  kind: InviteKind;
  token_hash: string;
  role: Role;
  session_id: string | null;
  meeting_id: string | null;
  email: string | null;
  label: string | null;
  allow_guest: boolean;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}

/**
 * Only the hash is ever stored. A leaked database therefore leaks no usable
 * invite links, and the raw token exists in exactly one place: the URL the
 * creator copied.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function inviteUrl(token: string): string {
  return `${env.appUrl}/#/join?token=${encodeURIComponent(token)}`;
}

export function toInviteRecord(row: InviteRow): InviteRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    kind: row.kind,
    role: row.role,
    sessionId: row.session_id,
    meetingId: row.meeting_id,
    email: row.email,
    label: row.label,
    allowGuest: row.allow_guest,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function findInviteByToken(token: string): Promise<InviteRow | undefined> {
  if (!token) return undefined;
  const result = await db.query<InviteRow>(`SELECT * FROM invites WHERE token_hash = $1`, [
    hashToken(token),
  ]);
  return result.rows[0];
}

export type InviteCheck =
  | { ok: true; invite: InviteRow }
  | { ok: false; reason: string };

/**
 * The one place an invite's validity is decided — revoked, expired, and spent
 * are all failures, and every caller gets the same answer with the same wording.
 */
export function checkInvite(row: InviteRow | undefined): InviteCheck {
  if (!row) return { ok: false, reason: "This invite link is not valid" };
  if (row.revoked_at) return { ok: false, reason: "This invite link has been revoked" };
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { ok: false, reason: "This invite link has expired" };
  }
  if (row.max_uses !== null && row.used_count >= row.max_uses) {
    return { ok: false, reason: "This invite link has already been used" };
  }
  return { ok: true, invite: row };
}

export async function peekInvite(token: string): Promise<InviteCheck> {
  return checkInvite(await findInviteByToken(token));
}

export async function peekWorkspaceInvite(token: string): Promise<InviteCheck> {
  const check = await peekInvite(token);
  if (!check.ok) return check;
  if (check.invite.kind !== "workspace") {
    return { ok: false, reason: "This link joins a meeting, not a workspace" };
  }
  return check;
}

/**
 * Records a redemption and advances the use count. Written as one statement per
 * table rather than a transaction because an over-count here costs an extra
 * seat check, while a lost redemption row loses the audit trail.
 */
export async function redeemInvite(input: {
  inviteId: string;
  userId?: string | null;
  guestId?: string | null;
  displayName?: string | null;
}): Promise<void> {
  await db.query(
    `INSERT INTO invite_redemptions (id, invite_id, user_id, guest_id, display_name, redeemed_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      newId("inv_use"),
      input.inviteId,
      input.userId ?? null,
      input.guestId ?? null,
      input.displayName ?? null,
      now(),
    ],
  );
  await db.query(`UPDATE invites SET used_count = used_count + 1 WHERE id = $1`, [input.inviteId]);
}

/** Convenience for the signup paths, which already validated the token. */
export async function consumeInviteForSignup(
  token: string,
  userId: string,
  displayName: string,
): Promise<void> {
  const row = await findInviteByToken(token);
  if (!row) return;
  await redeemInvite({ inviteId: row.id, userId, displayName });
}

export async function createInvite(input: {
  orgId: string;
  kind: InviteKind;
  role: Role;
  sessionId?: string | null;
  meetingId?: string | null;
  email?: string | null;
  label?: string | null;
  allowGuest?: boolean;
  maxUses?: number | null;
  expiresInHours?: number | null;
  createdBy: string;
}): Promise<{ row: InviteRow; token: string }> {
  const token = newInviteToken();
  const id = newId("inv");
  const ts = now();
  const expiresAt = input.expiresInHours
    ? new Date(Date.now() + input.expiresInHours * 3_600_000).toISOString()
    : null;

  await db.query(
    `INSERT INTO invites (id, org_id, kind, token_hash, role, session_id, meeting_id, email,
                          label, allow_guest, max_uses, used_count, expires_at, created_by, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,$14)`,
    [
      id,
      input.orgId,
      input.kind,
      hashToken(token),
      input.role,
      input.sessionId ?? null,
      input.meetingId ?? null,
      input.email ?? null,
      input.label ?? null,
      input.allowGuest ?? false,
      input.maxUses ?? null,
      expiresAt,
      input.createdBy,
      ts,
    ],
  );

  const created = await db.query<InviteRow>(`SELECT * FROM invites WHERE id = $1`, [id]);
  return { row: created.rows[0], token };
}
