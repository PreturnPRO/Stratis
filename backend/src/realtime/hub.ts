import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type {
  Role,
  SuggestionCard,
  WsClientEvent,
  WsServerEvent,
  WsTranscriptRow,
} from "@shared/types";
import { verifyToken, type JwtClaims } from "../auth/jwt";
import { db } from "../db/database";
import { createSttStream, type SttStreamHandle } from "../lib/sttStream";
import { getAccountState, getReleaseCutoff } from "../lib/accountState";
import { markAudio } from "./liveness";

interface Client {
  socket: WebSocket;
  sessionId: string;
  claims: JwtClaims;
  stt?: SttStreamHandle | null;
  isAlive: boolean;
}

export type StreamIngestFn = (input: {
  sessionId: string;
  speaker: string;
  text: string;
  role: string;
}) => Promise<WsTranscriptRow | null>;

let streamIngest: StreamIngestFn | null = null;

export function registerStreamIngest(fn: StreamIngestFn): void {
  streamIngest = fn;
}

const userConnections = new Map<string, Set<WebSocket>>();
const facilitators = new Map<string, Set<Client>>();
let wss: WebSocketServer | null = null;

function subscribe(client: Client): void {
  let sessionSet = facilitators.get(client.sessionId);
  if (!sessionSet) {
    sessionSet = new Set();
    facilitators.set(client.sessionId, sessionSet);
  }
  sessionSet.add(client);

  let userSet = userConnections.get(client.claims.sub);
  if (!userSet) {
    userSet = new Set();
    userConnections.set(client.claims.sub, userSet);
  }
  userSet.add(client.socket);
}

function unsubscribe(client: Client): void {
  const sessionSet = facilitators.get(client.sessionId);
  if (sessionSet) {
    sessionSet.delete(client);
    if (sessionSet.size === 0) facilitators.delete(client.sessionId);
  }

  const userSet = userConnections.get(client.claims.sub);
  if (userSet) {
    userSet.delete(client.socket);
    if (userSet.size === 0) userConnections.delete(client.claims.sub);
  }
}

function send(socket: WebSocket, event: any): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

function broadcast(sessionId: string, event: WsServerEvent): void {
  const set = facilitators.get(sessionId);
  if (!set) return;
  for (const c of set) send(c.socket, event);
}

export function facilitatorCount(sessionId: string): number {
  return facilitators.get(sessionId)?.size ?? 0;
}

async function ownsSession(
  claims: JwtClaims,
  sessionId: string,
): Promise<boolean> {
  try {
    const result = await db.query<{ facilitator_id: string }>(
      "SELECT facilitator_id FROM sessions WHERE id = $1",
      [sessionId],
    );
    const [row] = result.rows;
    if (!row) return true;
    return row.facilitator_id === claims.sub;
  } catch (err) {
    console.error("[ws:db] Failed to verify session ownership:", err);
    return false;
  }
}

