import { API_BASE } from "./api";

const STORAGE_KEY = "stratis.auth.v1";
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH = 20;

export interface ClientEvent {
  event: string;
  surface?: string;
  sessionId?: string;
  props?: Record<string, unknown>;
}

let queue: ClientEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let appVersion = "";

export function setTrackedVersion(version: string): void {
  appVersion = version;
}

function readToken(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? ((JSON.parse(raw) as { token?: string }).token ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Queue an event.
 *
 * Batched and fire-and-forget on purpose: telemetry must never add a request to
 * the critical path of a meeting, and a failed send is dropped rather than
 * retried forever. Send identifiers and counts only — never transcript text or
 * anything a participant said.
 */
export function track(event: string, props?: Record<string, unknown>, surface?: string): void {
  queue.push({ event, props, surface });
  if (queue.length >= MAX_BATCH) {
    void flush();
    return;
  }
  if (!timer) timer = setTimeout(() => void flush(), FLUSH_INTERVAL_MS);
}

export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;

  const events = queue.map((e) => ({ ...e, appVersion }));
  queue = [];

  const token = readToken();
  try {
    await fetch(`${API_BASE}/api/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ events }),
      keepalive: true,
    });
  } catch {
    // Dropped. An unreachable analytics endpoint is not the user's problem.
  }
}

/** Flush on the way out, so the last events of a session are not lost. */
export function installTrackFlush(): void {
  const send = () => void flush();
  window.addEventListener("pagehide", send);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") send();
  });
}
