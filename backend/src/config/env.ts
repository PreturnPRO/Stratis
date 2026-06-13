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

export const env = {
  nodeEnv,
  isProd: nodeEnv === "production",
  port: Number(process.env.PORT ?? 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",

  dbFile: dbPath(),

  jwtSecret: process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",

  // AI provider (S1-T03-B). Free + self-trainable options:
  //   groq   → free hosted Llama 3.3 70B (needs GROQ_API_KEY)
  //   ollama → fully local + fine-tunable open model (run Ollama, no key)
  //   mock   → deterministic offline stub (no network). Auto-used if groq has no key.
  ai: {
    provider: (process.env.AI_PROVIDER ?? "groq") as "groq" | "ollama" | "mock",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 10000),
    groq: {
      apiKey: process.env.GROQ_API_KEY ?? "",
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      baseUrl: "https://api.groq.com/openai/v1",
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
      model: process.env.OLLAMA_MODEL ?? "llama3.1",
    },
  },
  stt: {
    provider: (process.env.STT_PROVIDER ?? "mock") as "deepgram" | "mock",
    timeoutMs: Number(process.env.STT_TIMEOUT_MS ?? 15000),
    deepgram: {
      apiKey: process.env.DEEPGRAM_API_KEY ?? "",
      model: process.env.DEEPGRAM_MODEL ?? "nova-2",
      baseUrl: "https://api.deepgram.com/v1/listen",
    },
  },

  // NOTE: speech-to-text config (S1-T04) is added later.

  repoRoot,
};

export type Env = typeof env;
