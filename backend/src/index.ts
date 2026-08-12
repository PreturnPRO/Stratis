import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { authRouter } from "./auth/routes";
import { googleRouter } from "./auth/google";
import { apiRouter } from "./routes";
import { requireAuth } from "./auth/middleware";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { attachHub } from "./realtime/hub";
import { startSessionSweeper } from "./realtime/sessionSweeper";
import { selectProvider } from "@ai/index";
import { installProcessErrorHandlers, reportError } from "./lib/errorReporter";
import { applySchema } from "./db/applySchema";
import "./db/database";

// Before anything can throw: a rejected promise in the WebSocket hub or the
// sweeper never reaches Express, so without this it dies in silence.
installProcessErrorHandlers();

const app = express();
// Render terminates TLS one hop in front of this process. Trusting exactly that
// hop is what makes req.ip the caller rather than the proxy, which is what the
// rate limiter counts. `true` would trust a client-supplied X-Forwarded-For.
app.set("trust proxy", 1);
app.use(cors({ origin: env.clientOrigins }));
app.use(express.json({ limit: "10mb" }));

// Reports which providers this deploy actually resolved to. Both fall back to
// a mock when their credentials are missing, and the mock is quiet: a release
// with STT_PROVIDER unset looks healthy right up until the first meeting
// transcribes "[mock transcript]". Names only — no keys, no endpoints.
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    data: {
      status: "up",
      env: env.nodeEnv,
      providers: { ai: selectProvider().name, stt: env.stt.provider },
    },
  });
});

app.use("/api/auth", authRouter);
app.use("/api/auth", googleRouter);

app.use("/api", apiRouter);

app.get("/api/protected/ping", requireAuth, (req, res) => {
  res.json({ ok: true, data: { message: "authenticated", role: req.auth!.role } });
});

app.use(notFound);
app.use(errorHandler);

const server = createServer(app);
attachHub(server);

/**
 * Schema first, then the port.
 *
 * A deploy that ships code needing a new column, with the migration left for
 * someone to remember, serves 500s from the moment it goes green — and the
 * deploy itself looks successful. `schema.sql` is idempotent and guarded by an
 * advisory lock, so applying it on every boot costs one no-op query and closes
 * that window entirely. A migration that fails must stop the release, so this
 * refuses to listen rather than starting against the wrong schema.
 *
 * SKIP_SCHEMA_ON_BOOT=1 opts out, for a database an operator is holding still.
 */
async function boot() {
  if (process.env.SKIP_SCHEMA_ON_BOOT !== "1") {
    try {
      await applySchema();
      console.log("[stratis] schema applied");
    } catch (err) {
      reportError(err, { where: "boot:applySchema" });
      console.error("[stratis] REFUSING TO START — schema could not be applied:", err);
      process.exit(1);
    }
  }

  startSessionSweeper();

  server.listen(env.port, "0.0.0.0", () => {
    console.log(`[stratis] backend listening on port ${env.port} (${env.nodeEnv})`);
    console.log(`[stratis] websocket hub on ws://0.0.0.0:${env.port}/ws`);
    console.log(
      `[stratis] AI provider: ${selectProvider().name} (AI_PROVIDER=${env.ai.provider})`,
    );
  });
}

void boot();
