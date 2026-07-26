import { useEffect, useMemo, useState } from "react";
import { FONT, LETTER_SPACING, RADIUS, SPACE } from "../constants";
import { Button } from "../components/ui";
import { EmptyState, LoadingState } from "../components/states";
import { NewMeetingModal } from "../components/NewMeetingModal";
import { useAuth } from "../context/AuthContext";
import { useCreateMeeting, ACTIVE_SESSION_KEY, projectIdFromTitle } from "../hooks/useCreateMeeting";
import { useTheme } from "../hooks/useTheme";
import AmbientBackground from "../components/AmbientBackground";

import { API_BASE } from "../lib/api";

type Colors = ReturnType<typeof useTheme>["colors"];

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

function hashAccent(id: string, colors: Colors): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  const palette = [colors.accent, colors.cyan, colors.teal, colors.amber];
  return palette[Math.abs(hash) % palette.length];
}

function SectionHeader({
  colors,
  label,
  count,
  action,
}: {
  colors: Colors;
  label: string;
  count: number;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: FONT.size.caption,
            letterSpacing: LETTER_SPACING.wide,
            color: colors.textMuted,
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span style={{ fontFamily: FONT.mono, fontSize: FONT.size.caption, color: colors.textDim }}>
          {String(count).padStart(2, "0")}
        </span>
      </div>
      {action}
    </div>
  );
}

function meetingTime(m: DashboardMeeting): string | null {
  return m.scheduledAt ?? m.time ?? null;
}

/** Live first, then scheduled soonest-first, then the undated ones in backend order. */
function orderMeetings(meetings: DashboardMeeting[]): DashboardMeeting[] {
  const rank = (m: DashboardMeeting) => (m.activeSession ? 0 : meetingTime(m) ? 1 : 2);
  return meetings
    .map((m, i) => ({ m, i }))
    .sort((a, b) => {
      const byRank = rank(a.m) - rank(b.m);
      if (byRank !== 0) return byRank;

      const at = meetingTime(a.m);
      const bt = meetingTime(b.m);
      if (at && bt && at !== bt) return String(at).localeCompare(String(bt));

      return a.i - b.i;
    })
    .map((entry) => entry.m);
}

function MeetingRow({
  colors,
  meeting,
  first,
  last,
  onStart,
}: {
  colors: Colors;
  meeting: DashboardMeeting;
  first: boolean;
  last: boolean;
  onStart: () => void;
}) {
  const live = !!meeting.activeSession;
  const when = meetingTime(meeting);
  const dot = live ? colors.accent : hashAccent(meeting.id, colors);

  return (
    <div>
      <div style={{ position: "relative", paddingLeft: 26 }}>
        {!first && (
          <span style={{ position: "absolute", left: 5, top: 0, height: "50%", width: 1, background: colors.border }} />
        )}
        {!last && (
          <span style={{ position: "absolute", left: 5, top: "50%", height: "50%", width: 1, background: colors.border }} />
        )}
        <span
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 11,
            height: 11,
            borderRadius: "50%",
            background: colors.surfaceElevated,
            border: `2px solid ${dot}`,
            boxShadow: `0 0 0 3px ${colors.bg}`,
          }}
        />
        <div
          role="button"
          tabIndex={0}
          onClick={onStart}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onStart();
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: colors.surface,
            border: `1px solid ${live ? colors.accentDim : colors.border}`,
            borderRadius: RADIUS.md,
            padding: "10px 12px",
            cursor: "pointer",
          }}
        >
          <div style={{ minWidth: 0 }}>
            {live && (
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: FONT.size.caption,
                  fontWeight: 700,
                  letterSpacing: LETTER_SPACING.wide,
                  color: colors.accent,
                  marginBottom: 2,
                }}
              >
                LIVE NOW
              </div>
            )}
            <div style={{ color: colors.text, fontSize: FONT.size.body, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {meeting.title}
            </div>
            <div style={{ fontFamily: FONT.mono, color: colors.textMuted, fontSize: FONT.size.caption, marginTop: 2 }}>
              {meeting.project ?? meeting.projectId ?? "Project"}
              {when ? ` · ${formatDate(when)}` : ""}
            </div>
          </div>
          <Button variant="primary" onClick={(e) => { e.stopPropagation(); onStart(); }}>
            {live ? "Resume" : "Start"}
          </Button>
        </div>
      </div>
      {!last && (
        <div style={{ position: "relative", height: 22 }}>
          <span style={{ position: "absolute", left: 31, top: 0, bottom: 0, width: 1, background: colors.border }} />
        </div>
      )}
    </div>
  );
}

