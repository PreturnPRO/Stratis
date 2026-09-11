import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeWav } from "./wav.ts";

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.slice(from, to));

test("writes a 44-byte PCM header for 16-bit mono", () => {
  const wav = encodeWav([new Int16Array([1, -1, 32767, -32768]).buffer], 16_000);
  const view = new DataView(wav.buffer);
  assert.equal(wav.length, 44 + 8);
  assert.equal(ascii(wav, 0, 4), "RIFF");
  assert.equal(view.getUint32(4, true), 36 + 8);
  assert.equal(ascii(wav, 8, 16), "WAVEfmt ");
  assert.equal(view.getUint32(16, true), 16);
  assert.equal(view.getUint16(20, true), 1, "PCM");
  assert.equal(view.getUint16(22, true), 1, "mono");
  assert.equal(view.getUint32(24, true), 16_000);
  assert.equal(view.getUint32(28, true), 32_000, "byte rate");
  assert.equal(view.getUint16(32, true), 2, "block align");
  assert.equal(view.getUint16(34, true), 16, "bits per sample");
  assert.equal(ascii(wav, 36, 40), "data");
  assert.equal(view.getUint32(40, true), 8);
});

test("concatenates frames in order after the header", () => {
  const wav = encodeWav([new Int16Array([1]).buffer, new Int16Array([-2]).buffer], 48_000);
  const view = new DataView(wav.buffer);
  assert.equal(view.getUint32(24, true), 48_000);
  assert.equal(view.getInt16(44, true), 1);
  assert.equal(view.getInt16(46, true), -2);
});