export function attachHub(server: Server): WebSocketServer {
  wss = new WebSocketServer({
    server,
    path: "/ws",
    handleProtocols: (protocols) => {
      const [protocol] = Array.from(protocols);
      return protocol ? protocol.trim() : false;
    },
  });

  wss.on("connection", async (socket, req) => {
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const sessionId = url.searchParams.get("sessionId") ?? "";

      let token = "";
      const protocolHeader = req.headers["sec-websocket-protocol"];
      const headerValue = Array.isArray(protocolHeader)
        ? protocolHeader[0]
        : protocolHeader;

      if (typeof headerValue === "string" && headerValue.length > 0) {
        token = headerValue.split(",")[0]?.trim() ?? "";
      } else {
        token = url.searchParams.get("token") ?? "";
      }

      if (!token || !sessionId) {
        socket.close(4400, "Missing credentials");
        return;
      }

      let claims: JwtClaims;
      try {
        claims = verifyToken(token);
      } catch (err) {
        socket.close(4401, "Unauthorized");
        return;
      }

      // A socket outlives the request that opened it, so the same revocation
      // checks the REST middleware runs have to happen here too — otherwise a
      // suspended facilitator keeps a live audio stream for as long as they
      // stay connected.
      const issuedAt = claims.iat ?? 0;
      const releaseCutoff = await getReleaseCutoff();
      if (releaseCutoff && issuedAt <= releaseCutoff) {
        socket.close(4401, "Session ended by update");
        return;
      }

      const account = await getAccountState(claims.sub);
      if (!account || account.status !== "active") {
        socket.close(4403, "Account is not active");
        return;
      }
      if (account.tokenValidAfter && issuedAt <= account.tokenValidAfter) {
        socket.close(4401, "Access changed");
        return;
      }
      claims = { ...claims, role: account.role, orgId: account.orgId };

      const client: Client = { socket, sessionId, claims, stt: null, isAlive: true };

      let authorized = false;
      const preAuthQueue: Array<{ data: Buffer; isBinary: boolean }> = [];
      const MAX_PREAUTH_MESSAGES = 32;

      const handleMessage = (data: Buffer, isBinary: boolean): void => {
        if (isBinary) {
          markAudio(client.sessionId);
          client.stt?.write(data);
          return;
        }
        try {
          const msg = JSON.parse(String(data)) as WsClientEvent;
          if (msg.type === "stt:start") startSttStream(client, msg);
          else if (msg.type === "stt:flush") client.stt?.flush();
          else if (msg.type === "stt:stop") stopSttStream(client);
        } catch (err) {
          console.warn("[ws] Ignoring malformed client message:", err);
        }
      };

      socket.on("message", (data, isBinary) => {
        if (authorized) {
          handleMessage(data as Buffer, isBinary);
          return;
        }
        if (preAuthQueue.length >= MAX_PREAUTH_MESSAGES) {
          preAuthQueue.shift();
        }
        preAuthQueue.push({ data: data as Buffer, isBinary });
      });

      socket.on("pong", () => {
        client.isAlive = true;
      });

      socket.on("close", () => {
        stopSttStream(client);
        unsubscribe(client);
      });

      socket.on("error", () => {
        stopSttStream(client);
        unsubscribe(client);
      });

      if (!(await ownsSession(claims, sessionId))) {
        socket.close(4403, "Forbidden");
        return;
      }
      authorized = true;

      subscribe(client);
      send(socket, { type: "connected", sessionId, role: claims.role });

      for (const queued of preAuthQueue) {
        handleMessage(queued.data, queued.isBinary);
      }
      preAuthQueue.length = 0;
    } catch (e) {
      console.error("[ws:fatal] WS connection failure:", e);
      socket.close(5000, "Internal Server Error");
    }
  });

  const HEARTBEAT_MS = 30_000;
  const heartbeat = setInterval(() => {
    const clients: Client[] = [];
    for (const set of facilitators.values()) for (const c of set) clients.push(c);
    for (const client of clients) {
      if (!client.isAlive) {
        client.socket.terminate();
        continue;
      }
      client.isAlive = false;
      try {
        client.socket.ping();
      } catch {
      }
    }
  }, HEARTBEAT_MS);
  heartbeat.unref?.();
  wss.on("close", () => clearInterval(heartbeat));

  return wss;
}

function startSttStream(
  client: Client,
  msg: Extract<WsClientEvent, { type: "stt:start" }>,
): void {
  stopSttStream(client);

  const { sessionId } = client;
  const speaker = msg.speaker?.trim() || "Facilitator";
  const role = client.claims.role;
  const sampleRateHertz = Math.min(48_000, Math.max(8_000, msg.sampleRate || 16_000));

  console.log(
    `[ws:stt] Stream started for session ${sessionId} (${sampleRateHertz} Hz, speaker "${speaker}")`,
  );

  client.stt = createSttStream({
    sessionId,
    sampleRateHertz,
    onInterim: (text) => {
      send(client.socket, { type: "stt:interim", sessionId, text });
    },
    onFinal: (text) => {
      if (!streamIngest) {
        console.error("[ws:stt] No stream ingest registered — dropping final text");
        return;
      }
      void streamIngest({ sessionId, speaker, text, role })
        .then((row) => {
          if (row) broadcast(sessionId, { type: "transcript:final", sessionId, transcript: row });
        })
        .catch((err) => {
          console.error(`[ws:stt] Ingest failed for session ${sessionId}:`, err);
          send(client.socket, {
            type: "stt:error",
            sessionId,
            message: "Failed to save transcript segment",
          });
        });
    },
    onError: (message) => {
      send(client.socket, { type: "stt:error", sessionId, message });
    },
  });
}

function stopSttStream(client: Client): void {
  if (!client.stt) return;
  client.stt.stop();
  client.stt = null;
}

export function pushSuggestion(card: SuggestionCard): void {
  broadcast(card.sessionId, { type: "suggestion:new", card });
}

export function pushNotes(sessionId: string, text: string): void {
  broadcast(sessionId, { type: "notes:update", sessionId, text });
}

export function pushAnswered(
  sessionId: string,
  cardId: string,
  source: "auto" | "manual",
): void {
  broadcast(sessionId, {
    type: "suggestion:answered",
    sessionId,
    cardId,
    source,
  });
}

export function pushNotification(userId: string, notification: any): void {
  const sockets = userConnections.get(userId);
  if (!sockets) return;
  for (const s of sockets) {
    send(s, { type: "notification:new", notification });
  }
}
