// Explicit .ts extensions: this module is covered by `node --test`, which strips
// types rather than resolving like a bundler.
import { streamAction, isOpenWedged, openBackoffMs } from "./sttStreamPolicy.ts";
import { PendingAudio } from "./pendingAudio.ts";

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

export interface BidiStream {
  write(chunk: unknown): boolean;
  end(): void;
  destroy(): void;
  on(event: "data", cb: (resp: StreamingResponse) => void): void;
  on(event: "error", cb: (err: Error & { code?: number }) => void): void;
  removeAllListeners(): void;
}

export interface StreamingResponse {
  results?: Array<{
    alternatives?: Array<{ transcript?: string }>;
    isFinal?: boolean;
  }>;
}

export interface StreamDeps {
  /** Opens a recogniser that has already been sent its configuration. Null when STT is unavailable. */
  open: () => Promise<BidiStream | null>;
  /** Injected so tests control rotation and pacing. */
  now?: () => number;
}

const ROTATE_AFTER_MS = 240_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const STALL_AFTER_MS = 30_000;
const OPEN_TIMEOUT_MS = 10_000;

/**
 * Close the recogniser when the room goes quiet.
 *
 * The client now gates on speech and sends nothing during silence, which is
 * what stops Chirp inventing transcripts out of room tone — but an open
 * streaming session that receives no audio is a session Google eventually times
 * out itself, and that arrives here as a gRPC error and a backoff on the next
 * thing anyone says. Closing it deliberately turns a quiet meeting into no open
 * stream at all; the next frame opens a fresh one.
 *
 * Eight seconds is far inside Google's own audio timeout and far outside the
 * client's 1.2s speech hangover, so a normal conversation never touches it.
 */
const IDLE_CLOSE_MS = 8_000;
const IDLE_CHECK_MS = 2_000;

const RESTARTABLE_GRPC_CODES = new Set([4, 11, 13, 14]);

/** How often held audio is re-offered to the pacing queue. */
const PUMP_INTERVAL_MS = 100;

export function createStreamCore(opts: SttStreamOptions, deps: StreamDeps): SttStreamHandle {
  const now = deps.now ?? Date.now;
  let stream: BidiStream | null = null;
  let streamStartedAt = 0;
  let lastDataAt: number | null = null;
  let consecutiveFailures = 0;
  let nextOpenAllowedAt = 0;
  let openGen = 0;
  let stopped = false;
  let lastWriteAt = 0;
  let idleTimer: ReturnType<typeof setInterval> | null = null;

  const pending = new PendingAudio(opts.sampleRateHertz);
  let pumpTimer: ReturnType<typeof setTimeout> | null = null;
  let flushWhenOpen = false;
  let overflowLogged = false;

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

  let opening: Promise<void> | null = null;
  let openingStartedAt: number | null = null;

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

  const ensureStream = (): void => {
    if (stream || opening || stopped) return;
    if (now() < nextOpenAllowedAt) return;
    const gen = ++openGen;
    openingStartedAt = now();
    opening = openStream()
      .then((s) => {
        if (stopped || gen !== openGen) {
          s?.destroy();
          return;
        }
        if (!s) return;
        stream = s;
        if (flushWhenOpen) {
          flushWhenOpen = false;
          for (const piece of pending.releaseAll()) s.write({ audio: piece });
          closeStream();
          return;
        }
        pump();
      })
      .catch((err) => {
        if (gen !== openGen) return;
        consecutiveFailures += 1;
        nextOpenAllowedAt = now() + openBackoffMs(consecutiveFailures);
        console.error("[stt:stream] Failed to open streaming session:", err);
        opts.onError("Could not start streaming STT session");
      })
      .finally(() => {
        if (gen !== openGen) return;
        opening = null;
        openingStartedAt = null;
      });
  };

  const startIdleWatch = (): void => {
    if (idleTimer) return;
    idleTimer = setInterval(() => {
      if (stopped || !stream) return;
      // Never close over held audio: it would sit in the queue until someone spoke again.
      if (pending.size > 0 || now() - lastWriteAt < IDLE_CLOSE_MS) return;
      console.log(`[stt:stream] Closing idle stream for session ${opts.sessionId}`);
      closeStream();
    }, IDLE_CHECK_MS);
    idleTimer.unref?.();
  };

  const write = (chunk: Buffer): void => {
    if (stopped) return;
    const nowMs = now();
    lastWriteAt = nowMs;
    startIdleWatch();

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

    const dropped = pending.push(chunk);
    if (dropped > 0 && !overflowLogged) {
      overflowLogged = true;
      console.warn(
        `[stt:stream] Held audio passed the cap for session ${opts.sessionId}; ` +
          `dropped the oldest ${Math.round((dropped / pending.bytesPerSecond) * 1000)}ms`,
      );
    }
    pump();
  };

  return {
    write,
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
  };
}
