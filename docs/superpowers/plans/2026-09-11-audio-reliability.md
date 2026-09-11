# Audio Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the website's live transcript from losing audio while a recogniser opens, while the socket reconnects, and when the microphone stops.

**Architecture:** The logic lives in small pure modules that `node --test` can exercise without a browser, a microphone or Google: `pendingAudio.ts` on the server; `audioBacklog.ts`, `wav.ts` and `captureHealth.ts` on the client. The Google stream is split into an injectable core so the open-window defect is reproduced in a test before it is fixed. The existing hook and meeting screen are then rewired to use the modules.

**Tech Stack:** Node 22 (`node --experimental-strip-types --test`), Express, `ws`, `@google-cloud/speech` v2, React 18 + Vite, Web Audio `AudioWorklet`.

**Spec:** `docs/superpowers/specs/2026-09-11-audio-reliability-design.md`

## Global Constraints

- Work directly on `main`. `main` deploys to Vercel and Render: commit per task, **never push** without the owner's explicit go-ahead.
- Commit messages carry no `Co-Authored-By` trailer (the owner's standing preference).
- Modules covered by `node --test` import siblings with an explicit `.ts` extension.
- New test files are added by name to the `test` script in `backend/package.json` — it lists files, it does not glob.
- Every new user-facing English string ships with its Thai in `src/i18n/th.ts` in the same task, per `docs/i18n-thai-style.md`. No dynamic value inside a translated string: the DOM translator matches whole text nodes.
- `src/lib/speechGate.ts` constants do not change (A4).
- The model stays `chirp_2`; `STT_LOCATION` is not changed by this plan.
- Server queue cap: **10 s** of audio. Burst allowance: **2 s** (Task 1 may lower it). Max bytes per streaming request: **25,000**.
- Client backlog cap: **30 s** of audio.
- Capture watchdog: **5 s** without a frame. Reopen backoff **1 s, 2 s, 4 s, 4 s**; the 5th failed attempt is `lost`.
- Before claiming done: `npx tsc --noEmit`, `npm run build`, `npm --prefix backend run typecheck`, `npm --prefix backend test` — and say plainly what was not run.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `backend/scripts/probeStreamBurst.ts` | create, **never committed** | Task 1 throwaway probe |
| `backend/src/lib/pendingAudio.ts` | create | Byte-capped, real-time-paced queue for one recogniser |
| `backend/src/lib/sttStreamCore.ts` | create | Google stream lifecycle with an injected opener; holds audio while opening |
| `backend/src/lib/sttStream.ts` | modify | Builds the Google opener; keeps the mock and `createSttStream` |
| `backend/src/lib/capturedAt.ts` | create | Validates a client-supplied capture time |
| `backend/src/routes/transcript.ts` | modify | `audio-chunk`: `capturedAt`, noise and echo filters; `getSession` selects `started_at` |
| `backend/src/routes/audioChunkFilters.test.ts` | create | Source-reading guard for the clip route |
| `src/lib/audioBacklog.ts` | create | Frames held while the socket is down |
| `src/lib/wav.ts` | create | PCM16 frames → WAV bytes |
| `src/lib/captureHealth.ts` | create | `live → recovering → lost` state machine |
| `src/hooks/usePcmStream.ts` | modify | Notices a lost microphone and reopens it |
| `src/pages/Meeting.tsx` | modify | Backlog wiring; capture-state chip and banner |
| `src/i18n/th.ts` | modify | Thai for the new strings |
| `backend/package.json` | modify | Registers the new tests |
| `docs/context/03-engineering.md`, `docs/context/05-corrections.md` | modify | Library update, Task 9 |

Each `*.ts` module above has a sibling `*.test.ts`.

---

### Task 1: Probe Google's tolerance for bursts (throwaway)

**Files:**
- Create (do not commit): `backend/scripts/probeStreamBurst.ts`
- Modify: `docs/superpowers/specs/2026-09-11-audio-reliability-design.md` (§2, "Bursts")

**Interfaces:**
- Consumes: `getGoogleStreamingContext()` from `backend/src/lib/stt.ts`; `env` from `backend/src/config/env.ts`
- Produces: the value of `BURST_SECONDS` used in Task 2 (2, or 0.75 if scenario B fails)

- [ ] **Step 1: Ask the owner before running anything.** This uses the Google service-account key and bills about 22 seconds of audio. Do not continue without an explicit yes.

- [ ] **Step 2: Write the probe**

```ts
/**
 * THROWAWAY — Task 1 of docs/superpowers/plans/2026-09-11-audio-reliability.md.
 * Never committed. Answers one question: how does Chirp 2 streaming react when
 * audio arrives faster than real time?
 */
import { getGoogleStreamingContext } from "../src/lib/stt";
import { env } from "../src/config/env";

const RATE = 16_000;
const FRAME_MS = 250;
const FRAME_BYTES = ((RATE * FRAME_MS) / 1000) * 2;

function toneFrame(seed: number): Buffer {
  const buf = Buffer.alloc(FRAME_BYTES);
  let x = seed;
  for (let i = 0; i < FRAME_BYTES; i += 2) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const tone = Math.sin((2 * Math.PI * 220 * (i / 2)) / RATE) * 6000;
    const noise = (x % 2000) - 1000;
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(tone + noise))), i);
  }
  return buf;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Outcome {
  scenario: string;
  error: string | null;
  results: number;
}

async function run(scenario: string, burstFrames: number, realtimeFrames: number): Promise<Outcome> {
  const ctx = await getGoogleStreamingContext();
  if (!ctx) throw new Error("STT_PROVIDER is not google, or the Google client failed to start");
  const stream = ctx.client._streamingRecognize() as unknown as {
    write(chunk: unknown): boolean;
    end(): void;
    on(event: "data", cb: (resp: { results?: unknown[] }) => void): void;
    on(event: "error", cb: (err: Error & { code?: number }) => void): void;
  };
  const outcome: Outcome = { scenario, error: null, results: 0 };
  stream.on("data", (resp) => {
    outcome.results += resp.results?.length ?? 0;
  });
  stream.on("error", (err) => {
    outcome.error = `code ${err.code}: ${err.message}`;
  });
  stream.write({
    recognizer: ctx.recognizer,
    streamingConfig: {
      config: {
        explicitDecodingConfig: { encoding: "LINEAR16", sampleRateHertz: RATE, audioChannelCount: 1 },
        languageCodes: ctx.languageCodes,
        model: ctx.model,
      },
      streamingFeatures: { interimResults: true },
    },
  });
  let seed = 1;
  for (let i = 0; i < burstFrames; i++) stream.write({ audio: toneFrame(seed++) });
  for (let i = 0; i < realtimeFrames; i++) {
    await sleep(FRAME_MS);
    if (outcome.error) break;
    stream.write({ audio: toneFrame(seed++) });
  }
  await sleep(3_000);
  stream.end();
  await sleep(2_000);
  return outcome;
}

const { location, model, languageCodes } = env.stt.google;
console.log(`[probe] location=${location} model=${model} languages=${languageCodes.join(",")}`);
const outcomes = [
  await run("A: real time, 6 s", 0, 24),
  await run("B: 2 s burst, then 4 s real time", 8, 16),
  await run("C: 10 s burst", 40, 0),
];
for (const o of outcomes) {
  console.log(`[probe] ${o.scenario} -> ${o.error ?? "no error"} (results: ${o.results})`);
}
process.exit(0);
```

- [ ] **Step 3: Run it from `backend/`**

The `.env` sets `GOOGLE_APPLICATION_CREDENTIALS` to a path that does not exist on this laptop; the key is at the repo root. An inline variable wins because dotenv never overrides a variable that is already set. `pwd -W` gives Git Bash a Windows path, which Node needs.

```bash
GOOGLE_APPLICATION_CREDENTIALS="$(cd .. && pwd -W)/STT-service.key.json" npx tsx scripts/probeStreamBurst.ts
```

Expected: four `[probe]` lines — the configuration, then one per scenario.

- [ ] **Step 4: Apply the decision rule**

- **A errors** → stop the plan and report to the owner. The stream configuration itself is failing (most likely region or language, spec §6), and nothing below can be verified until that is settled.
- **A clean, B errors** → Task 2 uses `BURST_SECONDS = 0.75` (the size of the pre-roll burst the client already sends).
- **A and B clean** → Task 2 uses `BURST_SECONDS = 2`.
- **C** is recorded either way. Pacing already prevents a 10-second burst, so it changes no constant.

- [ ] **Step 5: Record the result in the spec**

In `docs/superpowers/specs/2026-09-11-audio-reliability-design.md` §2, replace the sentence beginning `The first plan task confirms Google's reaction` with the measured outcome, for example:

```markdown
Measured 2026-09-11 against `chirp_2` in `us-central1` (`th-TH,en-US`): real time
— no error; 2-second burst then real time — no error; 10-second burst — no error.
The 2-second allowance stands.
```

Use the real results and the real location printed by the probe.

- [ ] **Step 6: Delete the probe and commit the spec change**

```bash
rm backend/scripts/probeStreamBurst.ts
rmdir backend/scripts 2>/dev/null || true
git add docs/superpowers/specs/2026-09-11-audio-reliability-design.md
git commit -m "docs(spec): record how Chirp 2 streaming takes a burst"
```

---

### Task 2: A paced queue for audio that arrives before the recogniser is open

**Files:**
- Create: `backend/src/lib/pendingAudio.ts`
- Test: `backend/src/lib/pendingAudio.test.ts`
- Modify: `backend/package.json` (`test` script)

**Interfaces:**
- Consumes: `BURST_SECONDS` decided in Task 1
- Produces:
  - `class PendingAudio(sampleRateHertz: number)` with `readonly bytesPerSecond: number`, `get size(): number` (bytes queued), `push(chunk: Buffer): number` (returns bytes dropped from the front), `release(now: number): Buffer[]`, `releaseAll(): Buffer[]`, `clear(): void`
  - `splitChunk(chunk: Buffer, maxBytes: number): Buffer[]`
  - constants `MAX_REQUEST_BYTES = 25_000`, `QUEUE_SECONDS = 10`, `BURST_SECONDS`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { BURST_SECONDS, MAX_REQUEST_BYTES, PendingAudio, splitChunk } from "./pendingAudio.ts";

const RATE = 16_000;
const BYTES_PER_SECOND = RATE * 2;
/** One 250 ms frame at 16 kHz, filled with a marker byte so order is visible. */
const frame = (marker: number) => Buffer.alloc(8_000, marker);

test("releases queued chunks in the order they were pushed", () => {
  const q = new PendingAudio(RATE);
  q.push(frame(1));
  q.push(frame(2));
  q.push(frame(3));
  assert.deepEqual(q.release(0).map((b) => b[0]), [1, 2, 3]);
  assert.equal(q.size, 0);
});

test("drops the oldest audio past ten seconds and reports how much", () => {
  const q = new PendingAudio(RATE);
  let dropped = 0;
  for (let i = 0; i < 44; i++) dropped += q.push(frame(i)); // 11 seconds
  assert.equal(dropped, 4 * 8_000);
  assert.equal(q.size, 10 * BYTES_PER_SECOND);
  assert.equal(q.release(0)[0][0], 4);
});

test("a backlog inside the burst allowance is released at once", () => {
  const q = new PendingAudio(RATE);
  for (let i = 0; i < 3; i++) q.push(frame(i)); // 0.75 s, inside any allowance Task 1 can pick
  assert.equal(q.release(1_000).length, 3);
});

test("a backlog beyond the burst allowance is released at real-time pace", () => {
  const q = new PendingAudio(RATE);
  const burstFrames = Math.floor((q.bytesPerSecond * BURST_SECONDS) / 8_000);
  for (let i = 0; i < 24; i++) q.push(frame(i)); // 6 seconds
  assert.equal(q.release(0).length, burstFrames, "the burst goes at once");
  assert.equal(q.release(0).length, 0, "no time passed, nothing more");
  assert.equal(q.release(500).length, 2, "half a second releases half a second");
  assert.equal(q.release(1_000).length, 2, "the next half second releases the same again");
});

test("unused time never builds more than the burst allowance", () => {
  const q = new PendingAudio(RATE);
  q.release(0);
  for (let i = 0; i < 40; i++) q.push(frame(i));
  assert.equal(q.release(60_000).length, Math.floor((q.bytesPerSecond * BURST_SECONDS) / 8_000));
});

test("releaseAll ignores pacing; clear empties the queue", () => {
  const q = new PendingAudio(RATE);
  for (let i = 0; i < 24; i++) q.push(frame(i));
  assert.equal(q.releaseAll().length, 24);
  q.push(frame(1));
  q.clear();
  assert.equal(q.size, 0);
  assert.equal(q.release(0).length, 0);
});

test("splits a chunk larger than one streaming request on a sample boundary", () => {
  const parts = splitChunk(Buffer.alloc(60_001), MAX_REQUEST_BYTES);
  assert.deepEqual(parts.map((p) => p.length), [25_000, 25_000, 10_001]);
});
```

Note on the pacing tests: they read `BURST_SECONDS`, and every later step is half a second (16,000 bytes), which is below the allowance whether Task 1 chose 2 s or 0.75 s — so the expected counts do not depend on that choice.

- [ ] **Step 2: Register the test and run it to see it fail**

In `backend/package.json`, append ` src/lib/pendingAudio.test.ts` to the end of the `test` script string (after `../src/lib/accentContrast.test.ts`).

Run: `cd backend && node --experimental-strip-types --test src/lib/pendingAudio.test.ts`
Expected: FAIL — `Cannot find module '.../pendingAudio.ts'`

- [ ] **Step 3: Implement**

```ts
/**
 * Audio that arrived for a recogniser which is not open yet.
 *
 * A Google stream opens asynchronously. `sttStream.ts` used to write each chunk
 * with `stream?.write(...)`, so everything that arrived during the open was
 * discarded — and the server closes an idle stream after 8 seconds, so the
 * first words after every pause landed in that window, pre-roll included.
 *
 * Held audio cannot simply be flushed the moment the stream opens: Google
 * requires streaming audio at approximately real time. So release is a token
 * bucket — a small burst (the size the client's pre-roll already sends), then
 * real-time pace. The queue catches up during the silences the speech gate
 * already produces.
 */

/** Google's per-request ceiling for streaming audio. */
export const MAX_REQUEST_BYTES = 25_000;
/** Beyond this much held audio, the oldest goes. */
export const QUEUE_SECONDS = 10;
/** Audio that may be written at once before pacing starts. Measured in plan Task 1. */
export const BURST_SECONDS = 2;

const BYTES_PER_SAMPLE = 2;

/** Splits on an even byte so a 16-bit sample is never cut in half. */
export function splitChunk(chunk: Buffer, maxBytes: number): Buffer[] {
  const size = maxBytes - (maxBytes % BYTES_PER_SAMPLE);
  if (chunk.length <= size) return [chunk];
  const parts: Buffer[] = [];
  for (let offset = 0; offset < chunk.length; offset += size) {
    parts.push(chunk.subarray(offset, Math.min(offset + size, chunk.length)));
  }
  return parts;
}

export class PendingAudio {
  readonly bytesPerSecond: number;
  private readonly capacityBytes: number;
  private readonly burstBytes: number;
  private chunks: Buffer[] = [];
  private queuedBytes = 0;
  private tokens: number;
  private lastRefillAt: number | null = null;

  constructor(sampleRateHertz: number) {
    this.bytesPerSecond = sampleRateHertz * BYTES_PER_SAMPLE;
    this.capacityBytes = this.bytesPerSecond * QUEUE_SECONDS;
    this.burstBytes = this.bytesPerSecond * BURST_SECONDS;
    this.tokens = this.burstBytes;
  }

  get size(): number {
    return this.queuedBytes;
  }

  /** Queues a chunk. Returns how many bytes were dropped from the front to stay under the cap. */
  push(chunk: Buffer): number {
    for (const piece of splitChunk(chunk, MAX_REQUEST_BYTES)) {
      this.chunks.push(piece);
      this.queuedBytes += piece.length;
    }
    let dropped = 0;
    while (this.queuedBytes > this.capacityBytes && this.chunks.length > 0) {
      const head = this.chunks.shift()!;
      this.queuedBytes -= head.length;
      dropped += head.length;
    }
    return dropped;
  }

  /** The chunks that may be written now without running ahead of real time beyond the burst. */
  release(now: number): Buffer[] {
    this.refill(now);
    const out: Buffer[] = [];
    while (this.chunks.length > 0 && this.chunks[0].length <= this.tokens) {
      const head = this.chunks.shift()!;
      this.queuedBytes -= head.length;
      this.tokens -= head.length;
      out.push(head);
    }
    return out;
  }

  /** Everything, ignoring pace — for a flush at the end of a meeting. */
  releaseAll(): Buffer[] {
    const out = this.chunks;
    this.chunks = [];
    this.queuedBytes = 0;
    return out;
  }

  clear(): void {
    this.chunks = [];
    this.queuedBytes = 0;
  }

  private refill(now: number): void {
    if (this.lastRefillAt === null) {
      this.lastRefillAt = now;
      return;
    }
    const elapsedMs = Math.max(0, now - this.lastRefillAt);
    this.lastRefillAt = now;
    this.tokens = Math.min(this.burstBytes, this.tokens + (elapsedMs / 1000) * this.bytesPerSecond);
  }
}
```

If Task 1 chose 0.75 s, set `BURST_SECONDS = 0.75` and change the comment to say it was measured.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd backend && node --experimental-strip-types --test src/lib/pendingAudio.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/pendingAudio.ts backend/src/lib/pendingAudio.test.ts backend/package.json
git commit -m "feat(stt): a paced queue for audio that arrives before the recogniser is open"
```

---

### Task 3: The recogniser holds audio while it opens (A1)

**Files:**
- Create: `backend/src/lib/sttStreamCore.ts`
- Test: `backend/src/lib/sttStreamCore.test.ts`
- Modify: `backend/src/lib/sttStream.ts` (whole file becomes the version in Step 3)
- Modify: `backend/package.json` (`test` script)

**Interfaces:**
- Consumes: `PendingAudio` (Task 2); `streamAction`, `isOpenWedged`, `openBackoffMs` from `sttStreamPolicy.ts`
- Produces:
  - `createStreamCore(opts: SttStreamOptions, deps: StreamDeps): SttStreamHandle`
  - `interface StreamDeps { open: () => Promise<BidiStream | null>; now?: () => number }`
  - types `BidiStream`, `StreamingResponse`, `SttStreamOptions`, `SttStreamHandle` exported from `sttStreamCore.ts`; `sttStream.ts` re-exports `SttStreamOptions` and `SttStreamHandle`, so `backend/src/realtime/hub.ts` needs no change.

- [ ] **Step 1: Write the failing tests**

```ts
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
```

Append ` src/lib/sttStreamCore.test.ts` to the `test` script in `backend/package.json`.

- [ ] **Step 2: Run to see it fail**

Run: `cd backend && node --experimental-strip-types --test src/lib/sttStreamCore.test.ts`
Expected: FAIL — `Cannot find module '.../sttStreamCore.ts'`

- [ ] **Step 3: Move the stream into a core with an injected opener — behaviour unchanged**

Create `backend/src/lib/sttStreamCore.ts`. It holds `SttStreamOptions`, `SttStreamHandle`, `BidiStream`, `StreamingResponse`, the constants (`ROTATE_AFTER_MS`, `MAX_CONSECUTIVE_FAILURES`, `STALL_AFTER_MS`, `OPEN_TIMEOUT_MS`, `IDLE_CLOSE_MS` with its existing comment, `IDLE_CHECK_MS`, `RESTARTABLE_GRPC_CODES`) and the body of today's `createGoogleStream`, moved verbatim with exactly three changes:

1. The header and signature:

```ts
// Explicit .ts extensions: this module is covered by `node --test`, which strips
// types rather than resolving like a bundler.
import { streamAction, isOpenWedged, openBackoffMs } from "./sttStreamPolicy.ts";

export interface StreamDeps {
  /** Opens a recogniser that has already been sent its configuration. Null when STT is unavailable. */
  open: () => Promise<BidiStream | null>;
  /** Injected so tests control rotation and pacing. */
  now?: () => number;
}

export function createStreamCore(opts: SttStreamOptions, deps: StreamDeps): SttStreamHandle {
  const now = deps.now ?? Date.now;
```

2. Every `Date.now()` in the moved body becomes `now()`.

3. `openStream` no longer knows about Google:

```ts
  const openStream = async (): Promise<BidiStream | null> => {
    const s = await deps.open();
    if (!s) return null;
    streamStartedAt = now();
    lastDataAt = null;

    s.on("data", (resp) => {
      consecutiveFailures = 0;
      nextOpenAllowedAt = 0;
      lastDataAt = now();
      for (const result of resp.results ?? []) {
        const text = result.alternatives?.[0]?.transcript;
        if (!text) continue;
        if (result.isFinal) opts.onFinal(text);
        else opts.onInterim(text);
      }
    });

    s.on("error", (err) => {
      if (stopped || stream !== s) return;
      stream = null;
      consecutiveFailures += 1;

      const quiet =
        RESTARTABLE_GRPC_CODES.has(err.code ?? -1) &&
        consecutiveFailures <= MAX_CONSECUTIVE_FAILURES;

      nextOpenAllowedAt = now() + openBackoffMs(consecutiveFailures);

      console[quiet ? "warn" : "error"](
        `[stt:stream] gRPC error (code ${err.code}, session ${opts.sessionId}, ` +
          `retrying in ${openBackoffMs(consecutiveFailures)}ms):`,
        err.message,
      );

      if (!quiet) {
        opts.onError(`Streaming STT failed: ${err.message}`);
      }
    });

    return s;
  };
```

Replace `backend/src/lib/sttStream.ts` with:

```ts
import { getGoogleStreamingContext } from "./stt";
import { env } from "../config/env";
import {
  createStreamCore,
  type BidiStream,
  type SttStreamHandle,
  type SttStreamOptions,
} from "./sttStreamCore";

export type { SttStreamHandle, SttStreamOptions };

async function openGoogleStream(opts: SttStreamOptions): Promise<BidiStream | null> {
  const ctx = await getGoogleStreamingContext();
  if (!ctx) return null;

  const s = ctx.client._streamingRecognize() as unknown as BidiStream;
  s.write({
    recognizer: ctx.recognizer,
    streamingConfig: {
      config: {
        explicitDecodingConfig: {
          encoding: "LINEAR16",
          sampleRateHertz: opts.sampleRateHertz,
          audioChannelCount: 1,
        },
        languageCodes: ctx.languageCodes,
        model: ctx.model,
      },
      streamingFeatures: { interimResults: true },
    },
  });
  return s;
}
```

followed by today's `createMockStream`, unchanged, and:

```ts
export function createSttStream(opts: SttStreamOptions): SttStreamHandle {
  if (env.stt.provider === "google") {
    return createStreamCore(opts, { open: () => openGoogleStream(opts) });
  }
  return createMockStream(opts);
}
```

- [ ] **Step 4: Run the tests — the defect reproduces**

Run: `cd backend && node --experimental-strip-types --test src/lib/sttStreamCore.test.ts`
Expected: the first three tests FAIL (`[]` or `[2]` where `[1, 2, 3]` / `[1, 2]` was expected); "stop during the open" PASSES. This is spec §2's defect, reproduced before it is fixed.

Also run `npm --prefix backend run typecheck` — expected: clean. The move changed no behaviour.

- [ ] **Step 5: Hold audio in the core**

In `sttStreamCore.ts`:

Add the import and constant beside the others:

```ts
import { PendingAudio } from "./pendingAudio.ts";

/** How often held audio is re-offered to the pacing queue. */
const PUMP_INTERVAL_MS = 100;
```

Add this state and function inside `createStreamCore`, after `let idleTimer`:

```ts
  const pending = new PendingAudio(opts.sampleRateHertz);
  let pumpTimer: ReturnType<typeof setTimeout> | null = null;
  let flushWhenOpen = false;
  let overflowLogged = false;

  /**
   * Moves held audio into the recogniser as fast as pacing allows, and keeps
   * trying to open one while audio is waiting — including after a failed open,
   * once the backoff allows it.
   */
  const pump = (): void => {
    if (stopped) return;
    if (!stream) {
      ensureStream();
    } else {
      for (const piece of pending.release(now())) stream.write({ audio: piece });
    }
    if (pending.size === 0) {
      overflowLogged = false;
    } else if (!pumpTimer) {
      pumpTimer = setTimeout(() => {
        pumpTimer = null;
        pump();
      }, PUMP_INTERVAL_MS);
      pumpTimer.unref?.();
    }
  };
```

In `ensureStream`, replace `if (s) stream = s;` with:

```ts
        if (!s) return;
        stream = s;
        if (flushWhenOpen) {
          flushWhenOpen = false;
          for (const piece of pending.releaseAll()) s.write({ audio: piece });
          closeStream();
          return;
        }
        pump();
```

In `startIdleWatch`, replace `if (now() - lastWriteAt < IDLE_CLOSE_MS) return;` with:

```ts
      // Never close over held audio: it would sit in the queue until someone spoke again.
      if (pending.size > 0 || now() - lastWriteAt < IDLE_CLOSE_MS) return;
```

At the end of `write`, replace:

```ts
    ensureStream();
    stream?.write({ audio: chunk });
```

with:

```ts
    const dropped = pending.push(chunk);
    if (dropped > 0 && !overflowLogged) {
      overflowLogged = true;
      console.warn(
        `[stt:stream] Held audio passed the cap for session ${opts.sessionId}; ` +
          `dropped the oldest ${Math.round((dropped / pending.bytesPerSecond) * 1000)}ms`,
      );
    }
    pump();
```

Replace the returned `flush` and `stop` with:

```ts
    flush() {
      if (stopped) return;
      if (!stream) {
        if (pending.size > 0) {
          flushWhenOpen = true;
          ensureStream();
        }
        return;
      }
      console.log(`[stt:stream] Flushing stream for session ${opts.sessionId}`);
      for (const piece of pending.releaseAll()) stream.write({ audio: piece });
      closeStream();
    },
    stop() {
      stopped = true;
      if (idleTimer) clearInterval(idleTimer);
      idleTimer = null;
      if (pumpTimer) clearTimeout(pumpTimer);
      pumpTimer = null;
      pending.clear();
      closeStream();
    },
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `cd backend && node --experimental-strip-types --test src/lib/sttStreamCore.test.ts`
Expected: PASS, 4 tests

Run: `npm --prefix backend run typecheck && npm --prefix backend test`
Expected: clean typecheck; every test passes

- [ ] **Step 7: Commit**

```bash
git add backend/src/lib/sttStreamCore.ts backend/src/lib/sttStreamCore.test.ts backend/src/lib/sttStream.ts backend/package.json
git commit -m "fix(stt): audio that arrives while the recogniser opens is held, not dropped"
```

---

### Task 4: A held clip lands where it was said, through the stream's filters (A2, server)

**Files:**
- Create: `backend/src/lib/capturedAt.ts`
- Test: `backend/src/lib/capturedAt.test.ts`
- Create: `backend/src/routes/audioChunkFilters.test.ts`
- Modify: `backend/src/routes/transcript.ts` — `SessionRow` (lines 19-24), `getSession` (lines 34-43), the `/audio-chunk` handler (lines 610-761), imports (lines 1-14)
- Modify: `backend/package.json` (`test` script)

**Interfaces:**
- Produces:
  - `clampCapturedAt(raw: unknown, sessionStartedAt: string | Date | null | undefined, nowMs: number): string | undefined`
  - `POST /api/transcript/audio-chunk` accepts an optional body field `capturedAt` (ISO 8601 string). Task 6 sends it.

- [ ] **Step 1: Write the failing tests**

`backend/src/lib/capturedAt.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { clampCapturedAt } from "./capturedAt.ts";

const STARTED = "2026-09-11T02:00:00.000Z";
const NOW = Date.parse("2026-09-11T02:30:00.000Z");

test("keeps a capture time inside the session", () => {
  assert.equal(clampCapturedAt("2026-09-11T02:10:00.000Z", STARTED, NOW), "2026-09-11T02:10:00.000Z");
});

test("normalises any parseable time to UTC ISO", () => {
  assert.equal(clampCapturedAt("2026-09-11T09:10:00+07:00", STARTED, NOW), "2026-09-11T02:10:00.000Z");
});

test("refuses a time before the session started", () => {
  assert.equal(clampCapturedAt("2026-09-11T01:59:59.000Z", STARTED, NOW), undefined);
});

test("refuses a time in the future", () => {
  assert.equal(clampCapturedAt("2026-09-11T02:30:01.000Z", STARTED, NOW), undefined);
});

test("refuses anything that is not a parseable string", () => {
  for (const raw of [undefined, null, 1_726_020_000_000, "", "yesterday"]) {
    assert.equal(clampCapturedAt(raw, STARTED, NOW), undefined);
  }
});

test("refuses a capture time for a session that never started", () => {
  assert.equal(clampCapturedAt("2026-09-11T02:10:00.000Z", null, NOW), undefined);
});

test("accepts the start as a Date, which is how pg returns TIMESTAMPTZ", () => {
  assert.equal(clampCapturedAt("2026-09-11T02:10:00.000Z", new Date(STARTED), NOW), "2026-09-11T02:10:00.000Z");
});
```

`backend/src/routes/audioChunkFilters.test.ts`:

```ts
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
```

Append ` src/lib/capturedAt.test.ts src/routes/audioChunkFilters.test.ts` to the `test` script in `backend/package.json`.

- [ ] **Step 2: Run to see them fail**

Run: `cd backend && node --experimental-strip-types --test src/lib/capturedAt.test.ts src/routes/audioChunkFilters.test.ts`
Expected: `capturedAt.test.ts` FAILS with `Cannot find module`; the guard FAILS on `isSttNoise(`, `isSttEcho(` and `clampCapturedAt(`.

- [ ] **Step 3: Implement `capturedAt.ts`**

```ts
/**
 * When a clip was actually spoken, if the client's word for it can be trusted.
 *
 * Audio held through a dropped connection is uploaded after the reconnect.
 * Saving it at the server's clock would put those words after the lines that
 * followed them. So the client says when the audio was captured, and the server
 * believes it only inside the session — not before it started, not after now.
 * Anything else returns `undefined`, and the caller uses its own clock.
 */
export function clampCapturedAt(
  raw: unknown,
  sessionStartedAt: string | Date | null | undefined,
  nowMs: number,
): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = Date.parse(raw);
  if (!Number.isFinite(t) || t > nowMs) return undefined;
  if (!sessionStartedAt) return undefined;
  const startMs = new Date(sessionStartedAt).getTime();
  if (!Number.isFinite(startMs) || t < startMs) return undefined;
  return new Date(t).toISOString();
}
```

- [ ] **Step 4: Wire the route**

In `backend/src/routes/transcript.ts`:

Add beside the other `../lib` imports:

```ts
import { clampCapturedAt } from "../lib/capturedAt";
```

`SessionRow` gains the start:

```ts
interface SessionRow {
  id: string;
  facilitator_id: string;
  status: "created" | "active" | "ended";
  started_at: string | Date | null;
  org_id: string;
}
```

`getSession` selects it — change the query's first line to:

```ts
    `SELECT s.id, s.facilitator_id, s.status, s.started_at, m.org_id
```

In the `/audio-chunk` handler, directly after `if (!session) return;`, add:

```ts
    const capturedAt = clampCapturedAt(req.body?.capturedAt, session.started_at, Date.now());
```

Replace:

```ts
    const text = cleanSttText(stt.text);

    if (!text) {
```

with:

```ts
    const text = cleanSttText(stt.text);

    // The same filters the stream ingest applies. Audio held through a dropped
    // connection arrives here, and a clip of room tone is exactly what Chirp
    // turns into words nobody said.
    const filtered =
      !text || isSttNoise(text) || isSttEcho(await lastTranscriptText(sessionId), text);

    if (filtered) {
```

The body of that `if` — the `res.json` with `transcript: null` — stays as it is.

In the `saveTranscriptChunk` call inside the handler, add the timestamp:

```ts
      row = await saveTranscriptChunk({
        sessionId,
        speaker,
        text,
        timestamp: capturedAt,
      });
```

`saveTranscriptChunk` already falls back to `now()` when `timestamp` is `undefined`.

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd backend && node --experimental-strip-types --test src/lib/capturedAt.test.ts src/routes/audioChunkFilters.test.ts`
Expected: PASS, 12 tests

Run: `npm --prefix backend run typecheck && npm --prefix backend test`
Expected: clean; all pass. **Not verified by this:** the route against a real database and Google — say so in the task report.

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/capturedAt.ts backend/src/lib/capturedAt.test.ts backend/src/routes/audioChunkFilters.test.ts backend/src/routes/transcript.ts backend/package.json
git commit -m "fix(transcript): a held clip lands where it was said, through the stream's filters"
```

---

### Task 5: Frames held through a dropped connection, and the WAV they upload as (A2, client)

**Files:**
- Create: `src/lib/audioBacklog.ts`, `src/lib/wav.ts`
- Test: `src/lib/audioBacklog.test.ts`, `src/lib/wav.test.ts`
- Modify: `backend/package.json` (`test` script)

**Interfaces:**
- Produces:
  - `BACKLOG_SECONDS = 30`
  - `interface HeldFrame { frame: ArrayBuffer; capturedAt: number }` (`capturedAt` is epoch ms)
  - `frameDurationMs(byteLength: number, sampleRate: number): number`
  - `class AudioBacklog(sampleRate: number)`: `readonly sampleRate: number`, `get isEmpty(): boolean`, `push(frame: ArrayBuffer, capturedAt: number): void`, `takeAll(): { frames: HeldFrame[]; droppedMs: number }`
  - `encodeWav(frames: ArrayBuffer[], sampleRate: number): Uint8Array<ArrayBuffer>`

- [ ] **Step 1: Write the failing tests**

`src/lib/audioBacklog.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { AudioBacklog, BACKLOG_SECONDS, frameDurationMs } from "./audioBacklog.ts";

const RATE = 16_000;
/** 250 ms at 16 kHz, every sample set to a marker so order is visible. */
const frame = (marker: number) => new Int16Array(4_000).fill(marker).buffer;
const markerOf = (buf: ArrayBuffer) => new Int16Array(buf)[0];

test("a frame's duration comes from its size and the sample rate", () => {
  assert.equal(frameDurationMs(8_000, 16_000), 250);
  assert.equal(frameDurationMs(24_000, 48_000), 250);
});

test("hands back held frames oldest first with their capture times, and empties", () => {
  const b = new AudioBacklog(RATE);
  b.push(frame(1), 1_000);
  b.push(frame(2), 1_250);
  const { frames, droppedMs } = b.takeAll();
  assert.deepEqual(frames.map((f) => markerOf(f.frame)), [1, 2]);
  assert.deepEqual(frames.map((f) => f.capturedAt), [1_000, 1_250]);
  assert.equal(droppedMs, 0);
  assert.equal(b.isEmpty, true);
});

test("keeps only the newest thirty seconds and says how much was lost", () => {
  const b = new AudioBacklog(RATE);
  const frames32s = BACKLOG_SECONDS * 4 + 8;
  for (let i = 0; i < frames32s; i++) b.push(frame(i), i * 250);
  const { frames, droppedMs } = b.takeAll();
  assert.equal(frames.length, BACKLOG_SECONDS * 4);
  assert.equal(markerOf(frames[0].frame), 8);
  assert.equal(droppedMs, 2_000);
});

test("the lost-audio count resets once it has been reported", () => {
  const b = new AudioBacklog(RATE);
  for (let i = 0; i < BACKLOG_SECONDS * 4 + 4; i++) b.push(frame(i), i);
  b.takeAll();
  b.push(frame(1), 0);
  assert.equal(b.takeAll().droppedMs, 0);
});
```

`src/lib/wav.test.ts`:

```ts
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
```

Append ` ../src/lib/audioBacklog.test.ts ../src/lib/wav.test.ts` to the `test` script in `backend/package.json`.

- [ ] **Step 2: Run to see them fail**

Run: `cd backend && node --experimental-strip-types --test ../src/lib/audioBacklog.test.ts ../src/lib/wav.test.ts`
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement**

`src/lib/audioBacklog.ts` — explicit class fields, not constructor parameter properties, because `--experimental-strip-types` cannot strip those:

```ts
/**
 * Microphone frames captured while the meeting socket was down.
 *
 * `sendAudioFrame` returns false when the socket is not open, and every frame
 * of a reconnect — three seconds plus the handshake — used to be thrown away
 * with nothing on screen to say so. They are held here instead and uploaded as
 * one clip once the connection is back. Only speech reaches this point: the gate
 * in `usePcmStream` has already dropped the silence.
 */
export const BACKLOG_SECONDS = 30;

const BYTES_PER_SAMPLE = 2;

export interface HeldFrame {
  frame: ArrayBuffer;
  /** Epoch milliseconds at which the frame's audio began. */
  capturedAt: number;
}

export function frameDurationMs(byteLength: number, sampleRate: number): number {
  return (byteLength / BYTES_PER_SAMPLE / sampleRate) * 1000;
}

export class AudioBacklog {
  readonly sampleRate: number;
  private frames: HeldFrame[] = [];
  private heldBytes = 0;
  private droppedBytes = 0;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  get isEmpty(): boolean {
    return this.frames.length === 0;
  }

  push(frame: ArrayBuffer, capturedAt: number): void {
    this.frames.push({ frame, capturedAt });
    this.heldBytes += frame.byteLength;
    const cap = this.sampleRate * BYTES_PER_SAMPLE * BACKLOG_SECONDS;
    while (this.heldBytes > cap && this.frames.length > 0) {
      const oldest = this.frames.shift()!;
      this.heldBytes -= oldest.frame.byteLength;
      this.droppedBytes += oldest.frame.byteLength;
    }
  }

  /** Everything held, oldest first, and how much audio the cap cost. Resets the backlog. */
  takeAll(): { frames: HeldFrame[]; droppedMs: number } {
    const out = {
      frames: this.frames,
      droppedMs: frameDurationMs(this.droppedBytes, this.sampleRate),
    };
    this.frames = [];
    this.heldBytes = 0;
    this.droppedBytes = 0;
    return out;
  }
}
```

`src/lib/wav.ts`:

```ts
/**
 * 16-bit mono PCM as a WAV file.
 *
 * The clip route decodes with Google's `autoDecodingConfig`, which needs a
 * container: raw PCM carries no sample rate. `Int16Array` buffers are
 * little-endian on every platform Stratis runs on, which is what WAV stores.
 */
export function encodeWav(frames: ArrayBuffer[], sampleRate: number): Uint8Array<ArrayBuffer> {
  const dataBytes = frames.reduce((n, f) => n + f.byteLength, 0);
  const out = new Uint8Array(44 + dataBytes);
  const view = new DataView(out.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (const f of frames) {
    out.set(new Uint8Array(f), offset);
    offset += f.byteLength;
  }
  return out;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd backend && node --experimental-strip-types --test ../src/lib/audioBacklog.test.ts ../src/lib/wav.test.ts`
Expected: PASS, 6 tests

Run: `npx tsc --noEmit` (repo root)
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add src/lib/audioBacklog.ts src/lib/audioBacklog.test.ts src/lib/wav.ts src/lib/wav.test.ts backend/package.json
git commit -m "feat(meeting): hold audio frames through a dropped connection"
```

---

### Task 6: Speech during a dropped connection reaches the transcript (A2, meeting screen)

**Files:**
- Modify: `src/pages/Meeting.tsx` — imports (lines 1-30), module constants (after line 46), refs and callbacks around `sendAudioChunk` (lines 508-626)
- Modify: `src/i18n/th.ts` (after `Recording: "กำลังบันทึกเสียง",`, line 770)

**Interfaces:**
- Consumes: `AudioBacklog`, `frameDurationMs` (Task 5); `encodeWav` (Task 5); `capturedAt` on `/api/transcript/audio-chunk` (Task 4); existing `sendAudioFrame(frame): boolean` and `sendControl(msg): boolean` from `useSuggestionSocket`; existing `appendTranscript(row)`, which already sorts by `timestamp` — so a recovered line lands where it was said with no further change.
- Produces: `backlogRef.current` is the `AudioBacklog` for the current sample rate; Task 8 relies on `startListening`'s `beforeFlow` callback replacing it when the rate changes.

This task has no unit test of its own: the logic it wires is covered by Tasks 4 and 5, and `Meeting.tsx` has no test harness. It is verified by typecheck, build, and the manual check in Step 6.

- [ ] **Step 1: Imports and constants**

Add to the imports:

```ts
import { AudioBacklog, frameDurationMs } from "../lib/audioBacklog";
import { encodeWav } from "../lib/wav";
```

After `const FLUSH_SETTLE_MS = 1500;`, add:

```ts
// Shown when held audio is trimmed or cannot be sent. These are th.ts keys:
// the translator matches the whole sentence, so no number goes inside them.
const HELD_AUDIO_TRIMMED =
  "The connection was down longer than Stratis can hold — part of what was said in that gap is missing from the transcript.";
const HELD_AUDIO_NOT_SENT =
  "Audio from the dropped connection could not be sent — that part is missing from the transcript.";
const HELD_AUDIO_MEETING_ENDED =
  "The meeting ended before audio from the dropped connection could be sent.";
/** Waits between upload attempts for held audio; one more attempt than entries. */
const HELD_AUDIO_RETRY_MS = [1_000, 2_000, 4_000, 8_000];
```

- [ ] **Step 2: Upload the backlog**

Directly after the `sendAudioChunk` `useCallback` (it ends `}, [token, sessionId, user?.name, appendTranscript, ai]);`), add:

```ts
  const backlogRef = useRef<AudioBacklog | null>(null);
  /**
   * True once `stt:start` has gone out on the socket that is open now. The hub
   * drops binary frames that arrive before it, so until then frames are held.
   */
  const streamStartedOnSocketRef = useRef(false);
  const sendingHeldRef = useRef(false);

  /**
   * Speech captured while the socket was down, sent as one clip once it is back.
   *
   * Not written into the live stream: Google requires streaming audio at about
   * real time, and thirty seconds at once would be refused and would hold live
   * speech behind it. The clip carries the time it was captured, so the line
   * lands where it was said.
   */
  const sendHeldAudio = useCallback(async () => {
    const backlog = backlogRef.current;
    if (!backlog || backlog.isEmpty || sendingHeldRef.current || !token || !sessionId) return;
    sendingHeldRef.current = true;
    const { frames, droppedMs } = backlog.takeAll();
    if (droppedMs > 0) setError(HELD_AUDIO_TRIMMED);

    try {
      const wav = encodeWav(frames.map((f) => f.frame), backlog.sampleRate);
      const body = {
        sessionId,
        audioBase64: await blobToBase64(new Blob([wav], { type: "audio/wav" })),
        mimeType: "audio/wav",
        speaker: user?.name || "Facilitator",
        capturedAt: new Date(frames[0].capturedAt).toISOString(),
      };

      for (let attempt = 0; ; attempt += 1) {
        try {
          const payload = await apiFetch<AudioChunkResult>("/api/transcript/audio-chunk", {
            method: "POST",
            body,
          });
          if (payload?.transcript) appendTranscript(payload.transcript);
          return;
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            setError(HELD_AUDIO_MEETING_ENDED);
            return;
          }
          if (attempt >= HELD_AUDIO_RETRY_MS.length) {
            console.warn("[speech:held] Upload failed after retries:", err);
            setError(HELD_AUDIO_NOT_SENT);
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, HELD_AUDIO_RETRY_MS[attempt]));
        }
      }
    } finally {
      sendingHeldRef.current = false;
    }
  }, [token, sessionId, user?.name, appendTranscript]);
