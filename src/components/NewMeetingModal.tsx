import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { COLORS, FONT, LETTER_SPACING, SPACE } from "../tokens/colors";
import { Button, Chip, Modal } from "./ui";
import { useAuth } from "../context/AuthContext";
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
}

interface NewMeetingModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: NewMeetingFormValues) => void | Promise<void>;
  submitting: boolean;
  error: string | null;
  // Set only when opened from an existing project card (Projects.tsx) — locks
  // the project field instead of free-typing a name, so the new meeting can't
  // accidentally fork a new project via a slug mismatch.
  lockedProject?: LockedProject;
}

export function NewMeetingModal({
  open,
  onClose,
  onSubmit,
  submitting,
  error,
  lockedProject,
}: NewMeetingModalProps) {
  const { token } = useAuth();

  const [title, setTitle] = useState("");
  const [projectName, setProjectName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [goal, setGoal] = useState("");
  const [brief, setBrief] = useState("");
  const [docVersion, setDocVersion] = useState<number | null>(null);

  // Reset form state each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setProjectName(lockedProject?.name ?? "");
    setDurationMinutes(60);
    setGoal("");
    setBrief("");
    setDocVersion(null);
  }, [open, lockedProject?.id, lockedProject?.name]);

  // Check whether this project already has a PM document, so the modal can
  // show an "attached" chip signaling the live AI will get that context
  // automatically — the user doesn't need to retype it into Goal/Brief.
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

  const canSubmit = title.trim() && (lockedProject || projectName.trim());

  return (
    <Modal
      title={lockedProject ? `New meeting — ${lockedProject.name}` : "New meeting"}
      width={420}
      onClose={() => !submitting && onClose()}
      footer={
        <>
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
              })
            }
          >
            {submitting ? "Creating..." : "Create and start"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {error && (
          <div
            style={{
              background: COLORS.redBg,
              border: `1px solid ${COLORS.red}`,
              color: COLORS.red,
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: FONT.size.label,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
          <label htmlFor="new-meeting-title" style={fieldLabelStyle}>
            Meeting title
          </label>
          <input
            id="new-meeting-title"
            style={inputStyle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekly sync"
            autoFocus
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
          <label htmlFor="new-meeting-project" style={fieldLabelStyle}>
            Project
          </label>
          {lockedProject ? (
            <input
              id="new-meeting-project"
              style={{ ...inputStyle, color: COLORS.textMuted, cursor: "not-allowed" }}
              value={lockedProject.name}
              disabled
              readOnly
            />
          ) : (
            <input
              id="new-meeting-project"
              style={inputStyle}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Stratis"
            />
          )}
        </div>

        {lockedProject && docVersion != null && (
          <Chip color={COLORS.accent} icon={<FileText size={12} strokeWidth={2} />}>
            PM Document · v{docVersion} attached — the live AI will use it as context
          </Chip>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={fieldLabelStyle}>
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
                    borderRadius: 8,
                    fontSize: FONT.size.label,
                    fontWeight: 600,
                    background: selected ? COLORS.accent : "transparent",
                    border: `1px solid ${selected ? COLORS.accent : COLORS.border}`,
                    color: selected ? "#10160b" : COLORS.textMuted,
                  }}
                >
                  {min} min
                </button>
              );
            })}
            <input
              style={{ ...inputStyle, width: 96 }}
              type="number"
              min={5}
              max={480}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.min(480, Math.max(5, Number(e.target.value) || 0)))}
              aria-label="Custom duration in minutes"
            />
            <span style={{ color: COLORS.textMuted, fontSize: FONT.size.label }}>min</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
          <label htmlFor="new-meeting-goal" style={fieldLabelStyle}>
            Meeting goal
          </label>
          <input
            id="new-meeting-goal"
            style={inputStyle}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="One line — what this meeting needs to decide"
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1.5] }}>
          <label htmlFor="new-meeting-brief" style={fieldLabelStyle}>
            Brief / agenda <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            id="new-meeting-brief"
            style={{
              ...inputStyle,
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

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: FONT.size.body,
  outline: "none",
};

const fieldLabelStyle: React.CSSProperties = {
  color: COLORS.textMuted,
  fontSize: FONT.size.label,
  fontWeight: 500,
  letterSpacing: LETTER_SPACING.wide,
};
