import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  isRoomCodeShape,
  normalizeRoomCode,
} from "./roomCode.ts";

test("a generated code is the advertised length", () => {
  assert.equal(generateRoomCode().length, ROOM_CODE_LENGTH);
});

test("a generated code only uses the unambiguous alphabet", () => {
  const allowed = new Set(ROOM_CODE_ALPHABET);
  for (let i = 0; i < 200; i += 1) {
    for (const ch of generateRoomCode()) {
      assert.ok(allowed.has(ch), `${ch} is not in the room-code alphabet`);
    }
  }
});

test("the alphabet excludes the characters people misread aloud", () => {
  for (const ch of ["O", "0", "I", "1", "L", "S", "5", "B", "8", "Z", "2"]) {
    assert.ok(!ROOM_CODE_ALPHABET.includes(ch), `${ch} should not be issuable`);
  }
});

test("codes are not all the same", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 50; i += 1) seen.add(generateRoomCode());
  assert.ok(seen.size > 40, `expected variety, got ${seen.size} distinct in 50`);
});

test("typing it in lowercase still works", () => {
  assert.equal(normalizeRoomCode("acdef4"), "ACDEF4");
});

test("spaces and dashes people add are ignored", () => {
  assert.equal(normalizeRoomCode(" acd-ef 4 "), "ACDEF4");
});

test("an empty string normalizes to empty rather than throwing", () => {
  assert.equal(normalizeRoomCode(""), "");
});

test("a generated code passes its own shape check", () => {
  for (let i = 0; i < 50; i += 1) {
    assert.ok(isRoomCodeShape(generateRoomCode()));
  }
});

test("a code of the wrong length is not room-code shaped", () => {
  assert.equal(isRoomCodeShape("ACD"), false);
});

test("a code containing an excluded character is not room-code shaped", () => {
  assert.equal(isRoomCodeShape("ACDEF0"), false);
});
