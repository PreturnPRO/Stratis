// Central environment loader. Reads the repo-root .env so all services share
// one config file (S1-T01-B). Nothing here throws if a key is missing — the
// app degrades gracefully (AI → mock, STT → browser-only).
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// backend/src/config -> repo root is three levels up
const repoRoot = resolve(__dirname, "../../..");

// Load .env.<NODE_ENV> first if present, then fall back to .env
const nodeEnv = process.env.NODE_ENV ?? "development";
config({ path: resolve(repoRoot, `.env.${nodeEnv}`) });
config({ path: resolve(repoRoot, ".env") });

function dbPath(): string {
  const url = process.env.DATABASE_URL ?? "file:./data/stratis.db";
  const rel = url.replace(/^file:/, "");
  return resolve(repoRoot, rel.replace(/^\.\//, ""));
}

const isProd = nodeEnv === "production";

// Refuse to run production auth on the publicly-known dev fallback secret —
// anyone could forge valid tokens. Set JWT_SECRET on the Railway service.
if (isProd && !process.env.JWT_SECRET) {
  throw new Error(
    "[env] JWT_SECRET is not set. Refusing to start in production with the insecure dev fallback — set JWT_SECRET on the backend service.",
  );
}

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT ?? 3001),
  // Comma-separated list — a Vercel frontend needs its production domain and
  // (optionally) preview-deploy URLs allowed, e.g.
  // CLIENT_ORIGIN=https://stratis.vercel.app,https://stratis-git-main-user.vercel.app
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  dbFile: dbPath(),

  jwtSecret: process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",

  ai: {
    provider: (process.env.AI_PROVIDER ?? "groq") as
      | "groq"
      | "ollama"
      | "mock"
      | "typhoon"
      | "gemini",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 10000),
    // Minimum gap between live-card AI calls per session. A busy meeting emits
    // a transcript row every few seconds; without pacing the live loop fires a
    // request per row and burns the provider's requests-per-minute quota
    // (Gemini free tier: 15/min, 500/day). Rows arriving inside the gap
    // coalesce — the next call re-reads the recent window, so nothing is lost;
    // it rides the next call. Raise to cut request count (at the cost of card
    // latency), lower toward 0 for the old fire-per-row behaviour.
    minCallIntervalMs: Number(process.env.AI_MIN_CALL_INTERVAL_MS ?? 15000),
    groq: {
      apiKey: process.env.GROQ_API_KEY ?? "",
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      baseUrl: "https://api.groq.com/openai/v1",
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      model: process.env.OLLAMA_MODEL ?? "llama3.1",
    },
    typhoon: {
      apiKey: process.env.TYPHOON_API_KEY ?? "",
      model: "typhoon-v1.5x-70b-instruct",
      baseUrl: "https://api.opentyphoon.ai/v1",
    },
    // 2. Add Gemini credentials block using the OpenAI-compatible endpoint
    gemini: {
      apiKey: process.env.GEMINI_API_KEY ?? "",
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      // Overflow model. Google's endpoint intermittently returns 500/503 when
      // the primary model is overloaded — the provider retries the same request
      // once on this lighter model before failing. Empty string disables the
      // fallback (single attempt). Set distinct from GEMINI_MODEL to have effect.
      fallbackModel: process.env.GEMINI_MODEL_FALLBACK ?? "gemini-2.5-flash-lite",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    },
  },

  stt: {
    provider: (process.env.STT_PROVIDER ?? "mock") as "google" | "mock",
    timeoutMs: Number(process.env.STT_TIMEOUT_MS ?? 15000),
    google: {
      // Chirp 2 / Speech v2 authenticates with OAuth2 (service account), NOT an
      // API key. Prefer a key-file path; fall back to inline JSON, else
      // Application Default Credentials.
      keyFile:
        process.env.GOOGLE_APPLICATION_CREDENTIALS ??
        process.env.STT_GOOGLE_KEY_FILE ??
        "",
      serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "",
      apiKey: process.env.GOOGLE_API_KEY ?? "", // legacy v1 only — ignored by Chirp 2
      // Chirp 2 is region-scoped: the recognizer and API endpoint live here.
      location: process.env.STT_LOCATION ?? "us-central1",
      // Optional explicit project id; otherwise resolved from the credentials.
      projectId: process.env.STT_GOOGLE_PROJECT_ID ?? "",
      // model + languages drive code-switching. chirp_2 transcribes mixed
      // Thai+English inside a single utterance when given multiple BCP-47 codes.
      model: process.env.STT_MODEL ?? "chirp_2",
      languageCodes: (process.env.STT_LANGUAGES ?? "th-TH")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    },
  },
};
