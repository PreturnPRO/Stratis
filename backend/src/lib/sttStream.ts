// S-EXP — Streaming STT over Google Speech v2 StreamingRecognize.
//
// Replaces the clip-batch flow (6s standalone WebM clips → REST recognize) for
// clients that opt in over the WebSocket hub. Audio arrives as raw PCM16LE
// mono frames, so gRPC stream restarts need no container header and lose no
// audio context beyond the in-flight utterance.
//
// Google closes a streaming session at ~5 minutes; the stream proactively
// rotates well before that (ROTATE_AFTER_MS) and also restarts once on
// transient gRPC errors. STT_PROVIDER=mock (or a failed client init) degrades
// to a timer-based mock stream so the feature stays demoable without creds.

import { getGoogleStreamingContext } from "./stt";
import { env } from "../config/env";
import { streamAction, isOpenWedged, openBackoffMs } from "./sttStreamPolicy";

export interface SttStreamOptions {
  sessionId: string;
  sampleRateHertz: number;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}

export interface SttStreamHandle {
  write(chunk: Buffer): void;
  /** Half-close the underlying stream so pending finals land (checkpoint reads
   * a complete transcript mid-recording); the next write reopens it. */
  flush(): void;
  stop(): void;
}

// Rotate the gRPC stream comfortably before Google's ~305s hard limit.
const ROTATE_AFTER_MS = 240_000;
// More consecutive failures than this without a successful result in between
// means something is actually broken — surface instead of retry-looping.
const MAX_CONSECUTIVE_FAILURES = 3;
// Watchdog: frames are flowing but Google has produced zero results for this
// long → assume the stream died silently and rotate it. Rotating a healthy
// stream in a silent room is harmless (nothing buffered, reopen is cheap), so
// this can be aggressive. This automates the manual fix facilitators found:
// toggling the mic, which rebuilt the stream handle.
const STALL_AFTER_MS = 30_000;
// A single-flight open attempt that hangs past this is abandoned so it can't
// wedge the handle forever (the pre-watchdog failure mode: one hung
// getGoogleStreamingContext() dropped every subsequent frame silently).
const OPEN_TIMEOUT_MS = 10_000;

// Minimal shape of the duplex stream returned by _streamingRecognize().
interface BidiStream {
  write(chunk: unknown): boolean;
  end(): void;
  destroy(): void;
  on(event: "data", cb: (resp: StreamingResponse) => void): void;
  on(event: "error", cb: (err: Error & { code?: number }) => void): void;
  removeAllListeners(): void;
}

interface StreamingResponse {
  results?: Array<{
    alternatives?: Array<{ transcript?: string }>;
    isFinal?: boolean;
  }>;
}

// gRPC codes worth one silent restart: DEADLINE_EXCEEDED(4), OUT_OF_RANGE(11 —
// Google's "audio exceeded maximum allowed stream duration"), INTERNAL(13),
// UNAVAILABLE(14).
const RESTARTABLE_GRPC_CODES = new Set([4, 11, 13, 14]);

