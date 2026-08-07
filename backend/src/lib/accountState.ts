import type { AccountStatus, PlanDefinition, Role } from "@shared/types";
import { db } from "../db/database";
import { effectivePlan } from "./plans";

/**
 * Everything a request needs to know about the account behind a token, read
 * once and cached.
 *
 * A JWT is a snapshot: it carries the role the user had when they logged in and
 * stays valid for a week. That is fine until an admin revokes someone or
 * demotes them — without this lookup, the change would not bite until the token
 * expired. So every authenticated request checks the live row, and the cache
 * exists only to keep that from being a database round trip per request.
 */
export interface AccountState {
  userId: string;
  orgId: string;
  role: Role;
  status: AccountStatus;
  statusReason: string | null;
  /** Epoch seconds. Tokens issued at or before this are refused. */
  tokenValidAfter: number;
  plan: PlanDefinition;
  planStatus: string;
  isBeta: boolean;
}

interface Cached {
  state: AccountState | null;
  readAt: number;
}

const ACCOUNT_TTL_MS = 30_000;
const RELEASE_TTL_MS = 30_000;
const LAST_ACTIVE_THROTTLE_MS = 5 * 60_000;

const accounts = new Map<string, Cached>();
const lastActiveWrites = new Map<string, number>();

let releaseCutoff = { value: 0, readAt: 0 };

function toEpochSeconds(value: string | Date | null): number {
  if (!value) return 0;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

/**
 * The global logout line. Set by publishing a release with force_logout, this
 * is how a deploy ends every session started against the previous build —
 * clients holding a stale bundle are pushed back through login rather than
 * left calling an API that has moved underneath them.
 */
export async function getReleaseCutoff(): Promise<number> {
  const nowMs = Date.now();
  if (nowMs - releaseCutoff.readAt < RELEASE_TTL_MS) return releaseCutoff.value;

  try {
    const result = await db.query<{ released_at: string }>(
      `SELECT released_at FROM app_releases
       WHERE force_logout = TRUE
       ORDER BY released_at DESC
       LIMIT 1`,
    );
    releaseCutoff = { value: toEpochSeconds(result.rows[0]?.released_at ?? null), readAt: nowMs };
  } catch {
    // A missing app_releases table (database not migrated yet) must not lock
    // everyone out — no release on record means no cutoff.
    releaseCutoff = { value: 0, readAt: nowMs };
  }
  return releaseCutoff.value;
}

export function invalidateReleaseCutoff(): void {
  releaseCutoff = { value: 0, readAt: 0 };
}

interface AccountRow {
  id: string;
  org_id: string;
  role: Role;
  status: AccountStatus;
  status_reason: string | null;
  token_valid_after: string | null;
  plan: string | null;
  plan_status: string | null;
  is_beta: boolean | null;
}

export async function getAccountState(userId: string): Promise<AccountState | null> {
  const cached = accounts.get(userId);
  if (cached && Date.now() - cached.readAt < ACCOUNT_TTL_MS) return cached.state;

  const result = await db.query<AccountRow>(
    `SELECT u.id, u.org_id, u.role, u.status, u.status_reason, u.token_valid_after,
            o.plan, o.plan_status, o.is_beta
     FROM users u
     LEFT JOIN organizations o ON o.id = u.org_id
     WHERE u.id = $1`,
    [userId],
  );

  const row = result.rows[0];
  const state: AccountState | null = row
    ? {
        userId: row.id,
        orgId: row.org_id,
        role: row.role,
        status: row.status ?? "active",
        statusReason: row.status_reason,
        tokenValidAfter: toEpochSeconds(row.token_valid_after),
        plan: effectivePlan(row.plan, row.plan_status),
        planStatus: row.plan_status ?? "active",
        isBeta: Boolean(row.is_beta),
      }
    : null;

  accounts.set(userId, { state, readAt: Date.now() });
  return state;
}

/** Call after any write that changes role, status, or the revocation line. */
export function invalidateAccount(userId: string): void {
  accounts.delete(userId);
}

/** Call after a plan change — every member of the org is now stale. */
export function invalidateOrg(orgId: string): void {
  for (const [userId, cached] of accounts) {
    if (cached.state?.orgId === orgId) accounts.delete(userId);
  }
}

export function invalidateAll(): void {
  accounts.clear();
  invalidateReleaseCutoff();
}

/**
 * Cuts every existing session for a user by moving their revocation line to
 * now. Used by revoke, suspend, role change, and password change — each is a
 * case where a token minted a minute ago should stop working.
 */
export async function revokeUserTokens(userId: string): Promise<void> {
  await db.query(`UPDATE users SET token_valid_after = NOW() WHERE id = $1`, [userId]);
  invalidateAccount(userId);
}

/**
 * Best-effort activity stamp for the beta tracker. Throttled per user and
 * never awaited by the request that triggered it — an analytics write must not
 * add latency to, or be able to fail, a real API call.
 */
export function touchLastActive(userId: string): void {
  const last = lastActiveWrites.get(userId) ?? 0;
  if (Date.now() - last < LAST_ACTIVE_THROTTLE_MS) return;

  // The throttle map would otherwise hold one entry per user who has ever hit
  // the API, for the life of the process. Drop entries that are already past
  // the throttle window — they no longer suppress anything.
  if (lastActiveWrites.size > 500) {
    const cutoff = Date.now() - LAST_ACTIVE_THROTTLE_MS;
    for (const [id, at] of lastActiveWrites) {
      if (at < cutoff) lastActiveWrites.delete(id);
    }
  }

  lastActiveWrites.set(userId, Date.now());

  void db
    .query(`UPDATE users SET last_active_at = NOW() WHERE id = $1`, [userId])
    .catch(() => {
      lastActiveWrites.delete(userId);
    });
}
