// Backend entry point.
// Foundation scope (S1-T01-A … S1-T00-B): health check + auth only.
// Feature routes (sessions, transcript, AI, dashboard) are added from S1-T03 on.
// WebSocket hub for facilitator suggestion routing: S1-T03-E.
import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { authRouter } from "./auth/routes";
import { apiRouter } from "./routes";
import { requireAuth } from "./auth/middleware";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { attachHub } from "./realtime/hub";
// Importing the db module ensures the SQLite file + WAL pragmas initialise on boot.
import "./db/database";

const app = express();
app.use(cors({ origin: env.clientOrigin }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, data: { status: "up", env: env.nodeEnv } });
});

// Auth (S1-T00-B)
app.use("/api/auth", authRouter);

// API route skeleton (S1-T03-A): /api/meeting /ai /summary /session /transcript
app.use("/api", apiRouter);

// Example protected probe — confirms JWT gate works end to end.
app.get("/api/protected/ping", requireAuth, (req, res) => {
  res.json({ ok: true, data: { message: "authenticated", role: req.auth!.role } });
});

app.use(notFound);
app.use(errorHandler);

// Wrap Express in an HTTP server so the WebSocket hub (S1-T03-E) can share the
// same port and upgrade /ws connections.
const server = createServer(app);
attachHub(server);


server.listen(env.port, "0.0.0.0", () => {
  console.log(`[stratis] backend listening on port ${env.port} (${env.nodeEnv})`);
  console.log(`[stratis] websocket hub on ws://0.0.0.0:${env.port}/ws`);
});
