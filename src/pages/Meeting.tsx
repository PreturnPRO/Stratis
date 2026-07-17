import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, ChevronDown, ClipboardCheck } from "lucide-react";
import { COLORS, FONT, SHADOW, LETTER_SPACING } from "../constants";
import { RADIUS, SPACE } from "../tokens/colors";
import { Button, Chip, Modal } from "../components/ui";
import { EmptyState, LoadingState } from "../components/states";
import { SuggestionCardStack } from "../components/SuggestionCardStack";
import { CheckpointPanel } from "../components/CheckpointPanel";
import { useCheckpoint } from "../hooks/useCheckpoint";
import {
  AiPresenceChip,
  AgendaPulse,
  TimeRiver,
  type PresenceMode,
} from "../components/MeetingPulse";
import BlockRenderer from "../components/BlockRenderer";
import { useAiBlocks } from "../hooks/useAiBlocks";
import { useSuggestionSocket } from "../hooks/useSuggestionSocket";
import { useAuth } from "../context/AuthContext";
import { useSessionRecovery } from "../hooks/useSessionRecovery";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import { usePcmStream } from "../hooks/usePcmStream";
import { mergeTranscripts } from "../lib/mergeTranscripts";
import { API_BASE } from "../lib/api";

const ACTIVE_SESSION_KEY = "stratis.activeSessionId.v1";

// Mic capture cadence: record short standalone WebM/Opus clips and POST each to
// the backend, which runs Google Speech v2 chirp_2 (th-TH,en-US). Short clips
// (not timesliced fragments) keep every upload independently decodable.
const CHUNK_MAX_MS = 6000;

// S-EXP — streaming STT: raw PCM over the /ws hub into Google v2
// StreamingRecognize, with live interim text in the ghost row and no clip
// boundaries to split words. Set VITE_STT_STREAMING=0 to fall back to the
// 6s clip-batch REST path above.
const USE_STREAMING_STT = (import.meta.env.VITE_STT_STREAMING ?? "1") !== "0";

// Blob → base64 data URL. The backend strips the `data:...;base64,` prefix.
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Chat-style auto-follow: within this many px of the bottom counts as "at the
// bottom", so auto-scroll stays armed despite sub-pixel rounding and the
// growing live ghost row.
const NEAR_BOTTOM_PX = 80;

// Each CHUNK_MAX_MS audio clip becomes its own transcript row in the DB, so a
// continuous sentence arrives as a run of short rows. Consecutive rows from
// the same speaker within this gap render as one flowing block instead of a
// separate 1-2 word box each.
const GROUP_GAP_MS = 30_000;

