import type { Request, Response, NextFunction } from "express";
import { AUTH_ERROR_CODES, type Role } from "@shared/types";
import { verifyToken, verifyGuestToken, type JwtClaims, type GuestClaims } from "./jwt";
import {
  getAccountState,
  getReleaseCutoff,
  touchLastActive,
  type AccountState,
} from "../lib/accountState";
import { db } from "../db/database";

declare global {
  namespace Express {
    interface Request {
      auth?: JwtClaims;
      /** The live account row behind `auth`, read by requireAuth. */
      account?: AccountState;
      /** Set only by requireGuest / allowGuest, never alongside `auth`. */
      guest?: GuestClaims;
    }
  }
}

/**
 * Authenticates a request and then checks the token against the account as it
 * exists right now. A valid signature is necessary but not sufficient: the
 * account may have been suspended, revoked, or demoted since the token was
 * issued, and a release may have drawn a logout line under every session that
 * predates it.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ ok: false, error: "Missing auth token" });
  }

  let claims: JwtClaims;
  try {
    claims = verifyToken(token);
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }

  try {
    const issuedAt = claims.iat ?? 0;

    const releaseCutoff = await getReleaseCutoff();
    if (releaseCutoff && issuedAt <= releaseCutoff) {
      return res.status(401).json({
        ok: false,
        error: "Stratis has been updated — please sign in again",
        code: AUTH_ERROR_CODES.tokenRevoked,
      });
    }

    const account = await getAccountState(claims.sub);
    if (!account) {
      return res.status(401).json({
        ok: false,
        error: "Your session references an account that no longer exists — please log in again",
      });
    }

    if (account.status === "revoked") {
      return res.status(403).json({
        ok: false,
        error: account.statusReason || "This account has been revoked",
        code: AUTH_ERROR_CODES.accountRevoked,
      });
    }

    if (account.status === "suspended") {
      return res.status(403).json({
        ok: false,
        error: account.statusReason || "This account is suspended",
        code: AUTH_ERROR_CODES.accountSuspended,
      });
    }

    if (account.tokenValidAfter && issuedAt <= account.tokenValidAfter) {
      return res.status(401).json({
        ok: false,
        error: "Your access changed — please sign in again",
        code: AUTH_ERROR_CODES.tokenRevoked,
      });
    }

    // The live row wins over the token's snapshot, so a role change applies to
    // the very next request rather than at token expiry.
    req.auth = { ...claims, role: account.role, orgId: account.orgId };
    req.account = account;
    touchLastActive(account.userId);
    next();
  } catch (error) {
    console.error("[auth] account state check failed:", error);
    return res.status(500).json({ ok: false, error: "Could not verify your session" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ ok: false, error: "Not authenticated" });
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ ok: false, error: "Insufficient role" });
    }
    next();
  };
}

/** Workspace admin only. */
export const requireAdmin = requireRole("admin");

/**
 * Platform operator — the Stratis team, as opposed to a workspace admin, who is
 * a customer and must never see another workspace's data.
 *
 * The identity comes from the database row behind the token, never from the
 * request. An earlier version of this read the actor's email from an
 * `x-actor-email` header, which any caller can set to whatever it likes.
 */
export async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ ok: false, error: "Not authenticated" });

  const allowlist = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length === 0) {
    return res.status(403).json({ ok: false, error: "Platform operators only" });
  }

  try {
    const result = await db.query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [
      req.auth.sub,
    ]);
    const email = result.rows[0]?.email?.toLowerCase();
    if (!email || !allowlist.includes(email)) {
      return res.status(403).json({ ok: false, error: "Platform operators only" });
    }
    next();
  } catch (error) {
    console.error("[auth] platform admin check failed:", error);
    return res.status(500).json({ ok: false, error: "Could not verify your access" });
  }
}

/** Accepts a guest link token. Never sets `req.auth`. */
export function requireGuest(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "Missing guest token" });
  try {
    req.guest = verifyGuestToken(token);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid or expired guest link" });
  }
}

/**
 * Accepts either an account or a guest token, and lets an anonymous request
 * through with neither. Used by telemetry and feedback, where dropping the
 * event is worse than not knowing who sent it.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();

  try {
    const claims = verifyToken(token);
    const account = await getAccountState(claims.sub);
    if (account && account.status === "active") {
      req.auth = { ...claims, role: account.role, orgId: account.orgId };
      req.account = account;
    }
    return next();
  } catch {
    // Not an account token — it may still be a guest link.
  }

  try {
    req.guest = verifyGuestToken(token);
  } catch {
    // Anonymous. Carry on.
  }
  next();
}
