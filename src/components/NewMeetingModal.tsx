import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Gavel, Plus, Repeat, Rocket } from "lucide-react";
import { FONT, LETTER_SPACING, RADIUS, SPACE, tint } from "../tokens/colors";
import { Button, Chip, Modal } from "./ui";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import { apiFetch } from "../lib/http";
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

/** What the facilitator picked last time. Nothing here is required — it only
 *  decides what is already selected when the modal opens. */
interface MeetingPrefs {
  kind?: string;
  projectName?: string;
  durationMinutes?: number;
}

const PREFS_KEY = "stratis.newMeeting.prefs.v1";

function readPrefs(): MeetingPrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as MeetingPrefs) : {};
  } catch {
    return {};
  }
}

function writePrefs(prefs: MeetingPrefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / quota — defaults just don't persist */
  }
}

/** Three kinds cover almost every meeting a facilitator books here. Each one
 *  carries the answers that would otherwise be typed from scratch every time:
 *  a title, a length, and two goals worth stealing. */
const MEETING_KINDS = [
  {
    id: "checkin",
    label: "Check-in",
    hint: "Regular team update",
    noun: "check-in",
    icon: Repeat,
    duration: 30,
    goals: ["Clear anything that is blocking the team", "Agree what happens this week"],
  },
  {
    id: "decision",
    label: "Decision",
    hint: "Choose between options",
    noun: "decision",
    icon: Gavel,
    duration: 60,
    goals: ["Pick one option and write down why", "Close the questions left open last time"],
  },
  {
    id: "kickoff",
    label: "Kickoff",
    hint: "Start something new",
    noun: "kickoff",
    icon: Rocket,
    duration: 90,
    goals: ["Agree what we are building and why", "Decide who owns the first pieces"],
  },
] as const;

type MeetingKind = (typeof MEETING_KINDS)[number];

function kindById(id: string | null): MeetingKind | undefined {
  return MEETING_KINDS.find((k) => k.id === id);
}

function composeTitle(kindId: string | null, project: string): string {
  const kind = kindById(kindId);
  if (!kind) return "";
  const name = project.trim();
  return name ? `${name} ${kind.noun}` : kind.label;
}

function localDateValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localTimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

/** The next :00 or :30, skipping a slot that is already too close to start on. */
function nextSlot(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setSeconds(0, 0);
  const mins = d.getMinutes();
  let add = mins < 30 ? 30 - mins : 60 - mins;
  if (add < 10) add += 30;
  d.setMinutes(mins + add);
  return d;
}

function tomorrowAfternoon(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(14, 0, 0, 0);
  return d;
}

const PROJECT_CHIP_LIMIT = 4;

interface ProjectMatch {
  id: string;
  name: string;
  meetingCount?: number;
}

