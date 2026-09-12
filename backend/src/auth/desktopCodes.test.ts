import { test } from "node:test";
import assert from "node:assert/strict";
import { CODE_TTL_MS, DesktopCodes, challengeFor, isChallenge } from "./desktopCodes.ts";

// RFC 7636, Appendix B.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

test("the challenge is BASE64URL(SHA-256(verifier)), as RFC 7636 computes it", () => {
  assert.equal(challengeFor(VERIFIER), CHALLENGE);
  assert.equal(isChallenge(CHALLENGE), true);
});

test("only 43 base64url characters are a challenge", () => {
  assert.equal(isChallenge("short"), false);
  assert.equal(isChallenge(`${CHALLENGE}A`), false);
  assert.equal(isChallenge(CHALLENGE.replace("-", "+")), false);
  assert.equal(isChallenge(undefined), false);
});

test("the right verifier redeems a code once, for the account that asked", () => {
  const codes = new DesktopCodes();
  const code = codes.issue("usr_1", CHALLENGE);
  assert.deepEqual(codes.redeem(code, VERIFIER), { ok: true, userId: "usr_1" });
  assert.deepEqual(codes.redeem(code, VERIFIER), { ok: false, reason: "unknown" });
});

test("a wrong verifier burns the code, so it cannot be guessed at", () => {
  const codes = new DesktopCodes();
  const code = codes.issue("usr_1", CHALLENGE);
  assert.deepEqual(codes.redeem(code, "x".repeat(43)), { ok: false, reason: "mismatch" });
  assert.deepEqual(codes.redeem(code, VERIFIER), { ok: false, reason: "unknown" });
});

test("a code older than a minute is refused", () => {
  let now = 1_000;
  const codes = new DesktopCodes(() => now);
  const code = codes.issue("usr_1", CHALLENGE);
  now += CODE_TTL_MS + 1;
  assert.deepEqual(codes.redeem(code, VERIFIER), { ok: false, reason: "expired" });
});

test("codes are 32 random bytes and never repeat", () => {
  const codes = new DesktopCodes();
  const first = codes.issue("usr_1", CHALLENGE);
  const second = codes.issue("usr_1", CHALLENGE);
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
});

test("issuing a code sweeps the ones that expired", () => {
  let now = 1_000;
  const codes = new DesktopCodes(() => now);
  codes.issue("usr_1", CHALLENGE);
  now += CODE_TTL_MS + 1;
  codes.issue("usr_2", CHALLENGE);
  assert.equal(codes.size, 1);
});