```

- [ ] **Step 3: Hold frames the socket cannot take**

Replace:

```ts
  const pcm = usePcmStream({
    onFrame: (frame) => {
      if (streamingActiveRef.current) sendAudioFrame(frame);
    },
  });
```

with:

```ts
  const pcm = usePcmStream({
    onFrame: (frame) => {
      if (!streamingActiveRef.current) return;
      if (streamStartedOnSocketRef.current && sendAudioFrame(frame)) return;
      // The socket is down, or open but not yet told to start a recogniser.
      streamStartedOnSocketRef.current = false;
      const backlog = backlogRef.current;
      if (backlog) {
        backlog.push(frame, Date.now() - frameDurationMs(frame.byteLength, backlog.sampleRate));
      }
    },
  });
```

- [ ] **Step 4: Restart the recogniser, then send what was held, on every reconnect**

Replace:

```ts
  useEffect(() => {
    if (connected && streamingActiveRef.current && streamSampleRateRef.current) {
      sendControl({
        type: "stt:start",
        sampleRate: streamSampleRateRef.current,
        speaker: user?.name || "Facilitator",
      });
    }
  }, [connected, sendControl, user?.name]);
```

with:

```ts
  useEffect(() => {
    if (!connected) {
      streamStartedOnSocketRef.current = false;
      return;
    }
    if (streamingActiveRef.current && streamSampleRateRef.current) {
      streamStartedOnSocketRef.current = sendControl({
        type: "stt:start",
        sampleRate: streamSampleRateRef.current,
        speaker: user?.name || "Facilitator",
      });
    }
    // Runs even if recording has stopped since: what was said is still owed.
    void sendHeldAudio();
  }, [connected, sendControl, user?.name, sendHeldAudio]);
