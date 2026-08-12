import { useCallback, useEffect, useState } from "react";
import { Check, Flag } from "lucide-react";
import { FONT, LETTER_SPACING, RADIUS, SPACE } from "../constants";
import { useTheme } from "../hooks/useTheme";
import { BackLink, Button } from "../components/ui";
import { apiFetch } from "../lib/http";

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
 */

const GUEST_KEY = "stratis.room.v1";

interface RoomDecision {
  id: string;
  text: string;
  owner: string | null;
  dueDate: string | null;
  status: "complete" | "incomplete" | "open";
  reactions: { agree: number; flag: number; mine: "agree" | "flag" | null };
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
  const [flagging, setFlagging] = useState<string | null>(null);
  const [note, setNote] = useState("");

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
      setError(err instanceof Error ? err.message : "Could not load the checkpoint");
    }
  }, []);

  // The checkpoint changes while the meeting runs, and a guest holds no
  // meeting socket, so this polls. Ten seconds is well inside how fast a room
  // moves and nowhere near enough traffic to matter.
  useEffect(() => {
    if (!session) return;
    void loadCheckpoint(session);
    const timer = setInterval(() => void loadCheckpoint(session), 10_000);
    return () => clearInterval(timer);
  }, [session, loadCheckpoint]);

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
            placeholder="ACDEF4"
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

          <Button fullWidth onClick={() => void join()} disabled={busy || !preview || !name.trim()}>
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

        <p style={{ color: colors.textDim, fontSize: FONT.size.caption, marginTop: SPACE[2] }}>
          Updates every few seconds while the meeting runs.
        </p>
      </div>
    </div>
  );
}
