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
  timeoutMs: number
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

async function deepgramTranscribe(input: TranscribeInput): Promise<TranscribeResult> {
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
    env.stt.timeoutMs
  );

  const raw: any = await res.json();

  if (!res.ok) {
    throw new Error(`Deepgram error ${res.status}: ${JSON.stringify(raw)}`);
  }

  const text =
    raw?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

  return {
    provider: "deepgram",
    text,
    raw,
  };
}

export async function transcribeAudio(input: TranscribeInput): Promise<TranscribeResult> {
  if (env.stt.provider === "deepgram") {
    return deepgramTranscribe(input);
  }

  return mockTranscribe(input);
}