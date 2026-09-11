
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
  if (env.stt.provider === "google") {
    return createStreamCore(opts, { open: () => openGoogleStream(opts) });
  }
  return createMockStream(opts);
}