```

In `startListening`, replace the `beforeFlow` callback:

```ts
        .start((sampleRate) => {
          streamSampleRateRef.current = sampleRate;
          sendControl({
            type: "stt:start",
            sampleRate,
            speaker: user?.name || "Facilitator",
          });
        })
```

with:

```ts
        .start((sampleRate) => {
          streamSampleRateRef.current = sampleRate;
          if (backlogRef.current?.sampleRate !== sampleRate) {
            backlogRef.current = new AudioBacklog(sampleRate);
          }
          streamStartedOnSocketRef.current = sendControl({
            type: "stt:start",
            sampleRate,
            speaker: user?.name || "Facilitator",
          });
        })
```

- [ ] **Step 5: Thai for the three messages**

In `src/i18n/th.ts`, after `Recording: "กำลังบันทึกเสียง",`, add:

```ts
  "The connection was down longer than Stratis can hold — part of what was said in that gap is missing from the transcript.":
    "การเชื่อมต่อหลุดนานเกินกว่าที่ Stratis จะเก็บเสียงไว้ได้ — บางส่วนของสิ่งที่พูดในช่วงนั้นจะไม่อยู่ในบทถอดเสียง",
  "Audio from the dropped connection could not be sent — that part is missing from the transcript.":
    "ส่งเสียงช่วงที่การเชื่อมต่อหลุดไม่สำเร็จ — ช่วงนั้นจะไม่อยู่ในบทถอดเสียง",
  "The meeting ended before audio from the dropped connection could be sent.":
    "การประชุมจบก่อนที่จะส่งเสียงช่วงที่การเชื่อมต่อหลุดได้",
