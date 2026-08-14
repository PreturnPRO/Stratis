import { useCallback, useEffect, useState } from "react";
import { Banner, Card, StatTile } from "./panels";
import { EmptyState, LoadingState } from "./states";
import { Button } from "./ui";
import { useTheme } from "../hooks/useTheme";
import { apiFetch } from "../lib/http";
import { FONT, RADIUS, SPACE } from "../tokens/colors";
import { localeTag } from "../i18n/locale";

/**
 * Every workspace at a glance — the Stratis team's view.
 *
 * Read from `session_rollups`, one row written when a meeting ends. So the
 * numbers here move when a meeting *finishes*, never while one is running, and
 * refreshing this page during a launch cannot compete with the database work of
 * the meetings being recorded.
 *
 * Counts only: meetings, minutes, decisions. There is no way from this screen
 * into anybody's meeting, and that is deliberate — an operator is not a
 * participant.
 */

interface WorkspaceUsage {
  orgId: string;
  orgName: string;
  plan: string;
  meetings: number;
  recordedMinutes: number;
  decisions: number;
  lastMeetingAt: string | null;
}

interface UsagePayload {
  days: number;
  totals: {
    meetings: number;
    recordedMinutes: number;
    decisions: number;
    activeWorkspaces: number;
  };
  workspaces: WorkspaceUsage[];
}

function hours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function when(value: string | null): string {
  if (!value) return "never";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(localeTag(), { day: "numeric", month: "short" }).format(d);
}

export function OperatorUsageTab() {
  const { colors } = useTheme();
  const [data, setData] = useState<UsagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const load = useCallback(async (window: number) => {
    try {
      const payload = await apiFetch<UsagePayload>(`/api/admin/usage?days=${window}`);
      setData(payload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load usage");
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [load, days]);

  if (error) return <Banner tone="danger">{error}</Banner>;
  if (!data) return <LoadingState persist count={3} />;

  return (
    <>
      <Card
        title={`Last ${data.days} days`}
        description="Counted when a meeting ends, so a meeting in progress is not in here yet."
        footer={
          <div style={{ display: "flex", gap: SPACE[1] }}>
            {[7, 30, 90].map((option) => (
              <Button
                key={option}
                variant={option === days ? "primary" : "ghost"}
                size="sm"
                onClick={() => setDays(option)}
              >
                {option}d
              </Button>
            ))}
          </div>
        }
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE[1.5] }}>
          <StatTile label="Workspaces that met" value={data.totals.activeWorkspaces} />
          <StatTile label="Meetings" value={data.totals.meetings} />
          <StatTile label="Recorded" value={hours(data.totals.recordedMinutes)} />
          <StatTile label="Decisions" value={data.totals.decisions} />
        </div>
      </Card>

      <Card title="By workspace" description="Most recently active first.">
        {data.workspaces.length === 0 ? (
          <EmptyState message="No finished meetings in this window." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.workspaces.map((w) => (
              <div
                key={w.orgId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: SPACE[1.5],
                  padding: `${SPACE[1.5]}px 0`,
                  borderBottom: `1px solid ${colors.border}`,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ fontSize: FONT.size.body, color: colors.text }}>{w.orgName}</div>
                  <div style={{ fontSize: FONT.size.caption, color: colors.textDim }}>
                    {w.plan} · last met {when(w.lastMeetingAt)}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: FONT.size.label,
                    color: w.meetings ? colors.text : colors.textDim,
                    padding: `2px 8px`,
                    borderRadius: RADIUS.pill,
                    background: colors.surfaceMuted,
                  }}
                >
                  {w.meetings} meetings · {hours(w.recordedMinutes)} · {w.decisions} decisions
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
