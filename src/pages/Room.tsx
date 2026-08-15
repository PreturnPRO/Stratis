import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Flag } from "lucide-react";
import { FONT, LETTER_SPACING, RADIUS, SPACE } from "../constants";
import { useTheme } from "../hooks/useTheme";
import { BackLink, Button } from "../components/ui";
import { ApiError, apiFetch } from "../lib/http";

/**
 * The room's side of the checkpoint.
 *
 * Someone reads out six characters, everyone types them here, and the meeting's
 * decisions appear on their own screen while the meeting is still running. They
 * tick what matches what they heard and flag what does not, with a note.
 *
 * They cannot edit. The facilitator still owns the record; this is the room
 * telling them where to look, which is the whole reason this needs no
 * conflict resolution and no live merge.
 *
 * "Cannot" is literal: a six-character code is read out loud in a room and
 * forwarded afterwards, so anyone holding one could otherwise rewrite what the
 * meeting decided under the facilitator's name. A flag with a note carries the
 * correction; the facilitator applies it.
 */

const GUEST_KEY = "stratis.room.v1";

/** How often the open transcript panel asks for new lines. */
const TRANSCRIPT_POLL_MS = 5_000;

/** Within this far of the bottom, new lines scroll into view; further up, they do not. */
const AUTOSCROLL_SLACK_PX = 80;

interface RoomDecision {
  id: string;
  text: string;
  owner: string | null;
  dueDate: string | null;
  status: "complete" | "incomplete" | "open";
  reactions: { agree: number; flag: number; mine: "agree" | "flag" | null };
}

interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

interface RoomSession {
  token: string;
  sessionId: string;
  displayName: string;
  meetingTitle: string;
}

function readStoredSession(): RoomSession | null {
  try {
    const raw = window.localStorage.getItem(GUEST_KEY);
    return raw ? (JSON.parse(raw) as RoomSession) : null;
  } catch {
    return null;
  }
}