function DashboardPanels({
  colors,
  loading,
  meetings,
  summaries,
  onRefresh,
  onStartMeeting,
  onOpenSummary,
  onNav,
}: {
  colors: Colors;
  loading: boolean;
  meetings: DashboardMeeting[];
  summaries: DashboardSummary[];
  onRefresh: () => void;
  onStartMeeting: (m: DashboardMeeting) => void;
  onOpenSummary: (s: DashboardSummary) => void;
  onNav?: (id: string, params?: Record<string, string>) => void;
}) {
  const ordered = useMemo(() => orderMeetings(meetings), [meetings]);

  return (
    <div
      className="dashboard-panels"
      style={{
        marginBottom: 32,
        display: "grid",
        gridTemplateColumns: "minmax(320px, 520px) minmax(300px, 440px)",
        gap: 40,
      }}
    >
      <div>
        <SectionHeader
          colors={colors}
          label="Ready to start"
          count={ordered.length}
          action={<Button variant="ghost" onClick={onRefresh}>Refresh</Button>}
        />
        {loading ? (
          <LoadingState count={3} />
        ) : ordered.length === 0 ? (
          <EmptyState message="No meetings yet. Create your first meeting." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {ordered.map((m, i) => (
              <MeetingRow
                key={m.id}
                colors={colors}
                meeting={m}
                first={i === 0}
                last={i === ordered.length - 1}
                onStart={() => onStartMeeting(m)}
              />
            ))}
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          <Button variant="ghost" size="sm" onClick={() => onNav?.("docket")}>
            Open the docket
          </Button>
        </div>
      </div>

      <div>
        <SectionHeader colors={colors} label="Recent summaries" count={summaries.length} />
        {loading ? (
          <LoadingState count={3} />
        ) : summaries.length === 0 ? (
          <EmptyState message="No summaries yet. End a meeting to generate one." />
        ) : (
          <div
            className="dashboard-summary-cards"
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            {summaries.map((s) => {
              const edge = hashAccent(s.id, colors);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenSummary(s)}
                  style={{
                    textAlign: "left",
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderLeft: `3px solid ${edge}`,
                    borderRadius: RADIUS.md,
                    padding: "12px 14px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <div style={{ color: colors.text, fontSize: FONT.size.body, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: FONT.size.label, color: colors.textMuted }}>{s.project ?? "Project summary"}</div>
                  <div style={{ fontFamily: FONT.mono, color: colors.textDim, fontSize: FONT.size.caption }}>
                    {formatDate(s.date)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ onNav }: DashboardProps) {
  const { token, user } = useAuth();
  const { theme, colors } = useTheme();

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
    scheduledAt: string | null;
  }) => {
    const sessionId = await create.createMeeting({
      title: input.title,
      projectId: projectIdFromTitle(input.projectName),
      goal: input.goal,
      brief: input.brief,
      durationMinutes: input.durationMinutes,
      scheduledAt: input.scheduledAt,
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
              justifyContent: "flex-end",
              marginBottom: 12,
              fontFamily: FONT.mono,
              fontSize: FONT.size.caption,
              letterSpacing: LETTER_SPACING.eyebrow,
              color: colors.textMuted,
              textTransform: "uppercase",
            }}
          >
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

        <div style={{ display: "inline-block", marginBottom: 20 }}>
          <Button variant="primary" onClick={() => setShowNewMeeting(true)}>
            + NEW MEETING
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

        <DashboardPanels
          colors={colors}
          loading={loading}
          meetings={meetings}
          summaries={summaries}
          onRefresh={loadDashboard}
          onStartMeeting={(m) => void handleStartExisting(m)}
          onOpenSummary={(s) => onNav?.("summary", { sessionId: s.sessionId ?? s.id })}
          onNav={onNav}
        />

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
