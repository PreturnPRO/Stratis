/**
 * The transcript, kept on this device until the record it produces is safe.
 *
 * Everything the meeting is for lives on the server — but the meeting itself is
 * unrepeatable. If the network drops at minute forty, or the summary generation
 * fails, or the tab is closed before the checkpoint is written, the words are
 * gone and no amount of retrying brings them back. So every line that arrives is
 * also written here, and this copy is deleted only once the server has confirmed
 * the summary exists.
 *
 * Deliberately localStorage rather than IndexedDB: a meeting's text is tens of
 * kilobytes, the API is synchronous so a closing tab cannot lose the last write,
 * and a recovery mechanism that is itself complicated is one more thing that can
 * fail on the day it matters.
 */

const PREFIX = "stratis.transcript.";
/** Roughly 45 minutes of dense speech; past this the oldest lines are dropped. */
const MAX_CHARS = 400_000;

export interface LocalLine {
  speaker: string;
  text: string;
  timestamp: string;
}

export interface LocalTranscript {
  sessionId: string;
  meetingTitle: string | null;
  startedAt: string;
  updatedAt: string;
  lines: LocalLine[];
}

function key(sessionId: string): string {
  return `${PREFIX}${sessionId}`;
}

export function loadLocalTranscript(sessionId: string): LocalTranscript | null {
  try {
    const raw = window.localStorage.getItem(key(sessionId));
    return raw ? (JSON.parse(raw) as LocalTranscript) : null;
  } catch {
    return null;
  }
}

/**
 * Replace this session's local copy. Called with the full list rather than one
 * line at a time so the stored copy always matches what the screen shows —
 * appending separately is how the two drift after a reconnect replays lines.
 */
export function saveLocalTranscript(
  sessionId: string,
  lines: LocalLine[],
  meta: { meetingTitle?: string | null } = {},
): void {
  if (!sessionId || lines.length === 0) return;

  try {
    const existing = loadLocalTranscript(sessionId);
    let kept = lines;

    // Drop from the front if a very long meeting would blow the quota. Losing
    // the opening is bad; losing the write — and with it everything since the
    // last successful save — is worse.
    let size = JSON.stringify(kept).length;
    while (size > MAX_CHARS && kept.length > 50) {
      kept = kept.slice(Math.ceil(kept.length * 0.2));
      size = JSON.stringify(kept).length;
    }

    const record: LocalTranscript = {
      sessionId,
      meetingTitle: meta.meetingTitle ?? existing?.meetingTitle ?? null,
      startedAt: existing?.startedAt ?? kept[0]?.timestamp ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lines: kept,
    };

    window.localStorage.setItem(key(sessionId), JSON.stringify(record));
  } catch {
    // Quota, private mode, a disabled store: none of these are worth
    // interrupting a live meeting for. The server copy is still the primary.
  }
}

/** Called once the server has confirmed the summary exists. */
export function clearLocalTranscript(sessionId: string): void {
  try {
    window.localStorage.removeItem(key(sessionId));
  } catch {
    /* nothing to do */
  }
}

/**
 * Every local transcript still waiting for its summary, newest first.
 *
 * A non-empty list means a meeting happened whose record was never confirmed —
 * which is exactly the case the user needs to be told about, because they are
 * the only one who can still do something with it.
 */
export function orphanedTranscripts(): LocalTranscript[] {
  const out: LocalTranscript[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as LocalTranscript;
        if (parsed?.lines?.length) out.push(parsed);
      } catch {
        /* a corrupt entry is not worth failing the list for */
      }
    }
  } catch {
    return [];
  }

  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Plain text, in the shape someone would paste into LINE or a document. */
export function toPlainText(record: LocalTranscript): string {
  const header = [
    record.meetingTitle ?? "Stratis meeting",
    new Date(record.startedAt).toLocaleString(),
    "",
  ].join("\n");

  const body = record.lines
    .map((line) => `[${new Date(line.timestamp).toLocaleTimeString()}] ${line.speaker}: ${line.text}`)
    .join("\n");

  return `${header}${body}\n`;
}

export function downloadTranscript(record: LocalTranscript): void {
  const blob = new Blob([toPlainText(record)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stratis-${(record.meetingTitle ?? "meeting").replace(/[^\w-]+/g, "-").toLowerCase()}-${record.startedAt.slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on a later tick: revoking synchronously after click() drops the
  // download in Firefox and Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