```

Each English key must match its constant in `Meeting.tsx` character for character, including the em dash.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run build && npm --prefix backend test`
Expected: clean; build succeeds; all tests pass.

Manual check, with the owner, against a running backend with Google STT (`npm --prefix backend run dev`, `npm run dev`):

1. Start a meeting and record. Speak a sentence; it appears.
2. In DevTools → Network, set **Offline**. Say a distinct sentence. Wait 10 seconds. Set **Online**.
3. Expected: after the reconnect, the sentence appears **at the time it was said**, above anything spoken after the reconnect.
4. Repeat with 40 seconds offline. Expected: the trimmed-audio message, and only the last 30 seconds transcribed.

If the manual check is not run, the task report says so.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Meeting.tsx src/i18n/th.ts
git commit -m "fix(meeting): speech during a dropped connection reaches the transcript"
```

---

### Task 7: A state machine that notices the microphone has stopped (A3, logic)

**Files:**
- Create: `src/lib/captureHealth.ts`
- Test: `src/lib/captureHealth.test.ts`
- Modify: `backend/package.json` (`test` script)

**Interfaces:**
- Produces:
  - `type CaptureStatus = "live" | "recovering" | "lost"`
  - constants `WATCHDOG_MS = 5_000`, `RESUME_GRACE_MS = 1_000`, `REOPEN_BACKOFF_MS = [1_000, 2_000, 4_000, 4_000]`, `MAX_REOPEN_ATTEMPTS = 5`
  - `interface CaptureHealth { status: CaptureStatus; since: number; attempts: number; nextAttemptAt: number | null; reopening: boolean }`
  - `type CaptureEvent = { type: "tick"; at: number; lastFrameAt: number } | { type: "track-ended"; at: number } | { type: "context-suspended"; at: number } | { type: "reopen-succeeded"; at: number } | { type: "reopen-failed"; at: number } | { type: "retry"; at: number }`
  - `type CaptureAction = "none" | "resume-context" | "reopen"`
  - `initialHealth(at: number): CaptureHealth`
  - `stepHealth(health: CaptureHealth, event: CaptureEvent): { health: CaptureHealth; action: CaptureAction }`

- [ ] **Step 1: Write the failing tests**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_REOPEN_ATTEMPTS,
  REOPEN_BACKOFF_MS,
  WATCHDOG_MS,
  initialHealth,
  stepHealth,
  type CaptureEvent,
  type CaptureHealth,
} from "./captureHealth.ts";

function run(start: CaptureHealth, events: CaptureEvent[]) {
  let health = start;
  const actions: string[] = [];
  for (const event of events) {
    const next = stepHealth(health, event);
    health = next.health;
    actions.push(next.action);
  }
  return { health, actions };
}

test("stays live while frames keep arriving", () => {
  const { health, actions } = run(initialHealth(0), [
    { type: "tick", at: 1_000, lastFrameAt: 990 },
    { type: "tick", at: 9_000, lastFrameAt: 8_990 },
  ]);
  assert.equal(health.status, "live");
  assert.deepEqual(actions, ["none", "none"]);
});

test("five seconds without a frame starts a reopen", () => {
  const next = stepHealth(initialHealth(0), { type: "tick", at: WATCHDOG_MS + 1, lastFrameAt: 0 });
  assert.equal(next.health.status, "recovering");
  assert.equal(next.action, "reopen");
});

test("the watchdog counts from when capture started, not from the epoch", () => {
  const next = stepHealth(initialHealth(100_000), { type: "tick", at: 101_000, lastFrameAt: 0 });
  assert.equal(next.health.status, "live");
});

test("a track that ends starts a reopen at once", () => {
  assert.equal(stepHealth(initialHealth(0), { type: "track-ended", at: 10 }).action, "reopen");
});

test("a suspended context is resumed before anything is reopened", () => {
  const { health, actions } = run(initialHealth(0), [
    { type: "context-suspended", at: 100 },
    { type: "tick", at: 600, lastFrameAt: 550 },
  ]);
  assert.deepEqual(actions, ["resume-context", "none"]);
  assert.equal(health.status, "live");
});

test("a context that stays silent after resuming is reopened", () => {
  const { actions } = run(initialHealth(0), [
    { type: "context-suspended", at: 100 },
    { type: "tick", at: 1_200, lastFrameAt: 50 },
  ]);
  assert.deepEqual(actions, ["resume-context", "reopen"]);
});

test("a successful reopen returns to live", () => {
  const { health } = run(initialHealth(0), [
    { type: "track-ended", at: 10 },
    { type: "reopen-succeeded", at: 400 },
  ]);
  assert.equal(health.status, "live");
  assert.equal(health.attempts, 0);
});

test("nothing is reopened while a reopen is already running", () => {
  const reopening = stepHealth(initialHealth(0), { type: "track-ended", at: 0 }).health;
  assert.equal(stepHealth(reopening, { type: "tick", at: 60_000, lastFrameAt: 0 }).action, "none");
});

test("failed reopens wait 1s, 2s, 4s, 4s, and the fifth failure is lost", () => {
  let health = stepHealth(initialHealth(0), { type: "track-ended", at: 0 }).health;
  let at = 0;
  const waits: number[] = [];
  for (let attempt = 1; attempt < MAX_REOPEN_ATTEMPTS; attempt++) {
    health = stepHealth(health, { type: "reopen-failed", at }).health;
    assert.equal(health.status, "recovering");
    waits.push(health.nextAttemptAt! - at);
    const early = stepHealth(health, { type: "tick", at: health.nextAttemptAt! - 1, lastFrameAt: 0 });
    assert.equal(early.action, "none", "no reopen before the wait is over");
    at = health.nextAttemptAt!;
    const due = stepHealth(health, { type: "tick", at, lastFrameAt: 0 });
    assert.equal(due.action, "reopen");
    health = due.health;
  }
  assert.deepEqual(waits, [...REOPEN_BACKOFF_MS]);
  assert.equal(stepHealth(health, { type: "reopen-failed", at }).health.status, "lost");
});

test("lost stays lost until someone presses Try again", () => {
  const lost: CaptureHealth = { status: "lost", since: 0, attempts: 5, nextAttemptAt: null, reopening: false };
  assert.equal(stepHealth(lost, { type: "tick", at: 60_000, lastFrameAt: 0 }).health.status, "lost");
  const retried = stepHealth(lost, { type: "retry", at: 60_000 });
  assert.equal(retried.action, "reopen");
  assert.equal(retried.health.status, "recovering");
});
```

