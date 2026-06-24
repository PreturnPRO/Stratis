import { env } from "../config/env";

export interface TranscribeInput {
  audio: Buffer;
  mimeType: string;
}

export interface TranscribeResult {
  provider: "typhoon" | "mock";
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
    text: `[mock transcript] received ${input.audio.length} bytes of ${input.mimeType}. Set STT_PROVIDER=typhoon and HF_TOKEN for real STT.`,
    raw: { mock: true, bytes: input.audio.length, mimeType: input.mimeType },
  };
}

async function typhoonTranscribe(
  input: TranscribeInput,
): Promise<TranscribeResult> {
  const { hfToken, baseUrl } = env.stt.typhoon;

  if (!hfToken) {
    return mockTranscribe(input);
  }

  try {
    const res = await fetchWithTimeout(
      baseUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": input.mimeType,
        },
        body: input.audio,
      },
      env.stt.timeoutMs,
    );

    // Read raw text first so we can parse errors that might be thrown in HTML or non-standard JSON during a 503
    const rawText = await res.text();
    let parsedRaw: any = {};
    
    try {
      parsedRaw = JSON.parse(rawText);
    } catch (e) {
      parsedRaw = { unparseableResponse: rawText };
    }

    if (!res.ok) {
      // Cold-start safeguard 
      const isLoadingStr = JSON.stringify(parsedRaw).toLowerCase().includes("currently loading");
      
      if (res.status === 503 || isLoadingStr) {
        console.warn(`[stt] Typhoon model loading (503). Skipping chunk gracefully.`);
        return { provider: "typhoon", text: "", raw: { skipped: true, reason: "cold-start", ...parsedRaw } };
      }
      
      console.warn(`[stt] Typhoon error ${res.status}`);
      return { provider: "typhoon", text: "", raw: { skipped: true, error: parsedRaw } };
    }

    // Hugging Face standard text response extraction
    const text = parsedRaw?.text ?? "";
    return { provider: "typhoon", text, raw: parsedRaw };
    
  } catch (error) {
    // Graceful fallback for any network/timeout errors to keep the meeting pipeline alive
    console.warn(`[stt] Network or timeout error during Typhoon transcription.`);
    return { provider: "typhoon", text: "", raw: { skipped: true, error } };
  }
}

export async function transcribeAudio(
  input: TranscribeInput,
): Promise<TranscribeResult> {
  switch (env.stt.provider) {
    case "typhoon":
      return typhoonTranscribe(input);
    case "mock":
      return mockTranscribe(input);
    default:
      console.warn(
        `[stt] Unknown provider ${env.stt.provider}, falling back to mock`,
      );
      return mockTranscribe(input);
  }
}