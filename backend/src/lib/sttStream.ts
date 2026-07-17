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

export interface SttStreamOptions {
  sessionId: string;
  sampleRateHertz: number;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}

export interface SttStreamHandle {
  write(chunk: Buffer): void;
  stop(): void;
}

// Rotate the gRPC stream comfortably before Google's ~305s hard limit.
const ROTATE_AFTER_MS = 240_000;
// More consecutive failures than this without a successful result in between
// means something is actually broken — surface instead of retry-looping.
const MAX_CONSECUTIVE_FAILURES = 3;

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
  let consecutiveFailures = 0;
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

      const restartable =
        RESTARTABLE_GRPC_CODES.has(err.code ?? -1) &&
        consecutiveFailures <= MAX_CONSECUTIVE_FAILURES;

      console[restartable ? "warn" : "error"](
        `[stt:stream] gRPC error (code ${err.code}, session ${opts.sessionId}, ` +
          `${restartable ? "restarting" : "giving up"}):`,
        err.message,
      );

      if (!restartable) {
        opts.onError(`Streaming STT failed: ${err.message}`);
      }
      // Restartable errors need no action here — the next write() lazily
      // reopens the stream.
    });

    return s;
  };

  // Serialize opens so overlapping write() calls can't race two streams.
  let opening: Promise<void> | null = null;

  const ensureStream = (): void => {
    if (stream || opening || stopped) return;
    opening = openStream()
      .then((s) => {
        if (stopped) {
          s?.destroy();
          return;
        }
        if (s) stream = s;
      })
      .catch((err) => {
        console.error("[stt:stream] Failed to open streaming session:", err);
        opts.onError("Could not start streaming STT session");
      })
      .finally(() => {
        opening = null;
      });
  };

  return {
    write(chunk: Buffer) {
      if (stopped) return;

      // Proactive rotation: close at the age limit; the write below (or the
      // next one, for frames arriving mid-reopen) starts a fresh stream.
      if (stream && Date.now() - streamStartedAt > ROTATE_AFTER_MS) {
        console.log(
          `[stt:stream] Rotating stream for session ${opts.sessionId} (age limit)`,
        );
        closeStream();
      }

      ensureStream();
      // Frames arriving while a stream is opening are dropped (~a syllable at
      // 250ms/frame) — acceptable for the experiment; a queue can come later.
      stream?.write({ audio: chunk });
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

  const flush = () => {
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
      if (!timer) timer = setInterval(flush, 5_000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      flush();
    },
  };
}

export function createSttStream(opts: SttStreamOptions): SttStreamHandle {
  if (env.stt.provider === "google") return createGoogleStream(opts);
  return createMockStream(opts);
}
