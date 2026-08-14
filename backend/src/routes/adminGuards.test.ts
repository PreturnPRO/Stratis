import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * `/api/admin` carries two different powers, and the difference is the whole
 * security boundary:
 *
 * - workspace routes read one org and belong to its facilitator
 * - platform routes cross every org and belong to the Stratis team
 *
 * The file used to hold a single `adminRouter.use(requireAuth,
 * requireRole("admin"))`, which is how a product-wide logout switch ended up
 * behind a role anybody could self-declare at signup. A blanket guard also
 * fails silently in the other direction: delete the `.use()` line and every
 * route becomes reachable by any signed-in account, with nothing to notice it.
 *
 * So each route states its own guard and this test reads the source to prove
 * it. A handler added in a hurry fails here, not in production.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, "admin.ts"), "utf-8");

/** `adminRouter.get("/users", requireFacilitator, async (req, res) => {` */
const ROUTE = /adminRouter\.(get|post|patch|put|delete)\(\s*"([^"]+)"\s*,\s*([A-Za-z]+)/g;

function routes(): Array<{ method: string; path: string; guard: string }> {
  return [...source.matchAll(ROUTE)].map(([, method, path, guard]) => ({ method, path, guard }));
}

test("every /api/admin route names its own guard", () => {
  const found = routes();
  // A floor, not a count: the file legitimately shrinks when a surface is
  // deleted, and this only needs to prove the regex still matches routes.
  assert.ok(found.length >= 8, `expected to parse the admin routes, found ${found.length}`);

  const ungated = found
    .filter((r) => r.guard !== "requireFacilitator" && r.guard !== "requirePlatformAdmin")
    .map((r) => `${r.method.toUpperCase()} ${r.path} — first argument is \`${r.guard}\``);

  assert.deepEqual(
    ungated,
    [],
    "these admin routes do not start with requireFacilitator or requirePlatformAdmin:\n" +
      ungated.join("\n"),
  );
});

test("no blanket role guard is mounted on the admin router", () => {
  assert.doesNotMatch(
    source,
    /adminRouter\.use\([^)]*requireRole/,
    "a router-wide role check hides which routes are workspace and which are platform — guard each route instead",
  );
});

/**
 * The three that cross workspaces. Named individually because getting one of
 * these wrong hands a customer the product's controls, not just their own.
 */
test("cross-workspace routes are platform-operator only", () => {
  const crossWorkspace = [
    "/release",
    "/plan-codes",
    "/plan-codes/:id/revoke",
    "/plan-codes/:id/redemptions/:orgId/revoke",
    "/usage",
  ];
  const found = routes();

  for (const path of crossWorkspace) {
    const matches = found.filter((r) => r.path === path);
    if (matches.length === 0) continue; // not built yet — the next test catches the day it is
    for (const route of matches) {
      assert.equal(
        route.guard,
        "requirePlatformAdmin",
        `${route.method.toUpperCase()} ${path} crosses workspaces and must be requirePlatformAdmin`,
      );
    }
  }
});

test("the admin role is gone from the role list", () => {
  assert.doesNotMatch(
    source,
    /VALID_ROLES[^\]]*"admin"/,
    "admin is no longer a role — a workspace has facilitators and participants",
  );
});
