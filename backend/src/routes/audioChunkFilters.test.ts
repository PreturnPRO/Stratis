import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * The clip route is how audio held through a dropped connection reaches the
 * transcript, and it carried none of the stream ingest's filters: a clip of room
 * tone could write a line nobody said. This reads the handler rather than
 * calling it, because calling it needs a database and Google.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, "transcript.ts"), "utf8");
const start = source.indexOf('transcriptRouter.post("/audio-chunk"');
const next = source.indexOf("transcriptRouter.", start + 1);
const handler = source.slice(start, next === -1 ? undefined : next);

test("the audio-chunk handler exists", () => {
  assert.ok(start >= 0);
});

for (const call of ["cleanSttText(", "isSttNoise(", "isSttEcho(", "clampCapturedAt("]) {
  test(`the audio-chunk handler calls ${call}`, () => {
    assert.ok(handler.includes(call), `${call} is missing from /audio-chunk`);
  });
}
