import { randomInt } from "node:crypto";
import type { PlanId } from "@shared/types";

/**
 * Beta access codes — the supported way a workspace gets a paid plan.
 *
 * Until now the only route that could change a plan let a workspace admin
 * downgrade to Free, and refused everything else with "only the Stratis team
 * can activate a paid plan" — a sentence with no route behind it. Granting beta
 * access meant editing the database by hand, which is not something to do
 * during a launch week, at night, against production.
 *
 * A code is issued by a platform operator and redeemed by a workspace admin.
 * The split matters: `role = 'admin'` is self-declared at signup, so a
 * workspace admin must never be able to grant themselves a plan — only to
 * redeem something that was handed to them.
 */

/**
 * Same alphabet as the room code: no O/0, I/1/L, S/5, B/8, Z/2. These get read
 * out on a call and typed from a photo of a whiteboard.
 */
const ALPHABET = "ACDEFHJKMNPRTUVWXY34679";
const GROUP = 4;
const GROUPS = 3;

/** e.g. "H7KP-3RNM-XE4A" — long enough not to be guessed, short enough to dictate. */
export function generatePlanCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g += 1) {
    let out = "";
    for (let i = 0; i < GROUP; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(out);
  }
  return groups.join("-");
}

/** People type it with the spacing and casing they saw. */
export function normalisePlanCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export interface PlanCodeRow {
  id: string;
  code: string;
  plan: string;
  label: string | null;
  grant_days: number | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  revoked_at: string | null;
}

export type PlanCodeCheck =
  | { ok: true; row: PlanCodeRow }
  | { ok: false; reason: string };

/**
 * Every reason a code can be refused, in one place, with the wording the person
 * holding the code will read. Deliberately does not distinguish "no such code"
 * from "revoked": a message that confirms a code exists is the first half of
 * guessing one.
 */
export function checkPlanCode(row: PlanCodeRow | undefined, now: Date = new Date()): PlanCodeCheck {
  if (!row) return { ok: false, reason: "That code is not valid" };
  if (row.revoked_at) return { ok: false, reason: "That code is not valid" };

  if (row.expires_at && new Date(row.expires_at) < now) {
    return { ok: false, reason: "That code has expired" };
  }

  if (row.max_uses !== null && row.used_count >= row.max_uses) {
    return { ok: false, reason: "That code has already been used" };
  }

  return { ok: true, row };
}

/** When a grant of `grant_days` redeemed now runs out. NULL means open-ended. */
export function grantExpiry(grantDays: number | null, from: Date = new Date()): string | null {
  if (grantDays === null) return null;
  const end = new Date(from);
  end.setDate(end.getDate() + grantDays);
  return end.toISOString();
}

/** Codes may only hand out plans that exist, and never Free. */
export function isGrantablePlan(plan: unknown): plan is PlanId {
  return plan === "pro" || plan === "beta";
}
