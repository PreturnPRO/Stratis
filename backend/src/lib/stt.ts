import { env } from "../config/env";

export interface TranscribeInput {
  audio: Buffer;
  mimeType: string;
}

export interface TranscribeResult {
  provider: "deepgram" | "mock";
  text: string;
  raw?: unknown;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function mockTranscribe(input: TranscribeInput): TranscribeResult {
  return {
    provider: "mock",
    text: `[mock transcript] received ${input.audio.length} bytes of ${input.mimeType}. Set STT_PROVIDER=deepgram and DEEPGRAM_API_KEY for real STT.`,
    raw: { mock: true, bytes: input.audio.length, mimeType: input.mimeType },
  };
}

async function deepgramTranscribe(
  input: TranscribeInput,
): Promise<TranscribeResult> {
  const { apiKey, model, baseUrl } = env.stt.deepgram;

  if (!apiKey) {
    return mockTranscribe(input);
  }

  const url = `${baseUrl}?model=${encodeURIComponent(model)}&smart_format=true&punctuate=true`;

  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": input.mimeType,
      },
      body: input.audio,
    },
    env.stt.timeoutMs,
  );

  const raw: any = await res.json();

  if (!res.ok) {
    const message = `Deepgram error ${res.status}: ${JSON.stringify(raw)}`;

    // Browser MediaRecorder can occasionally emit a tiny/partial chunk,
    // especially on stop. Deepgram may reject that as corrupt/unsupported.
    // Treat 400 as "no transcript for this chunk" instead of crashing
    // the live meeting pipeline.
    if (res.status === 400) {
      console.warn(`[stt] ${message}`);

      return {
        provider: "deepgram",
        text: "",
        raw: {
          skipped: true,
          reason: "deepgram_rejected_chunk",
          error: raw,
        },
      };
    }

    throw new Error(message);
  }

  const text = raw?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

  return {
    provider: "deepgram",
    text,
    raw,
  };
}

export async function transcribeAudio(
  input: TranscribeInput,
): Promise<TranscribeResult> {
  if (env.stt.provider === "deepgram") {
    return deepgramTranscribe(input);
  }

  return mockTranscribe(input);
}
