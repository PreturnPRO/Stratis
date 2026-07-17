import { v2 } from "@google-cloud/speech";
import { env } from "../config/env";

const { SpeechClient } = v2;
type SpeechV2Client = InstanceType<typeof v2.SpeechClient>;

export interface TranscribeInput {
  audio: Buffer;
  mimeType: string;
}

export interface TranscribeResult {
  provider: "google" | "mock";
  text: string;
  raw?: unknown;
}

let googleClient: SpeechV2Client | null = null;
let resolvedProjectId: string | null = null;

// Corrected index type access  to extract the first element of the parameter tuple (ClientOptions)
 type SpeechClientOptions = NonNullable<ConstructorParameters<typeof v2.SpeechClient>[0]>;

function buildClientOptions(): SpeechClientOptions {
  const { keyFile, serviceAccountJson, location } = env.stt.google;
  
  // Initialize with the correct regional endpoint
  const opts: SpeechClientOptions = {
    apiEndpoint: `${location}-speech.googleapis.com`,
  };

  if (keyFile) {
    opts.keyFilename = keyFile;
  } else if (serviceAccountJson) {
    try {
      opts.credentials = JSON.parse(serviceAccountJson);
    } catch (err) {
      console.error(
        "[stt:google] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON:",
        err,
      );
    }
  }
  return opts;
}

function getGoogleClient(): SpeechV2Client | null {
  if (googleClient) return googleClient;
  try {
    googleClient = new SpeechClient(buildClientOptions());
    console.log(
      `[stt] Google Speech v2 client initialized (region ${env.stt.google.location}, model ${env.stt.google.model}).`,
    );
    return googleClient;
  } catch (err) {
    console.error("[stt:google] Failed to initialize Google Speech v2 client:", err);
    return null;
  }
}

async function getProjectId(client: SpeechV2Client): Promise<string> {
  if (resolvedProjectId) return resolvedProjectId;
  resolvedProjectId = env.stt.google.projectId || (await client.getProjectId());
  return resolvedProjectId;
}

function mockTranscribe(input: TranscribeInput): TranscribeResult {
  return {
    provider: "mock",
    text: `[mock transcript] received ${input.audio.length} bytes of ${input.mimeType}. Set STT_PROVIDER=google for real STT.`,
    raw: { mock: true, bytes: input.audio.length, mimeType: input.mimeType },
  };
}

async function googleTranscribe(input: TranscribeInput): Promise<TranscribeResult> {
  const client = getGoogleClient();
  if (!client) {
    console.warn("[stt] Google client uninitialized, falling back to mock.");
    return mockTranscribe(input);
  }

  try {
    const projectId = await getProjectId(client);
    const { location, model, languageCodes } = env.stt.google;
    const audioBytes = input.audio.toString("base64");

    const request = {
      recognizer: `projects/${projectId}/locations/${location}/recognizers/_`,
      config: {
        autoDecodingConfig: {}, // Dynamically handles browser WebM/Opus audio
        languageCodes: languageCodes,
        model: model,
      },
      content: audioBytes,
    };

    const [response] = await client.recognize(request);
    
    // Process and merge the transcribed audio segments safely (bracket-free)
    const textParts: string[] = [];
    const results = response.results || [];
    
    for (const res of results) {
      const alternatives = res.alternatives || [];
      const [firstAlternative] = alternatives;
      if (firstAlternative && firstAlternative.transcript) {
        textParts.push(firstAlternative.transcript);
      }
    }

    const text = textParts.join(" ").trim();

    return {
      provider: "google",
      text,
      raw: response,
    };
  } catch (error) {
    // The gRPC INVALID_ARGUMENT wraps the real cause in BadRequest.fieldViolations
    // (which field, and why). String(error) hides it — surface it explicitly.
    const anyErr = error as {
      details?: string;
      statusDetails?: Array<{ fieldViolations?: unknown }>;
    };
    const violations = anyErr?.statusDetails?.[0]?.fieldViolations;
    console.error("[stt:google] API error:", anyErr?.details ?? error);
    if (violations) {
      console.error(
        "[stt:google] field violations:",
        JSON.stringify(violations, null, 2),
      );
    }
    return {
      provider: "google",
      text: "",
      raw: { error: String(error), violations },
    };
  }
}

export async function transcribeAudio(
  input: TranscribeInput,
): Promise<TranscribeResult> {
  switch (env.stt.provider) {
    case "google":
      return googleTranscribe(input);
    case "mock":
    default:
      return mockTranscribe(input);
  }
}

// ── Streaming STT (S-EXP) ────────────────────────────────────────────────────
// Shared context for lib/sttStream.ts, which drives Speech v2 StreamingRecognize
// over the same client, recognizer path, and language/model config as the
// batch path above.

export interface GoogleStreamingContext {
  client: SpeechV2Client;
  recognizer: string;
  model: string;
  languageCodes: string[];
}

/** Null when STT_PROVIDER is not "google" or the client cannot initialize —
 * callers should fall back to mock streaming. */
export async function getGoogleStreamingContext(): Promise<GoogleStreamingContext | null> {
  if (env.stt.provider !== "google") return null;
  const client = getGoogleClient();
  if (!client) return null;

  const projectId = await getProjectId(client);
  const { location, model, languageCodes } = env.stt.google;

  return {
    client,
    recognizer: `projects/${projectId}/locations/${location}/recognizers/_`,
    model,
    languageCodes,
  };
}