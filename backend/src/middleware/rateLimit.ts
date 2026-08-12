import type { Request, Response, NextFunction } from "express";

/**
 * A fixed-window limiter, in memory, no dependency.
 *
 * The endpoints it guards are the unauthenticated ones — sign-in, sign-up, and
 * the invite links — where the caller is a stranger and one machine can spend
 * the night guessing. In memory is the right scope for now because the backend
 * runs as a single Render instance; if it is ever scaled to more than one, this
 * becomes per-instance and the real limiter belongs at the edge or in Postgres.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

// Without this the map keeps a row per IP for the life of the process.
const SWEEP_INTERVAL_MS = 5 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref();

export interface RateLimitOptions {
  /** Separates the counters of two routes that share an IP. */
  name: string;
  windowMs: number;
  max: number;
  message?: string;
}

export function rateLimit({ name, windowMs, max, message }: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    // req.ip is only trustworthy because index.ts sets `trust proxy` to the one
    // hop Render actually adds.
    const key = `${name}:${req.ip ?? "unknown"}`;
    const now = Date.now();

    let window = windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + windowMs };
      windows.set(key, window);
    }

    window.count += 1;

    if (window.count > max) {
      const retryAfter = Math.ceil((window.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        ok: false,
        error: message ?? "Too many attempts — please wait a moment and try again",
      });
    }

    next();
  };
}

/** Sign-in and sign-up: slow a guessing machine without troubling a typist. */
export const authLimiter = rateLimit({
  name: "auth",
  windowMs: 15 * 60_000,
  max: 30,
  message: "Too many sign-in attempts — please wait a few minutes and try again",
});

/** Invite tokens are unguessable, so this is about the volume of guesses. */
export const inviteLimiter = rateLimit({
  name: "invite",
  windowMs: 15 * 60_000,
  max: 60,
});