Append ` ../src/lib/captureHealth.test.ts` to the `test` script in `backend/package.json`.

- [ ] **Step 2: Run to see it fail**

Run: `cd backend && node --experimental-strip-types --test ../src/lib/captureHealth.test.ts`
Expected: FAIL — `Cannot find module`

- [ ] **Step 3: Implement**

```ts
/**
 * Whether the microphone is still delivering audio, and what to do when it is not.
 *
 * `usePcmStream` never listened for the track ending, the device going away, or
 * the audio context stopping. A Bluetooth headset switching profile, a USB
 * microphone unplugged, a laptop lid closed — capture ended, the status stayed
 * "streaming", and the header kept saying LIVE over a meeting nobody was
 * hearing.
 *
 * Pure so every transition is testable without a microphone. The hook feeds it
 * events and carries out the action it returns.
 *
 * Recovery never ends a recording. `lost` is shown as lost and stays one press
 * of Try again away: nothing ends a recording except the person who started it.
 */

export type CaptureStatus = "live" | "recovering" | "lost";

/** No frame for this long while live means capture has stopped, whatever the track reports. */
export const WATCHDOG_MS = 5_000;
/** How long a resumed context gets to deliver frames before it is reopened instead. */
export const RESUME_GRACE_MS = 1_000;
/** Waits after the 1st, 2nd, 3rd and 4th failed reopen. */
export const REOPEN_BACKOFF_MS = [1_000, 2_000, 4_000, 4_000] as const;
/** The failure after the last wait is final until someone retries. */
export const MAX_REOPEN_ATTEMPTS = REOPEN_BACKOFF_MS.length + 1;

export interface CaptureHealth {
  status: CaptureStatus;
  /** When the current status — or the current reopen attempt — began. */
  since: number;
  /** Reopen attempts in this recovery. */
  attempts: number;
  /** When the next reopen may start. Null while one runs, or when none is due. */
  nextAttemptAt: number | null;
  reopening: boolean;
}

export type CaptureEvent =
  | { type: "tick"; at: number; lastFrameAt: number }
  | { type: "track-ended"; at: number }
  | { type: "context-suspended"; at: number }
  | { type: "reopen-succeeded"; at: number }
  | { type: "reopen-failed"; at: number }
  | { type: "retry"; at: number };

export type CaptureAction = "none" | "resume-context" | "reopen";

interface Step {
  health: CaptureHealth;
  action: CaptureAction;
}

export function initialHealth(at: number): CaptureHealth {
  return { status: "live", since: at, attempts: 0, nextAttemptAt: null, reopening: false };
}

function beginReopen(at: number, attempts: number): Step {
  return {
    health: { status: "recovering", since: at, attempts, nextAttemptAt: null, reopening: true },
    action: "reopen",
  };
}

export function stepHealth(health: CaptureHealth, event: CaptureEvent): Step {
  const unchanged: Step = { health, action: "none" };

  switch (health.status) {
    case "live": {
      if (event.type === "track-ended") return beginReopen(event.at, 1);
      if (event.type === "context-suspended") {
        return {
          health: {
            status: "recovering",
            since: event.at,
            attempts: 0,
            nextAttemptAt: event.at + RESUME_GRACE_MS,
            reopening: false,
          },
          action: "resume-context",
        };
      }
      if (
        event.type === "tick" &&
        event.at - Math.max(event.lastFrameAt, health.since) > WATCHDOG_MS
      ) {
        return beginReopen(event.at, 1);
      }
      return unchanged;
    }

    case "recovering": {
      if (event.type === "reopen-succeeded") return { health: initialHealth(event.at), action: "none" };
      if (event.type === "reopen-failed") {
        if (health.attempts >= MAX_REOPEN_ATTEMPTS) {
          return {
            health: { ...health, status: "lost", since: event.at, nextAttemptAt: null, reopening: false },
            action: "none",
          };
        }
        return {
          health: {
            ...health,
            reopening: false,
            nextAttemptAt: event.at + REOPEN_BACKOFF_MS[health.attempts - 1],
          },
          action: "none",
        };
      }
      if (event.type === "tick" && !health.reopening) {
        if (event.lastFrameAt > health.since) return { health: initialHealth(event.at), action: "none" };
        if (health.nextAttemptAt !== null && event.at >= health.nextAttemptAt) {
          return beginReopen(event.at, health.attempts + 1);
        }
      }
      return unchanged;
    }

    case "lost":
      return event.type === "retry" ? beginReopen(event.at, 1) : unchanged;
  }
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd backend && node --experimental-strip-types --test ../src/lib/captureHealth.test.ts`
Expected: PASS, 10 tests

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 5: Commit**

