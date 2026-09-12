/**
 * Stratis Desktop signs in through this website (desktop spec §6).
 *
 * The app opens `#/desktop?port=N&state=S&challenge=C`. This file holds the
 * rules: which requests are well formed, how one survives a trip through
 * sign-in — Google's redirect leaves the page, so it rides in sessionStorage —
 * and where the browser goes once the person clicks Continue.
 */

export interface DesktopRequest {
  port: number;
  state: string;
  challenge: string;
}

type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY = "stratis.desktopSignIn.v1";
/** BASE64URL(SHA-256(verifier)). */
const CHALLENGE_SHAPE = /^[A-Za-z0-9_-]{43}$/;
/** The app sends base64url; nothing that could break out of a query string gets through. */
const STATE_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;
const PORT_SHAPE = /^\d{4,5}$/;

export function parseDesktopRequest(params: Record<string, string>): DesktopRequest | null {
  const { port, state, challenge } = params;
  if (!PORT_SHAPE.test(port ?? "")) return null;
  const portNumber = Number(port);
  if (portNumber < 1024 || portNumber > 65535) return null;
  if (!STATE_SHAPE.test(state ?? "") || !CHALLENGE_SHAPE.test(challenge ?? "")) return null;
  return { port: portNumber, state, challenge };
}

export function desktopRequestHash(request: DesktopRequest): string {
  const query = new URLSearchParams({
    port: String(request.port),
    state: request.state,
    challenge: request.challenge,
  });
  return `#/desktop?${query.toString()}`;
}

export function rememberDesktopRequest(storage: SessionStore, request: DesktopRequest): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(request));
}

/** Reads and forgets: a request resumes once, never on every later visit. */
export function takeDesktopRequest(storage: SessionStore): DesktopRequest | null {
  const raw = storage.getItem(STORAGE_KEY);
  storage.removeItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Record<string, unknown>;
    return parseDesktopRequest({
      port: String(stored.port ?? ""),
      state: String(stored.state ?? ""),
      challenge: String(stored.challenge ?? ""),
    });
  } catch {
    return null;
  }
}

export function desktopCallbackUrl(request: DesktopRequest, code: string, lang: "th" | "en"): string {
  const query = new URLSearchParams({ code, state: request.state, lang });
  return `http://127.0.0.1:${request.port}/callback?${query.toString()}`;
}
