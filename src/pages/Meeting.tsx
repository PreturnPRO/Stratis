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

import { useCallback, useEffect, useMemo, useState } from "react";
import { COLORS } from "../constants";
import { btnAccent, btnGhost } from "../components/ui";
import { EmptyState, LoadingState } from "../components/states";
import { SuggestionCardStack } from "../components/SuggestionCardStack";
import BlockRenderer from "../components/BlockRenderer";
import { useAiBlocks } from "../hooks/useAiBlocks";
import { useSuggestionSocket } from "../hooks/useSuggestionSocket";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import { useAuth } from "../context/AuthContext";
import { useSessionRecovery } from "../hooks/useSessionRecovery";
import type { AIBlock } from "../../shared/types";

import { API_BASE } from "../lib/api";
const ACTIVE_SESSION_KEY = "stratis.activeSessionId.v1";

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

  const handleEndMeeting = async () => {
    if (!token || !sessionId) return;

    recorder.stop();
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
    } finally {
      setEnding(false);
    }
  };

  const isRecording = recorder.status === "recording";
  const canRecord = !!sessionId && !!token && !ending;

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
            fontWeight: 500,
            margin: "0 0 24px",
          }}
        >
          Meeting
        </h1>

        <EmptyState message="No active meeting session. Start a meeting from Dashboard." />

        <div style={{ marginTop: 18 }}>
          <button style={btnAccent()} onClick={() => onNav?.("dashboard")}>
            Go to Dashboard
          </button>
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
        }}
      >
        <div
          style={{
            borderBottom: `1px solid ${COLORS.border}`,
            padding: "18px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <h1
              style={{
                color: COLORS.text,
                fontSize: 20,
                fontWeight: 500,
                margin: "0 0 4px",
              }}
            >
              Live meeting
            </h1>

            <div style={{ color: COLORS.textMuted, fontSize: 12 }}>
              Session: {sessionId}
              {" · "}
              Mic: {recorder.status}
              {" · "}
              AI: {ai.provider ?? "waiting"}
              {" · "}
              Suggestions: {connected ? "connected" : "offline"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isRecording ? (
              <button
                style={btnAccent()}
                onClick={() => void recorder.start()}
                disabled={!canRecord}
              >
                Start mic
              </button>
            ) : (
              <button
                style={{
                  ...btnGhost(),
                  color: COLORS.red,
                  borderColor: `${COLORS.red}66`,
                }}
                onClick={recorder.stop}
              >
                Stop mic
              </button>
            )}

            <button
              style={{
                ...btnGhost(),
                color: COLORS.red,
                borderColor: `${COLORS.red}66`,
              }}
              onClick={() => void handleEndMeeting()}
              disabled={ending}
            >
              {ending ? "Ending..." : "End meeting"}
            </button>
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

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "24px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <section>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  color: COLORS.text,
                  fontSize: 14,
                  fontWeight: 500,
                  margin: 0,
                }}
              >
                Transcript
              </h2>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {sendingChunk && (
                  <span style={{ color: COLORS.textDim, fontSize: 12 }}>
                    Processing audio...
                  </span>
                )}
                <button
                  style={btnGhost()}
                  onClick={() => void loadTranscript()}
                >
                  Refresh
                </button>
              </div>
            </div>

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
                      borderRadius: 8,
                      padding: "12px 14px",
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
          </section>

          <section>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h2
                style={{
                  color: COLORS.text,
                  fontSize: 14,
                  fontWeight: 500,
                  margin: 0,
                }}
              >
                AI notes
              </h2>

              <span style={{ color: COLORS.textDim, fontSize: 12 }}>
                {ai.status}
              </span>
            </div>

            {ai.error && (
              <div
                style={{
                  background: COLORS.redBg,
                  border: `1px solid ${COLORS.red}`,
                  color: COLORS.red,
                  borderRadius: 8,
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
    </div>
  );
}
