import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, ChevronDown, ClipboardCheck } from "lucide-react";
import type { AIBlock } from "../../shared/types";
import { FONT, SHADOW, LETTER_SPACING, RADIUS, SPACE } from "../tokens/colors";
import { useTheme } from "../hooks/useTheme";
import { Button, Chip, Modal } from "../components/ui";
import { EmptyState, LoadingState } from "../components/states";
import { SuggestionCardStack } from "../components/SuggestionCardStack";
import { NotesRibbon } from "../components/NotesRibbon";
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
import { loadSeen, saveSeen, shouldInterruptEnd, unreviewedIds } from "../lib/checkpointReview";
import { apiFetch } from "../lib/http";

const ACTIVE_SESSION_KEY = "stratis.activeSessionId.v1";

const CHUNK_MAX_MS = 6000;

const USE_STREAMING_STT = (import.meta.env.VITE_STT_STREAMING ?? "1") !== "0";

const FLUSH_SETTLE_MS = 1500;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const NEAR_BOTTOM_PX = 80;

const GROUP_GAP_MS = 30_000;

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

interface AudioChunkResult {
  transcript?: TranscriptRow;
  ai?: { blocks?: AIBlock[]; provider?: string | null };
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
  const { colors } = useTheme();
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 9, height: 9 }}>
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: colors.red,
          animation: "recPulse 1.5s ease-out infinite",
        }}
      />
      <span
        style={{
          position: "relative",
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: colors.red,
          boxShadow: SHADOW.glow(colors.red),
        }}
      />
    </span>
  );
}

function speakerColor(name: string, spkColors: readonly string[]): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return spkColors[Math.abs(hash) % spkColors.length];
}

