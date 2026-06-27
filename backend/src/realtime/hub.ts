// Realtime hub (S1-T03-E). One WebSocketServer mounted at /ws on the HTTP
// server. A client connects with a JWT and a sessionId:
//
//   ws://host/ws?token=<jwt>&sessionId=<id>
//
// Routing rule that defines this task: suggestion events go to the FACILITATOR
// of that session ONLY. Participants may connect (e.g. for future transcript
// streams) but are never subscribed to suggestion events. The transcript panel
// is a separate concern — suggestions never ride this channel to participants.
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

// sessionId -> facilitator sockets subscribed to its suggestion stack.
const facilitators = new Map<string, Set<Client>>();

let wss: WebSocketServer | null = null;

function subscribe(client: Client): void {
  let set = facilitators.get(client.sessionId);
  if (!set) {
    set = new Set();
    facilitators.set(client.sessionId, set);
  }
  set.add(client);
}

function unsubscribe(client: Client): void {
  const set = facilitators.get(client.sessionId);
  if (!set) return;
  set.delete(client);
  if (set.size === 0) facilitators.delete(client.sessionId);
}

function send(socket: WebSocket, event: WsServerEvent): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

/** Broadcast an event to every facilitator socket on a session. */
function broadcast(sessionId: string, event: WsServerEvent): void {
  const set = facilitators.get(sessionId);
  if (!set) return;
  for (const c of set) send(c.socket, event);
}

/**
 * Guard: the connecting user may only attach to a session they facilitate.
 * If the session row exists, the facilitator_id must match. If it does not yet
 * exist (session lifecycle lands in S1-T03-F), we allow the bind so the
 * pipeline is testable ahead of that task.
 * 
 * Converted to async to support PostgreSQL queries.
 */
async function ownsSession(claims: JwtClaims, sessionId: string): Promise<boolean> {
  const result = await db.query<{ facilitator_id: string }>(
    `SELECT facilitator_id FROM sessions WHERE id = $1`,
    [sessionId]
  );
  const row = result.rows[0];
  if (!row) return true;
  return row.facilitator_id === claims.sub;
}

/** Mount the WS server on the shared HTTP server. */
export function attachHub(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" });

  // Make the connection handler async to await the DB validation query
  wss.on("connection", async (socket, req) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const token = url.searchParams.get("token") ?? "";
    const sessionId = url.searchParams.get("sessionId") ?? "";

    if (!token || !sessionId) {
      send(socket, { type: "connected", sessionId, role: "participant" });
      socket.close(1008, "token and sessionId required");
      return;
    }

    let claims: JwtClaims;
    try {
      claims = verifyToken(token);
    } catch {
      socket.close(1008, "invalid token");
      return;
    }

    const role: Role = claims.role;
    send(socket, { type: "connected", sessionId, role });

    try {
      // Await the asynchronous database check
      const owns = await ownsSession(claims, sessionId);

      // Only the session's facilitator is subscribed to suggestion events.
      if (role !== "facilitator" || !owns) {
        // Participants/others stay connected but receive no suggestion events.
        return;
      }

      const client: Client = { socket, sessionId, claims };
      subscribe(client);
      socket.on("close", () => unsubscribe(client));
      socket.on("error", () => unsubscribe(client));

    } catch (error) {
      console.error("[hub] Database error during websocket connection validation:", error);
      // Cleanly close the socket on an internal DB error to avoid hanging connections
      socket.close(1011, "internal server error");
    }
  });

  return wss;
}

/** Push a new suggestion card to the session's facilitator stack (top of stack). */
export function pushSuggestion(card: SuggestionCard): void {
  broadcast(card.sessionId, { type: "suggestion:new", card });
}

/** Tell the facilitator a card has been answered (strikethrough). */
export function pushAnswered(
  sessionId: string,
  cardId: string,
  source: "auto" | "manual"
): void {
  broadcast(sessionId, { type: "suggestion:answered", sessionId, cardId, source });
}

/** How many facilitator sockets are live on a session (used by tests/ops). */
export function facilitatorCount(sessionId: string): number {
  return facilitators.get(sessionId)?.size ?? 0;
}