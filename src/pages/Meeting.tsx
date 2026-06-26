// S1-T03-D/E: wires AI pipeline to BlockRenderer + suggestion card stack.
//
// E2E: user types → POST /api/ai/structure → validated blocks → BlockRenderer.
//
// S1-T03-E: a second call, POST /api/ai/suggest (facilitator-only), turns any
// QuestionSuggestion blocks into cards on the server and pushes them over
// /ws to the facilitator's stack — never to BlockRenderer / the transcript
// panel, and never to participants. A third call, POST /api/ai/suggest/scan,
// runs auto-detect: if this chunk answers an already-open card, the server
// strikes it through over the same socket.
//
// S1-T04-C will replace manual input with live STT chunks (stub is here).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, RotateCw } from "lucide-react";
import { COLORS } from "../constants";
import { RADIUS } from "../tokens/colors";
import { Button, IconButton, Chip, Modal } from "../components/ui";
import { EmptyState, LoadingState } from "../components/states";
import { SuggestionCardStack } from "../components/SuggestionCardStack";
import BlockRenderer from "../components/BlockRenderer";
import { useAiBlocks } from "../hooks/useAiBlocks";
import { useSuggestionSocket } from "../hooks/useSuggestionSocket";
/* import { useMediaRecorder } from "../hooks/useMediaRecorder"; */
import { useAuth } from "../context/AuthContext";
import { useSessionRecovery } from "../hooks/useSessionRecovery";
import type { AIBlock } from "../../shared/types";

import { API_BASE } from "../lib/api";
const ACTIVE_SESSION_KEY = "stratis.activeSessionId.v1";

/*
const MIN_AUDIO_CHUNK_BYTES = 2048;

function getPreferredRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

const RECORDER_MIME_TYPE = getPreferredRecorderMimeType();
*/

interface MeetingProps {
  onNav?: (id: string, params?: Record<string, string>) => void;
}

interface TranscriptRow {
  id: string;
  session_id?: string;
  speaker: string;
  text: string;
  timestamp: string;
}

interface AudioChunkResponse {
  ok: boolean;
  error?: string;
  data?: {
    transcript?: TranscriptRow;
    stt?: {
      provider: string;
      text: string;
    };
    ai?: {
      provider: string;
      blocks: AIBlock[];
    };
    answered?: string[];
  };
}

function isRealSessionId(value: string | null | undefined): value is string {
  if (!value) return false;
  const clean = value.trim();
  return (
    clean !== "" &&
    clean !== "session_demo" &&
    clean !== "undefined" &&
    clean !== "null"
  );
}

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/*
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}
*/

// Pulsing red dot used in the recording chip.
function RecDot() {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 9, height: 9 }}>
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: COLORS.red,
          animation: "recPulse 1.5s ease-out infinite",
        }}
      />
      <span
        style={{
          position: "relative",
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: COLORS.red,
          boxShadow: `0 0 6px ${COLORS.red}`,
        }}
      />
    </span>
  );
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
        display: "inline-block",
      }}
    />
  );
}

