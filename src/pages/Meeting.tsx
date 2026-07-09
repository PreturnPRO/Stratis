import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { COLORS, FONT } from "../constants";
import { RADIUS } from "../tokens/colors";
import { Button, Chip, Modal } from "../components/ui";
import { EmptyState, LoadingState } from "../components/states";
import { SuggestionCardStack } from "../components/SuggestionCardStack";
import BlockRenderer from "../components/BlockRenderer";
import { useAiBlocks } from "../hooks/useAiBlocks";
import { useSuggestionSocket } from "../hooks/useSuggestionSocket";
import { useAuth } from "../context/AuthContext";
import { useSessionRecovery } from "../hooks/useSessionRecovery";
import { API_BASE } from "../lib/api";

const ACTIVE_SESSION_KEY = "stratis.activeSessionId.v1";
const CHUNK_FLUSH_MS = 5000;

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

  // Web Speech API Native Recording States
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  const authHeaders = useMemo((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const { cards, connected, markAnswered, markActive } = useSuggestionSocket(sessionId);

  const appendTranscript = useCallback((row: TranscriptRow) => {
    setTranscripts((prev) => {
      if (prev.some((p) => p.id === row.id)) return prev;
      return [...prev, row];
    });
  }, []);

  // --- Real-Time STT Chunk Ingestion Pipeline ---
  const sendTextChunk = useCallback(async (text: string) => {
    if (!token || !sessionId || !text.trim()) return;
    setSendingChunk(true);
    try {
      const response = await fetch(`${API_BASE}/api/transcript/chunk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          sessionId,
          session_id: sessionId,
          text: text.trim(),
          speaker: user?.name || "Facilitator",
          timestamp: new Date().toISOString(),
        }),
      });

      const payload = await response.json();
      if (response.ok && payload.ok && payload.data?.transcript) {
        appendTranscript(payload.data.transcript);
        if (payload.data.ai?.blocks) {
          ai.append(payload.data.ai.blocks, payload.data.ai.provider);
        }
      } else {
        console.warn("[speech:chunk] Pipeline rejected request:", payload.error);
      }
    } catch (err) {
      console.error("[speech:chunk] Connection fault:", err);
    } finally {
      setSendingChunk(false);
    }
  }, [token, sessionId, authHeaders, user?.name, appendTranscript, ai]);

  const sendTextChunkRef = useRef(sendTextChunk);
  useEffect(() => {
    sendTextChunkRef.current = sendTextChunk;
  }, [sendTextChunk]);

  // Dual-buffer silence-resistant accumulation strategy
  const bufferRef = useRef<string>("");
  const interimRef = useRef<string>("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBuffer = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    let text = bufferRef.current.trim();
    if (interimRef.current.trim()) {
      text = (text + " " + interimRef.current.trim()).trim();
    }

    bufferRef.current = "";
    interimRef.current = "";

    if (text) {
      sendTextChunkRef.current(text);
    }
  }, []);

  useEffect(() => {
    const SpeechRecognitionEngine =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionEngine) {
      console.warn("[speech] Native SpeechRecognition not available in this host environment.");
      return;
    }

    const rec = new SpeechRecognitionEngine();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "th-TH"; // Continuous dual-language Thai/English STT

    rec.onstart = () => {
      console.log("[speech] Recognition pipeline active.");
    };

    rec.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        // Correctly index SpeechRecognitionAlternative using item(0) (bracket-free!)
        const alternative = event.results[i].item(0);
        const transcript = alternative ? alternative.transcript : "";

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        bufferRef.current = (bufferRef.current + " " + finalTranscript).trim();
        interimRef.current = "";
      } else {
        interimRef.current = interimTranscript;
      }

      // Schedule periodic chunk flush
      if (bufferRef.current.trim() || interimRef.current.trim()) {
        if (!flushTimerRef.current) {
          flushTimerRef.current = setTimeout(() => {
            flushBuffer();
          }, CHUNK_FLUSH_MS);
        }
      }
    };

    rec.onerror = (event: any) => {
      console.error("[speech] Capture engine error:", event.error);
      if (event.error === "not-allowed") {
        setIsRecording(false);
        isRecordingRef.current = false;
      }
    };

    rec.onend = () => {
      console.log("[speech] Mic stream went silent or disconnected.");
      flushBuffer();

      if (isRecordingRef.current) {
        console.log("[speech] Re-initiating active capture stream...");
        try {
          rec.start();
        } catch (e) {
          console.warn("[speech] Auto-restart sequence missed:", e);
        }
      }
    };

    recognitionRef.current = rec;

    return () => {
      if (rec) {
        rec.onend = null;
        rec.onerror = null;
        rec.onresult = null;
        try {
          rec.stop();
        } catch (e) {}
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, [flushBuffer]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    setIsRecording(true);
    isRecordingRef.current = true;
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.warn("[speech] Already listening - start aborted:", e);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    setIsRecording(false);
    isRecordingRef.current = false;
    recognitionRef.current.stop();
    flushBuffer();
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

  useEffect(() => {
    if (!sessionId || !token) return;
    try {
      const storedDuration = window.localStorage.getItem(`stratis.duration.${sessionId}`);
      if (storedDuration) {
        setDurationMin(Number(storedDuration));
      } else {
        setDurationMin(60);
      }
    } catch (e) {
      setDurationMin(60);
    }
  }, [sessionId, token]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    if (!sessionId) {
      setDurationMin(null);
      return;
    }
    const raw = window.localStorage.getItem(`stratis.duration.${sessionId}`);
    const n = raw ? parseInt(raw, 10) : NaN;
    setDurationMin(Number.isFinite(n) && n > 0 ? n : 60);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [sessionId]);

  // Keep transcripts scrolled to the bottom
  useEffect(() => {
    const el = transcriptScrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [transcripts]);

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
    <div style={{ display: "flex", flex: 1, minHeight: 0, background: COLORS.bg }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {elapsed != null && (
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: FONT.size.subheading, fontWeight: 700, color: timeColor }}>
                  {formatElapsed(elapsed)}
                </div>
                {durationMin && (
                  <div style={{ fontSize: FONT.size.micro, color: COLORS.textDim }}>
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

              <Button variant="ghost" size="sm" onClick={() => setShowEndConfirm(true)} disabled={ending}>
                End Meeting
              </Button>
            </div>
          </div>
        </div>

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
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {loadingTranscript && transcripts.length === 0 ? (
                <LoadingState count={3} />
              ) : transcripts.length === 0 ? (
                <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center" }}>
                  <EmptyState message="Ready for speech input. Tap 'Record' above to begin capture stream." />
                </div>
              ) : (
                transcripts.map((row) => (
                  <div
                    key={row.id}
                    style={{
                      borderBottom: `1px solid ${COLORS.border}`,
                      paddingBottom: 10,
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
                ))
              )}
            </div>
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
            {/* Live Strategic Recommendations */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ color: COLORS.textMuted, fontSize: FONT.size.label, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Active Suggestions
                </span>
                {connected && <Chip color={COLORS.accent} mono>REALTIME SYNCED</Chip>}
              </div>

              <div style={{ flex: 1, overflowY: "auto" }}>
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
              <div style={{ flex: 1, overflowY: "auto" }}>
                {ai.blocks.length === 0 ? (
                  <p style={{ fontSize: FONT.size.label, color: COLORS.textDim, margin: 0, fontStyle: "italic" }}>
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
    </div>
  );
}