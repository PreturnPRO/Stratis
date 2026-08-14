import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkPlanCode,
  generatePlanCode,
  grantExpiry,
  isGrantablePlan,
  normalisePlanCode,
  type PlanCodeRow,
} from "./planCodes.ts";

const base: PlanCodeRow = {
  id: "pcode_1",
  code: "H7KP3RNMXE4A",
  plan: "beta",
  label: "Chiang Mai cohort 1",
  grant_days: 90,
  expires_at: null,
  max_uses: 10,
  used_count: 0,
  revoked_at: null,
};

test("a fresh code is redeemable", () => {
  assert.equal(checkPlanCode(base).ok, true);
});

test("a revoked code is refused, and does not say it exists", () => {
  const result = checkPlanCode({ ...base, revoked_at: "2026-08-01T00:00:00.000Z" });
  assert.equal(result.ok, false);
  // Same wording as an unknown code: distinguishing them confirms a code is
  // real, which is the first half of guessing one.
  assert.equal(result.ok === false && result.reason, "That code is not valid");
  assert.equal(
    checkPlanCode(undefined).ok === false && checkPlanCode(undefined).reason,
    result.ok === false ? result.reason : "",
  );
});

test("an expired code is refused", () => {
  const result = checkPlanCode(
    { ...base, expires_at: "2026-08-01T00:00:00.000Z" },
    new Date("2026-08-14T00:00:00.000Z"),
  );
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.reason : "", /expired/);
});

test("a spent code is refused, and the boundary is exact", () => {
  assert.equal(checkPlanCode({ ...base, max_uses: 3, used_count: 2 }).ok, true);
  assert.equal(checkPlanCode({ ...base, max_uses: 3, used_count: 3 }).ok, false);
});

test("no max_uses means unlimited redemptions", () => {
  assert.equal(checkPlanCode({ ...base, max_uses: null, used_count: 999 }).ok, true);
});

test("the grant runs from redemption, and open-ended stays open", () => {
  const from = new Date("2026-08-14T00:00:00.000Z");
  assert.equal(grantExpiry(90, from), "2026-11-12T00:00:00.000Z");
  assert.equal(grantExpiry(null, from), null);
});

test("codes are typed the way they are read", () => {
  assert.equal(normalisePlanCode("h7kp-3rnm-xe4a"), "H7KP3RNMXE4A");
  assert.equal(normalisePlanCode(" H7KP 3RNM XE4A "), "H7KP3RNMXE4A");
});

test("a generated code avoids the characters people mishear", () => {
  for (let i = 0; i < 200; i += 1) {
    const code = generatePlanCode();
    assert.match(code, /^[ACDEFHJKMNPRTUVWXY34679]{4}-[ACDEFHJKMNPRTUVWXY34679]{4}-[ACDEFHJKMNPRTUVWXY34679]{4}$/);
    assert.doesNotMatch(code, /[OI1LS5B8Z2]/);
  }
});

test("only paid plans can be granted by a code", () => {
  assert.equal(isGrantablePlan("beta"), true);
  assert.equal(isGrantablePlan("pro"), true);
  // Free is the absence of a grant, and "" / undefined must not slip through.
  assert.equal(isGrantablePlan("free"), false);
  assert.equal(isGrantablePlan(""), false);
  assert.equal(isGrantablePlan(undefined), false);
});
