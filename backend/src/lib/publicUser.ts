import type { Role, User } from "@shared/types";

/**
 * The only shape of a user that may leave the server.
 *
 * `SELECT * FROM users` plus `res.json({ user: row })` shipped `password_hash`
 * to the browser — a real bcrypt hash for an existing password account, handed
 * out during the Google sign-in link step, offline-crackable and landing in
 * devtools, any proxy log, and any client error reporter added later. The auth
 * routes had a mapper that stripped it; google.ts did not use it.
 *
 * Written as an explicit field list rather than a delete: a spread minus one
 * key silently starts leaking again the next time a column is added.
 */
export interface PublicUserRow {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
  status?: string | null;
  auth_provider?: string | null;
  avatar_url?: string | null;
}

/** The columns to ask for, so a `SELECT *` never reaches this in the first place. */
export const PUBLIC_USER_COLUMNS =
  "id, org_id, email, name, role, created_at, status, auth_provider, avatar_url";

export function toPublicUser(row: PublicUserRow): User {
  return {
    id: row.id,
    orgId: row.org_id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    status: (row.status ?? "active") as User["status"],
    authProvider: (row.auth_provider ?? "password") as User["authProvider"],
    avatarUrl: row.avatar_url ?? null,
  };
}
