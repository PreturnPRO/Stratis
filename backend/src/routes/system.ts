import { Router } from "express";
import type { ReleaseInfo } from "@shared/types";
import { env } from "../config/env";
import { db } from "../db/database";
import { getReleaseCutoff } from "../lib/accountState";

export const systemRouter = Router();

/**
 * What the client polls to notice a deploy.
 *
 * Two separate signals: `version` changing means the browser is running an old
 * bundle and should reload, and `minTokenIssuedAt` moving past a token's `iat`
 * means that session is already dead server-side. The client acts on the first
 * with a prompt and on the second by sending the user back to sign-in.
 *
 * Unauthenticated on purpose — a client that has just been logged out by a
 * release still needs to read it.
 */
systemRouter.get("/version", async (_req, res) => {
  try {
    const latest = await db.query<{ version: string; released_at: string; notes: string | null }>(
      `SELECT version, released_at, notes FROM app_releases ORDER BY released_at DESC LIMIT 1`,
    );

    const info: ReleaseInfo = {
      // The running build wins over the release row: what the server is
      // actually serving is what the client must match.
      version: env.appVersion,
      releasedAt: latest.rows[0]?.released_at ?? null,
      notes: latest.rows[0]?.notes ?? null,
      minTokenIssuedAt: await getReleaseCutoff(),
    };

    res.set("Cache-Control", "no-store");
    res.json({ ok: true, data: info });
  } catch (error) {
    console.error("Version read error:", error);
    // Never fail this route: a client that cannot read the version should keep
    // working, not stall behind an update check.
    res.json({
      ok: true,
      data: { version: env.appVersion, releasedAt: null, notes: null, minTokenIssuedAt: 0 },
    });
  }
});
