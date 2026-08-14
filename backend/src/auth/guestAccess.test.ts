import { test } from "node:test";
import assert from "node:assert/strict";
import { decideGuestAccess, type GuestSessionRow } from "./guestAccess.ts";

const live: GuestSessionRow = { status: "active", revoked: false };

test("a guest in a running meeting is let through", () => {
  assert.deepEqual(decideGuestAccess(live), { allow: true });
  assert.deepEqual(decideGuestAccess({ status: "created", revoked: false }), { allow: true });
});

test("revoking the room code stops a token that was already issued", () => {
  // The hole this closes: the token is signed, unexpired, and useless.
  const decision = decideGuestAccess({ status: "active", revoked: true });
  assert.equal(decision.allow, false);
  assert.equal(decision.allow === false && decision.status, 401);
  assert.match(decision.allow === false ? decision.error : "", /closed this room/);
});

test("an ended meeting answers 410, not 401", () => {
  // The room screen keys off this: 410 means stop polling and keep the last
  // decisions on screen. A 401 would read as a broken link.
  const decision = decideGuestAccess({ status: "ended", revoked: false });
  assert.equal(decision.allow, false);
  assert.equal(decision.allow === false && decision.status, 410);
  assert.match(decision.allow === false ? decision.error : "", /ended/);
});

test("revocation is reported before the meeting's own state", () => {
  // Both true: the useful thing to say is that it was taken away.
  const decision = decideGuestAccess({ status: "ended", revoked: true });
  assert.equal(decision.allow === false && decision.status, 401);
  assert.match(decision.allow === false ? decision.error : "", /closed this room/);
});

test("a token for a session that no longer exists is refused", () => {
  const decision = decideGuestAccess(undefined);
  assert.equal(decision.allow, false);
  assert.equal(decision.allow === false && decision.status, 401);
});

test("every refusal carries a status a client can act on", () => {
  const refusals = [
    decideGuestAccess(undefined),
    decideGuestAccess({ status: "active", revoked: true }),
    decideGuestAccess({ status: "ended", revoked: false }),
  ];

  for (const decision of refusals) {
    assert.equal(decision.allow, false);
    assert.ok(decision.allow === false && [401, 410].includes(decision.status));
    assert.ok(decision.allow === false && decision.error.length > 0);
  }
});
