import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { COLORS } from "../constants";
import { useAuth } from "../context/AuthContext";
import { useMediaRecorder } from "../hooks/useMediaRecorder";
import { useSessionRecovery } from "../hooks/useSessionRecovery";
import { useSuggestionSocket } from "../hooks/useSuggestionSocket";

const API_BASE = "http://localhost:3001";

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

type AIBlockType =
  | "TextBlock"
  | "DecisionNode"
  | "SummaryBlock"
  | "QuestionSuggestion"
  | string;

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

interface MeetingCreateData {
  meeting?: {
    id: string;
  };
}

interface SessionData {
  session?: {
    id: string;
    status?: string;
  };
}

interface TranscriptRow {
  id: string;
  session_id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

interface TranscriptLine {
  chunkNumber: number;
  id: string;
  speaker: string;
  text: string;
  timestamp: string;
}

interface AIBlock {
  type: AIBlockType;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface AudioAIOutput {
  provider: string;
  blocks: AIBlock[];
}

interface CreatedSuggestion {
  id?: string;
  question?: string;
  reason?: string;
  title?: string;
  brief_description?: string;
  suggested_question?: string;
}

interface SuggestionOutput {
  created?: CreatedSuggestion[];
  answered?: string[];
}

interface AudioChunkData {
  sessionId: string;
  transcript: TranscriptRow | null;
  stt?: {
    provider: string;
  };
  ai?: AudioAIOutput | null;
  suggestions?: SuggestionOutput;
}

interface AIEvent {
  chunkNumber: number;
  timestamp: string;
  ai: AudioAIOutput;
}

interface SuggestionEvent {
  chunkNumber: number;
  id: string;
  question: string;
  reason: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPathString(value: unknown, path: string[]): string {
  let current: unknown = value;

  for (const key of path) {
    if (!isRecord(current)) return "";
    current = current[key];
  }

  return typeof current === "string" ? current : "";
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
): Promise<ApiEnvelope<T>> {
  const res = await fetch(url, init);

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (isRecord(body) && typeof body.ok === "boolean") {
    return body as ApiEnvelope<T>;
  }

  if (!res.ok) {
    return {
      ok: false,
      error: `HTTP ${res.status}`,
      data: body as T,
    };
  }

  return {
    ok: true,
    data: body as T,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      resolve(String(reader.result));
    };

    reader.onerror = () => {
      reject(new Error("Could not read audio chunk"));
    };

    reader.readAsDataURL(blob);
  });
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value);
}

function nowLabel(): string {
  return new Date().toLocaleTimeString();
}

