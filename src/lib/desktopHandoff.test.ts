import { test } from "node:test";
import assert from "node:assert/strict";
import {
  desktopCallbackUrl,
  desktopRequestHash,
  parseDesktopRequest,
  rememberDesktopRequest,
  takeDesktopRequest,
} from "./desktopHandoff.ts";

const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const STATE = "af0ifjsldkjAAAAAAAAAAA";
const good = { port: "53682", state: STATE, challenge: CHALLENGE };

/** sessionStorage, without a browser: the rules under test are what survives and what is forgotten. */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

test("a well-formed request from the app is accepted", () => {
  assert.deepEqual(parseDesktopRequest(good), { port: 53682, state: STATE, challenge: CHALLENGE });
});

test("a port outside 1024-65535, or anything but a plain number, is refused", () => {
  for (const port of ["80", "1023", "65536", "5368a", " 53682", "", "-1"]) {
    assert.equal(parseDesktopRequest({ ...good, port }), null, `port ${JSON.stringify(port)}`);
  }
});

test("a missing or malformed state or challenge is refused", () => {
  assert.equal(parseDesktopRequest({ ...good, state: "" }), null);
  assert.equal(parseDesktopRequest({ ...good, state: "short" }), null);
  assert.equal(parseDesktopRequest({ ...good, state: "a&b=c".padEnd(20, "x") }), null);
  assert.equal(parseDesktopRequest({ ...good, challenge: CHALLENGE.slice(1) }), null);
  assert.equal(parseDesktopRequest({ port: "53682" }), null);
});

test("the callback goes to the app on 127.0.0.1 with the code, the state and the language", () => {
  const request = parseDesktopRequest(good)!;
  assert.equal(
    desktopCallbackUrl(request, "code_1", "th"),
    `http://127.0.0.1:53682/callback?code=code_1&state=${STATE}&lang=th`,
  );
});

test("a request survives the trip through sign-in and resumes once", () => {
  const storage = new MemoryStorage();
  const request = parseDesktopRequest(good)!;
  rememberDesktopRequest(storage, request);
  assert.deepEqual(takeDesktopRequest(storage), request);
  assert.equal(takeDesktopRequest(storage), null);
});

test("a stored request that has been tampered with is dropped, not trusted", () => {
  const storage = new MemoryStorage();
  storage.setItem("stratis.desktopSignIn.v1", JSON.stringify({ port: 80, state: STATE, challenge: CHALLENGE }));
  assert.equal(takeDesktopRequest(storage), null);
  storage.setItem("stratis.desktopSignIn.v1", "not json");
  assert.equal(takeDesktopRequest(storage), null);
});

test("the resume link carries the request back to the desktop page", () => {
  assert.equal(
    desktopRequestHash(parseDesktopRequest(good)!),
    `#/desktop?port=53682&state=${STATE}&challenge=${CHALLENGE}`,
  );
});
