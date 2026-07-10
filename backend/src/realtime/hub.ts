import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { Role, SuggestionCard, WsServerEvent } from "@shared/types";
import { verifyToken, type JwtClaims } from "../auth/jwt";
import { db } from "../db/database";

interface Client {
  socket: WebSocket;
  sessionId: string;
  claims: JwtClaims;
}

// Track connections globally by userId to support real-time notification push
const userConnections = new Map<string, Set<WebSocket>>();
const facilitators = new Map<string, Set<Client>>();
let wss: WebSocketServer | null = null;

function subscribe(client: Client): void {
  // Session subscription
  let sessionSet = facilitators.get(client.sessionId);
  if (!sessionSet) {
    sessionSet = new Set();
    facilitators.set(client.sessionId, sessionSet);
  }
  sessionSet.add(client);

  // User subscription
  let userSet = userConnections.get(client.claims.sub);
  if (!userSet) {
    userSet = new Set();
    userConnections.set(client.claims.sub, userSet);
  }
  userSet.add(client.socket);
}

function unsubscribe(client: Client): void {
  // Session cleanup
  const sessionSet = facilitators.get(client.sessionId);
  if (sessionSet) {
    sessionSet.delete(client);
    if (sessionSet.size === 0) facilitators.delete(client.sessionId);
  }

  // User cleanup
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

async function ownsSession(claims: JwtClaims, sessionId: string): Promise<boolean> {
  try {
    const result = await db.query<{ facilitator_id: string }>(
      "SELECT facilitator_id FROM sessions WHERE id = $1",
      [sessionId]
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
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (socket, req) => {
    try {
      const url = new URL(req.url ?? "", "http://localhost");
      const token = url.searchParams.get("token") ?? "";
      const sessionId = url.searchParams.get("sessionId") ?? "";

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

      const authorized = await ownsSession(claims, sessionId);
      if (!authorized) {
        socket.close(4403, "Forbidden");
        return;
      }

      const client: Client = { socket, sessionId, claims };
      subscribe(client);

      send(socket, { type: "connected", sessionId, role: claims.role });

      socket.on("close", () => {
        unsubscribe(client);
      });

      socket.on("error", () => {
        unsubscribe(client);
      });

    } catch (e) {
      console.error("[ws:fatal] WS connection failure:", e);
      socket.close(5000, "Internal Server Error");
    }
  });

  return wss;
}

export function pushSuggestion(card: SuggestionCard): void {
  broadcast(card.sessionId, { type: "suggestion:new", card });
}

export function pushAnswered(
  sessionId: string,
  cardId: string,
  source: "auto" | "manual"
): void {
  broadcast(sessionId, { type: "suggestion:answered", sessionId, cardId, source });
}

/**
 * Pushes a notification dynamically to a user's active sockets if they are online [2, 3]
 */
export function pushNotification(userId: string, notification: any): void {
  const sockets = userConnections.get(userId);
  if (!sockets) return;
  for (const s of sockets) {
    send(s, { type: "notification:new", notification });
  }
}