```bash
git add src/lib/captureHealth.ts src/lib/captureHealth.test.ts backend/package.json
git commit -m "feat(meeting): a state machine that notices the microphone has stopped"
```

---

### Task 8: The microphone is watched, reopened, and never shown LIVE when it is not (A3, hook and screen)

**Files:**
- Modify: `src/hooks/usePcmStream.ts` (whole file becomes the version in Step 1)
- Modify: `src/pages/Meeting.tsx` — after the `pcm.error` effect (around line 580), the status chip (lines 919-921), after the error banner (lines 1116-1128)
- Modify: `src/i18n/th.ts` (beside the Task 6 entries)

**Interfaces:**
- Consumes: `initialHealth`, `stepHealth`, `CaptureAction`, `CaptureEvent`, `CaptureStatus` (Task 7); `backlogRef` replacement in `beforeFlow` (Task 6)
- Produces: `usePcmStream` returns `{ status, error, health: CaptureStatus, start, stop, retry: () => void }`. `beforeFlow(sampleRate)` is now called on the first open **and again whenever a reopen lands on a different sample rate**.

The state machine is covered by Task 7's tests; this task wires it to real devices. Verified by typecheck, build and the manual check in Step 5.

- [ ] **Step 1: Rewrite `src/hooks/usePcmStream.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import {
  NOISE_WINDOW_FRAMES,
  PRE_ROLL_FRAMES,
  frameRms,
  isSpeechFrame,
  noiseFloorFrom,
  withinHangover,
} from "../lib/speechGate";
import {
  initialHealth,
  stepHealth,
  type CaptureAction,
  type CaptureEvent,
  type CaptureStatus,
} from "../lib/captureHealth";

export type PcmStreamStatus = "idle" | "starting" | "streaming" | "error";

const TARGET_SAMPLE_RATE = 16_000;
const FRAME_MS = 250;
/** How often capture health is checked. */
const HEALTH_TICK_MS = 1_000;

const WORKLET_CODE = `
class StratisPcmTap extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length > 0) {
      const copy = new Float32Array(channel);
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true;
  }
}
registerProcessor("stratis-pcm-tap", StratisPcmTap);
`;

export interface UsePcmStreamOptions {
  onFrame: (frame: ArrayBuffer) => void;
}

export interface UsePcmStreamReturn {
  status: PcmStreamStatus;
  error: string | null;
  /** Whether the microphone is still delivering audio. Meaningful only while streaming. */
  health: CaptureStatus;
  start: (beforeFlow?: (sampleRate: number) => void) => Promise<void>;
  stop: () => void;
  /** After `lost`: try the microphone again. */
  retry: () => void;
}

function floatToInt16(input: Float32Array, out: Int16Array, offset: number): void {
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[offset + i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
}

export function usePcmStream({ onFrame }: UsePcmStreamOptions): UsePcmStreamReturn {
  const [status, setStatus] = useState<PcmStreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<CaptureStatus>("live");

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const runningRef = useRef(false);

  const queueRef = useRef<Float32Array[]>([]);
  const queuedSamplesRef = useRef(0);
  const frameSamplesRef = useRef(TARGET_SAMPLE_RATE * (FRAME_MS / 1000));

  /** Rolling window of frame loudness; the gate's estimate of the room. */
  const recentRmsRef = useRef<number[]>([]);
  const lastSpeechAtRef = useRef(0);
  const preRollRef = useRef<ArrayBuffer[]>([]);

  const healthRef = useRef(initialHealth(0));
  const lastFrameAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const beforeFlowRef = useRef<((sampleRate: number) => void) | undefined>(undefined);
  /** The rate the caller was last told about. A reopen on a new device can change it. */
  const sampleRateRef = useRef<number | null>(null);
  const dispatchRef = useRef<(event: CaptureEvent) => void>(() => {});

  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  /** Drops the device, the context and the nodes. The recording itself carries on. */
  const releaseCapture = useCallback(() => {
    for (const node of nodesRef.current) {
      try {
        node.disconnect();
      } catch {
      }
    }
    nodesRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      });
      streamRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.onstatechange = null;
      void ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    queueRef.current = [];
    queuedSamplesRef.current = 0;
    // A different device has a different room: the gate relearns it.
    recentRmsRef.current = [];
    lastSpeechAtRef.current = 0;
    preRollRef.current = [];
  }, []);

  const teardown = useCallback(() => {
    runningRef.current = false;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    sampleRateRef.current = null;
    releaseCapture();
  }, [releaseCapture]);

  // The microphone belongs to the component that opened it. Without this,
  // navigating away from the meeting left the tracks live: the browser's
  // recording indicator and the OS mic light stayed on while the user looked at
  // a page with no recording UI on it at all.
  useEffect(() => teardown, [teardown]);

  const drainFrames = useCallback(() => {
    const frameSamples = frameSamplesRef.current;
    while (queuedSamplesRef.current >= frameSamples) {
      const out = new Int16Array(frameSamples);
      let filled = 0;
      while (filled < frameSamples) {
        const head = queueRef.current[0];
        const take = Math.min(head.length, frameSamples - filled);
        floatToInt16(head.subarray(0, take), out, filled);
        if (take === head.length) queueRef.current.shift();
        else queueRef.current[0] = head.subarray(take);
        filled += take;
      }
      queuedSamplesRef.current -= frameSamples;

      const rms = frameRms(out);
      // Observed before it is judged: the floor is a minimum, so a loud frame
      // cannot raise it, and a quiet one has to be able to lower it immediately.
      recentRmsRef.current.push(rms);
      if (recentRmsRef.current.length > NOISE_WINDOW_FRAMES) recentRmsRef.current.shift();
      const speech = isSpeechFrame(rms, noiseFloorFrom(recentRmsRef.current));

      const nowMs = Date.now();
      if (speech) lastSpeechAtRef.current = nowMs;

      if (!withinHangover(nowMs, lastSpeechAtRef.current)) {
        // Held, not dropped: this is the audio just before someone starts.
        preRollRef.current.push(out.buffer);
        if (preRollRef.current.length > PRE_ROLL_FRAMES) preRollRef.current.shift();
        continue;
      }

      if (preRollRef.current.length > 0) {
        for (const held of preRollRef.current) onFrameRef.current(held);
        preRollRef.current = [];
      }
      onFrameRef.current(out.buffer);
    }
  }, []);

  const openCapture = useCallback(async () => {
    const media = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    streamRef.current = media;
    const [track] = media.getAudioTracks();
    if (track) {
      track.onended = () => dispatchRef.current({ type: "track-ended", at: Date.now() });
    }

    let ctx: AudioContext;
    let source: MediaStreamAudioSourceNode;
    try {
      ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      source = ctx.createMediaStreamSource(media);
    } catch {
      ctx = new AudioContext();
      source = ctx.createMediaStreamSource(media);
    }
    ctxRef.current = ctx;
    ctx.onstatechange = () => {
      // "interrupted" is Safari's name for a context the system took away.
      if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") {
        dispatchRef.current({ type: "context-suspended", at: Date.now() });
      }
    };

    const workletUrl = URL.createObjectURL(
      new Blob([WORKLET_CODE], { type: "application/javascript" }),
    );
    try {
      await ctx.audioWorklet.addModule(workletUrl);
    } finally {
      URL.revokeObjectURL(workletUrl);
    }

    const tap = new AudioWorkletNode(ctx, "stratis-pcm-tap", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
    });
    const mute = ctx.createGain();
    mute.gain.value = 0;

    tap.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (!runningRef.current) return;
      lastFrameAtRef.current = Date.now();
      queueRef.current.push(event.data);
      queuedSamplesRef.current += event.data.length;
      drainFrames();
    };

    frameSamplesRef.current = Math.round(ctx.sampleRate * (FRAME_MS / 1000));
    if (sampleRateRef.current !== ctx.sampleRate) {
      sampleRateRef.current = ctx.sampleRate;
      beforeFlowRef.current?.(ctx.sampleRate);
    }

    source.connect(tap);
    tap.connect(mute);
    mute.connect(ctx.destination);
    nodesRef.current = [source, tap, mute];
  }, [drainFrames]);

  const reopen = useCallback(async () => {
    releaseCapture();
    try {
      await openCapture();
      if (!runningRef.current) {
        // Stopped while the device was reopening: do not leave it open.
        releaseCapture();
        return;
      }
      dispatchRef.current({ type: "reopen-succeeded", at: Date.now() });
    } catch (err) {
      console.warn("[speech:capture] Reopening the microphone failed:", err);
      releaseCapture();
      dispatchRef.current({ type: "reopen-failed", at: Date.now() });
    }
  }, [openCapture, releaseCapture]);

  const runAction = useCallback(
    (action: CaptureAction) => {
      if (action === "resume-context") void ctxRef.current?.resume().catch(() => {});
      else if (action === "reopen") void reopen();
    },
    [reopen],
  );

  dispatchRef.current = (event: CaptureEvent) => {
    if (!runningRef.current) return;
    const next = stepHealth(healthRef.current, event);
    healthRef.current = next.health;
    setHealth(next.health.status);
    runAction(next.action);
  };

  // A device that disappears does not always end its track first.
  useEffect(() => {
    const onDeviceChange = () => {
      const track = streamRef.current?.getAudioTracks()[0];
      if (runningRef.current && track && track.readyState === "ended") {
        dispatchRef.current({ type: "track-ended", at: Date.now() });
      }
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
  }, []);

  const stop = useCallback(() => {
    teardown();
    setHealth("live");
    setStatus("idle");
  }, [teardown]);

  const start = useCallback(
    async (beforeFlow?: (sampleRate: number) => void) => {
      if (runningRef.current) return;
      setError(null);
      setStatus("starting");
      beforeFlowRef.current = beforeFlow;
      sampleRateRef.current = null;
      runningRef.current = true;

      try {
        await openCapture();
        const now = Date.now();
        healthRef.current = initialHealth(now);
        lastFrameAtRef.current = now;
        setHealth("live");
        tickRef.current = setInterval(() => {
          dispatchRef.current({ type: "tick", at: Date.now(), lastFrameAt: lastFrameAtRef.current });
        }, HEALTH_TICK_MS);
        setStatus("streaming");
      } catch (err) {
        teardown();
        const msg = err instanceof Error ? err.message : "Mic access denied";
        setError(msg);
        setStatus("error");
        throw err;
      }
    },
    [openCapture, teardown],
  );

  const retry = useCallback(() => {
    dispatchRef.current({ type: "retry", at: Date.now() });
  }, []);

  return { status, error, health, start, stop, retry };
}
```

