import { useEffect, useMemo, useState } from "react";
import { FONT, LETTER_SPACING, SPACE } from "../constants";
import { Button } from "../components/ui";
import { EmptyState, LoadingState } from "../components/states";
import { NewMeetingModal } from "../components/NewMeetingModal";
import { useAuth } from "../context/AuthContext";
import { useCreateMeeting, ACTIVE_SESSION_KEY, projectIdFromTitle } from "../hooks/useCreateMeeting";
import { useTheme } from "../hooks/useTheme";
import AmbientBackground from "../components/AmbientBackground";
import RollingText from "../components/RollingText";

import { API_BASE } from "../lib/api";

type Colors = ReturnType<typeof useTheme>["colors"];
type Shadow = ReturnType<typeof useTheme>["shadow"];

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


// Single reminder pill combining upcoming meetings + recent summaries.
// Hover reveals a dropdown with both lists — replaces the old two-stat-card
// + two-panel layout so the dashboard leads with one glanceable notifier.
function ReminderCard({
  colors,
  shadow,
  loading,
  meetings,
  summaries,
  onRefresh,
  onStartMeeting,
  onOpenSummary,
}: {
  colors: Colors;
  shadow: Shadow;
  loading: boolean;
  meetings: DashboardMeeting[];
  summaries: DashboardSummary[];
  onRefresh: () => void;
  onStartMeeting: (m: DashboardMeeting) => void;
  onOpenSummary: (s: DashboardSummary) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = meetings.length + summaries.length;
  const nextMeeting = meetings[0];
  const latestSummary = summaries[0];

  const subline = nextMeeting
    ? `Next: ${formatDate(nextMeeting.scheduledAt ?? nextMeeting.time)} — ${nextMeeting.title}`
    : latestSummary
    ? `New: ${formatDate(latestSummary.date)} — ${latestSummary.title}`
    : undefined;

  return (
    <div
      style={{ position: "relative", marginBottom: 24, maxWidth: 420 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        style={{
          textAlign: "left",
          background: colors.surfaceElevated,
          border: `1px solid ${colors.accentDim}`,
          borderRadius: 12,
          padding: "16px 18px",
          boxShadow: `${shadow.shadCard}, ${shadow.glow(colors.accent)}`,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8, flexShrink: 0 }}>
            {total > 0 && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: colors.accent,
                  animation: "recPulse 1.5s ease-out infinite",
                }}
              />
            )}
            <span
              style={{
                position: "relative",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: colors.accent,
              }}
            />
          </span>
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: FONT.size.label,
              fontWeight: 600,
              letterSpacing: LETTER_SPACING.wide,
              color: colors.text,
              textTransform: "uppercase",
            }}
          >
            {total} REMINDER{total === 1 ? "" : "S"}
          </span>
        </div>
        {subline && (
          <div style={{ fontSize: FONT.size.body, color: colors.textMuted }}>{subline}</div>
        )}
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 6,
            zIndex: 5,
            background: colors.surfaceElevated,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            boxShadow: shadow.shadCard,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: FONT.size.caption,
                  letterSpacing: LETTER_SPACING.wide,
                  color: colors.textMuted,
                  textTransform: "uppercase",
                }}
              >
                Upcoming meetings
              </span>
              <Button variant="ghost" onClick={onRefresh}>
                Refresh
              </Button>
            </div>
            {loading ? (
              <LoadingState count={2} />
            ) : meetings.length === 0 ? (
              <EmptyState message="No meetings yet. Create your first meeting." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE[2] }}>
                {meetings.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "8px 4px",
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    <div>
                      <div style={{ color: colors.text, fontSize: FONT.size.body, fontWeight: 500 }}>
                        {m.title}
                      </div>
                      <div style={{ fontFamily: FONT.mono, color: colors.textMuted, fontSize: FONT.size.caption }}>
                        {m.project ?? m.projectId ?? "Project"} · {formatDate(m.scheduledAt ?? m.time)}
                      </div>
                    </div>
                    <Button variant="primary" onClick={() => onStartMeeting(m)}>
                      {m.activeSession ? "Resume" : "Start"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: FONT.size.caption,
                letterSpacing: LETTER_SPACING.wide,
                color: colors.textMuted,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Recent summaries
            </div>
            {loading ? (
              <LoadingState count={2} />
            ) : summaries.length === 0 ? (
              <EmptyState message="No summaries yet. End a meeting to generate one." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {summaries.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onOpenSummary(s)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                      width: "100%",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      borderBottom: i === summaries.length - 1 ? "none" : `1px solid ${colors.border}`,
                      padding: "8px 4px",
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <div style={{ color: colors.text, fontSize: FONT.size.body, fontWeight: 500 }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: FONT.size.label, color: colors.textMuted }}>
                        {s.project ?? "Project summary"}
                      </div>
                    </div>
                    <span style={{ fontFamily: FONT.mono, color: colors.textMuted, fontSize: FONT.size.caption, whiteSpace: "nowrap" }}>
                      {formatDate(s.date)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ onNav }: DashboardProps) {
  const { token, user } = useAuth();
  const { theme, colors, shadow } = useTheme();

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

  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <div style={{ flex: 1, position: "relative", height: "100%", overflow: "hidden" }}>
      <AmbientBackground theme={theme} />

      <div className="page-padding" style={{ position: "relative", zIndex: 1, height: "100%", overflowY: "auto" }}>
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              fontFamily: FONT.mono,
              fontSize: FONT.size.caption,
              letterSpacing: LETTER_SPACING.eyebrow,
              color: colors.textMuted,
              textTransform: "uppercase",
            }}
          >
            <span>SYS.02 — DASHBOARD</span>
            <span>{todayLabel}</span>
          </div>
          <div
            style={{
              fontSize: "clamp(36px, 4.6vw, 64px)",
              fontWeight: 600,
              letterSpacing: "-.028em",
              lineHeight: 1,
              color: colors.text,
            }}
          >
            Welcome back,
            <br />
            <span style={{ color: colors.textDim }}>{user?.name ?? "facilitator"}</span>
          </div>
        </div>

        <ReminderCard
          colors={colors}
          shadow={shadow}
          loading={loading}
          meetings={meetings}
          summaries={summaries}
          onRefresh={loadDashboard}
          onStartMeeting={(m) => void handleStartExisting(m)}
          onOpenSummary={(s) => onNav?.("summary", { sessionId: s.sessionId ?? s.id })}
        />

        <div data-magnet style={{ display: "inline-block", marginBottom: 40 }}>
          <Button variant="primary" onClick={() => setShowNewMeeting(true)}>
            <RollingText accentColor={colors.onAccent}>+ NEW MEETING</RollingText>
          </Button>
        </div>

        {error && (
          <div
            style={{
              background: colors.redBg,
              border: `1px solid ${colors.red}`,
              color: colors.red,
              borderRadius: 8,
              padding: "10px 12px",
              marginBottom: SPACE[5],
              fontSize: FONT.size.body,
            }}
          >
            {error}
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
    </div>
  );
}