export default function Room({
  code: codeFromUrl,
  onBack,
}: {
  code?: string;
  /** Back to the public site. Without it this screen is a dead end. */
  onBack?: () => void;
}) {
  const { colors } = useTheme();
  const [session, setSession] = useState<RoomSession | null>(readStoredSession);
  const [code, setCode] = useState(codeFromUrl ?? "");
  const [name, setName] = useState("");
  const [preview, setPreview] = useState<{ meetingTitle: string; status: string } | null>(null);
  const [decisions, setDecisions] = useState<RoomDecision[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set once the room is over for good: ended, or the organiser closed it. */
  const [closed, setClosed] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<string | null>(null);
  const [note, setNote] = useState("");

  /** Loaded on request, not on arrival: an hour of speech is not a page header. */
  const [transcript, setTranscript] = useState<TranscriptLine[] | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const transcriptBoxRef = useRef<HTMLDivElement | null>(null);

  // Look the code up as soon as there is a whole one, so someone typing sees
  // the meeting name before they commit a name to it.
  useEffect(() => {
    const clean = code.replace(/[^a-zA-Z0-9]/g, "");
    if (clean.length !== 6 || session) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    void apiFetch<{ meetingTitle: string; status: string }>(`/api/room/${clean}`, {
      anonymous: true,
    })
      .then((data) => {
        if (!cancelled) {
          setPreview(data);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setPreview(null);
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code, session]);

  const loadCheckpoint = useCallback(async (active: RoomSession) => {
    try {
      const data = await apiFetch<{ decisions: RoomDecision[] }>(
        `/api/room/session/${active.sessionId}/checkpoint`,
        { token: active.token },
      );
      setDecisions(data.decisions ?? []);
      setError(null);
    } catch (err) {
      // A meeting that has ended, or a room the organiser closed, is a final
      // answer — not a failed request to retry every ten seconds. Say it once,
      // keep the decisions already on screen, and stop polling.
      if (err instanceof ApiError && (err.status === 410 || err.status === 401)) {
        setClosed(err.message);
        return;
      }
      setError(err instanceof Error ? err.message : "Could not load the checkpoint");
    }
  }, []);

  // The checkpoint changes while the meeting runs, and a guest holds no
  // meeting socket, so this polls. Ten seconds is well inside how fast a room
  // moves and nowhere near enough traffic to matter.
  useEffect(() => {
    if (!session || closed) return;
    void loadCheckpoint(session);
    const timer = setInterval(() => void loadCheckpoint(session), 10_000);
    return () => clearInterval(timer);
  }, [session, closed, loadCheckpoint]);

  const join = async () => {
    const clean = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (!clean || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<RoomSession>(`/api/room/${clean}/join`, {
        method: "POST",
        anonymous: true,
        body: { name: name.trim() },
      });
      window.localStorage.setItem(GUEST_KEY, JSON.stringify(data));
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this meeting");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Only what is new. `lastSeenAt` is the timestamp of the newest line already
   * on screen; the server returns what came after it, so a poll during a quiet
   * minute costs an empty array rather than the whole meeting.
   */
  const lastLineAtRef = useRef<string | null>(null);

  const loadTranscript = useCallback(async (active: RoomSession) => {
    const since = lastLineAtRef.current;
    try {
      const data = await apiFetch<{ transcript: TranscriptLine[] }>(
        `/api/room/session/${active.sessionId}/transcript${
          since ? `?since=${encodeURIComponent(since)}` : ""
        }`,
        { token: active.token },
      );
      const incoming = data.transcript ?? [];
      setTranscript((prev) => {
        // First read replaces; every later one appends. Deduped by id because a
        // line written on the same timestamp boundary can arrive twice.
        const base = since === null ? [] : (prev ?? []);
        const seen = new Set(base.map((line) => line.id));
        const merged = [...base, ...incoming.filter((line) => !seen.has(line.id))];
        const newest = merged[merged.length - 1];
        if (newest) lastLineAtRef.current = newest.timestamp;
        return merged;
      });
      setTranscriptError(null);
    } catch (err) {
      // Its own error slot: a transcript that will not load must not paint the
      // checkpoint red, and the checkpoint is the part that matters here.
      setTranscriptError(err instanceof Error ? err.message : "Could not load the transcript");
    }
  }, []);

  /**
   * The transcript keeps arriving while the panel is open.
   *
   * It was fetched exactly once — `if (transcript) return` — so a guest who
   * opened it two minutes into the meeting read those two minutes and then a
   * frozen page for the next forty, with a browser refresh as the only way to
   * see another line. The guest holds no meeting socket, so this polls, and only
   * while the panel is actually open.
   */
  useEffect(() => {
    if (!session || !transcriptOpen || closed) return;
    void loadTranscript(session);
    const timer = setInterval(() => void loadTranscript(session), TRANSCRIPT_POLL_MS);
    return () => clearInterval(timer);
  }, [session, transcriptOpen, closed, loadTranscript]);

  /**
   * Follow the meeting, unless the reader has scrolled up to re-read something.
   * Pinning to the bottom unconditionally would yank the page out from under
   * anyone checking what was said five minutes ago.
   */
  useEffect(() => {
    const box = transcriptBoxRef.current;
    if (!box || !transcriptOpen) return;
    const distanceFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight;
    if (distanceFromBottom < AUTOSCROLL_SLACK_PX) box.scrollTop = box.scrollHeight;
  }, [transcript, transcriptOpen]);

  const react = async (decisionId: string, kind: "agree" | "flag" | null, withNote?: string) => {
    if (!session) return;
    // Optimistic: a tick must feel like a tick. The next poll reconciles the
    // counts, so a lost write corrects itself within ten seconds.
    setDecisions((prev) =>
      prev.map((d) => {
        if (d.id !== decisionId) return d;
        const was = d.reactions.mine;
        const next = { ...d.reactions, mine: kind };
        if (was === "agree") next.agree -= 1;
        if (was === "flag") next.flag -= 1;
        if (kind === "agree") next.agree += 1;
        if (kind === "flag") next.flag += 1;
        return { ...d, reactions: next };
      }),
    );
    try {
      await apiFetch(`/api/room/session/${session.sessionId}/reaction`, {
        method: "POST",
        token: session.token,
        body: { decisionId, kind, note: withNote ?? null },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that");
      void loadCheckpoint(session);
    }
  };

  const leave = () => {
    window.localStorage.removeItem(GUEST_KEY);
    setSession(null);
    setDecisions([]);
    setCode("");
    setName("");
    // Without this the next room joined on this tab would ask for lines "since"
    // a timestamp from the previous meeting and show nothing.
    lastLineAtRef.current = null;
    setTranscript(null);
    setTranscriptOpen(false);
    setTranscriptError(null);
  };

  const shell: React.CSSProperties = {
    minHeight: "100dvh",
    background: colors.bg,
    color: colors.text,
    padding: SPACE[3],
    display: "flex",
    justifyContent: "center",
  };

  if (!session) {
    return (
      <div style={shell}>
        {onBack && <BackLink onClick={onBack} />}
        <div style={{ width: "100%", maxWidth: 380, paddingTop: 48 }}>
          <div
            style={{
              fontSize: FONT.size.caption,
              letterSpacing: LETTER_SPACING.wide,
              textTransform: "uppercase",
              color: colors.accent,
              fontFamily: FONT.mono,
              marginBottom: SPACE[1],
            }}
          >
            Stratis
          </div>
          <h1 style={{ fontSize: FONT.size.title, margin: `0 0 ${SPACE[1]}px`, fontWeight: 500 }}>
            Join the room
          </h1>
          <p style={{ color: colors.textMuted, fontSize: FONT.size.body, marginTop: 0 }}>
            Type the code the facilitator read out.
          </p>

          <label
            htmlFor="room-code"
            style={{ display: "block", fontSize: FONT.size.label, color: colors.textMuted, marginBottom: 6 }}
          >
            Room code
          </label>
          <input
            id="room-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            // "ACDEF4" in this field — centred, letter-spaced, monospace — was
            // indistinguishable from a code someone had already typed.
            placeholder="6 characters"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={8}
            style={{
              width: "100%",
              padding: "12px 14px",
              fontSize: 24,
              fontFamily: FONT.mono,
              letterSpacing: 6,
              textAlign: "center",
              background: colors.surface,
              border: `1px solid ${preview ? colors.accent : colors.border}`,
              borderRadius: RADIUS.md,
              color: colors.text,
              marginBottom: SPACE[2],
            }}
          />

          {preview && (
            <div
              style={{
                fontSize: FONT.size.label,
                color: colors.textMuted,
                marginBottom: SPACE[2],
                textAlign: "center",
              }}
            >
              Joining <strong style={{ color: colors.text }}>{preview.meetingTitle}</strong>
            </div>
          )}

          <label
            htmlFor="room-name"
            style={{ display: "block", fontSize: FONT.size.label, color: colors.textMuted, marginBottom: 6 }}
          >
            Your name
          </label>
          <input
            id="room-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="How the room knows you"
            maxLength={60}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: FONT.size.body,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: RADIUS.md,
              color: colors.text,
              marginBottom: SPACE[2],
            }}
          />

          {error && (
            <div style={{ color: colors.red, fontSize: FONT.size.label, marginBottom: SPACE[2] }}>
              {error}
            </div>
          )}

          {/* The one action on the screen, so it carries the product's primary
              style rather than the outline the rest of the page uses. */}
          <Button
            fullWidth
            variant="primary"
            onClick={() => void join()}
            disabled={busy || !preview || !name.trim()}
          >
            {busy ? "Joining…" : "Join"}
          </Button>

          <p style={{ color: colors.textDim, fontSize: FONT.size.caption, marginTop: SPACE[2] }}>
            No account needed. You can see and comment on this meeting's decisions
            for as long as it is running.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: SPACE[2],
            marginBottom: SPACE[2],
          }}
        >
          <div>
            <div
              style={{
                fontSize: FONT.size.caption,
                letterSpacing: LETTER_SPACING.wide,
                textTransform: "uppercase",
                color: colors.accent,
                fontFamily: FONT.mono,
              }}
            >
              Checkpoint
            </div>
            <h1 style={{ fontSize: FONT.size.heading, margin: "2px 0 0", fontWeight: 500 }}>
              {session.meetingTitle}
            </h1>
          </div>
          <button
            onClick={leave}
            style={{
              background: "transparent",
              border: "none",
              color: colors.textDim,
              fontSize: FONT.size.label,
              cursor: "pointer",
            }}
          >
            Leave
          </button>
        </div>

        <p style={{ color: colors.textMuted, fontSize: FONT.size.label, marginTop: 0 }}>
          You are in as <strong style={{ color: colors.text }}>{session.displayName}</strong>. Tick
          what matches what you heard. Flag anything that does not — the facilitator sees it.
        </p>

        {error && (
          <div style={{ color: colors.red, fontSize: FONT.size.label, marginBottom: SPACE[2] }}>
            {error}
          </div>
        )}

        {decisions.length === 0 ? (
          <div
            style={{
              padding: SPACE[3],
              border: `1px dashed ${colors.border}`,
              borderRadius: RADIUS.md,
              color: colors.textDim,
              fontSize: FONT.size.label,
              textAlign: "center",
            }}
          >
            Nothing on the checkpoint yet. It fills in as the meeting reaches decisions.
          </div>
        ) : (
          decisions.map((d) => (
            <div
              key={d.id}
              style={{
                background: colors.surface,
                border: `1px solid ${d.reactions.mine === "flag" ? colors.orange : colors.border}`,
                borderRadius: RADIUS.md,
                padding: SPACE[2],
                marginBottom: SPACE[1.5],
              }}
            >
              <div style={{ fontSize: FONT.size.body, marginBottom: 6 }}>{d.text}</div>
              <div
                style={{
                  fontSize: FONT.size.caption,
                  color: colors.textDim,
                  fontFamily: FONT.mono,
                  marginBottom: SPACE[1.5],
                }}
              >
                {d.owner || "unowned"} · {d.dueDate || "no date"}
              </div>

              <div style={{ display: "flex", gap: SPACE[1], alignItems: "center", flexWrap: "wrap" }}>
                <Button
                  size="sm"
                  variant={d.reactions.mine === "agree" ? "primary" : "subtle"}
                  iconLeft={<Check size={13} />}
                  onClick={() => void react(d.id, d.reactions.mine === "agree" ? null : "agree")}
                >
                  That's right{d.reactions.agree > 0 ? ` · ${d.reactions.agree}` : ""}
                </Button>
                <Button
                  size="sm"
                  variant={d.reactions.mine === "flag" ? "danger" : "subtle"}
                  iconLeft={<Flag size={13} />}
                  onClick={() => {
                    if (d.reactions.mine === "flag") {
                      void react(d.id, null);
                      return;
                    }
                    setFlagging(d.id);
                    setNote("");
                  }}
                >
                  Not quite{d.reactions.flag > 0 ? ` · ${d.reactions.flag}` : ""}
                </Button>
              </div>
              {/* No editor here on purpose. The code is a shared secret read out
                  loud, so an edit button on this screen is a licence for anyone
                  who overheard it to rewrite the meeting's record. "Not quite"
                  plus a note carries the correction to the facilitator, who
                  owns the wording. */}

              {flagging === d.id && (
                <div style={{ marginTop: SPACE[1.5] }}>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What did the room actually decide?"
                    rows={2}
                    maxLength={500}
                    style={{
                      width: "100%",
                      padding: 8,
                      fontSize: FONT.size.label,
                      background: colors.surfaceMuted,
                      border: `1px solid ${colors.border}`,
                      borderRadius: RADIUS.sm,
                      color: colors.text,
                      resize: "vertical",
                    }}
                  />
                  <div style={{ display: "flex", gap: SPACE[1], marginTop: 6 }}>
                    <Button
                      size="sm"
                      onClick={() => {
                        void react(d.id, "flag", note);
                        setFlagging(null);
                      }}
                    >
                      Send
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setFlagging(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* What was actually said, for the people who were in the room to hear
            it. Behind a toggle: the checkpoint is the point of this screen, and
            an hour of speech above it would bury the four lines that matter. */}
        <div style={{ marginTop: SPACE[2] }}>
          <Button
            variant="subtle"
            size="sm"
            iconLeft={<ChevronDown size={13} />}
            onClick={() => setTranscriptOpen((open) => !open)}
          >
            {transcriptOpen ? "Hide the transcript" : "Read the transcript"}
          </Button>

          {transcriptOpen && (
            <div
              ref={transcriptBoxRef}
              style={{
                marginTop: SPACE[1.5],
                maxHeight: 360,
                overflowY: "auto",
                border: `1px solid ${colors.border}`,
                borderRadius: RADIUS.md,
                padding: SPACE[2],
                background: colors.surface,
              }}
            >
              {transcriptError ? (
                <div style={{ color: colors.red, fontSize: FONT.size.label }}>{transcriptError}</div>
              ) : transcript === null ? (
                <div style={{ color: colors.textDim, fontSize: FONT.size.label }}>Loading…</div>
              ) : transcript.length === 0 ? (
                <div style={{ color: colors.textDim, fontSize: FONT.size.label }}>
                  Nothing has been transcribed yet.
                </div>
              ) : (
                transcript.map((line) => (
                  <div key={line.id} style={{ marginBottom: SPACE[1.5] }}>
                    <span
                      style={{
                        fontSize: FONT.size.caption,
                        fontFamily: FONT.mono,
                        color: colors.textDim,
                        marginRight: 8,
                      }}
                    >
                      {line.speaker}
                    </span>
                    <span style={{ fontSize: FONT.size.label, color: colors.textMuted }}>
                      {line.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* The footer used to promise live updates for ever, including long
            after the meeting ended and the polling had started failing. */}
        {closed ? (
          <div
            style={{
              marginTop: SPACE[2],
              padding: SPACE[2],
              borderRadius: RADIUS.md,
              border: `1px solid ${colors.border}`,
              background: colors.surfaceMuted,
              color: colors.textMuted,
              fontSize: FONT.size.label,
            }}
          >
            {closed} The decisions above are the last version you saw — the
            facilitator may have changed them since.
          </div>
        ) : (
        <p style={{ color: colors.textDim, fontSize: FONT.size.caption, marginTop: SPACE[2] }}>
          Updates every few seconds while the meeting runs.
        </p>
        )}
      </div>
    </div>
  );
}