// Thai has no spaces between words — joining Thai chunk texts with " " would
// scatter spaces mid-sentence. Mirrors the Thai-aware cleanup applied per
// chunk in backend/src/routes/transcript.ts.
function joinChunkText(a: string, b: string): string {
  if (!a) return b;
  if (!b) return a;
  const thaiEnd = /[฀-๿]$/;
  const thaiStart = /^[฀-๿]/;
  return thaiEnd.test(a) && thaiStart.test(b) ? a + b : `${a} ${b}`;
}

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
          boxShadow: SHADOW.glow(COLORS.red),
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
  const [manualSessionId] = useState<string | null>(() => {
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
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [presentMode, setPresentMode] = useState(false);

  const [isRecording, setIsRecording] = useState(false);

  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  // Last time speech recognition produced a result — drives the "hearing you"
  // state of the AI presence chip.
  const [lastSpeechMs, setLastSpeechMs] = useState<number | null>(null);

  // Ghost-row state: words shown instantly, before any backend/AI round-trip.
  // liveText = recognized but not yet flushed; pendingText = flushed chunk
  // still in flight to the backend.
  const [liveText] = useState("");
  const [pendingText, setPendingText] = useState("");
  const inFlightChunksRef = useRef(0);

  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  // Chat-style auto-follow: pinned to the newest line while the user is at the
  // bottom; scrolling up to read history pauses it and reveals a "jump to
  // latest" affordance (Discord-style).
  const [stickToBottom, setStickToBottom] = useState(true);

  const authHeaders = useMemo((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  // Merge consecutive rows from the same speaker into one continuous display
  // block — the DB keeps one row per audio clip, but reading a sentence split
  // across a stack of 1-2 word boxes is unusable.
  const transcriptGroups = useMemo(() => {
    const groups: Array<{ id: string; speaker: string; timestamp: string; text: string }> = [];
    let prevMs = NaN;
    for (const row of transcripts) {
      const rowMs = new Date(row.timestamp).getTime();
      const last = groups[groups.length - 1];
      if (
        last &&
        last.speaker === row.speaker &&
        Number.isFinite(rowMs) &&
        Number.isFinite(prevMs) &&
        rowMs - prevMs <= GROUP_GAP_MS
      ) {
        last.text = joinChunkText(last.text, row.text);
      } else {
        groups.push({
          id: row.id,
          speaker: row.speaker,
          timestamp: row.timestamp,
          text: row.text,
        });
      }
      prevMs = rowMs;
    }
    return groups;
  }, [transcripts]);

  const appendTranscript = useCallback((row: TranscriptRow) => {
    setTranscripts((prev) => {
      if (prev.some((p) => p.id === row.id)) return prev;
      // Keep rows in timestamp order even if two in-flight uploads resolve
      // out of order (ISO timestamps sort lexicographically).
      const next = [...prev, row];
      next.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return next;
    });
  }, []);

  // Placed after appendTranscript so the streaming handlers can reference it.
  // Interim text drives the same ghost row the clip path uses; finals are
  // saved server-side and arrive here as ordinary transcript rows.
  const { cards, connected, markAnswered, markActive, sendControl, sendAudioFrame } =
    useSuggestionSocket(sessionId, {
      onSttInterim: (text) => {
        setPendingText(text);
        setLastSpeechMs(Date.now());
      },
      onTranscriptFinal: (row) => {
        appendTranscript(row);
        setPendingText("");
        setLastSpeechMs(Date.now());
      },
      onSttError: (message) => setError(message),
    });

  const checkpoint = useCheckpoint(sessionId, token);

  // Opening the checkpoint reads the meeting: extract fresh if we have nothing
  // yet, otherwise just reload what's stored (and let the facilitator re-read).
  const openCheckpoint = useCallback(() => {
    setShowCheckpoint(true);
    if (checkpoint.decisions.length === 0) {
      void checkpoint.extract();
    } else {
      void checkpoint.load();
    }
  }, [checkpoint]);

  // --- Real-Time STT: mic → MediaRecorder → Chirp 2 (all browsers) ---
  // The old path used the browser Web Speech API, which only exists in
  // Chrome/Edge/Safari (Firefox has none) and transcribes on Google's consumer
  // endpoint — never our Chirp 2 project. MediaRecorder + getUserMedia work in
  // every modern browser; each short clip POSTs to /api/transcript/audio-chunk,
  // which runs Speech v2 chirp_2 (th-TH,en-US) and returns Thai transcript rows.
  const sendAudioChunk = useCallback(async (blob: Blob) => {
    if (!token || !sessionId || blob.size === 0) return;
    // Uploads can overlap (a new clip starts while the previous one is still
    // in flight) — count them so the first response back doesn't clear the
    // "Transcribing…" indicator out from under the later one.
    inFlightChunksRef.current += 1;
    setSendingChunk(true);
    setPendingText("Transcribing…");
    try {
      const audioBase64 = await blobToBase64(blob);
      const response = await fetch(`${API_BASE}/api/transcript/audio-chunk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          sessionId,
          session_id: sessionId,
          audioBase64,
          mimeType: blob.type || "audio/webm",
          speaker: user?.name || "Facilitator",
        }),
      });

      const payload = await response.json();
      if (response.ok && payload.ok && payload.data?.transcript) {
        appendTranscript(payload.data.transcript);
        setLastSpeechMs(Date.now());
        if (payload.data.ai?.blocks) {
          ai.append(payload.data.ai.blocks, payload.data.ai.provider);
        }
      } else if (!payload.ok) {
        console.warn("[speech:audio] Pipeline rejected chunk:", payload.error);
      }
    } catch (err) {
      console.error("[speech:audio] Connection fault:", err);
    } finally {
      inFlightChunksRef.current -= 1;
      if (inFlightChunksRef.current === 0) {
        setSendingChunk(false);
        setPendingText("");
      }
    }
  }, [token, sessionId, authHeaders, user?.name, appendTranscript, ai]);
  
  const {
    error: recError,
    start: startRec,
    stop: stopRec,
  } = useMediaRecorder({ onChunk: sendAudioChunk, chunkIntervalMs: CHUNK_MAX_MS });

  useEffect(() => {
    if (recError) setError(recError);
  }, [recError]);

  // --- Streaming STT path (S-EXP) ---
  // Mic → AudioWorklet PCM frames → binary WS frames → backend
  // StreamingRecognize. Interim/final results come back over the same socket
  // (see the useSuggestionSocket handlers above).
  const streamingActiveRef = useRef(false);
  const streamSampleRateRef = useRef<number | null>(null);

  const pcm = usePcmStream({
    onFrame: (frame) => {
      if (streamingActiveRef.current) sendAudioFrame(frame);
    },
  });

  useEffect(() => {
    if (pcm.error) setError(pcm.error);
  }, [pcm.error]);

  // If the socket drops mid-meeting, the backend loses its stream state — re-arm
  // it on reconnect so audio keeps transcribing.
  useEffect(() => {
    if (connected && streamingActiveRef.current && streamSampleRateRef.current) {
      sendControl({
        type: "stt:start",
        sampleRate: streamSampleRateRef.current,
        speaker: user?.name || "Facilitator",
      });
    }
  }, [connected, sendControl, user?.name]);

  const startListening = () => {
    setIsRecording(true);
    if (USE_STREAMING_STT && connected) {
      streamingActiveRef.current = true;
      void pcm
        .start((sampleRate) => {
          streamSampleRateRef.current = sampleRate;
          sendControl({
            type: "stt:start",
            sampleRate,
            speaker: user?.name || "Facilitator",
          });
        })
        .catch((err) => {
          // Worklet/mic failure on this browser — fall back to the clip path.
          console.warn("[speech:stream] PCM capture failed, using clip upload:", err);
          streamingActiveRef.current = false;
          void startRec();
        });
    } else {
      void startRec();
    }
  };

  const stopListening = () => {
    setIsRecording(false);
    if (streamingActiveRef.current) {
      streamingActiveRef.current = false;
      pcm.stop();
      sendControl({ type: "stt:stop" });
      setPendingText("");
    }
    stopRec();
  };

  // --- Past Transcript Syncing ---
  const loadTranscript = useCallback(async () => {
    if (!token || !sessionId) return;
    setLoadingTranscript(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/transcript/session/${sessionId}`, {
        headers: authHeaders,
      });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        setTranscripts(payload.data?.transcripts || []);
      } else {
        setError(payload.error || "Failed to restore previous session transcript rows.");
      }
    } catch (err) {
      console.error("[meeting] Error recovery loading transcripts:", err);
      setError("Network error fetching past transcript data.");
    } finally {
      setLoadingTranscript(false);
    }
  }, [sessionId, token, authHeaders]);

  useEffect(() => {
    if (sessionId) {
      void loadTranscript();
    }
  }, [sessionId, loadTranscript]);

  // Reconnect backfill: rows finalized during a socket drop are broadcast while
  // we're disconnected and never reach this client. On every reconnect (not the
  // first connect — the mount load above covers that) refetch and merge so the
  // panel matches the database with no silent gap. Silent: no spinner, dedup by id.
  const backfillTranscript = useCallback(async () => {
    if (!token || !sessionId) return;
    try {
      const response = await fetch(`${API_BASE}/api/transcript/session/${sessionId}`, {
        headers: authHeaders,
      });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        const rows: TranscriptRow[] = payload.data?.transcripts || [];
        setTranscripts((prev) => mergeTranscripts(prev, rows));
      }
    } catch (err) {
      console.error("[meeting] Transcript backfill on reconnect failed:", err);
    }
  }, [sessionId, token, authHeaders]);

  const hadConnectionRef = useRef(false);
  useEffect(() => {
    if (!connected) return;
    if (!hadConnectionRef.current) {
      hadConnectionRef.current = true; // first connect — mount load already ran
      return;
    }
    void backfillTranscript();
  }, [connected, backfillTranscript]);

  // Sync starting server timestamps
  useEffect(() => {
    if (!sessionId || !token) return;
    const pingStartEndpoint = async () => {
      try {
        await fetch(`${API_BASE}/api/session/${sessionId}/start`, {
          method: "POST",
          headers: authHeaders,
        });
      } catch (e) {
        console.warn("[meeting] Start ping synchronization failed:", e);
      }
    };
    void pingStartEndpoint();
  }, [sessionId, token, authHeaders]);

  useEffect(() => {
    if (!sessionId) {
      setStartMs(null);
      return;
    }
    const serverStart = recovery.session?.started_at
      ? new Date(recovery.session.started_at).getTime()
      : NaN;
    setStartMs((prev) => (Number.isFinite(serverStart) ? serverStart : prev ?? Date.now()));
  }, [sessionId, recovery.session?.started_at]);

  // Planned duration: the server-stored value on the meeting wins (it survives
  // cleared localStorage and other devices); localStorage covers sessions
  // created before duration_minutes existed; 60 is the last-resort default.
  const recoveredDuration = recovery.session?.id === sessionId ? recovery.session?.duration_minutes : null;

useEffect(() => {
  if (!sessionId) {
    setDurationMin(null);
    return;
  }

  // 1. If server recovery has finished and returned a valid duration, prioritize it immediately
  const server = Number(recoveredDuration);
  if (Number.isFinite(server) && server > 0) {
    setDurationMin(server);
    window.localStorage.setItem(`stratis.duration.${sessionId}`, String(server));
    return;
  }

  // 2. Wait until recovery finishes loading before falling back to local storage or defaults
  if (recovery.status !== "loading") {
    const raw = window.localStorage.getItem(`stratis.duration.${sessionId}`);
    const n = raw ? parseInt(raw, 10) : NaN;
    setDurationMin(Number.isFinite(n) && n > 0 ? n : 60);
  }
}, [sessionId, recoveredDuration, recovery.status]);

  useEffect(() => {
    if (!sessionId) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sessionId]);

  // User scroll intent: reaching the bottom re-arms auto-follow; scrolling up
  // pauses it. Our own programmatic scroll-to-bottom lands here too and simply
  // keeps auto-follow armed, so no "is this programmatic?" flag is needed.
  const handleTranscriptScroll = useCallback(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distanceFromBottom <= NEAR_BOTTOM_PX);
  }, []);

  const jumpToBottom = useCallback(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setStickToBottom(true);
  }, []);

  // While auto-follow is armed, keep the newest line — and the live ghost row
  // as it grows word by word — pinned to the bottom as content streams in.
  useEffect(() => {
    if (!stickToBottom) return;
    const el = transcriptScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [transcripts, liveText, pendingText, stickToBottom]);

  const handleEndMeeting = async () => {
    if (!token || !sessionId) return;
    setEnding(true);
    stopListening();
    try {
      const response = await fetch(`${API_BASE}/api/session/${sessionId}/end`, {
        method: "POST",
        headers: authHeaders,
      });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        window.localStorage.removeItem(ACTIVE_SESSION_KEY);
        recovery.clearRecoveredSession();
        if (onNav) {
          onNav("document", { sessionId });
        }
      } else {
        setError(payload.error || "Failed to finalize session.");
      }
    } catch (e) {
      console.error("[meeting:end] connection error:", e);
      setError("An unexpected network error occurred ending the session.");
    } finally {
      setEnding(false);
      setShowEndConfirm(false);
    }
  };

  const canRecord = !!sessionId && !!token && !ending;
  const elapsed = sessionId && startMs != null ? Math.max(0, Math.floor((nowMs - startMs) / 1000)) : null;

  const WRAP_UP_SEC = 15 * 60;
  const remainingSec = durationMin != null && elapsed != null ? durationMin * 60 - elapsed : null;
  const inWrapUp = remainingSec != null && remainingSec <= WRAP_UP_SEC && remainingSec > 0;
  const overtime = remainingSec != null && remainingSec <= 0;
  const timeColor = overtime ? COLORS.red : inWrapUp ? COLORS.orange : COLORS.textMuted;

  const speechActive = lastSpeechMs != null && nowMs - lastSpeechMs < 6000;
  const presenceMode: PresenceMode = !isRecording
    ? "off"
    : sendingChunk
      ? "thinking"
      : speechActive
        ? "speech"
        : "listening";

  const meetingTitle = recovery.session?.meeting_title?.trim() || "Live meeting";
  const sessionShort = sessionId ? `...${sessionId.slice(-6)}` : "";

  if (recovery.status === "loading" && !sessionId) {
    return (
      <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1, background: COLORS.bg }}>
        <LoadingState count={3} persist />
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1, background: COLORS.bg }}>
        <h1
          style={{
            color: COLORS.text,
            fontSize: FONT.size.title,
            fontWeight: 600,
            margin: "0 0 24px",
          }}
        >
          Control Room Workspace
        </h1>
        <EmptyState message="No active meeting session found. Initialize or join a workspace session from your Dashboard." />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flex: 1, height: "100%", minHeight: 0, background: COLORS.bg }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        
        {/* Header */}
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
                fontSize: FONT.size.heading,
                fontWeight: 600,
                margin: "0 0 8px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {meetingTitle}
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: SPACE[2.5] }}>
              <Chip icon={isRecording ? <RecDot /> : <StatusDot color={COLORS.textDim} />} mono>
                {isRecording ? "LIVE" : "STANDBY"}
              </Chip>
              <span style={{ fontSize: FONT.size.caption, color: COLORS.textMuted }}>
                Session {sessionShort}
              </span>
              {connected && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: FONT.size.micro, color: COLORS.cyan }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.cyan }} />
                  WEBSOCKET SYNCED
                </span>
              )}

              <AiPresenceChip
                mode={presenceMode}
                cardCount={cards.length}
                provider={ai.provider}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: SPACE[4] }}>
            {elapsed != null && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: FONT.size.subheading, fontWeight: 700, color: timeColor }}>
                  {formatElapsed(elapsed)}
                </div>
                {durationMin && (
                  <div style={{ fontSize: FONT.size.micro, color: COLORS.textMuted }}>
                    TARGET: {durationMin}m {overtime && "(OVERTIME)"}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              {isRecording ? (
                <Button variant="danger" size="sm" onClick={stopListening} iconLeft={<Square size={14} />}>
                  Pause
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={startListening}
                  disabled={!canRecord}
                  iconLeft={<Mic size={14} />}
                >
                  Record
                </Button>
              )}

              <Button
                variant={inWrapUp ? "primary" : "ghost"}
                size="sm"
                onClick={openCheckpoint}
                disabled={!sessionId || ending}
                iconLeft={<ClipboardCheck size={14} />}
              >
                Checkpoint
              </Button>

              <Button variant="ghost" size="sm" onClick={() => setShowEndConfirm(true)} disabled={ending}>
                End Meeting
              </Button>
            </div>
          </div>
        </div>

        {durationMin != null && elapsed != null && (
          <TimeRiver
            durationMin={durationMin}
            elapsedSec={elapsed}
            wrapUpSec={WRAP_UP_SEC}
          />
        )}

        {error && (
          <div
            style={{
              background: COLORS.dangerBg,
              borderBottom: `1px solid ${COLORS.red}`,
              padding: "10px 24px",
              fontSize: FONT.size.label,
              color: COLORS.red,
            }}
          >
            {error}
          </div>
        )}

        {/* Main Two-Column Control Workspace */}
        <div className="meeting-grid" style={{ flex: 1, padding: "24px", overflow: "hidden" }}>
          
          {/* Column 1: Live Ingestion Feed */}
          <div
            style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.lg,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div style={{ borderBottom: `1px solid ${COLORS.border}`, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: FONT.size.label, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Continuous STT Capture
              </span>
              {sendingChunk && (
                <span style={{ fontSize: FONT.size.micro, color: COLORS.accent }}>
                  Flushing chunk...
                </span>
              )}
            </div>

            <div
              ref={transcriptScrollRef}
              onScroll={handleTranscriptScroll}
              className="transcript-scroll"
              role="log"
              aria-live="polite"
              aria-label="Live transcript"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: SPACE[4],
              }}
            >
              {loadingTranscript && transcripts.length === 0 ? (
                <LoadingState count={3} />
              ) : transcripts.length === 0 && !liveText && !pendingText ? (
                <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
                  <EmptyState message="Ready for speech input. Tap 'Record' above to begin capture stream." />
                </div>
              ) : (
                <>
                  {transcriptGroups.map((row) => (
                    <div
                      key={row.id}
                      style={{
                        borderBottom: `1px solid ${COLORS.border}`,
                        paddingBottom: SPACE[2.5],
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: FONT.size.body, color: COLORS.textPrimary }}>
                          {row.speaker}
                        </span>
                        <span style={{ fontSize: FONT.size.micro, color: COLORS.textDim }}>
                          {formatTime(row.timestamp)}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: FONT.size.body, color: COLORS.textMuted, lineHeight: 1.5 }}>
                        {row.text}
                      </p>
                    </div>
                  ))}

                  {(pendingText || liveText) && (
                    <div style={{ paddingBottom: SPACE[2.5], opacity: 0.7 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: FONT.size.body, color: COLORS.textMuted }}>
                          {user?.name || "Facilitator"}
                        </span>
                        <span style={{ fontSize: FONT.size.micro, color: COLORS.accent, letterSpacing: 0.5 }}>
                          LIVE
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: FONT.size.body, color: COLORS.textDim, lineHeight: 1.5, fontStyle: "italic" }}>
                        {(pendingText + " " + liveText).trim()}{" "}
                        <span
                          aria-hidden
                          style={{ color: COLORS.accent, animation: "pulse 1.2s ease-in-out infinite" }}
                        >
                          ▌
                        </span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Jump-to-latest: re-arms auto-scroll after the user has scrolled
                up to read history. Only shown while auto-follow is paused. */}
            {!stickToBottom && (
              <button
                type="button"
                onClick={jumpToBottom}
                aria-label="Jump to latest and resume auto-scroll"
                style={{
                  position: "absolute",
                  bottom: 16,
                  right: 20,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px 7px 14px",
                  borderRadius: RADIUS.pill,
                  background: COLORS.surfaceElevated,
                  border: `1px solid ${COLORS.borderLight}`,
                  color: COLORS.accent,
                  fontSize: FONT.size.label,
                  fontWeight: 600,
                  letterSpacing: LETTER_SPACING.wide,
                  boxShadow: SHADOW.float,
                  animation: "slideUp 0.2s ease",
                }}
              >
                Jump to latest
                <ChevronDown size={15} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Column 2: Suggestion Gutter Stack */}
          <div
            className="suggestion-gutter"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              overflowY: "auto",
              minHeight: 0,
            }}
          >
            {durationMin != null && elapsed != null && (
              <AgendaPulse
                durationMin={durationMin}
                elapsedSec={elapsed}
                wrapUpSec={WRAP_UP_SEC}
              />
            )}

            {/* Live Strategic Recommendations */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ color: COLORS.textMuted, fontSize: FONT.size.label, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Active Suggestions
                </span>
                {connected && <Chip color={COLORS.accent} mono>REALTIME SYNCED</Chip>}
              </div>

              <div style={{ flex: 1, overflowY: "auto" }} aria-live="polite" aria-label="Active suggestions">
                <SuggestionCardStack
                  cards={cards}
                  thinking={isRecording && transcripts.length > 0}
                  onMarkAnswered={markAnswered}
                  onMarkActive={markActive}
                />
              </div>
            </div>

            {/* AI Session Notes Panel */}
            <div
              style={{
                height: 240,
                background: COLORS.surfaceMuted,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.md,
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <div style={{ fontSize: FONT.size.micro, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 }}>
                Strategic Meeting Notes
              </div>
              <div style={{ flex: 1, overflowY: "auto" }} aria-live="polite" aria-label="Strategic meeting notes">
                {ai.blocks.length === 0 ? (
                  <p style={{ fontSize: FONT.size.label, color: COLORS.textMuted, margin: 0, fontStyle: "italic" }}>
                    Notes, key arguments, and identified risks will populate here as conversation signal classification completes.
                  </p>
                ) : (
                  <BlockRenderer nodes={ai.blocks} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* End Meeting Confirmation Modal */}
      {showEndConfirm && (
        <Modal
          title="Conclude Meeting Session?"
          onClose={() => setShowEndConfirm(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowEndConfirm(false)} disabled={ending}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleEndMeeting} disabled={ending}>
                {ending ? "Concluding..." : "Generate Patches"}
              </Button>
            </>
          }
        >
          <p style={{ fontSize: FONT.size.body, color: COLORS.textMuted, lineHeight: 1.5, margin: 0 }}>
            This action will disconnect the continuous recording feed and run post-meeting summary parsing. You will proceed to review individual PM document patches before final commit.
          </p>
        </Modal>
      )}

      {/* Alignment Checkpoint — normal (modal) or present (fullscreen overlay) */}
      {showCheckpoint && !presentMode && (
        <Modal
          title=""
          width={620}
          onClose={() => setShowCheckpoint(false)}
        >
          <CheckpointPanel
            decisions={checkpoint.decisions}
            metric={checkpoint.metric}
            extracting={checkpoint.extracting}
            present={false}
            onEdit={checkpoint.edit}
            onReExtract={checkpoint.extract}
            onTogglePresent={() => setPresentMode(true)}
            onClose={() => setShowCheckpoint(false)}
          />
        </Modal>
      )}

      {showCheckpoint && presentMode && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: COLORS.bg,
            zIndex: 300,
            padding: "48px 64px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ maxWidth: 900, width: "100%", margin: "0 auto", height: "100%" }}>
            <CheckpointPanel
              decisions={checkpoint.decisions}
              metric={checkpoint.metric}
              extracting={checkpoint.extracting}
              present={true}
              onEdit={checkpoint.edit}
              onReExtract={checkpoint.extract}
              onTogglePresent={() => setPresentMode(false)}
              onClose={() => setShowCheckpoint(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
