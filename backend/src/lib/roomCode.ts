import { randomInt } from "node:crypto";

/**
 * The code a facilitator reads out so the room can join the checkpoint.
 *
 * It is spoken across a table and typed on a phone, so the alphabet leaves out
 * every pair that survives being misheard or misread: O/0, I/1/L, S/5, B/8,
 * Z/2. What remains is 23 characters; six of them is ~148 million codes, which
 * is far more than enough for a code that is only valid while one meeting is
 * running, and short enough to say twice without anyone writing it down.
 *
 * This is not a secret. It is a convenience on top of a session invite, and the
 * invite is what actually carries the grant — the code is looked up, checked
 * for expiry and revocation like any other invite, and rate limited, because
 * six characters is guessable if you are allowed to guess forever.
 */

export const ROOM_CODE_ALPHABET = "ACDEFHJKMNPRTUVWXY34679";
export const ROOM_CODE_LENGTH = 6;

export function generateRoomCode(): string {
  let out = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    out += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * People type the code with the spacing and casing they saw it in. Strip
 * anything that is not alphanumeric and upper-case the rest, so "acd-ef 4"
 * and "ACDEF4" are the same code.
 */
export function normalizeRoomCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/** Cheap shape check, so a malformed code never reaches the database. */
export function isRoomCodeShape(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}
