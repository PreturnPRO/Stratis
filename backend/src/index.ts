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
import "./db/database";

const app = express();
app.use(cors({ origin: env.clientOrigins }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, data: { status: "up", env: env.nodeEnv } });
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
startSessionSweeper();

server.listen(env.port, "0.0.0.0", () => {
  console.log(`[stratis] backend listening on port ${env.port} (${env.nodeEnv})`);
  console.log(`[stratis] websocket hub on ws://0.0.0.0:${env.port}/ws`);
  console.log(
    `[stratis] AI provider: ${selectProvider().name} (AI_PROVIDER=${env.ai.provider})`,
  );
});
