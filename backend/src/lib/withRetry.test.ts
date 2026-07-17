import { test } from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "./withRetry.ts";

test("resolves on the first attempt without retrying", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls += 1;
    return "ok";
  }, { retries: 3, baseMs: 1 });

  assert.equal(result, "ok");
  assert.equal(calls, 1);
});

test("retries until a later attempt succeeds", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls += 1;
    if (calls < 3) throw new Error(`fail ${calls}`);
    return "recovered";
  }, { retries: 3, baseMs: 1 });

  assert.equal(result, "recovered");
  assert.equal(calls, 3);
});

test("rejects with the last error after retries are exhausted", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => {
      calls += 1;
      throw new Error(`boom ${calls}`);
    }, { retries: 2, baseMs: 1 }),
    /boom 3/,
  );
  assert.equal(calls, 3); // 1 initial + 2 retries
});
