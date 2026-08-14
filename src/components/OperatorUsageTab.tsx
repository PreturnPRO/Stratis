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

interface UsageDay {
  day: string;
  meetings: number;
  recordedMinutes: number;
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
  byDay: UsageDay[];
}

/**
 * A bar that says its own number.
 *
 * Colour alone encodes nothing here: reading a value off an axis is a guess,
 * and a legend is a second lookup. Every bar carries its figure, a zero prints
 * as 0 rather than vanishing, and the tallest bar sets the scale so a quiet
 * fortnight does not get stretched into a busy-looking one.
 */
function LabelledBars({
  title,
  data,
  value,
  format,
}: {
  title: string;
  data: UsageDay[];
  value: (d: UsageDay) => number;
  format?: (n: number) => string;
}) {
  const { colors } = useTheme();
  const peak = Math.max(1, ...data.map(value));
  const show = format ?? ((n: number) => String(n));

  return (
    <Card title={title} description={`${data.length} days. Every bar is the real count for that day.`}>
      {data.length === 0 ? (
        <EmptyState message="No finished meetings in this window." />
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, overflowX: "auto", paddingBottom: 4 }}>
          {data.map((d) => {
            const n = value(d);
            const height = Math.round((n / peak) * 90);
            return (
              <div
                key={d.day}
                title={`${d.day}: ${show(n)}`}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 26 }}
              >
                <span
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: FONT.size.micro,
                    color: n > 0 ? colors.text : colors.textDim,
                  }}
                >
                  {show(n)}
                </span>
                <div
                  style={{
                    width: 18,
                    height: Math.max(2, height),
                    borderRadius: 3,
                    background: n > 0 ? colors.accent : colors.border,
                  }}
                />
                <span style={{ fontSize: FONT.size.micro, color: colors.textDim, fontFamily: FONT.mono }}>
                  {d.day.slice(8)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
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

      <LabelledBars title="Meetings a day" data={data.byDay ?? []} value={(d) => d.meetings} />
      <LabelledBars
        title="Minutes recorded a day"
        data={data.byDay ?? []}
        value={(d) => d.recordedMinutes}
        format={(n) => (n >= 60 ? `${Math.round(n / 60)}h` : String(n))}
      />

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
