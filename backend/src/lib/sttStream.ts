
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
  flush(): void;
  stop(): void;
}

const ROTATE_AFTER_MS = 240_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const STALL_AFTER_MS = 30_000;
const OPEN_TIMEOUT_MS = 10_000;

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

const RESTARTABLE_GRPC_CODES = new Set([4, 11, 13, 14]);

function createGoogleStream(opts: SttStreamOptions): SttStreamHandle {
  let stream: BidiStream | null = null;
  let streamStartedAt = 0;
  let lastDataAt: number | null = null;
  let consecutiveFailures = 0;
  let nextOpenAllowedAt = 0;
  let openGen = 0;
  let stopped = false;

  const release = (s: BidiStream) => {
    try {
      s.end();
    } catch {
    }
    const timer = setTimeout(() => {
      try {
        s.removeAllListeners();
        s.destroy();
      } catch {
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

  let opening: Promise<void> | null = null;
  let openingStartedAt: number | null = null;

  const ensureStream = (): void => {
    if (stream || opening || stopped) return;
    if (Date.now() < nextOpenAllowedAt) return;
    const gen = ++openGen;
    openingStartedAt = Date.now();
    opening = openStream()
      .then((s) => {
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
        if (gen !== openGen) return;
        opening = null;
        openingStartedAt = null;
      });
  };

  const write = (chunk: Buffer): void => {
    if (stopped) return;
    const nowMs = Date.now();

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
    stream?.write({ audio: chunk });
  };

  return {
    write,
    flush() {
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
