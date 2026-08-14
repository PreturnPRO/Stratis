import { FONT, LETTER_SPACING, RADIUS, SPACE } from "../tokens/colors";
import { useTheme } from "../hooks/useTheme";
import { localeTag } from "../i18n/locale";
import { Button } from "./ui";

/**
 * What the team still has to decide, above everything else on the dashboard.
 *
 * The page used to open on meetings and summaries, which is what a
 * transcription product opens on — the same screen would have suited Otter or
 * Notion. Stratis claims to track the state of a decision, so the state of the
 * decisions is the first thing on it.
 *
 * Emphasis is graded rather than uniform: a count of zero is quiet, a count
 * that needs someone is not, and an overdue follow-up is the only thing here
 * allowed to use the warning colour. Nothing on this page shouts by default —
 * that is what makes the one thing that does shout legible.
 */

export interface Attention {
  openQuestions: number;
  inProgress: number;
  followUpsDue: number;
}

export interface NextMeeting {
  id: string;
  title: string;
  projectName?: string | null;
  goal?: string | null;
  scheduledAt?: string | null;
  unresolved?: number;
  activeSession?: { id: string; status: string } | null;
}

/** "Today · 14:00", "Thu 15 Aug · 09:30", or nothing when it has no date. */
function whenLabel(next: NextMeeting): string | null {
  if (next.activeSession) return null;
  if (!next.scheduledAt) return "No date yet";
  const when = new Date(next.scheduledAt);
  if (Number.isNaN(when.getTime())) return null;

  const today = new Date();
  const sameDay = when.toDateString() === today.toDateString();
  const time = new Intl.DateTimeFormat(localeTag(), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(when);

  if (sameDay) return `Today · ${time}`;
  const day = new Intl.DateTimeFormat(localeTag(), {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(when);
  return `${day} · ${time}`;
}

function Tile({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: "quiet" | "attention" | "critical";
  onClick?: () => void;
}) {
  const { colors } = useTheme();
  const accent =
    value === 0
      ? colors.textDim
      : tone === "critical"
        ? colors.amber
        : tone === "attention"
          ? colors.accent
          : colors.text;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        flex: "1 1 160px",
        textAlign: "left",
        padding: `${SPACE[2]}px ${SPACE[2]}px`,
        borderRadius: RADIUS.md,
        border: `1px solid ${value > 0 && tone !== "quiet" ? colors.borderLight : colors.border}`,
        background: colors.surface,
        cursor: onClick ? "pointer" : "default",
        font: "inherit",
      }}
    >
      <div
        style={{
          fontSize: "clamp(26px, 3vw, 34px)",
          fontWeight: 600,
          letterSpacing: "-.02em",
          lineHeight: 1.1,
          color: accent,
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 4, fontSize: FONT.size.label, color: colors.textMuted }}>{label}</div>
    </button>
  );
}

export function AttentionRow({
  attention,
  next,
  onOpenDocket,
  onRejoin,
  onPrepare,
}: {
  attention: Attention;
  next: NextMeeting | null;
  onOpenDocket: () => void;
  /** Only reachable while a session is actually running. */
  onRejoin: (m: NextMeeting) => void;
  /** Review what this project has left unresolved. Starts nothing. */
  onPrepare: (m: NextMeeting) => void;
}) {
  const { colors } = useTheme();
  const live = Boolean(next?.activeSession);

  return (
    <section style={{ marginBottom: SPACE[4] }}>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: FONT.size.caption,
          letterSpacing: LETTER_SPACING.eyebrow,
          textTransform: "uppercase",
          color: colors.textMuted,
          marginBottom: SPACE[1.5],
        }}
      >
        What needs your attention
      </div>

      <div style={{ display: "flex", gap: SPACE[1.5], flexWrap: "wrap", marginBottom: SPACE[2] }}>
        <Tile label="Open questions" value={attention.openQuestions} tone="attention" onClick={onOpenDocket} />
        <Tile label="Decisions in progress" value={attention.inProgress} tone="quiet" onClick={onOpenDocket} />
        <Tile label="Follow-ups due" value={attention.followUpsDue} tone="critical" onClick={onOpenDocket} />
      </div>

      {next && (
        <div
          style={{
            padding: SPACE[2.5],
            borderRadius: RADIUS.md,
            background: colors.surface,
            // The one card on the page allowed a stronger edge, and only while
            // a meeting is actually running.
            border: `1px solid ${live ? colors.accent : colors.border}`,
          }}
        >
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: FONT.size.caption,
              letterSpacing: LETTER_SPACING.eyebrow,
              textTransform: "uppercase",
              color: live ? colors.accent : colors.textMuted,
              marginBottom: 6,
            }}
          >
            {live ? "In progress" : "Next meeting"}
          </div>

          <div style={{ fontSize: FONT.size.subheading, fontWeight: 600, color: colors.text }}>
            {next.title}
          </div>
          <div style={{ fontSize: FONT.size.label, color: colors.textMuted, marginTop: 2 }}>
            {[next.projectName ?? "No project", whenLabel(next)].filter(Boolean).join(" · ")}
          </div>

          <div style={{ marginTop: SPACE[2] }}>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: FONT.size.caption,
                letterSpacing: LETTER_SPACING.eyebrow,
                textTransform: "uppercase",
                color: colors.textDim,
              }}
            >
              Goal
            </div>
            <div style={{ fontSize: FONT.size.body, color: colors.text, marginTop: 3 }}>
              {next.goal ?? (
                <span style={{ color: colors.amber }}>
                  No goal set — Stratis has nothing to aim at
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: SPACE[2],
              display: "flex",
              alignItems: "center",
              gap: SPACE[2],
              flexWrap: "wrap",
            }}
          >
            {/* Only a meeting that is actually happening gets the primary
                button. A card at the top of the page with "Start" on it reads
                as an instruction — the top of this page reports where things
                stand, and starting a recording is the reader's decision, made
                when they are in the room and not when they open a tab. */}
            <Button
              variant={live ? "primary" : "ghost"}
              size="sm"
              onClick={() => (live ? onRejoin(next) : onPrepare(next))}
            >
              {live ? "Rejoin meeting" : "Review what is unresolved"}
            </Button>
            {typeof next.unresolved === "number" && next.unresolved > 0 && (
              <span style={{ fontSize: FONT.size.label, color: colors.textMuted }}>
                {next.unresolved} unresolved {next.unresolved === 1 ? "question" : "questions"} carried
                into this project
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