- [ ] **Step 2: Meeting — the chip says LIVE only while audio is arriving**

In `src/pages/Meeting.tsx`, directly after:

```ts
  useEffect(() => {
    if (pcm.error) setError(pcm.error);
  }, [pcm.error]);
```

add:

```ts
  /** The clip-upload fallback has no health signal; only the PCM stream is watched. */
  const captureLive = isRecording && (pcm.status !== "streaming" || pcm.health === "live");
```

Replace the status chip:

```tsx
              <Chip icon={isRecording ? <RecDot /> : <StatusDot color={colors.textDim} />} mono>
                {isRecording ? "LIVE" : "STANDBY"}
              </Chip>
```

with:

```tsx
              <Chip
                icon={captureLive ? <RecDot /> : <StatusDot color={isRecording ? colors.red : colors.textDim} />}
                mono
              >
                {!isRecording
                  ? "STANDBY"
                  : captureLive
                    ? "LIVE"
                    : pcm.health === "recovering"
                      ? "RECONNECTING"
                      : "NOT RECORDING"}
              </Chip>
```

- [ ] **Step 3: Meeting — say what is wrong, and offer Try again when it is lost**

Directly after the error banner block (`{error && ( … )}`), add:

```tsx
        {isRecording && pcm.status === "streaming" && pcm.health !== "live" && (
          <div
            role="status"
            style={{
              background: colors.dangerBg,
              borderBottom: `1px solid ${colors.red}`,
              padding: "10px 24px",
              fontSize: FONT.size.label,
              color: colors.red,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span>
              {pcm.health === "recovering"
                ? "Microphone disconnected — reconnecting"
                : "Not recording — microphone unavailable"}
            </span>
            {pcm.health === "lost" && (
              <Button size="sm" variant="danger" onClick={pcm.retry}>
                Try again
              </Button>
            )}
          </div>
        )}
```