type StartMode = "now" | "slot" | "tomorrow" | "custom";

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

  const [kind, setKind] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [autoTitle, setAutoTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [customDuration, setCustomDuration] = useState(false);
  const [goal, setGoal] = useState("");
  const [brief, setBrief] = useState("");
  const [briefOpen, setBriefOpen] = useState(false);
  const [docVersion, setDocVersion] = useState<number | null>(null);
  const [projects, setProjects] = useState<ProjectMatch[]>([]);
  const [typingProject, setTypingProject] = useState(false);
  const [startMode, setStartMode] = useState<StartMode>("now");
  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("14:00");

  const slotDate = nextSlot();
  const laterDate = tomorrowAfternoon();
  // Late at night the next half-hour slot lands after midnight, where a bare
  // "00:00" chip reads as this morning. Drop it; "Tomorrow" already covers it.
  const slotIsToday = slotDate.toDateString() === new Date().toDateString();

  useEffect(() => {
    if (!open) return;

    const prefs = readPrefs();
    const startKind = seed ? "decision" : (prefs.kind ?? null);
    const startProject = lockedProject?.name ?? prefs.projectName ?? "";
    const startDuration = prefs.durationMinutes ?? kindById(startKind)?.duration ?? 60;
    const generated = composeTitle(startKind, startProject);

    setKind(startKind);
    setProjectName(startProject);
    setTypingProject(false);
    setDurationMinutes(startDuration);
    setCustomDuration(!DURATION_PRESETS.includes(startDuration));
    setTitle(seed?.title ?? generated);
    setAutoTitle(generated);
    setGoal(seed?.goal ?? "");
    setBrief("");
    setBriefOpen(false);
    setDocVersion(null);

    const scheduled = defaultScheduled ? "tomorrow" : "now";
    setStartMode(scheduled);
    const initial = tomorrowAfternoon();
    setDateStr(localDateValue(initial));
    setTimeStr(localTimeValue(initial));
  }, [open, lockedProject?.id, lockedProject?.name, defaultScheduled, seed?.goal, seed?.title]);

  // The whole project list arrives in one request, sorted most-recent-first by
  // the backend. Loading it on open (rather than searching per keystroke) is
  // what lets the facilitator recognise a project instead of recalling and
  // retyping its exact name — and typing a near-identical name is how a
  // project's history used to end up split across two slugs.
  useEffect(() => {
    if (!open || lockedProject || !token) return;

    let cancelled = false;
    apiFetch<{ projects?: ProjectMatch[] }>("/api/meeting/projects")
      .then((data) => {
        if (cancelled) return;
        setProjects(data?.projects ?? []);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, lockedProject, token]);

  useEffect(() => {
    if (!open || !lockedProject || !token) return;

    let cancelled = false;
    apiFetch<{ document?: { version?: number | null } }>(`/api/document/${lockedProject.id}`)
      .then((data) => {
        if (cancelled) return;
        setDocVersion(data?.document?.version ?? null);
      })
      .catch(() => {
        if (!cancelled) setDocVersion(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open, lockedProject, token]);

  if (!open) return null;

  const selectedKind = kindById(kind);
  const scheduling = startMode !== "now";
  const scheduledAt = scheduling ? toIso(dateStr, timeStr) : null;
  const canSubmit =
    title.trim() && (lockedProject || projectName.trim()) && (!scheduling || !!scheduledAt);

  /** Only rewrite the title while it is still the one we generated. The moment
   *  the facilitator edits it, it is theirs. */
  const retitle = (nextKind: string | null, nextProject: string) => {
    const generated = composeTitle(nextKind, nextProject);
    setAutoTitle(generated);
    if (!title.trim() || title === autoTitle) setTitle(generated);
  };

  const pickKind = (k: MeetingKind) => {
    const next = kind === k.id ? null : k.id;
    setKind(next);
    retitle(next, projectName);
    if (next) {
      setDurationMinutes(k.duration);
      setCustomDuration(false);
    }
  };

  const pickProject = (name: string) => {
    setProjectName(name);
    setTypingProject(false);
    retitle(kind, name);
  };

  const pickStart = (mode: StartMode) => {
    setStartMode(mode);
    if (mode === "slot") {
      setDateStr(localDateValue(slotDate));
      setTimeStr(localTimeValue(slotDate));
    } else if (mode === "tomorrow") {
      setDateStr(localDateValue(laterDate));
      setTimeStr(localTimeValue(laterDate));
    }
  };

  const chipStyle = (selected: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "baseline",
    gap: 6,
    padding: "5px 11px",
    borderRadius: RADIUS.pill,
    border: `1px solid ${selected ? colors.accent : colors.border}`,
    background: selected ? tint(colors.accent, colors.surface) : "transparent",
    color: selected ? colors.accent : colors.textMuted,
    fontSize: FONT.size.label,
    fontWeight: selected ? 600 : 500,
    cursor: "pointer",
  });

  const projectChips = projects.slice(0, PROJECT_CHIP_LIMIT);
  const knownProject = projects.some(
    (p) => p.name.trim().toLowerCase() === projectName.trim().toLowerCase(),
  );
  const showProjectInput = typingProject || (!!projectName && !knownProject) || projects.length === 0;
  const typedMatches = typingProject
    ? projects
        .filter((p) => p.name.toLowerCase().includes(projectName.trim().toLowerCase()))
        .slice(0, PROJECT_CHIP_LIMIT)
    : [];

  const submit = () => {
    const finalProject = lockedProject?.name ?? projectName.trim();
    writePrefs({ kind: kind ?? undefined, projectName: finalProject, durationMinutes });
    void onSubmit({
      title: title.trim(),
      projectName: finalProject,
      durationMinutes,
      goal,
      brief,
      scheduledAt,
    });
  };

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
            {scheduling ? `Starts ${describeWhen(dateStr, timeStr)}` : "Starts now"}
            {` · ${durationMinutes} min`}
          </span>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" disabled={submitting || !canSubmit} onClick={submit}>
            {submitting
              ? scheduling
                ? "Scheduling..."
                : "Starting..."
              : scheduling
                ? "Schedule meeting"
                : `Start ${durationMinutes}-min meeting`}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, minWidth: 0 }}>
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
          <span style={fieldLabelStyle(colors)}>Kind of meeting</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: SPACE[1.5] }}>
            {MEETING_KINDS.map((k) => {
              const selected = kind === k.id;
              const Icon = k.icon;
              return (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => pickKind(k)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    padding: "10px 6px",
                    borderRadius: RADIUS.md,
                    border: `1px solid ${selected ? colors.accent : colors.border}`,
                    background: selected ? tint(colors.accent, colors.surface) : "transparent",
                    color: selected ? colors.accent : colors.textMuted,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  <span style={{ fontSize: FONT.size.label, fontWeight: 600 }}>{k.label}</span>
                  <span style={{ fontSize: FONT.size.micro, color: colors.textDim }}>{k.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
          <label htmlFor="new-meeting-title" style={fieldLabelStyle(colors)}>
            Title
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
            <>
              {projectChips.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {projectChips.map((p) => {
                    const selected =
                      !typingProject &&
                      p.name.trim().toLowerCase() === projectName.trim().toLowerCase();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => pickProject(p.name)}
                        style={chipStyle(selected)}
                      >
                        {p.name}
                        {typeof p.meetingCount === "number" && (
                          <span
                            style={{
                              fontFamily: FONT.mono,
                              fontSize: FONT.size.micro,
                              color: colors.textDim,
                            }}
                          >
                            {p.meetingCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={showProjectInput}
                    onClick={() => {
                      setTypingProject(true);
                      setProjectName("");
                    }}
                    style={{
                      ...chipStyle(false),
                      borderStyle: "dashed",
                      alignItems: "center",
                    }}
                  >
                    <Plus size={12} strokeWidth={2} />
                    Other
                  </button>
                </div>
              )}

              {showProjectInput && (
                <input
                  id="new-meeting-project"
                  style={inputStyle(colors)}
                  value={projectName}
                  onChange={(e) => {
                    setTypingProject(true);
                    setProjectName(e.target.value);
                    retitle(kind, e.target.value);
                  }}
                  placeholder="Name a new project"
                  autoComplete="off"
                />
              )}

              {typedMatches.length > 0 && projectName.trim().length >= 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: FONT.size.micro, color: colors.textDim }}>
                    Already exists — pick it so the history stays together
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {typedMatches.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => pickProject(p.name)}
                        style={chipStyle(
                          p.name.trim().toLowerCase() === projectName.trim().toLowerCase(),
                        )}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {lockedProject && docVersion != null && (
          <Chip color={colors.accent} icon={<FileText size={12} strokeWidth={2} />}>
            PM document v{docVersion} attached — Stratis will use it as live context.
          </Chip>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE[4] }}>
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5], minWidth: 0 }}>
            <span style={fieldLabelStyle(colors)}>Starts</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                type="button"
                aria-pressed={startMode === "now"}
                onClick={() => pickStart("now")}
                style={chipStyle(startMode === "now")}
              >
                Now
              </button>
              {slotIsToday && (
                <button
                  type="button"
                  aria-pressed={startMode === "slot"}
                  onClick={() => pickStart("slot")}
                  style={chipStyle(startMode === "slot")}
                >
                  Today {localTimeValue(slotDate)}
                </button>
              )}
              <button
                type="button"
                aria-pressed={startMode === "tomorrow"}
                onClick={() => pickStart("tomorrow")}
                style={chipStyle(startMode === "tomorrow")}
              >
                Tomorrow {localTimeValue(laterDate)}
              </button>
              <button
                type="button"
                aria-pressed={startMode === "custom"}
                onClick={() => pickStart("custom")}
                style={chipStyle(startMode === "custom")}
              >
                Pick a time
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5], minWidth: 0 }}>
            <span style={fieldLabelStyle(colors)}>How long</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {DURATION_PRESETS.map((min) => {
                const selected = !customDuration && durationMinutes === min;
                return (
                  <button
                    key={min}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setCustomDuration(false);
                      setDurationMinutes(min);
                    }}
                    style={chipStyle(selected)}
                  >
                    {min}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={customDuration}
                onClick={() => setCustomDuration((v) => !v)}
                style={chipStyle(customDuration)}
              >
                Custom
              </button>
              {customDuration && (
                <>
                  <input
                    style={{ ...inputStyle(colors), width: 84, padding: "6px 8px" }}
                    type="number"
                    min={5}
                    max={480}
                    value={durationMinutes}
                    onChange={(e) =>
                      setDurationMinutes(Math.min(480, Math.max(5, Number(e.target.value) || 0)))
                    }
                    aria-label="Meeting length in minutes"
                    autoFocus
                  />
                  <span style={{ color: colors.textMuted, fontSize: FONT.size.label }}>min</span>
                </>
              )}
            </div>
          </div>
        </div>

        {startMode === "custom" && (
          <div style={{ display: "flex", gap: SPACE[1.5], flexWrap: "wrap" }}>
            <input
              type="date"
              aria-label="Meeting date"
              value={dateStr}
              min={localDateValue(new Date())}
              onChange={(e) => setDateStr(e.target.value)}
              style={{ ...inputStyle(colors), width: 156, fontFamily: FONT.mono, padding: "8px 10px" }}
            />
            <input
              type="time"
              aria-label="Start time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              style={{ ...inputStyle(colors), width: 116, fontFamily: FONT.mono, padding: "8px 10px" }}
            />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
          <label htmlFor="new-meeting-goal" style={fieldLabelStyle(colors)}>
            Goal — what this meeting has to settle
          </label>
          <input
            id="new-meeting-goal"
            style={inputStyle(colors)}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="One line is enough"
          />
          {selectedKind && !goal.trim() && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {selectedKind.goals.map((g) => (
                <button key={g} type="button" onClick={() => setGoal(g)} style={chipStyle(false)}>
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
          <button
            type="button"
            aria-expanded={briefOpen}
            onClick={() => setBriefOpen((v) => !v)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              alignSelf: "flex-start",
              background: "none",
              border: "none",
              padding: 0,
              color: colors.textMuted,
              fontSize: FONT.size.label,
              cursor: "pointer",
            }}
          >
            {briefOpen ? <ChevronDown size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
            Add an agenda or context
            <span style={{ color: colors.textDim }}>(optional)</span>
          </button>
          {briefOpen && (
            <textarea
              id="new-meeting-brief"
              aria-label="Agenda or context"
              style={{
                ...inputStyle(colors),
                minHeight: 72,
                resize: "vertical",
                fontFamily: "inherit",
              }}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Anything the AI co-facilitator should know before it listens"
              autoFocus
            />
          )}
        </div>

        <span style={{ fontSize: FONT.size.micro, color: colors.textDim }}>
          Stratis warns you when 15 minutes are left.
        </span>
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
