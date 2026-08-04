import { Router } from "express";
import { createPublicKey, randomBytes, type JsonWebKey } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Role } from "@shared/types";
import { env } from "../config/env";
import { db } from "../db/database";
import { newId, now } from "../lib/ids";
import { signToken } from "./jwt";
import { consumeInviteForSignup, peekWorkspaceInvite } from "../lib/invites";

export const googleRouter = Router();

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS: [string, ...string[]] = [
  "https://accounts.google.com",
  "accounts.google.com",
];

interface GoogleIdToken {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  locale?: string;
}

let jwksCache: { keys: (JsonWebKey & { kid?: string })[]; readAt: number } = { keys: [], readAt: 0 };
const JWKS_TTL_MS = 60 * 60_000;

async function getSigningKey(kid: string) {
  if (Date.now() - jwksCache.readAt > JWKS_TTL_MS || jwksCache.keys.length === 0) {
    const res = await fetch(GOOGLE_JWKS_URL);
    if (!res.ok) throw new Error(`Could not fetch Google signing keys (${res.status})`);
    const body = (await res.json()) as { keys: (JsonWebKey & { kid?: string })[] };
    jwksCache = { keys: body.keys ?? [], readAt: Date.now() };
  }

  const jwk = jwksCache.keys.find((k) => k.kid === kid);
  if (!jwk) throw new Error("Google signed this token with an unknown key");
  return createPublicKey({ key: jwk, format: "jwk" });
}

/**
 * Verifies the ID token against Google's published keys rather than calling
 * the tokeninfo endpoint: it is the only check that proves the token was minted
 * for THIS client and not replayed from another app's sign-in.
 */
async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdToken> {
  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid) throw new Error("Google ID token has no key id");

  const key = await getSigningKey(kid);
  const payload = jwt.verify(idToken, key, {
    algorithms: ["RS256"],
    audience: env.google.clientId,
    issuer: GOOGLE_ISSUERS,
  }) as unknown as GoogleIdToken;

  if (!payload.email) throw new Error("Google account has no email address");
  if (!payload.email_verified) throw new Error("This Google email address is not verified");
  return payload;
}

/**
 * The `state` parameter, signed. It carries the invite the user arrived with
 * through the round trip to Google and back, and its signature is what makes
 * the callback resistant to a forged request.
 */
interface OAuthState {
  nonce: string;
  invite?: string;
  redirect?: string;
}

function signState(state: OAuthState): string {
  return jwt.sign(state, env.jwtSecret, { expiresIn: "10m" });
}

function verifyState(raw: string): OAuthState {
  return jwt.verify(raw, env.jwtSecret) as OAuthState;
}

function landing(params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString();
  // The token rides in the URL fragment: fragments are not sent to servers and
  // do not land in access logs or the Referer header.
  return `${env.appUrl}/#/oauth?${query}`;
}

googleRouter.get("/google", (req, res) => {
  if (!env.google.enabled) {
    return res.status(503).json({
      ok: false,
      error:
        "Google sign-in is not configured on this server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)",
    });
  }

  const state = signState({
    nonce: randomBytes(16).toString("hex"),
    invite: typeof req.query.invite === "string" ? req.query.invite : undefined,
  });

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", env.google.clientId);
  url.searchParams.set("redirect_uri", env.google.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  res.redirect(url.toString());
});

googleRouter.get("/google/callback", async (req, res) => {
  if (!env.google.enabled) {
    return res.redirect(landing({ error: "Google sign-in is not configured" }));
  }

  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const rawState = typeof req.query.state === "string" ? req.query.state : "";

    if (typeof req.query.error === "string") {
      return res.redirect(landing({ error: "Google sign-in was cancelled" }));
    }
    if (!code || !rawState) {
      return res.redirect(landing({ error: "Google sign-in returned an incomplete response" }));
    }

    let state: OAuthState;
    try {
      state = verifyState(rawState);
    } catch {
      return res.redirect(landing({ error: "This sign-in link expired — please try again" }));
    }

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.google.clientId,
        client_secret: env.google.clientSecret,
        redirect_uri: env.google.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error("[google] token exchange failed:", await tokenRes.text());
      return res.redirect(landing({ error: "Google would not complete the sign-in" }));
    }

    const tokens = (await tokenRes.json()) as { id_token?: string };
    if (!tokens.id_token) {
      return res.redirect(landing({ error: "Google did not return an identity token" }));
    }

    const profile = await verifyGoogleIdToken(tokens.id_token);
    const result = await upsertGoogleUser(profile, state.invite);

    if ("error" in result) return res.redirect(landing({ error: result.error }));
    return res.redirect(landing({ token: result.token }));
  } catch (error) {
    console.error("[google] callback error:", error);
    return res.redirect(landing({ error: "Google sign-in failed" }));
  }
});

