import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * One-time codes that hand an account to Stratis Desktop (desktop spec §6).
 *
 * The website asks for one after the person clicks Continue; the app redeems it
 * with the PKCE verifier only it knows. A code is single use and lives sixty
 * seconds in this process's memory — the backend runs as one Render instance,
 * the same assumption the rate limiter makes. A restart inside the minute loses
 * the code, and the person clicks Continue again.
 */

export const CODE_TTL_MS = 60_000;

/** BASE64URL(SHA-256(verifier)) is always 43 characters. */
const CHALLENGE_SHAPE = /^[A-Za-z0-9_-]{43}$/;
/** RFC 7636 §4.1: 43 to 128 characters from the unreserved set. */
const VERIFIER_SHAPE = /^[A-Za-z0-9._~-]{43,128}$/;

interface Pending {
  userId: string;
  challenge: string;
  expiresAt: number;
}

export type Redeemed =
  | { ok: true; userId: string }
  | { ok: false; reason: "unknown" | "expired" | "mismatch" };

export function isChallenge(value: unknown): value is string {
  return typeof value === "string" && CHALLENGE_SHAPE.test(value);
}

export function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export class DesktopCodes {
  private readonly pending = new Map<string, Pending>();
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  issue(userId: string, challenge: string): string {
    this.sweep();
    const code = randomBytes(32).toString("base64url");
    this.pending.set(code, { userId, challenge, expiresAt: this.now() + CODE_TTL_MS });
    return code;
  }

  redeem(code: string, verifier: string): Redeemed {
    const entry = this.pending.get(code);
    // Gone before any check: a code gets exactly one attempt, right or wrong.
    this.pending.delete(code);
    if (!entry) return { ok: false, reason: "unknown" };
    if (this.now() > entry.expiresAt) return { ok: false, reason: "expired" };
    if (!VERIFIER_SHAPE.test(verifier) || !sameText(challengeFor(verifier), entry.challenge)) {
      return { ok: false, reason: "mismatch" };
    }
    return { ok: true, userId: entry.userId };
  }

  get size(): number {
    return this.pending.size;
  }

  private sweep(): void {
    const now = this.now();
    for (const [code, entry] of this.pending) {
      if (entry.expiresAt < now) this.pending.delete(code);
    }
  }
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
