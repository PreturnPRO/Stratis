import { useEffect, useMemo, useState } from "react";
import { FONT, LETTER_SPACING, TRANSITION, SPACE } from "../constants";
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

// Small hover-lift for otherwise-flat interactive rows — same hover-via-state
// idiom as Button/IconButton in ui.tsx, just applied locally here. The resting
// boxShadow/borderColor come from the caller's `style`; only the hover-state
// border/lift are computed here.
function HoverLift({
  as = "div",
  style,
  hoverBorderColor,
  children,
  ...rest
}: {
  as?: "div" | "button";
  style?: React.CSSProperties;
  hoverBorderColor?: string;
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
        borderColor: hovered ? (hoverBorderColor ?? style?.borderColor) : style?.borderColor,
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: `transform ${TRANSITION.springSoft}, box-shadow ${TRANSITION.base}, border-color ${TRANSITION.base}`,
      }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

// Quick-notifier stat card — pulsing/plain dot, count + label, optional
// subline, clickable when there's somewhere to navigate to.
function StatCard({
  colors,
  shadow,
  label,
  count,
  subline,
  dotColor,
  pulsing,
  accentBorder,
  onClick,
}: {
  colors: Colors;
  shadow: Shadow;
  label: string;
  count: number;
  subline?: string;
  dotColor: string;
  pulsing?: boolean;
  accentBorder?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        textAlign: "left",
        background: colors.surfaceElevated,
        border: `1px solid ${accentBorder ? colors.accentDim : colors.border}`,
        borderRadius: 12,
        padding: "16px 18px",
        boxShadow: accentBorder ? `${shadow.shadCard}, ${shadow.glow(colors.accent)}` : shadow.shadCard,
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8, flexShrink: 0 }}>
          {pulsing && (
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: dotColor,
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
              background: dotColor,
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
          {count} {label}
        </span>
      </div>
      {subline && (
        <div style={{ fontSize: FONT.size.body, color: colors.textMuted }}>{subline}</div>
      )}
    </button>
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

  const nextMeeting = meetings[0];
  const latestSummary = summaries[0];

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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <StatCard
            colors={colors}
            shadow={shadow}
            label="UPCOMING"
            count={meetings.length}
            subline={
              nextMeeting
                ? `Next: ${formatDate(nextMeeting.scheduledAt ?? nextMeeting.time)} — ${nextMeeting.title}`
                : undefined
            }
            dotColor={colors.accent}
            pulsing
            accentBorder
            onClick={nextMeeting ? () => void handleStartExisting(nextMeeting) : undefined}
          />
          <StatCard
            colors={colors}
            shadow={shadow}
            label="SUMMARIES"
            count={summaries.length}
            subline={
              latestSummary
                ? `New: ${formatDate(latestSummary.date)} — ${latestSummary.title}`
                : undefined
            }
            dotColor={colors.cyan}
            onClick={
              latestSummary
                ? () => onNav?.("summary", { sessionId: latestSummary.sessionId ?? latestSummary.id })
                : undefined
            }
          />
        </div>

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
                    color: colors.text,
                    fontSize: FONT.size.subheading,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: LETTER_SPACING.wide,
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
                      hoverBorderColor={colors.borderLight}
                      style={{
                        background: colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 12,
                        padding: "16px 18px",
                        boxShadow: shadow.shadCard,
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
                              color: colors.text,
                              fontSize: FONT.size.body,
                              fontWeight: 500,
                              marginBottom: SPACE[1.5],
                            }}
                          >
                            {m.title}
                          </div>
                          <div
                            style={{
                              fontFamily: FONT.mono,
                              color: colors.textMuted,
                              fontSize: FONT.size.caption,
                            }}
                          >
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
                  color: colors.text,
                  fontSize: FONT.size.subheading,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: LETTER_SPACING.wide,
                  margin: "0 0 16px",
                }}
              >
                Recent summaries
              </h2>

              {summaries.length === 0 ? (
                <EmptyState message="No summaries yet. End a meeting to generate one." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {summaries.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        onNav?.("summary", { sessionId: s.sessionId ?? s.id })
                      }
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 16,
                        width: "100%",
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        borderBottom: i === summaries.length - 1 ? "none" : `1px solid ${colors.border}`,
                        padding: "14px 4px",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: colors.text,
                            fontSize: FONT.size.body,
                            fontWeight: 500,
                            marginBottom: 4,
                          }}
                        >
                          {s.title}
                        </div>
                        <div style={{ fontSize: FONT.size.label, color: colors.textMuted }}>
                          {s.project ?? "Project summary"}
                        </div>
                      </div>
                      <span
                        style={{
                          fontFamily: FONT.mono,
                          color: colors.textMuted,
                          fontSize: FONT.size.caption,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDate(s.date)}
                      </span>
                    </button>
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
    </div>
  );
}
