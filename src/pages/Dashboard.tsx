import { useEffect, useMemo, useState } from "react";
import { COLORS, FONT, SHADOW, TRANSITION, GRADIENT, SPACE } from "../constants";
import { Button } from "../components/ui";
import { EmptyState, LoadingState } from "../components/states";
import { NewMeetingModal } from "../components/NewMeetingModal";
import { useAuth } from "../context/AuthContext";
import { useCreateMeeting, ACTIVE_SESSION_KEY, projectIdFromTitle } from "../hooks/useCreateMeeting";

import { API_BASE } from "../lib/api";

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

// Small hover-lift for otherwise-flat interactive rows — same hover-via-state
// idiom as Button/IconButton in ui.tsx, just applied locally here.
function HoverLift({
  as = "div",
  style,
  children,
  ...rest
}: {
  as?: "div" | "button";
  style?: React.CSSProperties;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const [hovered, setHovered] = useState(false);
  const Comp = as as any;

  return (
    <Comp
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...style,
        borderColor: hovered ? COLORS.borderLight : COLORS.border,
        boxShadow: hovered ? SHADOW.xs : "none",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        transition: `transform ${TRANSITION.springSoft}, box-shadow ${TRANSITION.base}, border-color ${TRANSITION.base}`,
      }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

export default function Dashboard({ onNav }: DashboardProps) {
  const { token, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<DashboardMeeting[]>([]);
  const [summaries, setSummaries] = useState<DashboardSummary[]>([]);
  const [showNewMeeting, setShowNewMeeting] = useState(false);

  const authHeaders = useMemo((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const create = useCreateMeeting(onNav);

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

      await create.startSessionForMeeting(meeting.id, 60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start meeting");
    }
  };

  const handleCreateMeeting = async (input: {
    title: string;
    projectName: string;
    durationMinutes: number;
    goal: string;
    brief: string;
  }) => {
    const sessionId = await create.createMeeting({
      title: input.title,
      projectId: projectIdFromTitle(input.projectName),
      goal: input.goal,
      brief: input.brief,
      durationMinutes: input.durationMinutes,
    });
    if (sessionId) setShowNewMeeting(false);
  };

  return (
    <div className="page-padding" style={{ overflowY: "auto", flex: 1 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 40,
          padding: "8px 12px",
          margin: "-8px -12px 32px",
          borderRadius: 12,
          backgroundImage: GRADIENT.accentGlow(COLORS.accent),
        }}
      >
        <div>
          <h1
            style={{
              color: COLORS.text,
              fontSize: FONT.size.title,
              fontWeight: 600,
              margin: 0,
              marginBottom: 4,
            }}
          >
            Dashboard
          </h1>
          <span style={{ color: COLORS.textMuted, fontSize: FONT.size.body }}>
            Welcome back, {user?.name ?? "facilitator"}
          </span>
        </div>

        <Button variant="primary" onClick={() => setShowNewMeeting(true)}>
          + New meeting
        </Button>
      </div>

      {error && (
        <div
          style={{
            background: COLORS.redBg,
            border: `1px solid ${COLORS.red}`,
            color: COLORS.red,
            borderRadius: 8,
            padding: "10px 12px",
            marginBottom: SPACE[5],
            fontSize: FONT.size.body,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState count={4} />
      ) : (
        <div
          className="dashboard-grid"
          style={{
            display: "grid",
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
                  fontSize: FONT.size.subheading,
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                Upcoming meetings
              </h2>
              <Button variant="ghost" onClick={loadDashboard}>
                Refresh
              </Button>
            </div>
            {meetings.length === 0 ? (
              <EmptyState message="No meetings yet. Create your first meeting." />
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: SPACE[2.5] }}
              >
                {meetings.map((m) => (
                  <HoverLift
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
                            fontSize: FONT.size.body,
                            fontWeight: 500,
                            marginBottom: SPACE[1.5],
                          }}
                        >
                          {m.title}
                        </div>
                        <div style={{ color: COLORS.textMuted, fontSize: FONT.size.label }}>
                          {m.project ?? m.projectId ?? "Project"} ·{" "}
                          {formatDate(m.scheduledAt ?? m.time)}
                        </div>
                      </div>

                      <Button
                        variant="primary"
                        onClick={() => void handleStartExisting(m)}
                      >
                        {m.activeSession ? "Resume" : "Start"}
                      </Button>
                    </div>
                  </HoverLift>
                ))}
              </div>
            )}
          </div>

          {/* Recent Summaries */}
          <div>
            <h2
              style={{
                color: COLORS.text,
                fontSize: FONT.size.subheading,
                fontWeight: 600,
                margin: "0 0 16px",
              }}
            >
              Recent summaries
            </h2>

            {summaries.length === 0 ? (
              <EmptyState message="No summaries yet. End a meeting to generate one." />
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: SPACE[2.5] }}
              >
                {summaries.map((s) => (
                  <HoverLift
                    as="button"
                    key={s.id}
                    style={{
                      width: "100%",
                      textAlign: "left",
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
                          fontSize: FONT.size.body,
                          fontWeight: 500,
                        }}
                      >
                        {s.title}
                      </span>
                      <span style={{ color: COLORS.textMuted, fontSize: FONT.size.label }}>
                        {formatDate(s.date)}
                      </span>
                    </div>
                    <div style={{ fontSize: FONT.size.label, color: COLORS.textMuted }}>
                      {s.project ?? "Project summary"}
                    </div>
                  </HoverLift>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <NewMeetingModal
        open={showNewMeeting}
        onClose={() => setShowNewMeeting(false)}
        onSubmit={handleCreateMeeting}
        submitting={create.creating}
        error={create.error}
      />
    </div>
  );
}