export default function LiveVoicePipelineTest() {
  const { token } = useAuth();

  const {
    sessionId: recoveredSessionId,
    status: recoveryStatus,
    error: recoveryError,
    rememberSession,
    clearRecoveredSession,
  } = useSessionRecovery({ token });

  const [activeSessionId, setActiveSessionId] = useState("");
  const activeSessionRef = useRef("");

  const [sessionStatus, setSessionStatus] = useState("No active test session");
  const [pipelineStatus, setPipelineStatus] = useState("Idle");
  const [sttStatus, setSttStatus] = useState("Waiting");
  const [aiStatus, setAiStatus] = useState("Waiting");
  const [lastChunkStatus, setLastChunkStatus] = useState("No chunks sent yet");

  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [pendingChunks, setPendingChunks] = useState(0);

  const [chunkCount, setChunkCount] = useState(0);
  const [lastChunkBytes, setLastChunkBytes] = useState(0);

  const [sttProvider, setSttProvider] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);

  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);
  const [latestAiJson, setLatestAiJson] = useState<AudioAIOutput | null>(null);
  const [aiEvents, setAiEvents] = useState<AIEvent[]>([]);
  const [suggestionEvents, setSuggestionEvents] = useState<SuggestionEvent[]>(
    [],
  );
  const [lastRawResponse, setLastRawResponse] = useState<unknown>(null);

  const [pulledLabel, setPulledLabel] = useState("");
  const [pulledValue, setPulledValue] = useState("");

  const [error, setError] = useState<string | null>(null);

  const chunkSeqRef = useRef(0);

  const socket = useSuggestionSocket(activeSessionId);

  const setActiveSession = useCallback(
    (id: string) => {
      setActiveSessionId(id);
      activeSessionRef.current = id;
      rememberSession(id);
    },
    [rememberSession],
  );

  useEffect(() => {
    if (!activeSessionId && recoveredSessionId) {
      setActiveSession(recoveredSessionId);
      setSessionStatus("Recovered existing session");
    }
  }, [activeSessionId, recoveredSessionId, setActiveSession]);

  const authHeaders = useCallback(
    (json = true): Record<string, string> => {
      const headers: Record<string, string> = {};

      if (json) {
        headers["Content-Type"] = "application/json";
      }

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      return headers;
    },
    [token],
  );

  const startSessionOnServer = useCallback(
    async (sessionId: string) => {
      const started = await requestJson<SessionData>(
        `${API_BASE}/api/session/${sessionId}/start`,
        {
          method: "POST",
          headers: authHeaders(),
        },
      );

      if (!started.ok) {
        throw new Error(started.error ?? "Could not start session");
      }

      setSessionStatus("Session active");
    },
    [authHeaders],
  );

  const createTestSession = useCallback(async (): Promise<string> => {
    if (!token) {
      throw new Error("Missing auth token. Please sign in first.");
    }

    setSessionStatus("Creating test meeting...");

    const meeting = await requestJson<MeetingCreateData>(
      `${API_BASE}/api/meeting`,
      {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          title: `Live Voice Pipeline Test — ${new Date().toLocaleString()}`,
          projectId: "project_stratis",
          scheduledAt: new Date().toISOString(),
        }),
      },
    );

    if (!meeting.ok) {
      throw new Error(meeting.error ?? "Could not create test meeting");
    }

    const meetingId =
      meeting.data?.meeting?.id ||
      readPathString(meeting, ["data", "meeting", "id"]);

    if (!meetingId) {
      throw new Error("Meeting created but no meeting ID was returned");
    }

    setSessionStatus("Creating session...");

    const session = await requestJson<SessionData>(`${API_BASE}/api/session`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        meetingId,
      }),
    });

    if (!session.ok) {
      throw new Error(session.error ?? "Could not create session");
    }

    const sessionId =
      session.data?.session?.id ||
      readPathString(session, ["data", "session", "id"]);

    if (!sessionId) {
      throw new Error("Session created but no session ID was returned");
    }

    setActiveSession(sessionId);
    setSessionStatus("Session created");

    return sessionId;
  }, [authHeaders, setActiveSession, token]);

  const ensureLiveSession = useCallback(async (): Promise<string> => {
    const existingSessionId = activeSessionId || recoveredSessionId || "";

    if (existingSessionId) {
      setActiveSession(existingSessionId);
      setSessionStatus("Starting recovered session...");
      await startSessionOnServer(existingSessionId);
      return existingSessionId;
    }

    const newSessionId = await createTestSession();
    setSessionStatus("Starting new session...");
    await startSessionOnServer(newSessionId);
    return newSessionId;
  }, [
    activeSessionId,
    recoveredSessionId,
    setActiveSession,
    startSessionOnServer,
    createTestSession,
  ]);

  const handleAudioChunk = useCallback(
    async (chunk: Blob) => {
      const sessionId = activeSessionRef.current;

      if (chunk.size < MIN_AUDIO_CHUNK_BYTES) {
        setLastChunkStatus(
          `Skipped tiny audio chunk: ${formatBytes(chunk.size)} at ${nowLabel()}`,
        );
        setPipelineStatus("Skipped tiny/partial audio chunk");
        return;
      }

      if (!token) {
        setError("Missing auth token. Please sign in first.");
        return;
      }

      if (!sessionId) {
        setError("No active session ID. Click Start Live Test first.");
        return;
      }

      const chunkNumber = chunkSeqRef.current + 1;
      chunkSeqRef.current = chunkNumber;

      setChunkCount(chunkNumber);
      setLastChunkBytes(chunk.size);
      setPendingChunks((n) => n + 1);
      setError(null);

      setPipelineStatus(`Chunk ${chunkNumber}: captured microphone audio`);
      setLastChunkStatus(
        `Chunk ${chunkNumber}: ${formatBytes(chunk.size)} captured at ${nowLabel()}`,
      );
      setSttStatus(`Chunk ${chunkNumber}: uploading to STT...`);
      setAiStatus("Waiting for transcript before AI");

      try {
        const audioBase64 = await blobToBase64(chunk);

        setPipelineStatus(`Chunk ${chunkNumber}: sending audio to backend`);
        setSttStatus(`Chunk ${chunkNumber}: waiting for Deepgram/STT...`);

        const response = await requestJson<AudioChunkData>(
          `${API_BASE}/api/transcript/audio-chunk`,
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({
              sessionId,
              audioBase64,
              mimeType: chunk.type || RECORDER_MIME_TYPE || "audio/webm",
              speaker: "Live Voice Test",
            }),
          },
        );

        setLastRawResponse(response);

        if (!response.ok) {
          setPipelineStatus(`Chunk ${chunkNumber}: failed`);
          setSttStatus("Error");
          setAiStatus("Skipped because STT/audio pipeline failed");
          setError(response.error ?? "Audio pipeline failed");
          return;
        }

        const output = response.data;

        if (!output) {
          setPipelineStatus(`Chunk ${chunkNumber}: empty backend response`);
          setSttStatus("No response data");
          setAiStatus("No AI output");
          return;
        }

        if (output.stt?.provider) {
          setSttProvider(output.stt.provider);
        }

        const transcriptText = output.transcript?.text?.trim() ?? "";

        if (!transcriptText) {
          setPipelineStatus(
            `Chunk ${chunkNumber}: listening, no speech detected`,
          );
          setSttStatus(`Chunk ${chunkNumber}: no speech detected`);
          setAiStatus("No transcript, so AI was not called");
          return;
        }

        setTranscriptLines((prev) => [
          ...prev,
          {
            chunkNumber,
            id: output.transcript?.id ?? `chunk-${chunkNumber}`,
            speaker: output.transcript?.speaker ?? "Live Voice Test",
            text: transcriptText,
            timestamp: output.transcript?.timestamp ?? new Date().toISOString(),
          },
        ]);

        setPipelineStatus(`Chunk ${chunkNumber}: transcript received`);
        setSttStatus(`Chunk ${chunkNumber}: transcript received`);
        setAiStatus(`Chunk ${chunkNumber}: waiting for AI JSON...`);

        if (output.ai) {
          setLatestAiJson(output.ai);
          setAiProvider(output.ai.provider);
          setAiEvents((prev) => [
            {
              chunkNumber,
              timestamp: new Date().toISOString(),
              ai: output.ai as AudioAIOutput,
            },
            ...prev,
          ]);

          setPipelineStatus(`Chunk ${chunkNumber}: AI JSON received`);
          setAiStatus(`Chunk ${chunkNumber}: validated AI JSON received`);
        } else {
          setAiStatus(`Chunk ${chunkNumber}: no AI output returned`);
        }

        const createdSuggestions = output.suggestions?.created ?? [];

        if (createdSuggestions.length > 0) {
          setSuggestionEvents((prev) => [
            ...createdSuggestions.map((card, index) => {
              const question =
                card.question ||
                card.suggested_question ||
                card.title ||
                "Untitled suggestion";

              const reason =
                card.reason || card.brief_description || "No reason returned";

              return {
                chunkNumber,
                id: card.id ?? `suggestion-${chunkNumber}-${index}`,
                question,
                reason,
              };
            }),
            ...prev,
          ]);
        }
      } catch (err) {
        setPipelineStatus(`Chunk ${chunkNumber}: error`);
        setSttStatus("Error");
        setAiStatus("Error");
        setError(err instanceof Error ? err.message : "Audio chunk failed");
      } finally {
        setPendingChunks((n) => Math.max(0, n - 1));
      }
    },
    [authHeaders, token],
  );

  const recorder = useMediaRecorder({
    onChunk: handleAudioChunk,
    chunkIntervalMs: 4000,
    mimeType: RECORDER_MIME_TYPE,
  });

  const startLiveTest = useCallback(async () => {
    setIsStarting(true);
    setError(null);

    try {
      setPipelineStatus("Preparing live voice test...");
      setSttStatus("Waiting");
      setAiStatus("Waiting");

      const sessionId = await ensureLiveSession();

      activeSessionRef.current = sessionId;
      setActiveSessionId(sessionId);

      setPipelineStatus("Requesting microphone permission...");
      await recorder.start();

      setPipelineStatus(
        "Recording. Speak now. First transcript may take a few seconds.",
      );
    } catch (err) {
      setPipelineStatus("Start failed");
      setSessionStatus("Start failed");
      setError(
        err instanceof Error ? err.message : "Could not start live test",
      );
    } finally {
      setIsStarting(false);
    }
  }, [ensureLiveSession, recorder]);

  const stopMic = useCallback(() => {
    recorder.stop();
    setPipelineStatus("Mic stopped. Session is still open.");
  }, [recorder]);

  const endSession = useCallback(async () => {
    if (!activeSessionId || !token) {
      recorder.stop();
      clearRecoveredSession();
      setActiveSessionId("");
      activeSessionRef.current = "";
      setSessionStatus("No active test session");
      setPipelineStatus("Ended locally");
      return;
    }

    setIsEnding(true);
    setError(null);

    try {
      recorder.stop();

      const ended = await requestJson<SessionData>(
        `${API_BASE}/api/session/${activeSessionId}/end`,
        {
          method: "POST",
          headers: authHeaders(),
        },
      );

      if (!ended.ok) {
        throw new Error(ended.error ?? "Could not end session");
      }

      clearRecoveredSession();
      setActiveSessionId("");
      activeSessionRef.current = "";
      setSessionStatus("Session ended");
      setPipelineStatus("Ended");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end session");
    } finally {
      setIsEnding(false);
    }
  }, [activeSessionId, authHeaders, clearRecoveredSession, recorder, token]);

  const clearPage = useCallback(() => {
    setTranscriptLines([]);
    setLatestAiJson(null);
    setAiEvents([]);
    setSuggestionEvents([]);
    setLastRawResponse(null);
    setPulledLabel("");
    setPulledValue("");
    setError(null);
    setChunkCount(0);
    setLastChunkBytes(0);
    setLastChunkStatus("No chunks sent yet");
    setSttStatus("Waiting");
    setAiStatus("Waiting");
    setPipelineStatus("Cleared. Ready.");
    chunkSeqRef.current = 0;
  }, []);

  const fullTranscript = useMemo(() => {
    return transcriptLines.map((line) => line.text).join("\n");
  }, [transcriptLines]);

  const firstBlock = latestAiJson?.blocks?.[0] ?? null;

  const questionSuggestionBlocks = useMemo(() => {
    return (
      latestAiJson?.blocks.filter(
        (block) => block.type === "QuestionSuggestion",
      ) ?? []
    );
  }, [latestAiJson]);

  const pullValue = useCallback((label: string, value: string) => {
    setPulledLabel(label);
    setPulledValue(value);
  }, []);

  const recordingActive =
    recorder.status === "requesting" || recorder.status === "recording";

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Live Voice Pipeline Test</h1>
          <p style={styles.subtitle}>
            Start session → mic records → Deepgram transcript → AI JSON →
            suggestion output.
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            style={buttonStyle(isStarting || recordingActive)}
            disabled={isStarting || recordingActive}
            onClick={() => void startLiveTest()}
          >
            {isStarting ? "Starting..." : "Start Live Test"}
          </button>

          <button
            style={buttonStyle(recorder.status !== "recording")}
            disabled={recorder.status !== "recording"}
            onClick={stopMic}
          >
            Stop Mic
          </button>

          <button
            style={buttonStyle(isEnding)}
            disabled={isEnding}
            onClick={() => void endSession()}
          >
            {isEnding ? "Ending..." : "End Session"}
          </button>

          <button style={buttonStyle(false)} onClick={clearPage}>
            Clear
          </button>
        </div>
      </div>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>Live Status</h2>

        <div style={styles.statusGrid}>
          <StatusPill label="Recovery" value={recoveryStatus} />
          <StatusPill label="Session" value={sessionStatus} />
          <StatusPill
            label="Session ID"
            value={activeSessionId || "none"}
            wide
          />
          <StatusPill
            label="Mic"
            value={recorder.status}
            tone={recorder.status === "recording" ? "good" : "neutral"}
          />
          <StatusPill label="Pipeline" value={pipelineStatus} wide />
          <StatusPill
            label="STT"
            value={sttStatus}
            tone={sttStatus.includes("received") ? "good" : "neutral"}
            wide
          />
          <StatusPill label="STT Provider" value={sttProvider ?? "unknown"} />
          <StatusPill
            label="AI"
            value={aiStatus}
            tone={aiStatus.includes("received") ? "good" : "neutral"}
            wide
          />
          <StatusPill label="AI Provider" value={aiProvider ?? "unknown"} />
          <StatusPill
            label="WS Connected"
            value={socket.connected ? "yes" : "no"}
            tone={socket.connected ? "good" : "neutral"}
          />
          <StatusPill label="WS Role" value={socket.role ?? "unknown"} />
          <StatusPill label="Pending Chunks" value={String(pendingChunks)} />
        </div>

        {recoveryError && (
          <div style={styles.warningBox}>Session recovery: {recoveryError}</div>
        )}

        {recorder.error && (
          <div style={styles.errorBox}>Recorder: {recorder.error}</div>
        )}

        {error && <div style={styles.errorBox}>{error}</div>}
      </section>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>Audio Chunks</h2>

        <div style={styles.metricRow}>
          <Metric label="Chunks sent" value={String(chunkCount)} />
          <Metric
            label="Last chunk size"
            value={lastChunkBytes ? formatBytes(lastChunkBytes) : "0 B"}
          />
          <Metric label="Recorder status" value={recorder.status} />
        </div>

        <div style={styles.smallMuted}>{lastChunkStatus}</div>
      </section>

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Live Transcript</h2>

          <button
            style={smallButtonStyle(false)}
            onClick={() => void copyToClipboard(fullTranscript)}
          >
            Copy Full Transcript
          </button>
        </div>

        {transcriptLines.length === 0 ? (
          <div style={styles.emptyBox}>
            No transcript yet. Click Start Live Test and speak clearly for a few
            seconds.
          </div>
        ) : (
          <div style={styles.transcriptList}>
            {transcriptLines.map((line) => (
              <div
                key={`${line.id}-${line.chunkNumber}`}
                style={styles.transcriptItem}
              >
                <div style={styles.transcriptMeta}>
                  Chunk {line.chunkNumber} · {line.speaker} ·{" "}
                  {new Date(line.timestamp).toLocaleTimeString()}
                </div>
                <div style={styles.transcriptText}>{line.text}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Latest AI JSON Output</h2>

          <button
            style={smallButtonStyle(!latestAiJson)}
            disabled={!latestAiJson}
            onClick={() =>
              void copyToClipboard(latestAiJson ? prettyJson(latestAiJson) : "")
            }
          >
            Copy JSON
          </button>
        </div>

        <pre style={styles.pre}>
          {latestAiJson ? prettyJson(latestAiJson) : "No AI JSON yet."}
        </pre>

        <div style={styles.pullGrid}>
          <button
            style={smallButtonStyle(!firstBlock)}
            disabled={!firstBlock}
            onClick={() =>
              pullValue("first_block.type", firstBlock?.type ?? "")
            }
          >
            Pull First Block Type
          </button>

          <button
            style={smallButtonStyle(!firstBlock)}
            disabled={!firstBlock}
            onClick={() =>
              pullValue("first_block.title", firstBlock?.title ?? "")
            }
          >
            Pull First Block Title
          </button>

          <button
            style={smallButtonStyle(!firstBlock)}
            disabled={!firstBlock}
            onClick={() =>
              pullValue("first_block.content", firstBlock?.content ?? "")
            }
          >
            Pull First Block Content
          </button>

          <button
            style={smallButtonStyle(!fullTranscript)}
            disabled={!fullTranscript}
            onClick={() => pullValue("full_transcript", fullTranscript)}
          >
            Pull Full Transcript
          </button>
        </div>
      </section>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>QuestionSuggestion Blocks</h2>

        {questionSuggestionBlocks.length === 0 ? (
          <div style={styles.emptyBox}>
            No QuestionSuggestion block in the latest AI output.
          </div>
        ) : (
          <div style={styles.cardList}>
            {questionSuggestionBlocks.map((block, index) => (
              <div key={`${block.title}-${index}`} style={styles.suggestionBox}>
                <div style={styles.suggestionTitle}>{block.title}</div>
                <div style={styles.suggestionReason}>{block.content}</div>

                <div style={styles.cardActions}>
                  <button
                    style={smallButtonStyle(false)}
                    onClick={() =>
                      pullValue("question_suggestion.title", block.title)
                    }
                  >
                    Pull Question
                  </button>

                  <button
                    style={smallButtonStyle(false)}
                    onClick={() =>
                      pullValue("question_suggestion.content", block.content)
                    }
                  >
                    Pull Reason
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>
          Suggestion Events Created By Backend
        </h2>

        {suggestionEvents.length === 0 ? (
          <div style={styles.emptyBox}>
            No created suggestion events returned from audio chunks yet.
          </div>
        ) : (
          <div style={styles.cardList}>
            {suggestionEvents.map((card) => (
              <div key={card.id} style={styles.suggestionBox}>
                <div style={styles.transcriptMeta}>
                  Chunk {card.chunkNumber}
                </div>
                <div style={styles.suggestionTitle}>{card.question}</div>
                <div style={styles.suggestionReason}>{card.reason}</div>

                <div style={styles.cardActions}>
                  <button
                    style={smallButtonStyle(false)}
                    onClick={() =>
                      pullValue("suggestion.question", card.question)
                    }
                  >
                    Pull Question
                  </button>

                  <button
                    style={smallButtonStyle(false)}
                    onClick={() => pullValue("suggestion.reason", card.reason)}
                  >
                    Pull Reason
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>Live WebSocket Suggestion Stack</h2>

        {socket.cards.length === 0 ? (
          <div style={styles.emptyBox}>
            No cards received over WebSocket for this session yet.
          </div>
        ) : (
          <div style={styles.cardList}>
            {socket.cards.map((card) => (
              <div key={card.id} style={styles.suggestionBox}>
                <div style={styles.transcriptMeta}>Status: {card.status}</div>
                <div style={styles.suggestionTitle}>{card.question}</div>
                <div style={styles.suggestionReason}>{card.reason}</div>

                <div style={styles.cardActions}>
                  <button
                    style={smallButtonStyle(false)}
                    onClick={() => socket.markAnswered(card.id)}
                  >
                    Mark Answered
                  </button>

                  <button
                    style={smallButtonStyle(false)}
                    onClick={() => socket.markActive(card.id)}
                  >
                    Reopen Locally
                  </button>

                  <button
                    style={smallButtonStyle(false)}
                    onClick={() =>
                      pullValue("websocket_card.question", card.question)
                    }
                  >
                    Pull Question
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.panel}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Pulled Value</h2>

          <button
            style={smallButtonStyle(!pulledValue)}
            disabled={!pulledValue}
            onClick={() => void copyToClipboard(pulledValue)}
          >
            Copy Pulled Value
          </button>
        </div>

        <div style={styles.smallMuted}>
          {pulledLabel ? `Pulled: ${pulledLabel}` : "Nothing pulled yet."}
        </div>

        <textarea
          value={pulledValue}
          onChange={(e) => setPulledValue(e.target.value)}
          placeholder="Pulled values appear here..."
          rows={4}
          style={styles.textarea}
        />
      </section>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>AI Event History</h2>

        {aiEvents.length === 0 ? (
          <div style={styles.emptyBox}>No AI events yet.</div>
        ) : (
          <div style={styles.eventList}>
            {aiEvents.map((event) => (
              <div
                key={`${event.chunkNumber}-${event.timestamp}`}
                style={styles.eventItem}
              >
                <div style={styles.transcriptMeta}>
                  Chunk {event.chunkNumber} ·{" "}
                  {new Date(event.timestamp).toLocaleTimeString()} ·{" "}
                  {event.ai.provider}
                </div>
                <pre style={styles.smallPre}>{prettyJson(event.ai)}</pre>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.panel}>
        <h2 style={styles.sectionTitle}>Raw Last Backend Response</h2>

        <pre style={styles.pre}>
          {lastRawResponse
            ? prettyJson(lastRawResponse)
            : "No backend response yet."}
        </pre>
      </section>
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone = "neutral",
  wide = false,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "bad";
  wide?: boolean;
}) {
  const color =
    tone === "good"
      ? COLORS.teal
      : tone === "bad"
        ? COLORS.red
        : COLORS.textMuted;

  return (
    <div
      style={{ ...styles.statusPill, gridColumn: wide ? "span 2" : undefined }}
    >
      <div style={styles.statusLabel}>{label}</div>
      <div style={{ ...styles.statusValue, color }}>{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metric}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

function buttonStyle(disabled: boolean): CSSProperties {
  return {
    background: disabled ? COLORS.surface : COLORS.accent,
    border: `1px solid ${disabled ? COLORS.border : COLORS.accent}`,
    color: disabled ? COLORS.textDim : "#000",
    borderRadius: 6,
    padding: "8px 13px",
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function smallButtonStyle(disabled: boolean): CSSProperties {
  return {
    background: "transparent",
    border: `1px solid ${COLORS.border}`,
    color: disabled ? COLORS.textDim : COLORS.textMuted,
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

const styles: Record<string, CSSProperties> = {
  page: {
    height: "100%",
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "32px 48px 80px",
    flex: 1,
    color: COLORS.text,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 20,
  },

  headerActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  title: {
    fontSize: 22,
    fontWeight: 500,
    margin: "0 0 6px",
  },

  subtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    margin: 0,
    lineHeight: 1.5,
  },

  panel: {
    background: COLORS.surface,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: 500,
    margin: "0 0 12px",
  },

  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
  },

  statusPill: {
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "9px 10px",
    minWidth: 0,
  },

  statusLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },

  statusValue: {
    fontSize: 12,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  metricRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 10,
  },

  metric: {
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "12px 14px",
  },

  metricLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    marginBottom: 6,
  },

  metricValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 500,
  },

  smallMuted: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 1.5,
  },

  emptyBox: {
    border: `1px dashed ${COLORS.border}`,
    borderRadius: 8,
    padding: 18,
    color: COLORS.textDim,
    fontSize: 13,
    textAlign: "center",
  },

  transcriptList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  transcriptItem: {
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "11px 12px",
  },

  transcriptMeta: {
    color: COLORS.textDim,
    fontSize: 11,
    marginBottom: 5,
  },

  transcriptText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 1.5,
  },

  pre: {
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: 12,
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 1.5,
    overflow: "auto",
    maxHeight: 360,
    margin: 0,
  },

  smallPre: {
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: 10,
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 1.45,
    overflow: "auto",
    maxHeight: 180,
    margin: 0,
  },

  pullGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  suggestionBox: {
    background: COLORS.bg,
    border: `1px solid ${COLORS.teal}`,
    borderLeft: `3px solid ${COLORS.teal}`,
    borderRadius: 8,
    padding: "11px 12px",
  },

  suggestionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.4,
    marginBottom: 5,
  },

  suggestionReason: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 1.5,
  },

  cardActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  textarea: {
    width: "100%",
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: "10px 12px",
    color: COLORS.text,
    outline: "none",
    resize: "vertical",
    fontSize: 13,
    lineHeight: 1.5,
    fontFamily: "inherit",
    marginTop: 8,
  },

  eventList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  eventItem: {
    background: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    padding: 10,
  },

  warningBox: {
    marginTop: 10,
    background: COLORS.orangeBg,
    border: `1px solid ${COLORS.orange}`,
    color: COLORS.orange,
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
  },

  errorBox: {
    marginTop: 10,
    background: COLORS.redBg,
    border: `1px solid ${COLORS.red}`,
    color: COLORS.red,
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 13,
  },
};
