import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Every way into a meeting records that somebody came in.
 *
 * Joining by code minted a guest token and wrote a redemption, and nothing
 * else — no `session_guests` row and no `session_participants` row. So the
 * facilitator could not see that anyone had arrived, and the usage rollup
 * counted every code-joined meeting as empty. The invite-link path did it
 * correctly, which is exactly why nobody noticed: the feature worked on the
 * path the tests used.
 *
 * A join that does not record presence is the defect. This reads the source
 * because the alternative needs a database, a live session and a real code.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

function source(file: string): string {
  return readFileSync(resolve(__dirname, file), "utf-8");
}

test("joining by room code records the guest and their presence", () => {
  const room = source("room.ts");
  const join = room.slice(room.indexOf('roomRouter.post("/:code/join"'));
  const handler = join.slice(0, join.indexOf("roomRouter.get(") + 1 || undefined);

  assert.match(
    handler,
    /INSERT INTO session_guests/,
    "a code-joined guest needs a row, or the roster has nothing to read",
  );
  assert.match(
    handler,
    /INSERT INTO session_participants/,
    "presence is what the facilitator's count and the usage rollup both read",
  );
});

test("the guest's poll refreshes last_seen_at", () => {
  const room = source("room.ts");

  assert.match(
    room.replace(/\s+/g, " "),
    /UPDATE session_guests SET last_seen_at/,
    "without a heartbeat everyone in the room reads as away two minutes in",
  );
});

test("the roster is the facilitator's own, and says away rather than gone", () => {
  const room = source("room.ts");
  const roster = room.slice(room.indexOf('roomRouter.get("/session/:sessionId/roster"'));
  const handler = roster.slice(0, 2000);

  assert.match(
    handler,
    /facilitator_id !== req\.auth!\.sub/,
    "a roster is a list of people — it belongs to whoever is running that meeting and nobody else",
  );
  assert.match(
    handler,
    /INTERVAL '2 minutes'/,
    "a phone that slept has not left the meeting; presence dims, it does not delete",
  );
});
