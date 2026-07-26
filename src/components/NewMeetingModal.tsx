import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { FONT, LETTER_SPACING, RADIUS, SPACE, tint } from "../tokens/colors";
import { Button, Chip, Modal } from "./ui";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import { API_BASE } from "../lib/api";
import { DURATION_PRESETS } from "../hooks/useCreateMeeting";

export interface LockedProject {
  id: string;
  name: string;
}

export interface NewMeetingFormValues {
  title: string;
  projectName: string;
  durationMinutes: number;
  goal: string;
  brief: string;
  scheduledAt: string | null;
}

export interface MeetingSeed {
  goal: string;
  title?: string;
}

interface NewMeetingModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewMeetingFormValues) => void | Promise<void>;
  submitting: boolean;
  error: string | null;
  lockedProject?: LockedProject;
  defaultScheduled?: boolean;
  seed?: MeetingSeed;
}

function localDateValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toIso(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const dt = new Date(`${dateStr}T${timeStr}`);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function describeWhen(dateStr: string, timeStr: string): string {
  const iso = toIso(dateStr, timeStr);
  if (!iso) return "Pick a date and time";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Wait this long after the last keystroke before searching projects. */
const PROJECT_SEARCH_DEBOUNCE_MS = 300;
const PROJECT_MATCH_LIMIT = 5;

interface ProjectMatch {
  id: string;
  name: string;
  meetingCount?: number;
}

export function NewMeetingModal({
  open,
  onClose,
  onSubmit,
  submitting,
  error,
  lockedProject,
  defaultScheduled = false,
  seed,
}: NewMeetingModalProps) {
  const { token } = useAuth();
  const { colors } = useTheme();

  const [title, setTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [goal, setGoal] = useState("");
  const [brief, setBrief] = useState("");
  const [docVersion, setDocVersion] = useState<number | null>(null);
  const [projectMatches, setProjectMatches] = useState<ProjectMatch[]>([]);
  const [scheduling, setScheduling] = useState(false);
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("14:00");

  useEffect(() => {
    if (!open) return;
    setTitle(seed?.title ?? "");
    setProjectName(lockedProject?.name ?? "");
    setDurationMinutes(60);
    setGoal(seed?.goal ?? "");
    setBrief("");
    setDocVersion(null);
    setScheduling(defaultScheduled);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDateStr(localDateValue(tomorrow));
    setTimeStr("14:00");
  }, [open, lockedProject?.id, lockedProject?.name, defaultScheduled, seed?.goal, seed?.title]);

  // Typing a project name that already exists used to create a second project
  // with a near-identical slug, splitting a project's history in two. The
  // matches below let the facilitator land on the existing one instead.
  //
  // 300ms after the last keystroke, not on every one: a search per character
  // means a request per character, and the list arriving mid-word shifts the
  // options under the pointer.
  useEffect(() => {
    if (!open || lockedProject || !token) return;

    const term = projectName.trim();
    if (term.length < 2) {
      setProjectMatches([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/api/meeting/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data?.ok) return;
          const all: ProjectMatch[] = data.data?.projects ?? [];
          const needle = term.toLowerCase();
          setProjectMatches(
            all
              .filter((p) => p.name?.toLowerCase().includes(needle))
              .slice(0, PROJECT_MATCH_LIMIT),
          );
        })
        .catch(() => {
          if (!cancelled) setProjectMatches([]);
        });
    }, PROJECT_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, lockedProject, token, projectName]);

  useEffect(() => {
    if (!open || !lockedProject || !token) return;

    let cancelled = false;
    fetch(`${API_BASE}/api/document/${lockedProject.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setDocVersion(data?.ok ? (data.data?.document?.version ?? null) : null);
      })
      .catch(() => {
        if (!cancelled) setDocVersion(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open, lockedProject, token]);

  if (!open) return null;

  const scheduledAt = scheduling ? toIso(dateStr, timeStr) : null;
  const canSubmit =
    title.trim() && (lockedProject || projectName.trim()) && (!scheduling || !!scheduledAt);

  return (
    <Modal
      closeOnBackdrop={false}
      title={lockedProject ? `New meeting — ${lockedProject.name}` : "New meeting"}
      width={560}
      onClose={() => !submitting && onClose()}
      footer={
        <>
          <span
            style={{
              marginRight: "auto",
              fontFamily: FONT.mono,
              fontSize: FONT.size.caption,
              color: colors.textMuted,
            }}
          >
            {scheduling
              ? `Starts ${describeWhen(dateStr, timeStr)}`
              : "Starts immediately"}
            {` · ${durationMinutes} min`}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={submitting || !canSubmit}
            onClick={() =>
              void onSubmit({
                title: title.trim(),
                projectName: lockedProject?.name ?? projectName.trim(),
                durationMinutes,
                goal,
                brief,
                scheduledAt,
              })
            }
          >
            {submitting
              ? scheduling
                ? "Scheduling..."
                : "Creating..."
              : scheduling
                ? "Schedule meeting"
                : "Create and start"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minWidth: 0 }}>
        {seed && (
          <div
            style={{
              background: colors.tealBg,
              border: `1px solid ${colors.teal}`,
              color: colors.textMuted,
              borderRadius: 8,
              padding: "9px 11px",
              fontSize: FONT.size.label,
              lineHeight: 1.5,
            }}
          >
            Seeded from a decision that has been waiting for a date — the goal below is
            pre-filled, so the AI walks in already briefed.
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: SPACE[1.5],
            flexWrap: "wrap",
            background: scheduling ? colors.surfaceMuted : colors.amberSubtle,
            border: `1px solid ${scheduling ? colors.border : colors.accentDim}`,
            borderRadius: 8,
            padding: "10px 11px",
          }}
        >
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: FONT.size.label,
              fontWeight: 700,
              color: scheduling ? colors.text : colors.accent,
            }}
          >
            {scheduling ? "Scheduled" : "Starting now"}
          </span>

          {scheduling && (
            <>
              <input
                type="date"
                aria-label="Meeting date"
                value={dateStr}
                min={localDateValue(new Date())}
                onChange={(e) => setDateStr(e.target.value)}
                style={{ ...inputStyle(colors), width: 148, fontFamily: FONT.mono, padding: "6px 8px" }}
              />
              <input
                type="time"
                aria-label="Start time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                style={{ ...inputStyle(colors), width: 108, fontFamily: FONT.mono, padding: "6px 8px" }}
              />
            </>
          )}

          <button
            type="button"
            onClick={() => setScheduling((v) => !v)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: colors.accent,
              fontSize: FONT.size.label,
              textDecoration: "underline",
              cursor: "pointer",
              padding: 0,
            }}
          >
            {scheduling ? "Start now instead" : "Schedule for later"}
          </button>
        </div>

        {error && (
          <div
            style={{
              background: colors.redBg,
              border: `1px solid ${colors.red}`,
              color: colors.red,
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: FONT.size.label,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
          <label htmlFor="new-meeting-title" style={fieldLabelStyle(colors)}>
            Meeting title
          </label>
          <input
            id="new-meeting-title"
            style={inputStyle(colors)}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekly sync"
            autoFocus
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
          <label htmlFor="new-meeting-project" style={fieldLabelStyle(colors)}>
            Project
          </label>
          {lockedProject ? (
            <input
              id="new-meeting-project"
              style={{ ...inputStyle(colors), color: colors.textMuted, cursor: "not-allowed" }}
              value={lockedProject.name}
              disabled
              readOnly
            />
          ) : (
            <input
              id="new-meeting-project"
              style={inputStyle(colors)}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Stratis"
              autoComplete="off"
            />
          )}

          {!lockedProject && projectMatches.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: FONT.size.micro, color: colors.textDim }}>
                Existing projects — pick one to keep the history together
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {projectMatches.map((p) => {
                  const exact = p.name.trim().toLowerCase() === projectName.trim().toLowerCase();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProjectName(p.name)}
                      style={{
                        display: "inline-flex",
                        alignItems: "baseline",
                        gap: 6,
                        padding: "4px 10px",
                        borderRadius: RADIUS.pill,
                        border: `1px solid ${exact ? colors.accent : colors.border}`,
                        background: exact ? tint(colors.accent, colors.surface) : "transparent",
                        color: exact ? colors.accent : colors.textMuted,
                        fontSize: FONT.size.caption,
                        cursor: "pointer",
                      }}
                    >
                      {p.name}
                      {typeof p.meetingCount === "number" && (
                        <span style={{ fontFamily: FONT.mono, fontSize: FONT.size.micro, color: colors.textDim }}>
                          {p.meetingCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {lockedProject && docVersion != null && (
          <Chip color={colors.accent} icon={<FileText size={12} strokeWidth={2} />}>
            PM document v{docVersion} attached — Stratis will use it as live context.
          </Chip>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={fieldLabelStyle(colors)}>
            Planned duration — Stratis warns you when 15 minutes remain
          </label>
          <div style={{ display: "flex", gap: SPACE[1.5], flexWrap: "wrap", alignItems: "center" }}>
            {DURATION_PRESETS.map((min) => {
              const selected = durationMinutes === min;
              return (
                <button
                  key={min}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setDurationMinutes(min)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: RADIUS.pill,
                    fontSize: FONT.size.label,
                    fontWeight: 600,
                    background: selected ? colors.amberSubtle : "transparent",
                    border: `1px solid ${selected ? colors.accentDim : colors.border}`,
                    color: selected ? colors.accent : colors.textMuted,
                  }}
                >
                  {min} min
                </button>
              );
            })}
            <input
              style={{ ...inputStyle(colors), width: 96 }}
              type="number"
              min={5}
              max={480}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.min(480, Math.max(5, Number(e.target.value) || 0)))}
              aria-label="Custom duration in minutes"
            />
            <span style={{ color: colors.textMuted, fontSize: FONT.size.label }}>min</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
          <label htmlFor="new-meeting-goal" style={fieldLabelStyle(colors)}>
            Meeting goal
          </label>
          <input
            id="new-meeting-goal"
            style={inputStyle(colors)}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="One line — what this meeting needs to decide"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
          <label htmlFor="new-meeting-brief" style={fieldLabelStyle(colors)}>
            Brief / agenda <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            id="new-meeting-brief"
            style={{
              ...inputStyle(colors),
              minHeight: 72,
              resize: "vertical",
              fontFamily: "inherit",
            }}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Context for the AI co-facilitator"
          />
        </div>
      </div>
    </Modal>
  );
}

const inputStyle = (colors: { bg: string; border: string; text: string }): React.CSSProperties => ({
  width: "100%",
  background: colors.bg,
  border: `1px solid ${colors.border}`,
  color: colors.text,
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: FONT.size.body,
  outline: "none",
});

const fieldLabelStyle = (colors: { textMuted: string }): React.CSSProperties => ({
  color: colors.textMuted,
  fontSize: FONT.size.label,
  fontWeight: 500,
  letterSpacing: LETTER_SPACING.wide,
});