function AgendaPulseRing({ elapsed, duration, phaseColor }: { elapsed: number; duration: number; phaseColor: string }) {
  const circumference = 94.2;
  const pct = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  return (
    <svg width={36} height={36} viewBox="0 0 36 36" style={{ transform: "rotate(-90deg)" }} aria-hidden>
      <circle cx={18} cy={18} r={15} fill="none" stroke={phaseColor} strokeOpacity={0.2} strokeWidth={3} />
      <circle
        cx={18} cy={18} r={15} fill="none" stroke={phaseColor} strokeWidth={3}
        strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }}
      />
    </svg>
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
  const { colors } = useTheme();
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
  // The checkpoint shown on the way out, when decisions are still unread.
  const [showEndCheckpoint, setShowEndCheckpoint] = useState(false);
  const [seenDecisions, setSeenDecisions] = useState<string[]>([]);
  const checkpointOpenedRef = useRef(false);
  const checkpointWarmedRef = useRef(false);

  const [isRecording, setIsRecording] = useState(false);

  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [lastSpeechMs, setLastSpeechMs] = useState<number | null>(null);

  const [liveText] = useState("");
  const [pendingText, setPendingText] = useState("");
  const inFlightChunksRef = useRef(0);
  const [liveNotes, setLiveNotes] = useState("");

  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);

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
      const next = [...prev, row];
      next.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return next;
    });
  }, []);

  const { cards, connected, markAnswered, markActive, dismissCard, sendControl, sendAudioFrame } =
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
      onNotesUpdate: (text) => setLiveNotes(text),
    });

  const checkpoint = useCheckpoint(sessionId, token);

  const speakerNames = useMemo(() => {
    const names = new Set<string>();
    for (const row of transcripts) {
      const clean = row.speaker?.trim();
      if (clean) names.add(clean);
    }
    return [...names];
  }, [transcripts]);

  const extractAfterFlush = useCallback(() => {
    const flushed = isRecording && sendControl({ type: "stt:flush" });
    window.setTimeout(() => {
      void checkpoint.extract();
    }, flushed ? FLUSH_SETTLE_MS : 0);
  }, [isRecording, sendControl, checkpoint]);

  const openCheckpoint = useCallback(() => {
    setShowCheckpoint(true);
    if (checkpoint.decisions.length === 0) {
      extractAfterFlush();
    } else {
      void checkpoint.load();
    }
  }, [checkpoint, extractAfterFlush]);

  const checkpointVisible = showCheckpoint || showEndCheckpoint;

  useEffect(() => {
    if (!sessionId) return;
    setSeenDecisions(loadSeen(sessionId));
    checkpointOpenedRef.current = false;
  }, [sessionId]);

  // Anything on screen in the panel counts as reviewed.
  useEffect(() => {
    if (!checkpointVisible || !sessionId) return;
    checkpointOpenedRef.current = true;

    const unseen = unreviewedIds(checkpoint.decisions, seenDecisions);
    if (unseen.length === 0) return;

    const next = [...seenDecisions, ...unseen];
    saveSeen(sessionId, next);
    setSeenDecisions(next);
  }, [checkpointVisible, sessionId, checkpoint.decisions, seenDecisions]);

  // Ending goes through the checkpoint only when there is something unread —
  // otherwise the Checkpoint button already did this job mid-meeting.
  const requestEnd = useCallback(() => {
    const unreviewed = unreviewedIds(checkpoint.decisions, seenDecisions).length;
    const interrupt = shouldInterruptEnd({
      unreviewed,
      extracting: checkpoint.extracting,
      everOpened: checkpointOpenedRef.current,
    });

    if (!interrupt) {
      setShowEndConfirm(true);
      return;
    }

    setShowEndCheckpoint(true);
    // Same rule as the button: extract only when nothing has been pulled yet,
    // so peek-then-end cannot fire two ~90s extractions against one quota.
    if (checkpoint.decisions.length === 0) {
      extractAfterFlush();
    } else {
      void checkpoint.load();
    }
  }, [checkpoint, seenDecisions, extractAfterFlush]);

  const sendAudioChunk = useCallback(async (blob: Blob) => {
    if (!token || !sessionId || blob.size === 0) return;
    inFlightChunksRef.current += 1;
    setSendingChunk(true);
    setPendingText("Transcribing…");
    try {
      const audioBase64 = await blobToBase64(blob);
      const payload = await apiFetch<AudioChunkResult>("/api/transcript/audio-chunk", {
        method: "POST",
        body: {
          sessionId,
          session_id: sessionId,
          audioBase64,
          mimeType: blob.type || "audio/webm",
          speaker: user?.name || "Facilitator",
        },
      });

      if (payload?.transcript) {
        appendTranscript(payload.transcript);
        setLastSpeechMs(Date.now());
        if (payload.ai?.blocks) {
          ai.append(payload.ai.blocks, payload.ai.provider);
        }
      }
    } catch (err) {
      console.warn("[speech:audio] Chunk rejected:", err);
    } finally {
      inFlightChunksRef.current -= 1;
      if (inFlightChunksRef.current === 0) {
        setSendingChunk(false);
        setPendingText("");
      }
    }
  }, [token, sessionId, user?.name, appendTranscript, ai]);
  
  const {
    error: recError,
    start: startRec,
    stop: stopRec,
  } = useMediaRecorder({ onChunk: sendAudioChunk, chunkIntervalMs: CHUNK_MAX_MS });

  useEffect(() => {
    if (recError) setError(recError);
  }, [recError]);

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

  const loadTranscript = useCallback(async () => {
    if (!token || !sessionId) return;
    setLoadingTranscript(true);
    setError(null);
    try {
      const payload = await apiFetch<{ transcripts?: TranscriptRow[] }>(
        `/api/transcript/session/${sessionId}`,
      );
      setTranscripts(payload?.transcripts || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to restore previous session transcript rows.",
      );
    } finally {
      setLoadingTranscript(false);
    }
  }, [sessionId, token]);

  useEffect(() => {
    if (sessionId) {
      void loadTranscript();
    }
  }, [sessionId, loadTranscript]);

  const backfillTranscript = useCallback(async () => {
    if (!token || !sessionId) return;
    try {
      const payload = await apiFetch<{ transcripts?: TranscriptRow[] }>(
        `/api/transcript/session/${sessionId}`,
      );
      setTranscripts((prev) => mergeTranscripts(prev, payload?.transcripts || []));
    } catch (err) {
      console.error("[meeting] Transcript backfill on reconnect failed:", err);
    }
  }, [sessionId, token]);

  const hadConnectionRef = useRef(false);
  useEffect(() => {
    if (!connected) return;
    if (!hadConnectionRef.current) {
      hadConnectionRef.current = true;
      return;
    }
    void backfillTranscript();
  }, [connected, backfillTranscript]);

  useEffect(() => {
    if (!sessionId || !token) return;
    const pingStartEndpoint = async () => {
      try {
        await apiFetch(`/api/session/${sessionId}/start`, { method: "POST" });
      } catch (e) {
        console.warn("[meeting] Start ping synchronization failed:", e);
      }
    };
    void pingStartEndpoint();
  }, [sessionId, token]);

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

  const recoveredDuration = recovery.session?.id === sessionId ? recovery.session?.duration_minutes : null;