export default function Meeting({ onNav }: MeetingProps) {
  const { token, user } = useAuth();
  const recovery = useSessionRecovery({ token });
  const ai = useAiBlocks();

  const recoveredSessionId = recovery.sessionId;
  const [manualSessionId, setManualSessionId] = useState<string | null>(() => {
    return window.localStorage.getItem(ACTIVE_SESSION_KEY);
  });

  const sessionId = isRealSessionId(recoveredSessionId)
    ? recoveredSessionId
    : isRealSessionId(manualSessionId)
      ? manualSessionId
      : null;

  const [transcripts, setTranscripts] = useState<TranscriptRow[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingChunk, setSendingChunk] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Web Speech API Native Recoding State
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  // Planned meeting length (minutes) chosen at creation, stored per session.
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [wrapUpDismissed, setWrapUpDismissed] = useState(false);

  // Live meeting timer — anchored to the server start time when known, else to
  // the moment this session became active in the UI.
  const [startMs, setStartMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  const authHeaders = useMemo((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const { cards, role, connected, markAnswered, markActive } =
    useSuggestionSocket(sessionId);

  const appendTranscript = useCallback((row: TranscriptRow) => {
    setTranscripts((prev) => {
      if (prev.some((p) => p.id === row.id)) return prev;
      return [...prev, row];
    });
  }, []);

  /* // --- OLD AUDIO CHUNKING LOGIC ---
  const sendAudioChunk = useCallback(
    async (blob: Blob) => {
      if (!token || !sessionId) return;

      if (blob.size < MIN_AUDIO_CHUNK_BYTES) {
        console.warn("[meeting] skipped tiny audio chunk", {
          size: blob.size,
          type: blob.type,
        });
        return;
      }

      const chunkMimeType = blob.type || RECORDER_MIME_TYPE || "audio/webm";

      console.log("[meeting] audio chunk", {
        size: blob.size,
        type: chunkMimeType,
      });

      setSendingChunk(true);
      setError(null);

      try {
        const buffer = await blob.arrayBuffer();
        const audioBase64 = arrayBufferToBase64(buffer);

        const res = await fetch(`${API_BASE}/api/transcript/audio-chunk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            sessionId,
            session_id: sessionId,
            speaker: user?.name ?? "Facilitator",
            mimeType: chunkMimeType,
            mime_type: chunkMimeType,
            audioBase64,
            audio_base64: audioBase64,
          }),
        });

        const data: AudioChunkResponse = await res.json();

        if (!data.ok) {
          setError(data.error ?? "Audio chunk failed");
          return;
        }

        if (data.data?.transcript?.text?.trim()) {
          appendTranscript(data.data.transcript);
        } else if (data.data?.stt?.text?.trim()) {
          appendTranscript({
            id: `local_${Date.now()}`,
            session_id: sessionId,
            speaker: user?.name ?? "Facilitator",
            text: data.data.stt.text,
            timestamp: new Date().toISOString(),
          });
        }

        if (data.data?.ai?.blocks?.length) {
          ai.append(data.data.ai.blocks, data.data.ai.provider);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not send audio chunk",
        );
      } finally {
        setSendingChunk(false);
      }
    },
    [token, sessionId, authHeaders, user?.name, appendTranscript, ai],
  );

  const recorder = useMediaRecorder({
    onChunk: (chunk) => {
      void sendAudioChunk(chunk);
    },
    chunkIntervalMs: 8000,
    mimeType: RECORDER_MIME_TYPE,
  });
  */

  // --- NEW WEB SPEECH API TEXT CHUNKING LOGIC ---
  const sendTextChunk = useCallback(async (text: string) => {
    if (!token || !sessionId || !text.trim()) return;

    setSendingChunk(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/transcript/chunk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          sessionId,
          session_id: sessionId,
          speaker: user?.name ?? "Facilitator",
          text
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Text chunk failed");
        return;
      }

      if (data.data?.transcript) {
        appendTranscript(data.data.transcript);
      }

      if (data.data?.ai?.blocks?.length) {
        ai.append(data.data.ai.blocks, data.data.ai.provider);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send text chunk");
    } finally {
      setSendingChunk(false);
    }
  }, [token, sessionId, authHeaders, user?.name, appendTranscript, ai]);

  // Initialise the Web Speech API engine exactly once on mount.
  // No dependency on sendTextChunk — handlers are re-wired via refs so the
  // engine instance is never recreated (eliminates the memory leak caused by
  // re-running this effect every time sendTextChunk changed).
  const sendTextChunkRef = useRef(sendTextChunk);
  useEffect(() => { sendTextChunkRef.current = sendTextChunk; }, [sendTextChunk]);

  useEffect(() => {
    const SpeechRecognitionEngine =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionEngine) {
      setError("Your browser does not support the Web Speech API.");
      return;
    }

    const recognition = new SpeechRecognitionEngine();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "th-TH";

    // Call through the ref so this handler always uses the latest
    // sendTextChunk without needing the effect to re-run.
    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      if (text) sendTextChunkRef.current(text);
    };

    // Auto-restart after silence timeouts while the meeting is still active.
    recognition.onend = () => {
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.warn("[speech] restart collision — already running", e);
        }
      }
    };

    recognition.onerror = (event: any) => {
      // 'aborted' and 'no-speech' are normal silence-timeout events;
      // onend fires next and restarts the engine automatically.
      const expected = new Set(["aborted", "no-speech"]);
      if (!expected.has(event.error)) {
        console.warn("[speech] unexpected error:", event.error);
        setError(`Microphone error: ${event.error}`);
      }
    };

    recognitionRef.current = recognition;

    // Cleanup: stop the engine when the component unmounts.
    // Do NOT call .stop() mid-session — stopListening() handles that.
    return () => {
      isRecordingRef.current = false;
      recognition.onend = null; // prevent auto-restart during teardown
      recognition.stop();
    };
  }, []); // empty deps — one instance for the lifetime of the component

  const startListening = () => {
    if (!recognitionRef.current) return;
    setIsRecording(true);
    isRecordingRef.current = true;
    try {
      recognitionRef.current.start();
    } catch (e) {
      // Engine may already be running if onend restarted it just before the
      // user clicked; safe to ignore.
      console.warn("[speech] start collision — already running", e);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    // Clear flag BEFORE .stop() so the onend guard does not restart.
    setIsRecording(false);
    isRecordingRef.current = false;
    recognitionRef.current.stop();
  };

  const loadTranscript = useCallback(async () => {
    if (!token || !sessionId) return;

    setLoadingTranscript(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/transcript/session/${sessionId}`,
        {
          headers: authHeaders,
        },
      );

      const data = await res.json();

      if (!data.ok) {
        setError(data.error ?? "Could not load transcript");
        return;
      }

      const rows = data.data?.transcripts ?? data.data?.rows ?? [];

      setTranscripts(rows);
    } catch {
      setError("Could not reach transcript endpoint");
    } finally {
      setLoadingTranscript(false);
    }
  }, [token, sessionId, authHeaders]);

  useEffect(() => {
    if (!sessionId) return;

    setManualSessionId(sessionId);
    window.localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);

    void loadTranscript();
  }, [sessionId, loadTranscript]);

  // Anchor the meeting timer.
  useEffect(() => {
    if (!sessionId) {
      setStartMs(null);
      return;
    }
    const serverStart = recovery.session?.started_at
      ? new Date(recovery.session.started_at).getTime()
      : NaN;
    setStartMs((prev) =>
      Number.isFinite(serverStart) ? serverStart : prev ?? Date.now(),
    );
  }, [sessionId, recovery.session?.started_at]);

  // Load the planned duration for this session (set on the dashboard). Default
  // to 60 min if none was stored.
  useEffect(() => {
    if (!sessionId) {
      setDurationMin(null);
      return;
    }
    const raw = window.localStorage.getItem(`stratis.duration.${sessionId}`);
    const n = raw ? parseInt(raw, 10) : NaN;
    setDurationMin(Number.isFinite(n) && n > 0 ? n : 60);
    setWrapUpDismissed(false);
  }, [sessionId]);

  // Tick the timer once per second while a session is open.
  useEffect(() => {
    if (!sessionId) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sessionId]);

  // Follow the conversation: auto-scroll to newest line if the user is at/near
  // the bottom (don't yank them back up while they scroll history).
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [transcripts]);

  const handleEndMeeting = async () => {
    if (!token || !sessionId) return;

    // recorder.stop();
    stopListening();
    setEnding(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/session/${sessionId}/end`, {
        method: "POST",
        headers: authHeaders,
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error ?? "Could not end meeting");
      }

      window.localStorage.removeItem(ACTIVE_SESSION_KEY);
      recovery.clearRecoveredSession();

      onNav?.("document", { sessionId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end meeting");
      setShowEndConfirm(false);
    } finally {
      setEnding(false);
    }
  };

  const canRecord = !!sessionId && !!token && !ending;
  const elapsed =
    sessionId && startMs != null
      ? Math.max(0, Math.floor((nowMs - startMs) / 1000))
      : null;

  // Countdown against the planned duration. Wrap-up window = final 15 minutes.
  const WRAP_UP_SEC = 15 * 60;
  const remainingSec =
    durationMin != null && elapsed != null ? durationMin * 60 - elapsed : null;
  const inWrapUp =
    remainingSec != null && remainingSec <= WRAP_UP_SEC && remainingSec > 0;
  const overtime = remainingSec != null && remainingSec <= 0;
  const timeColor = overtime
    ? COLORS.red
    : inWrapUp
      ? COLORS.amber
      : COLORS.textMuted;

  const meetingTitle = recovery.session?.meeting_title?.trim() || "Live meeting";
  const sessionShort = sessionId
    ? `…${sessionId.slice(-6)}`
    : "";

  if (recovery.status === "loading" && !sessionId) {
    return (
      <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1 }}>
        <LoadingState count={3} persist />
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1 }}>
        <h1
          style={{
            color: COLORS.text,
            fontSize: 22,
            fontWeight: 600,
            margin: "0 0 24px",
          }}
        >
          Meeting
        </h1>

        <EmptyState message="No active meeting session. Start a meeting from Dashboard." />

        <div style={{ marginTop: 18 }}>
          <Button variant="primary" onClick={() => onNav?.("dashboard")}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ display: "flex", flex: 1, minHeight: 0, background: COLORS.bg }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          minHeight: 0,
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div
          style={{
            borderBottom: `1px solid ${COLORS.border}`,
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                color: COLORS.text,
                fontSize: 19,
                fontWeight: 600,
                margin: "0 0 8px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {meetingTitle}
            </h1>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {isRecording && (
                <Chip color={COLORS.red} icon={<RecDot />}>
                  REC
                </Chip>
              )}

              {remainingSec != null ? (
                <Chip
                  color={timeColor}
                  icon={<StatusDot color={timeColor} />}
                >
                  {overtime
                    ? `+${formatElapsed(Math.abs(remainingSec))} over`
                    : `${formatElapsed(remainingSec)} left`}
                </Chip>
              ) : (
                <Chip color={COLORS.textMuted} icon={<StatusDot color={COLORS.textDim} />}>
                  {elapsed != null ? formatElapsed(elapsed) : "Idle"}
                </Chip>
              )}

              <Chip color={COLORS.textMuted}>
                AI · {ai.provider ?? "waiting"}
              </Chip>

              <Chip
                color={connected ? COLORS.teal : COLORS.textMuted}
                icon={
                  <StatusDot color={connected ? COLORS.teal : COLORS.textDim} />
                }
              >
                {connected ? "Suggestions live" : "Offline"}
              </Chip>

              <Chip color={COLORS.textDim} mono>
                {sessionShort}
              </Chip>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isRecording ? (
              <Button
                variant="primary"
                onClick={startListening}
                disabled={!canRecord}
                iconLeft={<Mic size={15} strokeWidth={2} />}
              >
                Start mic
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={stopListening}
                iconLeft={<Square size={13} strokeWidth={2.5} />}
              >
                Stop mic
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={() => setShowEndConfirm(true)}
              disabled={ending}
            >
              {ending ? "Ending…" : "End meeting"}
            </Button>
          </div>
        </div>

        {error && (
          <div
            style={{
              background: COLORS.redBg,
              borderBottom: `1px solid ${COLORS.red}`,
              color: COLORS.red,
              padding: "10px 24px",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* recorder error fallback commented out
        {recorder.error && (
          <div
            style={{
              background: COLORS.redBg,
              borderBottom: `1px solid ${COLORS.red}`,
              color: COLORS.red,
              padding: "10px 24px",
              fontSize: 13,
            }}
          >
            {recorder.error}
          </div>
        )}
        */}

        {inWrapUp && !wrapUpDismissed && (
          <div
            style={{
              background: COLORS.amberSubtle,
              borderBottom: `1px solid ${COLORS.amber}`,
              color: COLORS.amber,
              padding: "10px 24px",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              animation: "fadeIn 0.2s ease",
            }}
          >
            <span style={{ fontWeight: 600 }}>
              ⏰ {formatElapsed(remainingSec!)} left — start wrapping up open
              questions and confirm decisions.
            </span>
            <button
              onClick={() => setWrapUpDismissed(true)}
              style={{
                background: "transparent",
                border: "none",
                color: COLORS.amber,
                fontSize: 16,
                lineHeight: 1,
                padding: "0 4px",
              }}
              title="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {overtime && (
          <div
            style={{
              background: COLORS.redBg,
              borderBottom: `1px solid ${COLORS.red}`,
              color: COLORS.red,
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Over the planned {durationMin} min by {formatElapsed(Math.abs(remainingSec!))}.
          </div>
        )}

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="meeting-grid" style={{ flex: 1, padding: 24 }}>
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
                flexShrink: 0,
              }}
            >
              <h2
                style={{
                  color: COLORS.text,
                  fontSize: 13,
                  fontWeight: 600,
                  margin: 0,
                  letterSpacing: 0.3,
                }}
              >
                Transcript
              </h2>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {sendingChunk && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      color: COLORS.textDim,
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 11,
                        height: 11,
                        border: `2px solid ${COLORS.border}`,
                        borderTopColor: COLORS.accent,
                        borderRadius: "50%",
                        animation: "spin 0.7s linear infinite",
                      }}
                    />
                    Transcribing…
                  </span>
                )}
                <IconButton
                  title="Reload transcript"
                  onClick={() => void loadTranscript()}
                >
                  <RotateCw size={14} strokeWidth={2} />
                </IconButton>
              </div>
            </div>

            <div
              ref={transcriptScrollRef}
              style={{ flex: 1, overflow: "auto", minHeight: 0, paddingRight: 4 }}
            >
              {loadingTranscript ? (
                <LoadingState count={3} persist />
              ) : transcripts.length === 0 ? (
                <EmptyState message="Transcript will appear here after you start speaking." />
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  {transcripts.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.md,
                        padding: "12px 14px",
                        animation: "cardIn 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            color: COLORS.teal,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {row.speaker}
                        </span>
                        <span style={{ color: COLORS.textDim, fontSize: 11 }}>
                          {formatTime(row.timestamp)}
                        </span>
                      </div>

                      <div
                        style={{
                          color: COLORS.textMuted,
                          fontSize: 13,
                          lineHeight: 1.6,
                        }}
                      >
                        {row.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
                flexShrink: 0,
              }}
            >
              <h2
                style={{
                  color: COLORS.text,
                  fontSize: 13,
                  fontWeight: 600,
                  margin: 0,
                  letterSpacing: 0.3,
                }}
              >
                AI notes
              </h2>

              <span style={{ color: COLORS.textDim, fontSize: 12 }}>
                {ai.status}
              </span>
            </div>

            <div style={{ flex: 1, overflow: "auto", minHeight: 0, paddingRight: 4 }}>
              {ai.error && (
                <div
                  style={{
                    background: COLORS.redBg,
                    border: `1px solid ${COLORS.red}`,
                    color: COLORS.red,
                    borderRadius: RADIUS.md,
                    padding: "10px 12px",
                    marginBottom: 12,
                    fontSize: 13,
                  }}
                >
                  {ai.error}
                </div>
              )}

              {ai.blocks.length === 0 ? (
                <EmptyState message="AI notes will appear when the transcript has enough signal." />
              ) : (
                <BlockRenderer nodes={ai.blocks} />
              )}
            </div>
          </section>
        </div>
      </div>

      {role === "facilitator" && (
        <SuggestionCardStack
          cards={cards}
          onMarkAnswered={markAnswered}
          onMarkActive={markActive}
        />
      )}

      {showEndConfirm && (
        <Modal
          title="End this meeting?"
          width={400}
          onClose={() => !ending && setShowEndConfirm(false)}
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setShowEndConfirm(false)}
                disabled={ending}
              >
                Keep going
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleEndMeeting()}
                disabled={ending}
              >
                {ending ? "Ending…" : "End meeting"}
              </Button>
            </>
          }
        >
          <p style={{ color: COLORS.textMuted, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
            Recording will stop and the session will close. Stratis will generate
            the post-meeting summary and document patches from the transcript.
            This can't be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}