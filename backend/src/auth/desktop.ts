import { Router } from "express";
import { db } from "../db/database";
import { getAccountState } from "../lib/accountState";
import { PUBLIC_USER_COLUMNS, toPublicUser, type PublicUserRow } from "../lib/publicUser";
import { authLimiter } from "../middleware/rateLimit";
import { signToken } from "./jwt";
import { requireAuth } from "./middleware";
import { DesktopCodes, isChallenge } from "./desktopCodes";

export const desktopRouter = Router();

const codes = new DesktopCodes();

/**
 * Step 4 of desktop sign-in (Stratis Desktop spec §6). The website calls this with its
 * own session once the person has clicked Continue, so the code belongs to the account
 * they saw named on that page.
 */
desktopRouter.post("/desktop/code", requireAuth, (req, res) => {
  const challenge = req.body?.challenge;
  if (!isChallenge(challenge)) {
    return res.status(400).json({ ok: false, error: "challenge must be 43 base64url characters" });
  }
  res.json({ ok: true, data: { code: codes.issue(req.auth!.sub, challenge) } });
});

/**
 * Step 5. Stratis Desktop redeems the code with its verifier and gets a token of its
 * own — separate from the website's, so signing out of one leaves the other. The
 * account is read again: a minute is long enough to be suspended in.
 */
desktopRouter.post("/desktop/token", authLimiter, async (req, res) => {
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  const verifier = typeof req.body?.verifier === "string" ? req.body.verifier : "";
  if (!code || !verifier) {
    return res.status(400).json({ ok: false, error: "code and verifier are required" });
  }

  const redeemed = codes.redeem(code, verifier);
  if (!redeemed.ok) {
    return res.status(400).json({
      ok: false,
      error: "This sign-in code is not valid — start again from Stratis Desktop",
    });
  }

  try {
    const account = await getAccountState(redeemed.userId);
    if (!account || account.status !== "active") {
      return res
        .status(403)
        .json({ ok: false, error: account?.statusReason || "This account cannot sign in" });
    }

    const userRow = await db.query<PublicUserRow>(
      `SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = $1`,
      [redeemed.userId],
    );
    const user = userRow.rows[0];
    if (!user) return res.status(404).json({ ok: false, error: "Account not found" });

    const token = signToken({ sub: account.userId, orgId: account.orgId, role: account.role });
    res.json({ ok: true, data: { token, user: toPublicUser(user) } });
  } catch (error) {
    console.error("[auth] desktop token error:", error);
    res.status(500).json({ ok: false, error: "Could not finish signing in" });
  }
});
