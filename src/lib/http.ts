import { API_BASE } from "./api";

const STORAGE_KEY = "stratis.auth.v1";

/**
 * Broadcast when the server says this session is over — a release drew a
 * logout line under it, or an admin revoked the account. AuthContext listens
 * and clears local state, so every screen reacts to it the same way instead of
 * each fetch site inventing its own handling.
 */
export const SESSION_ENDED_EVENT = "stratis:session-ended";

export type SessionEndReason = "revoked" | "suspended" | "updated" | "expired";

export interface SessionEndedDetail {
  reason: SessionEndReason;
  message: string;
}

export function announceSessionEnded(detail: SessionEndedDetail): void {
  window.dispatchEvent(new CustomEvent<SessionEndedDetail>(SESSION_ENDED_EVENT, { detail }));
}

function readToken(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: unknown;

  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Send without the stored token — used by the invite and login screens. */
  anonymous?: boolean;
  /** Use this token instead of the stored one (guest links). */
  token?: string | null;
}

/**
 * The single door to the API.
 *
 * Every call goes through here so that the three things that must be handled
 * identically everywhere — the auth header, the ok/error envelope, and a
 * session the server has ended — are handled in one place.
 */
export async function apiFetch<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, anonymous, token: explicitToken, headers, ...rest } = options;
  const token = anonymous ? null : explicitToken ?? readToken();

  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const code = payload?.code;
    const message = payload?.error ?? `Request failed (${response.status})`;

    if (response.status === 401 || code === "TOKEN_REVOKED") {
      announceSessionEnded({
        reason: code === "TOKEN_REVOKED" ? "updated" : "expired",
        message,
      });
    } else if (code === "ACCOUNT_REVOKED" || code === "ACCOUNT_SUSPENDED") {
      announceSessionEnded({
        reason: code === "ACCOUNT_REVOKED" ? "revoked" : "suspended",
        message,
      });
    }

    throw new ApiError(message, response.status, code, payload?.data);
  }

  return (payload?.data ?? (payload as unknown)) as T;
}
