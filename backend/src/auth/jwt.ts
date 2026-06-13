// JWT issue + verify (S1-T00-B).
import jwt from "jsonwebtoken";
import type { Role } from "@shared/types";
import { env } from "../config/env";

export interface JwtClaims {
  sub: string; // user id
  orgId: string;
  role: Role;
}

export function signToken(claims: JwtClaims): string {
  return jwt.sign(claims, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtClaims {
  return jwt.verify(token, env.jwtSecret) as JwtClaims;
}
