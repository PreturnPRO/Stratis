import jwt from "jsonwebtoken";
import type { Role } from "@shared/types";
import { env } from "../config/env";

export interface JwtClaims {
  sub: string;
  orgId: string;
  role: Role;
  /** Issued-at, epoch seconds. Set by jsonwebtoken; present on every verified token. */
  iat?: number;
  exp?: number;
}

/**
 * A link-only participant. Deliberately a different shape from JwtClaims — a
 * guest has no org, no role, and no user row, and `kind` is what stops one
 * being mistaken for an account anywhere downstream.
 */
export interface GuestClaims {
  sub: string;
  sessionId: string;
  kind: "guest";
  name: string;
  iat?: number;
  exp?: number;
}

export type AnyClaims = JwtClaims | GuestClaims;

export function isGuestClaims(claims: AnyClaims): claims is GuestClaims {
  return (claims as GuestClaims).kind === "guest";
}

export function signToken(claims: JwtClaims): string {
  return jwt.sign(claims, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtClaims {
  const claims = jwt.verify(token, env.jwtSecret) as AnyClaims;
  if (isGuestClaims(claims)) {
    throw new Error("Guest token used where an account token is required");
  }
  return claims;
}

/** Guest tokens are short-lived on purpose — they outlive one meeting, not a week. */
export function signGuestToken(claims: Omit<GuestClaims, "kind">): string {
  return jwt.sign({ ...claims, kind: "guest" }, env.jwtSecret, {
    expiresIn: env.guestTokenExpiresIn,
  } as jwt.SignOptions);
}

export function verifyGuestToken(token: string): GuestClaims {
  const claims = jwt.verify(token, env.jwtSecret) as AnyClaims;
  if (!isGuestClaims(claims)) {
    throw new Error("Account token used where a guest token is required");
  }
  return claims;
}

/** Verifies either kind. Callers must branch on `isGuestClaims`. */
export function verifyAnyToken(token: string): AnyClaims {
  return jwt.verify(token, env.jwtSecret) as AnyClaims;
}