function createGoogleStream(opts: SttStreamOptions): SttStreamHandle {
  let stream: BidiStream | null = null;
  let streamStartedAt = 0;
  /** Last interim/final from Google on the current stream; null = none yet. */
  let lastDataAt: number | null = null;
  let consecutiveFailures = 0;
  /** Earliest time a reopen may be attempted (failure backoff). */
  let nextOpenAllowedAt = 0;
  /** Generation counter: bumping it discards any in-flight open attempt. */
  let openGen = 0;
  let stopped = false;

  // Half-close: end our write side so Google flushes any pending final result
  // (listeners stay attached to receive it), then hard-destroy after a grace
  // period. Used for both explicit stop and mid-meeting rotation — dropping
  // listeners before end() would eat the last utterance.
  const release = (s: BidiStream) => {
    try {
      s.end();
    } catch {
      /* already gone */
    }
    const timer = setTimeout(() => {
      try {
        s.removeAllListeners();
        s.destroy();
      } catch {
        /* already gone */
      }
    }, 8_000);
    timer.unref?.();
  };

  const closeStream = () => {
    if (!stream) return;
    const s = stream;
    stream = null;
    release(s);
  };

  const openStream = async (): Promise<BidiStream | null> => {
    const ctx = await getGoogleStreamingContext();
    if (!ctx) return null;

    const s = ctx.client._streamingRecognize() as unknown as BidiStream;
    streamStartedAt = Date.now();
    lastDataAt = null;

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

    s.on("data", (resp) => {
      consecutiveFailures = 0;
      nextOpenAllowedAt = 0;
      lastDataAt = Date.now();
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

      // Never give up permanently: every failure schedules a backed-off lazy
      // reopen on a later write. Only the noise level differs — expected codes
      // restart quietly; anything else (e.g. 8 RESOURCE_EXHAUSTED quota) also
      // alerts the client so the facilitator sees WHY transcription is paused.
      nextOpenAllowedAt = Date.now() + openBackoffMs(consecutiveFailures);

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

  // Serialize opens so overlapping write() calls can't race two streams.
  let opening: Promise<void> | null = null;
  let openingStartedAt: number | null = null;

  const ensureStream = (): void => {
    if (stream || opening || stopped) return;
    if (Date.now() < nextOpenAllowedAt) return; // failure backoff window
    const gen = ++openGen;
    openingStartedAt = Date.now();
    opening = openStream()
      .then((s) => {
        // A bumped generation means this attempt was abandoned (hung past
        // OPEN_TIMEOUT_MS) or the handle stopped — discard the late stream.
        if (stopped || gen !== openGen) {
          s?.destroy();
          return;
        }
        if (s) stream = s;
      })
      .catch((err) => {
        if (gen !== openGen) return;
        consecutiveFailures += 1;
        nextOpenAllowedAt = Date.now() + openBackoffMs(consecutiveFailures);
        console.error("[stt:stream] Failed to open streaming session:", err);
        opts.onError("Could not start streaming STT session");
      })
      .finally(() => {
        if (gen !== openGen) return; // a newer attempt owns these fields now
        opening = null;
        openingStartedAt = null;
      });
  };

  const write = (chunk: Buffer): void => {
    if (stopped) return;
    const nowMs = Date.now();

    // Rotation: proactive age limit, or the stall watchdog (frames flowing but
    // zero results — the silent-death mode that used to require a mic toggle).
    if (
      stream &&
      streamAction({
        now: nowMs,
        streamStartedAt,
        lastDataAt,
        rotateAfterMs: ROTATE_AFTER_MS,
        stallAfterMs: STALL_AFTER_MS,
      }) === "rotate"
    ) {
      console.log(
        `[stt:stream] Rotating stream for session ${opts.sessionId} ` +
          `(${nowMs - streamStartedAt > ROTATE_AFTER_MS ? "age limit" : "stall watchdog"})`,
      );
      closeStream();
    }

    // A hung open attempt would otherwise block reopening forever — abandon it
    // (bump the generation so its late resolution is discarded) and retry.
    if (isOpenWedged({ now: nowMs, openingStartedAt, timeoutMs: OPEN_TIMEOUT_MS })) {
      console.warn(
        `[stt:stream] Open attempt hung >${OPEN_TIMEOUT_MS}ms for session ` +
          `${opts.sessionId} — abandoning and retrying`,
      );
      openGen += 1;
      opening = null;
      openingStartedAt = null;
    }

    ensureStream();
    // Frames arriving while a stream is opening are dropped (~a syllable at
    // 250ms/frame) — acceptable for the experiment; a queue can come later.
    stream?.write({ audio: chunk });
  };

  return {
    write,
    flush() {
      // Half-close the current stream so Google finalizes and emits any pending
      // utterance (listeners stay attached in release()); the next audio frame
      // lazily reopens. Lets the checkpoint read a complete transcript without
      // the facilitator stopping the mic.
      if (stopped || !stream) return;
      console.log(`[stt:stream] Flushing stream for session ${opts.sessionId}`);
      closeStream();
    },
    stop() {
      stopped = true;
      closeStream();
    },
  };
}

function createMockStream(opts: SttStreamOptions): SttStreamHandle {
  let bytes = 0;
  let chunks = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const flushBuffered = () => {
    if (bytes === 0) return;
    opts.onFinal(
      `[mock stream] transcribed ${(bytes / 1024).toFixed(0)} KB of PCM ` +
        `(${chunks} frames). Set STT_PROVIDER=google for real streaming STT.`,
    );
    bytes = 0;
    chunks = 0;
  };

  return {
    write(chunk: Buffer) {
      bytes += chunk.length;
      chunks += 1;
      opts.onInterim(`[mock stream] hearing audio… (${(bytes / 1024).toFixed(0)} KB)`);
      if (!timer) timer = setInterval(flushBuffered, 5_000);
    },
    flush() {
      flushBuffered();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      flushBuffered();
    },
  };
}

export function createSttStream(opts: SttStreamOptions): SttStreamHandle {
  if (env.stt.provider === "google") return createGoogleStream(opts);
  return createMockStream(opts);
}