Nothing here calls `setIsRecording(false)` or `setRecording(false)`. A lost microphone is shown as lost; only Stop ends the recording.

- [ ] **Step 4: Thai**

In `src/i18n/th.ts`, beside the Task 6 entries, add (`Try again` already exists):

```ts
  RECONNECTING: "กำลังเชื่อมต่อใหม่",
  "NOT RECORDING": "ไม่ได้บันทึกเสียง",
  "Microphone disconnected — reconnecting": "ไมโครโฟนหลุดการเชื่อมต่อ — กำลังเชื่อมต่อใหม่",
  "Not recording — microphone unavailable": "ไม่ได้บันทึกเสียง — ใช้ไมโครโฟนไม่ได้",
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run build && npm --prefix backend test`
Expected: clean; build succeeds; all tests pass.

Manual check, with the owner, in Chrome against a running backend:

1. Record with a USB microphone or Bluetooth headset as the input. Unplug it (or switch the headset off) mid-sentence.
2. Expected within 5 seconds: chip **RECONNECTING**, the reconnecting banner; then **LIVE** again on the laptop microphone, and speech keeps reaching the transcript.
3. In Chrome's site settings for the app, block the microphone, then unplug the input again.
4. Expected after about 15 seconds of failed attempts: chip **NOT RECORDING**, the banner with **Try again**. The recording is not stopped: the Stop button is still there.
5. Allow the microphone again and press **Try again**. Expected: **LIVE**.
6. Switch the app to Thai and repeat step 1. Expected: the chip and banner are in Thai.

If the manual check is not run, the task report says so.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/usePcmStream.ts src/pages/Meeting.tsx src/i18n/th.ts
git commit -m "fix(meeting): a microphone that stops is noticed, reopened, and never shown as LIVE"
```

---

### Task 9: Verify the whole change and update the library

**Files:**
- Modify: `docs/context/03-engineering.md` (after the paragraph ending `as a gRPC error against the next thing anyone says.`, inside "Silence is not audio…")
- Modify: `docs/context/05-corrections.md` (new dated entry at the top, after the owner approves)
- Modify, only if Task 1 needed the credential override: `docs/context/04-environment.md`

**Interfaces:**
- Consumes: everything from Tasks 1-8

- [ ] **Step 1: Run the full verification floor**

```bash
npx tsc --noEmit
npm run build
npm --prefix backend run typecheck
npm --prefix backend test
```

Expected: all four clean. Keep the output for the report.

- [ ] **Step 2: Add the standing rules to `03-engineering.md`**

After the paragraph that ends `as a gRPC error against the next thing anyone says.`, add:

```markdown
## Audio is never dropped on the way to the recogniser

Three places used to throw speech away without a trace. Each now holds it, and
each rule has a pure module and a test.

- **Before the recogniser is open, audio is queued, not dropped**
  (`backend/src/lib/pendingAudio.ts`, `sttStreamCore.ts`). A Google stream opens
  asynchronously, and the 8-second idle close means the first words after every
  pause arrive during an open. The queue holds 10 seconds, releases a short burst
  and then real-time pace — Google requires streaming audio at about real time.
  The idle close never fires over held audio.
- **While the socket is down, the client keeps up to 30 seconds**
  (`src/lib/audioBacklog.ts`) and uploads it as one WAV clip with `capturedAt`
  once the socket is back. It is not written into the live stream. Frames are
  not sent before `stt:start` on the current socket: the hub drops them.
  `clampCapturedAt` believes the client's time only inside the session.
- **LIVE means frames are arriving** (`src/lib/captureHealth.ts`). Five seconds
  without a worklet frame, an ended track or a suspended context starts a
  recovery; the header says so. Recovery never ends a recording — a lost
  microphone shows Try again, and only Stop ends it.
```

- [ ] **Step 3: Log the credential workaround, if it was used**

If Task 1 needed the inline `GOOGLE_APPLICATION_CREDENTIALS`, add to the log in `docs/context/04-environment.md`:

```markdown
**Running Google STT locally with the `.env` credential path** — use instead:
`GOOGLE_APPLICATION_CREDENTIALS="$(pwd -W)/STT-service.key.json" npx tsx …` from the
repo root (adjust the path from `backend/`) — why: the `.env` value points at a
drive that does not exist on this laptop, and dotenv never overrides a variable
that is already set, so the inline value wins.
```

- [ ] **Step 4: Commit the library update**

```bash
git add docs/context/03-engineering.md docs/context/04-environment.md
git commit -m "docs(context): audio is never dropped on the way to the recogniser"
```

(`git add` of an unchanged `04-environment.md` is harmless.)

- [ ] **Step 5: Report to the owner — do not push**

The report lists:

- The four verification commands and their result.
- Which manual checks from Tasks 6 and 8 were run, and which were not.
- Task 1's measured result and the `BURST_SECONDS` it produced.
- **Not verified here:** the clip route against a real database; the fixes on the deployed Render backend.
- **For the owner to measure before the beta grows** (spec §2): how many `[stt:stream] Closing idle stream` lines one real meeting writes in the Render logs, against Google's 300 concurrent streaming sessions per region per 5 minutes.
- That nothing has been pushed, and that pushing `main` deploys to Vercel and Render.

- [ ] **Step 6: After the owner approves the fix, add the dated correction**

At the top of `docs/context/05-corrections.md` (above the newest entry), add:

```markdown
## 2026-09-11 — Audio lost on the way to the recogniser

Reported by the owner from real meetings: online voices missing, words cut or
dropped, wrong or invented text, and recordings that stopped.

Three causes were in code, and none of them showed up anywhere a person would
look:

- **Audio written while a Google stream was opening was discarded.** The idle
  close put the first words after every pause into that window, pre-roll
  included — so the onset fix for "ตกลง" arriving as "กลง" was being undone on
  the server.
- **Frames captured during a reconnect were discarded**, along with frames sent
  before `stt:start` on a new socket.
- **A microphone that stopped was never noticed.** The header said LIVE over a
  meeting nobody was hearing.

Online voices missing is a browser limit, not a defect: the website captures only
the microphone. Computer audio belongs to Stratis Desktop.

→ `03-engineering.md` (audio is never dropped on the way to the recogniser).
```

```bash
git add docs/context/05-corrections.md
git commit -m "docs(context): record the audio defects and their causes"
```
