// Auth middleware (S1-T00-B). Protected routes require a valid Bearer token;
// requireRole() additionally gates by role (e.g. facilitator-only actions).
import type { Request, Response, NextFunction } from "express";
import type { Role } from "@shared/types";
import { verifyToken, type JwtClaims } from "./jwt";
import { db } from "../db/database";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: JwtClaims;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ ok: false, error: "Missing auth token" });
  }
  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
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
