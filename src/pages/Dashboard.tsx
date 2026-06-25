import { useEffect, useMemo, useState } from "react";
import { COLORS } from "../constants";
import { btnAccent, btnGhost } from "../components/ui";
import { EmptyState, LoadingState } from "../components/states";
import { useAuth } from "../context/AuthContext";

import { API_BASE } from "../lib/api";
const ACTIVE_SESSION_KEY = "stratis.activeSessionId.v1";

interface DashboardProps {
  onNav?: (id: string, params?: Record<string, string>) => void;
}

interface DashboardMeeting {
  id: string;
  title: string;
  projectId?: string;
  project?: string;
  scheduledAt?: string | null;
  time?: string | null;
  participantCount?: number;
  participants?: number;
  activeSession?: {
    id: string;
    status: "created" | "active" | "ended";
  } | null;
}

interface DashboardSummary {
  id: string;
  sessionId?: string;
  title: string;
  project?: string;
  date?: string;
  decisions?: number;
  openItems?: number;
}

interface BackendSummary {
  id: string;
  user_id?: string;
  session_id?: string | null;
  kind?: string;
  title: string;
  body?: string;
  read?: number;
  created_at?: string;
  meeting_title?: string | null;
  project_id?: string | null;
}

interface DashboardPayload {
  upcomingMeetings?: DashboardMeeting[];
  upcoming?: DashboardMeeting[];
  meetings?: DashboardMeeting[];
  recentSummaries?: BackendSummary[];
  summaries?: DashboardSummary[];
  activeSession?: {
    id: string;
    meeting_title?: string;
    project_id?: string;
  } | null;
}

function formatDate(value?: string | null): string {
  if (!value) return "Unscheduled";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function projectIdFromTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "default-project";
}

function getMinDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export default function Dashboard({ onNav }: DashboardProps) {
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<DashboardMeeting[]>([]);
  const [summaries, setSummaries] = useState<DashboardSummary[]>([]);
  const [showNewMeeting, setShowNewMeeting] = useState(false);

  const [title, setTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [goal, setGoal] = useState("");
  const [brief, setBrief] = useState("");
  const [creating, setCreating] = useState(false);

  const authHeaders = useMemo((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const loadDashboard = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/meeting/dashboard`, {
        headers: authHeaders,
      });

      const data: {
        ok: boolean;
        error?: string;
        data?: DashboardPayload;
      } = await res.json();

      if (!data.ok) {
        setError(data.error ?? "Could not load dashboard");
        return;
      }

      const dashboardData = data.data;

      setMeetings(
        dashboardData?.upcomingMeetings ??
          dashboardData?.upcoming ??
          dashboardData?.meetings ??
          [],
      );

      setSummaries(
        dashboardData?.summaries ??
          (dashboardData?.recentSummaries ?? []).map((summary) => ({
            id: summary.id,
            sessionId: summary.session_id ?? undefined,
            title: summary.title,
            project:
              summary.project_id ?? summary.meeting_title ?? "Project summary",
            date: summary.created_at,
          })),
      );
    } catch {
      setError("Could not reach backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [token]);

  const startSessionForMeeting = async (meetingId: string) => {
    const createRes = await fetch(`${API_BASE}/api/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        meetingId,
        meeting_id: meetingId,
      }),
    });

    const createData = await createRes.json();

    if (!createData.ok) {
      throw new Error(createData.error ?? "Could not create session");
    }

    const session = createData.data?.session ?? createData.data;

    const sessionId = session?.id;

    if (!sessionId) {
      throw new Error("Session id missing from backend response");
    }

    await fetch(`${API_BASE}/api/session/${sessionId}/start`, {
      method: "POST",
      headers: authHeaders,
    }).catch(() => {
      // Non-fatal. Some backends create sessions directly as active.
    });

    window.localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    onNav?.("meeting", { sessionId });

    return sessionId;
  };

  const handleStartExisting = async (meeting: DashboardMeeting) => {
    setError(null);

    try {
      if (meeting.activeSession?.id) {
        window.localStorage.setItem(
          ACTIVE_SESSION_KEY,
          meeting.activeSession.id,
        );
        onNav?.("meeting", { sessionId: meeting.activeSession.id });
        return;
      }

      await startSessionForMeeting(meeting.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start meeting");
    }
  };

  const handleCreateMeeting = async () => {
    const cleanTitle = title.trim();
    const cleanProject = projectName.trim();

    if (!cleanTitle) {
      setError("Meeting title is required");
      return;
    }

    if (!cleanProject) {
      setError("Project name is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const projectId = projectIdFromTitle(cleanProject);

      const res = await fetch(`${API_BASE}/api/meeting`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          title: cleanTitle,
          projectId,
          project_id: projectId,
          scheduledAt: scheduledAt || null,
          scheduled_at: scheduledAt || null,
          goal: goal.trim() || null,
          brief: brief.trim() || null,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error ?? "Could not create meeting");
      }

      const meeting = data.data?.meeting ?? data.data;

      const meetingId = meeting?.id;

      if (!meetingId) {
        throw new Error("Meeting id missing from backend response");
      }

      setShowNewMeeting(false);
      setTitle("");
      setProjectName("");
      setScheduledAt("");
      setGoal("");
      setBrief("");

      await startSessionForMeeting(meetingId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create meeting");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 40,
        }}
      >
        <div>
          <h1
            style={{
              color: COLORS.text,
              fontSize: 22,
              fontWeight: 500,
              margin: 0,
              marginBottom: 4,
            }}
          >
            Dashboard
          </h1>
          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>
            Welcome back, {user?.name ?? "facilitator"}
          </span>
        </div>

        <button style={btnAccent()} onClick={() => setShowNewMeeting(true)}>
          + New meeting
        </button>
      </div>

      {error && (
        <div
          style={{
            background: COLORS.redBg,
            border: `1px solid ${COLORS.red}`,
            color: COLORS.red,
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: 18,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState count={4} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 32,
            alignItems: "start",
          }}
        >
          {/* Upcoming Meetings */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
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
                Upcoming meetings
              </h2>
              <button style={btnGhost()} onClick={loadDashboard}>
                Refresh
              </button>
            </div>
            {meetings.length === 0 ? (
              <EmptyState message="No meetings yet. Create your first meeting." />
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {meetings.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 10,
                      padding: "16px 18px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 16,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: COLORS.text,
                            fontSize: 14,
                            fontWeight: 500,
                            marginBottom: 6,
                          }}
                        >
                          {m.title}
                        </div>
                        <div style={{ color: COLORS.textMuted, fontSize: 12 }}>
                          {m.project ?? m.projectId ?? "Project"} ·{" "}
                          {formatDate(m.scheduledAt ?? m.time)}
                        </div>
                      </div>

                      <button
                        style={btnAccent()}
                        onClick={() => void handleStartExisting(m)}
                      >
                        {m.activeSession ? "Resume" : "Start"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Summaries */}
          <div>
            <h2
              style={{
                color: COLORS.text,
                fontSize: 14,
                fontWeight: 500,
                margin: "0 0 16px",
              }}
            >
              Recent summaries
            </h2>

            {summaries.length === 0 ? (
              <EmptyState message="No summaries yet. End a meeting to generate one." />
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {summaries.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 10,
                      padding: "16px 18px",
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      onNav?.("summary", { sessionId: s.sessionId ?? s.id })
                    }
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          color: COLORS.text,
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        {s.title}
                      </span>
                      <span style={{ color: COLORS.textDim, fontSize: 12 }}>
                        {s.date ?? ""}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                      {s.project ?? "Project summary"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showNewMeeting && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2
              style={{
                color: COLORS.text,
                fontSize: 18,
                fontWeight: 500,
                margin: "0 0 18px",
              }}
            >
              New meeting
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                style={inputStyle}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting title"
              />

              <input
                style={inputStyle}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name"
              />

              <input
                style={inputStyle}
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={getMinDateTime()}
              />

              <input
                style={inputStyle}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Meeting goal (one line)"
              />

              <textarea
                style={{
                  ...inputStyle,
                  minHeight: 72,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Brief / agenda — context for the AI (optional)"
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 22,
              }}
            >
              <button
                style={btnGhost()}
                onClick={() => setShowNewMeeting(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                style={btnAccent()}
                onClick={() => void handleCreateMeeting()}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create and start"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 200,
};

const modalStyle: React.CSSProperties = {
  width: 420,
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: 24,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};
