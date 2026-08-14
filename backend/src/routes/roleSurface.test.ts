import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * There is one account role, and growing a second is a product decision rather
 * than an implementation detail.
 *
 * Three roles became two became one, and each shrink left behind checks written
 * against a role that no longer existed — `role === "participant"` branches that
 * silently became dead code, and one that granted read access to every meeting
 * in a workspace. TypeScript catches comparisons against a removed literal, but
 * only while the union is narrow: the day someone widens `Role` "just to add
 * viewer", every one of those branches quietly comes back to life.
 *
 * So the surface is asserted here. Widening it means editing this test, which
 * means saying out loud that a second kind of account now exists.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

test("Role has exactly one member", () => {
  const types = readFileSync(resolve(repoRoot, "shared/types.ts"), "utf-8");
  const match = types.match(/export type Role = ([^;]+);/);

  assert.ok(match, "shared/types.ts must declare `export type Role`");
  assert.equal(
    match![1].trim(),
    '"facilitator"',
    "Role is the account role and there is one. A guest's role inside a meeting is SessionRole.",
  );
});

/**
 * Comments describe history — "behind `requireRole("admin")` this was
 * reachable by anyone" is a record of a fixed bug, not a live guard. Stripping
 * them is what makes this test about code.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("no route guard names a role other than facilitator", () => {
  const routesDir = resolve(__dirname);
  const offenders: string[] = [];

  for (const name of readdirSync(routesDir)) {
    if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
    const source = code(readFileSync(resolve(routesDir, name), "utf-8"));

    for (const guard of source.matchAll(/requireRole\(([^)]*)\)/g)) {
      const roles = guard[1];
      if (roles.replace(/["'\s]/g, "") !== "facilitator") {
        offenders.push(`${name}: requireRole(${roles})`);
      }
    }

    // A comparison against a role literal that is not the only role is either
    // dead code or a guard that no longer guards anything.
    for (const compare of source.matchAll(/role\s*===\s*"([a-z]+)"/g)) {
      if (compare[1] !== "facilitator") offenders.push(`${name}: role === "${compare[1]}"`);
    }
  }

  assert.deepEqual(offenders, [], `role checks that cannot be true:\n${offenders.join("\n")}`);
});

test("signup does not read a role or a workspace name from the request", () => {
  const auth = readFileSync(resolve(repoRoot, "backend/src/auth/routes.ts"), "utf-8");
  const signup = code(auth.slice(auth.indexOf('authRouter.post("/signup"')));

  // The destructuring line specifically: `role` also appears as a column name
  // in the INSERT below, which is not the same thing as trusting the caller.
  const destructured = signup.match(/const \{([^}]*)\} = \(req\.body[^;]*SignupRequest;/);
  assert.ok(destructured, "signup must destructure its body in one recognisable statement");

  const fields = destructured![1].split(",").map((f) => f.trim());
  assert.ok(
    !fields.includes("role"),
    "a self-declared role in the signup body is how the admin role became an open door",
  );
  assert.ok(
    !fields.includes("orgName"),
    "the organisation is an invisible container — nothing names it, least of all the person signing up",
  );
});