useEffect(() => {
  if (!sessionId) {
    setDurationMin(null);
    return;
  }

  const server = Number(recoveredDuration);
  if (Number.isFinite(server) && server > 0) {
    setDurationMin(server);
    window.localStorage.setItem(`stratis.duration.${sessionId}`, String(server));
    return;
  }

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
      await apiFetch(`/api/session/${sessionId}/end`, { method: "POST" });
      window.localStorage.removeItem(ACTIVE_SESSION_KEY);
      recovery.clearRecoveredSession();
      if (onNav) {
        onNav("document", { sessionId });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to finalize session.");
    } finally {
      setEnding(false);
      setShowEndConfirm(false);
      setShowEndCheckpoint(false);
    }
  };

  // Committed decisions still missing a date — what the exit line reports.
  const undatedCount = checkpoint.metric
    ? Math.max(0, checkpoint.metric.committed - checkpoint.metric.withDueDate)
    : 0;

  const canRecord = !!sessionId && !!token && !ending;
  const elapsed = sessionId && startMs != null ? Math.max(0, Math.floor((nowMs - startMs) / 1000)) : null;

  const WRAP_UP_SEC = 15 * 60;
  const remainingSec = durationMin != null && elapsed != null ? durationMin * 60 - elapsed : null;
  const inWrapUp = remainingSec != null && remainingSec <= WRAP_UP_SEC && remainingSec > 0;
  const overtime = remainingSec != null && remainingSec <= 0;
  const timeColor = overtime ? colors.red : inWrapUp ? colors.orange : colors.textMuted;

  // Extraction is a heavy ~90s call, so waiting until someone asks for the
  // checkpoint guarantees they wait for it. Run it once when the meeting
  // reaches wrap-up: by the time anyone opens the panel — or presses End —
  // the decisions are already there and it opens populated.
  //
  // Deliberately one call per session. The AI quota is shared with the live
  // card loop, and a periodic re-read would spend it on a list nobody is
  // looking at yet.
  useEffect(() => {
    if (!inWrapUp || checkpointWarmedRef.current) return;
    if (!sessionId || !isRecording) return;
    if (transcripts.length === 0) return;
    if (checkpoint.decisions.length > 0 || checkpoint.extracting) return;

    checkpointWarmedRef.current = true;
    void checkpoint.extract();
  }, [inWrapUp, sessionId, isRecording, transcripts.length, checkpoint]);

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
      <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1, background: colors.bg }}>
        <LoadingState count={3} persist />
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1, background: colors.bg }}>
        <h1
          style={{
            color: colors.text,
            fontSize: FONT.size.title,
            fontWeight: 600,
            margin: "0 0 24px",
          }}
        >
          Meeting
        </h1>
        <EmptyState
          message="No meeting is running right now."
          action={
            <Button variant="primary" size="sm" onClick={() => onNav?.("dashboard")}>
              Go to dashboard to start one
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flex: 1, height: "100%", minHeight: 0, background: colors.bg }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        
        <div
          style={{
            borderBottom: `1px solid ${colors.border}`,
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
                color: colors.text,
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
              <Chip icon={isRecording ? <RecDot /> : <StatusDot color={colors.textDim} />} mono>
                {isRecording ? "LIVE" : "STANDBY"}
              </Chip>
              <span style={{ fontSize: FONT.size.caption, color: colors.textMuted, fontFamily: FONT.mono }}>
                Session {sessionShort}
              </span>
              {connected && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: FONT.size.micro, color: colors.cyan, fontFamily: FONT.mono }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: colors.cyan }} />
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {durationMin != null && (
                  <AgendaPulseRing
                    elapsed={elapsed}
                    duration={durationMin * 60}
                    phaseColor={overtime ? colors.red : inWrapUp ? colors.orange : colors.accent}
                  />
                )}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: FONT.mono, fontSize: FONT.size.subheading, fontWeight: 700, color: timeColor }}>
                    {formatElapsed(elapsed)}
                  </div>
                  {durationMin && (
                    <div style={{ fontSize: FONT.size.micro, color: colors.textMuted }}>
                      TARGET: {durationMin}m {overtime && "(OVERTIME)"}
                    </div>
                  )}
                </div>
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

              <Button variant="ghost" size="sm" onClick={requestEnd} disabled={ending}>
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

        <NotesRibbon
          text={liveNotes}
          fallback={ai.blocks.length > 0 ? <BlockRenderer nodes={ai.blocks} /> : undefined}
        />

        {error && (
          <div
            style={{
              background: colors.dangerBg,
              borderBottom: `1px solid ${colors.red}`,
              padding: "10px 24px",
              fontSize: FONT.size.label,
              color: colors.red,
            }}
          >
            {error}
          </div>
        )}

        <div className="meeting-grid" style={{ flex: 1, padding: "24px", overflow: "hidden" }}>
          
          <div
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: RADIUS.lg,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div style={{ borderBottom: `1px solid ${colors.border}`, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: FONT.size.label, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Continuous STT Capture
              </span>
              {sendingChunk && (
                <span style={{ fontSize: FONT.size.micro, color: colors.accent }}>
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
                  {transcriptGroups.map((row) => {
                    const spkColor = speakerColor(row.speaker, [colors.spkA, colors.spkB, colors.spkC]);
                    return (
                      <div
                        key={row.id}
                        style={{
                          borderLeft: `2px solid ${spkColor}`,
                          borderBottom: `1px solid ${colors.border}`,
                          paddingLeft: SPACE[2.5],
                          paddingBottom: SPACE[2.5],
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: FONT.size.body, color: spkColor }}>
                            {row.speaker}
                          </span>
                          <span style={{ fontSize: FONT.size.micro, color: colors.textDim, fontFamily: FONT.mono }}>
                            {formatTime(row.timestamp)}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: FONT.size.body, color: colors.textMuted, lineHeight: 1.5 }}>
                          {row.text}
                        </p>
                      </div>
                    );
                  })}

                  {(pendingText || liveText) && (
                    <div style={{ borderLeft: "2px solid transparent", paddingLeft: SPACE[2.5], paddingBottom: SPACE[2.5], opacity: 0.7 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: FONT.size.body, color: colors.textMuted }}>
                          {user?.name || "Facilitator"}
                        </span>
                        <span style={{ fontSize: FONT.size.micro, color: colors.accent, letterSpacing: 0.5 }}>
                          LIVE
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: FONT.size.body, color: colors.textDim, lineHeight: 1.5, fontStyle: "italic" }}>
                        {(pendingText + " " + liveText).trim()}{" "}
                        <span
                          aria-hidden
                          style={{ color: colors.accent, animation: "pulse 1.2s ease-in-out infinite" }}
                        >
                          ▌
                        </span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

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
                  background: colors.surfaceElevated,
                  border: `1px solid ${colors.borderLight}`,
                  color: colors.accent,
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

            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ color: colors.textMuted, fontSize: FONT.size.label, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Facilitator Only
                </span>
                {connected && <Chip color={colors.accent} mono>REALTIME SYNCED</Chip>}
              </div>

              <div style={{ flex: 1, overflowY: "auto" }} aria-live="polite" aria-label="Active suggestions">
                <SuggestionCardStack
                  cards={cards}
                  thinking={isRecording && transcripts.length > 0}
                  onMarkAnswered={markAnswered}
                  onMarkActive={markActive}
                  onDismiss={dismissCard}
                />
              </div>
            </div>

          </div>
        </div>
      </div>

      {showEndConfirm && (
        <Modal
          title="End the meeting?"
          onClose={() => setShowEndConfirm(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowEndConfirm(false)} disabled={ending}>
                Keep going
              </Button>
              <Button variant="primary" onClick={handleEndMeeting} disabled={ending}>
                {ending ? "Writing the summary…" : "End meeting"}
              </Button>
            </>
          }
        >
          <p style={{ fontSize: FONT.size.body, color: colors.textMuted, lineHeight: 1.5, margin: 0 }}>
            Recording stops, and Stratis writes the summary. You'll get to review every change it
            proposes to the project document before anything is saved.
          </p>
        </Modal>
      )}

      {showEndCheckpoint && (
        <Modal
          title=""
          width={620}
          closeOnBackdrop={false}
          onClose={() => setShowEndCheckpoint(false)}
        >
          <CheckpointPanel
            decisions={checkpoint.decisions}
            metric={checkpoint.metric}
            extracting={checkpoint.extracting}
            error={checkpoint.error}
            speakers={speakerNames}
            present={false}
            onEdit={checkpoint.edit}
            onReExtract={extractAfterFlush}
            onTogglePresent={() => {
              setShowEndCheckpoint(false);
              setShowCheckpoint(true);
              setPresentMode(true);
            }}
            onClose={() => setShowEndCheckpoint(false)}
            footer={
              <div
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  marginTop: 4,
                  paddingTop: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: FONT.size.label, color: colors.textMuted, maxWidth: "38ch", lineHeight: 1.45 }}>
                  {checkpoint.extracting
                    ? "Still reading the meeting — you can end now and finish this on the docket."
                    : undatedCount > 0
                      ? `${undatedCount} decision${undatedCount === 1 ? "" : "s"} without a date — ${undatedCount === 1 ? "it waits" : "they wait"} on the docket as an open question.`
                      : "Everything here has a date."}
                </span>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <Button variant="ghost" size="sm" onClick={() => setShowEndCheckpoint(false)} disabled={ending}>
                    Back to meeting
                  </Button>
                  <Button variant="subtle" size="sm" onClick={handleEndMeeting} disabled={ending}>
                    {ending ? "Writing the summary…" : "End meeting"}
                  </Button>
                </div>
              </div>
            }
          />
        </Modal>
      )}

      {showCheckpoint && !presentMode && (
        <Modal
          title=""
          width={620}
          closeOnBackdrop={false}
          onClose={() => setShowCheckpoint(false)}
        >
          <CheckpointPanel
            decisions={checkpoint.decisions}
            metric={checkpoint.metric}
            extracting={checkpoint.extracting}
            error={checkpoint.error}
            speakers={speakerNames}
            present={false}
            onEdit={checkpoint.edit}
            onReExtract={extractAfterFlush}
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
            background: colors.bg,
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
            error={checkpoint.error}
              speakers={speakerNames}
              present={true}
              onEdit={checkpoint.edit}
              onReExtract={extractAfterFlush}
              onTogglePresent={() => setPresentMode(false)}
              onClose={() => setShowCheckpoint(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
