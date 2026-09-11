import { test } from "node:test";
import assert from "node:assert/strict";
import { createStreamCore, type BidiStream } from "./sttStreamCore.ts";

/** Records what reaches the recogniser. Handlers are ignored: no results are needed here. */
class FakeStream {
  writes: Buffer[] = [];
  ended = false;
  destroyed = false;
  write(chunk: unknown): boolean {
    this.writes.push((chunk as { audio: Buffer }).audio);
    return true;
  }
  end(): void {
    this.ended = true;
  }
  destroy(): void {
    this.destroyed = true;
  }
  on(): void {}
  removeAllListeners(): void {}
}

const opts = {
  sessionId: "ses_test",
  sampleRateHertz: 16_000,
  onInterim: () => {},
  onFinal: () => {},
  onError: () => {},
};

/** An opener the test completes by hand, so writes can land inside the open window. */
function manualOpener() {
  let resolve!: (s: BidiStream | null) => void;
  const open = () =>
    new Promise<BidiStream | null>((r) => {
      resolve = r;
    });
  return { open, finish: (s: BidiStream | null) => resolve(s) };
}

const settle = () => new Promise((r) => setImmediate(r));
const marker = (n: number) => Buffer.alloc(8_000, n);

test("audio written while the recogniser opens reaches it, in order", async () => {
  const opener = manualOpener();
  const fake = new FakeStream();
  const handle = createStreamCore(opts, { open: opener.open, now: () => 0 });
  handle.write(marker(1));
  handle.write(marker(2));
  handle.write(marker(3));
  opener.finish(fake as unknown as BidiStream);
  await settle();
  assert.deepEqual(fake.writes.map((b) => b[0]), [1, 2, 3]);
  handle.stop();
});

test("audio written after the open lands behind the audio that was held", async () => {
  const opener = manualOpener();
  const fake = new FakeStream();
  const handle = createStreamCore(opts, { open: opener.open, now: () => 0 });
  handle.write(marker(1));
  opener.finish(fake as unknown as BidiStream);
  await settle();
  handle.write(marker(2));
  assert.deepEqual(fake.writes.map((b) => b[0]), [1, 2]);
  handle.stop();
});

test("a flush during the open still delivers the held audio, then closes", async () => {
  const opener = manualOpener();
  const fake = new FakeStream();
  const handle = createStreamCore(opts, { open: opener.open, now: () => 0 });
  handle.write(marker(1));
  handle.write(marker(2));
  handle.flush();
  opener.finish(fake as unknown as BidiStream);
  await settle();
  assert.deepEqual(fake.writes.map((b) => b[0]), [1, 2]);
  assert.equal(fake.ended, true);
  handle.stop();
});

test("stop during the open writes nothing and destroys the late stream", async () => {
  const opener = manualOpener();
  const fake = new FakeStream();
  const handle = createStreamCore(opts, { open: opener.open, now: () => 0 });
  handle.write(marker(1));
  handle.stop();
  opener.finish(fake as unknown as BidiStream);
  await settle();
  assert.deepEqual(fake.writes, []);
  assert.equal(fake.destroyed, true);
});
