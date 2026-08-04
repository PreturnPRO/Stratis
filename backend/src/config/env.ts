import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

const nodeEnv = process.env.NODE_ENV ?? "development";
config({ path: resolve(repoRoot, `.env.${nodeEnv}`) });
config({ path: resolve(repoRoot, ".env") });

function dbPath(): string {
  const url = process.env.DATABASE_URL ?? "file:./data/stratis.db";
  const rel = url.replace(/^file:/, "");
  return resolve(repoRoot, rel.replace(/^\.\//, ""));
}

const isProd = nodeEnv === "production";

if (isProd && !process.env.JWT_SECRET) {
  throw new Error(
    "[env] JWT_SECRET is not set. Refusing to start in production with the insecure dev fallback — set JWT_SECRET on the backend service.",
  );
}

export const env = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT ?? 3001),
  clientOrigins: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  dbFile: dbPath(),

  jwtSecret: process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  /** A guest link should outlive one meeting, not a week. */
  guestTokenExpiresIn: process.env.GUEST_TOKEN_EXPIRES_IN ?? "12h",

  /**
   * Reported by /api/system/version and stamped on telemetry rows. Set this per
   * deploy (Render exposes RENDER_GIT_COMMIT) so the beta dashboard can tell
   * which build produced an event.
   */
  appVersion:
    process.env.APP_VERSION ??
    process.env.RENDER_GIT_COMMIT?.slice(0, 7) ??
    "dev",

  /** Where the browser lands after an OAuth round trip or an invite accept. */
  appUrl: (process.env.APP_URL ?? process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")[0]
    .trim(),

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    /**
     * Must match a redirect URI registered on the Google Cloud OAuth client
     * exactly, including the scheme and any trailing path.
     */
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ??
      `http://localhost:${Number(process.env.PORT ?? 3001)}/api/auth/google/callback`,
    /** Google sign-in is off until both halves of the credential are present. */
    get enabled(): boolean {
      return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    },
  },

  ai: {
    provider: (process.env.AI_PROVIDER ?? "groq") as
      | "groq"
      | "ollama"
      | "mock"
      | "typhoon"
      | "gemini",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 10000),
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
    gemini: {
      apiKey: process.env.GEMINI_API_KEY ?? "",
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      fallbackModel: process.env.GEMINI_MODEL_FALLBACK ?? "gemini-2.5-flash-lite",
      minRequestIntervalMs: Number(process.env.GEMINI_MIN_REQUEST_INTERVAL_MS ?? 4000),
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    },
  },

  stt: {
    provider: (process.env.STT_PROVIDER ?? "mock") as "google" | "mock",
    timeoutMs: Number(process.env.STT_TIMEOUT_MS ?? 15000),
    google: {
      keyFile:
        process.env.GOOGLE_APPLICATION_CREDENTIALS ??
        process.env.STT_GOOGLE_KEY_FILE ??
        "",
      serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "",
      apiKey: process.env.GOOGLE_API_KEY ?? "",
      location: process.env.STT_LOCATION ?? "us-central1",
      projectId: process.env.STT_GOOGLE_PROJECT_ID ?? "",
      model: process.env.STT_MODEL ?? "chirp_2",
      languageCodes: (process.env.STT_LANGUAGES ?? "th-TH")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
    },
  },
};
