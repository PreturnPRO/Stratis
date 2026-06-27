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
  const { apiKey, baseUrl, model } = env.stt.deepgram;

  if (!apiKey) {
    return mockTranscribe(input);
  }

  try {
    const url = `${baseUrl}?model=${encodeURIComponent(model)}&smart_format=true&punctuate=true&language=th`;
    
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

    const rawText = await res.text();
    let parsedRaw: any = {};
    
    try {
      parsedRaw = JSON.parse(rawText);
    } catch (e) {
      parsedRaw = { unparseableResponse: rawText };
    }

    if (!res.ok) {
      console.warn(`[stt] Deepgram error ${res.status}`);
      return { provider: "deepgram", text: "", raw: { skipped: true, error: parsedRaw } };
    }

    // Safely extract Deepgram's nested transcription text
    const text = parsedRaw?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    return { provider: "deepgram", text, raw: parsedRaw };
    
  } catch (error) {
    // Graceful fallback for any network/timeout errors to keep the meeting pipeline alive
    console.warn(`[stt] Network or timeout error during Deepgram transcription.`);
    return { provider: "deepgram", text: "", raw: { skipped: true, error } };
  }
}

export async function transcribeAudio(
  input: TranscribeInput,
): Promise<TranscribeResult> {
  switch (env.stt.provider) {
    case "deepgram":
      return deepgramTranscribe(input);
    case "mock":
      return mockTranscribe(input);
    default:
      console.warn(
        `[stt] Unknown provider ${env.stt.provider}, falling back to mock`,
      );
      return mockTranscribe(input);
  }
}