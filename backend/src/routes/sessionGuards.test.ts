import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * A route that acts on a session id must prove the caller owns that session.
 *
 * Five handlers in ai.ts did not. They carried `requireAuth`, read
 * `body.sessionId`, and went straight to the live-card store — so any account
 * could read another workspace's suggestion cards, push cards onto a stranger's
 * facilitator screen mid-meeting, and mark or dismiss them. Nothing failed:
 * types were fine, tests were green, and the only way to notice was to read the
 * five handlers side by side with the ones that got it right.
 *
 * So the check is mechanical now. Any route file that mentions a session id
 * must also carry one of the guards, and a new route added in a hurry fails
 * here rather than in production.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

const GUARDS = [
  "requireSessionAccess",
  "requireAccessibleSession",
  "checkSessionAccess",
  // room.ts scopes guests by comparing the token's own session id
  "req.guest!.sessionId",
  // these resolve the session through their own org + facilitator check
  "sessionForRoom",
  "getSessionForSummary",
  "canUseSession",
  "canAccessDocument",
];

/**
 * An inline comparison of the session's workspace against the caller's counts
 * as a guard. transcript.ts, document.ts and invite.ts each own their check
 * rather than sharing a helper, and rewriting three correct files to satisfy a
 * test would be the test wagging the codebase.
 */
const INLINE_ORG_CHECK = /org_id !== .*orgId|org_id === .*orgId|m\.org_id = \$/;

/** Files that legitimately name a session without acting on one. */
const EXEMPT = new Set(["index.ts", "_placeholder.ts", "system.ts", "notification.ts"]);

function routeFiles(): Array<{ name: string; source: string }> {
  return readdirSync(__dirname)
    .filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts") && !EXEMPT.has(n))
    .map((name) => ({ name, source: readFileSync(resolve(__dirname, name), "utf-8") }));
}

test("every route file that takes a session id also checks access to it", () => {
  const offenders: string[] = [];

  for (const { name, source } of routeFiles()) {
    const takesSessionId =
      /body\?\.sessionId/.test(source) ||
      /params\.sessionId/.test(source) ||
      /body\?\.session_id/.test(source);

    if (!takesSessionId) continue;
    if (GUARDS.some((guard) => source.includes(guard))) continue;
    if (INLINE_ORG_CHECK.test(source)) continue;

    offenders.push(name);
  }

  assert.deepEqual(
    offenders,
    [],
    `these route files read a session id without checking who owns it:\n${offenders.join("\n")}`,
  );
});

test("the admin release switch is not reachable with a workspace admin role", () => {
  const admin = readFileSync(resolve(__dirname, "admin.ts"), "utf-8");
  const release = admin.slice(admin.indexOf('adminRouter.post("/release"'));

  // Signup accepts a self-declared role, and the release cutoff is global —
  // app_releases has no org column — so a workspace admin must not reach it.
  assert.match(
    release.slice(0, 120),
    /requirePlatformAdmin/,
    "POST /api/admin/release must be gated by requirePlatformAdmin, not requireRole('admin')",
  );
});