interface GoogleUpsertOk {
  token: string;
  userId: string;
}

/**
 * Resolves a verified Google profile to a Stratis account, in three steps:
 * an already-linked account, an existing password account with the same
 * verified email (linked, not duplicated), or a new account. The email match is
 * only safe because `email_verified` was checked — otherwise it would be an
 * account takeover.
 */
async function upsertGoogleUser(
  profile: GoogleIdToken,
  inviteToken?: string,
): Promise<GoogleUpsertOk | { error: string }> {
  const email = profile.email.toLowerCase();
  const ts = now();

  const linked = await db.query<{ id: string; org_id: string; role: Role; status: string }>(
    `SELECT id, org_id, role, status FROM users WHERE google_id = $1`,
    [profile.sub],
  );

  if (linked.rows[0]) {
    const user = linked.rows[0];
    if (user.status !== "active") return { error: "This account is no longer active" };
    await db.query(`UPDATE users SET last_active_at = $1 WHERE id = $2`, [ts, user.id]);
    return {
      token: signToken({ sub: user.id, orgId: user.org_id, role: user.role }),
      userId: user.id,
    };
  }

  const byEmail = await db.query<{ id: string; org_id: string; role: Role; status: string }>(
    `SELECT id, org_id, role, status FROM users WHERE LOWER(email) = $1`,
    [email],
  );

  if (byEmail.rows[0]) {
    const user = byEmail.rows[0];
    if (user.status !== "active") return { error: "This account is no longer active" };
    await db.query(
      `UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2), last_active_at = $3
       WHERE id = $4`,
      [profile.sub, profile.picture ?? null, ts, user.id],
    );
    return {
      token: signToken({ sub: user.id, orgId: user.org_id, role: user.role }),
      userId: user.id,
    };
  }

  // New account. An invite decides the workspace and role; without one the user
  // gets their own workspace, same as an email signup.
  let orgId: string;
  let role: Role = "facilitator";
  let invitedBy: string | null = null;

  if (inviteToken) {
    const invite = await peekWorkspaceInvite(inviteToken);
    if (!invite.ok) return { error: invite.reason };
    orgId = invite.invite.org_id;
    role = invite.invite.role;
    invitedBy = invite.invite.created_by;
  } else {
    orgId = newId("org");
    await db.query(`INSERT INTO organizations (id, name, created_at) VALUES ($1, $2, $3)`, [
      orgId,
      `${profile.name ?? email.split("@")[0]}'s workspace`,
      ts,
    ]);
  }

  const userId = newId("usr");
  await db.query(
    `INSERT INTO users (id, org_id, email, name, password_hash, role, created_at,
                        google_id, auth_provider, avatar_url, locale, invited_by, last_active_at)
     VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,'google',$8,$9,$10,$6)`,
    [
      userId,
      orgId,
      profile.email,
      profile.name ?? email.split("@")[0],
      role,
      ts,
      profile.sub,
      profile.picture ?? null,
      profile.locale ?? "en",
      invitedBy,
    ],
  );

  if (inviteToken) await consumeInviteForSignup(inviteToken, userId, profile.name ?? email);

  return { token: signToken({ sub: userId, orgId, role }), userId };
}

/**
 * Google Identity Services (the one-tap / button widget) hands the browser an
 * ID token directly. Accepting it here means the frontend can use the widget
 * without a redirect; the token is verified exactly as in the redirect flow.
 */
googleRouter.post("/google/id-token", async (req, res) => {
  if (!env.google.clientId) {
    return res.status(503).json({ ok: false, error: "Google sign-in is not configured" });
  }
  try {
    const credential = typeof req.body?.credential === "string" ? req.body.credential : "";
    if (!credential) return res.status(400).json({ ok: false, error: "credential is required" });

    const profile = await verifyGoogleIdToken(credential);
    const invite = typeof req.body?.invite === "string" ? req.body.invite : undefined;
    const result = await upsertGoogleUser(profile, invite);
    if ("error" in result) return res.status(403).json({ ok: false, error: result.error });

    const userRow = await db.query(`SELECT * FROM users WHERE id = $1`, [result.userId]);
    res.json({ ok: true, data: { token: result.token, user: userRow.rows[0] } });
  } catch (error) {
    console.error("[google] id-token error:", error);
    res.status(401).json({ ok: false, error: "Could not verify that Google account" });
  }
});
