import { env } from "../config/env";

/**
 * Where a production crash goes so that a human finds out before a customer
 * tells them.
 *
 * Deliberately dependency-free. An APM agent is the fuller answer, but it is
 * also an account, a DSN, a build change and a new package in the tree — and
 * the thing actually missing before launch is not tracing, it is *notice*.
 * This gives notice: one line of structured JSON on stdout for every unhandled
 * failure (Render keeps stdout), and, if ERROR_WEBHOOK_URL is set, a short
 * message pushed to whatever listens there — LINE Notify, Discord, Slack, a
 * webhook relay. Adding Sentry later replaces the body of `report()` and
 * nothing else.
 *
 * Three rules it must never break, because a reporter that breaks the app it
 * reports on is worse than no reporter:
 *   1. it never throws — every path is wrapped;
 *   2. it never blocks a response — the webhook is fire-and-forget;
 *   3. it never floods — identical errors collapse for a cooldown, and there
 *      is a hard ceiling per hour, so one hot loop cannot spend the quota or
 *      the rate limit of the channel.
 */

const WEBHOOK_URL = process.env.ERROR_WEBHOOK_URL ?? "";
const DEDUP_WINDOW_MS = 5 * 60_000;
const MAX_PER_HOUR = 20;
const WEBHOOK_TIMEOUT_MS = 5_000;

const lastSent = new Map<string, number>();
let hourStartedAt = Date.now();
let sentThisHour = 0;

export interface ErrorContext {
  /** Where it happened, in words a tired person can scan: "POST /api/room/:code/join". */
  where: string;
  /** Anything safe that helps: session id, org id. Never tokens, never transcript text. */
  meta?: Record<string, string | number | null | undefined>;
}

function fingerprint(where: string, err: unknown): string {
  const name = err instanceof Error ? err.name : typeof err;
  const message = err instanceof Error ? err.message : String(err);
  // The first line only: a stack tail differs per request, the message does not.
  return `${where}|${name}|${message.slice(0, 200)}`;
}

/** True when this exact failure has already been reported inside the window. */
function shouldSuppress(key: string): boolean {
  const now = Date.now();

  if (now - hourStartedAt > 60 * 60_000) {
    hourStartedAt = now;
    sentThisHour = 0;
  }
  if (sentThisHour >= MAX_PER_HOUR) return true;

  const previous = lastSent.get(key);
  if (previous !== undefined && now - previous < DEDUP_WINDOW_MS) return true;

  lastSent.set(key, now);
  sentThisHour += 1;

  // The map is bounded by the number of distinct failures, which is small, but
  // a pathological error message (an id in the text) would grow it unbounded.
  if (lastSent.size > 500) {
    for (const [k, at] of lastSent) {
      if (now - at > DEDUP_WINDOW_MS) lastSent.delete(k);
    }
  }

  return false;
}

async function push(text: string): Promise<void> {
  if (!WEBHOOK_URL) return;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    // `content` suits Discord, `text` suits Slack and most relays. Sending both
    // costs nothing and means the URL can be swapped without a code change.
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, text }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  } catch {
    // A dead webhook must not become a second incident.
  }
}

export function reportError(err: unknown, context: ErrorContext): void {
  try {
    const key = fingerprint(context.where, err);
    const suppressed = shouldSuppress(key);

    const record = {
      level: "error",
      at: new Date().toISOString(),
      where: context.where,
      release: env.appVersion,
      env: env.nodeEnv,
      name: err instanceof Error ? err.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 6).join("\n") : undefined,
      ...context.meta,
    };

    // Always logged, even when the alert is suppressed: the log is the record,
    // the webhook is only the tap on the shoulder.
    console.error(JSON.stringify(record));

    if (suppressed) return;

    void push(
      `🔴 Stratis ${env.nodeEnv} (${env.appVersion})\n${record.where}\n${record.name}: ${record.message}`,
    );
  } catch {
    // Reporting is best-effort by definition.
  }
}

/**
 * The two failures that kill the process rather than one request. Wired once at
 * boot. `uncaughtException` is reported and then left to Node's default —
 * staying up after one is how a process ends up serving from corrupted state,
 * and Render restarts it in seconds.
 */
export function installProcessErrorHandlers(): void {
  process.on("unhandledRejection", (reason) => {
    reportError(reason, { where: "unhandledRejection" });
  });

  process.on("uncaughtException", (err) => {
    reportError(err, { where: "uncaughtException" });
    // Give the webhook a moment to leave the process before it exits.
    setTimeout(() => process.exit(1), 500).unref();
  });
}
