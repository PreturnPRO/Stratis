import { useId, useState } from "react";
import { Check, CircleAlert, PauseCircle, Pencil, Presentation, RefreshCw, X } from "lucide-react";
import { FONT, RADIUS, SPACE, tint } from "../tokens/colors";
import { useTheme } from "../hooks/useTheme";
import { Button } from "./ui";
import type { DecisionRecord, DecisionStatus } from "../../shared/types";
import type { CompletenessMetric, DecisionEdit } from "../hooks/useCheckpoint";

interface CheckpointPanelProps {
  decisions: DecisionRecord[];
  metric: CompletenessMetric | null;
  extracting: boolean;
  speakers?: string[];
  present: boolean;
  onEdit: (decisionId: string, patch: DecisionEdit) => void;
  onReExtract: () => void;
  onTogglePresent: () => void;
  onClose: () => void;
}

function statusMeta(colors: Record<string, string>): Record<
  DecisionStatus,
  { label: string; color: string; icon: typeof Check }
> {
  return {
    complete: { label: "READY", color: colors.green, icon: Check },
    incomplete: { label: "NEEDS A DATE", color: colors.orange, icon: CircleAlert },
    open: { label: "OPEN", color: colors.cyan, icon: PauseCircle },
  };
}

function isoOrEmpty(due: string | null): string {
  return due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : "";
}

function DecisionRow({
  decision,
  speakers,
  present,
  onEdit,
}: {
  decision: DecisionRecord;
  speakers: string[];
  present: boolean;
  onEdit: (patch: DecisionEdit) => void;
}) {
  const { colors } = useTheme();
  const meta = statusMeta(colors)[decision.status];
  const Icon = meta.icon;
  const [owner, setOwner] = useState(decision.owner ?? "");
  const [editingText, setEditingText] = useState(false);
  const [draftText, setDraftText] = useState(decision.text);
  const datalistId = useId();

  if (decision.dismissed) {
    if (present) return null;
    return (
      <div
        style={{
          border: `1px dashed ${colors.border}`,
          borderRadius: RADIUS.md,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: FONT.size.label,
            color: colors.textDim,
            textDecorationLine: "line-through",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {decision.text}
        </span>
        <button
          type="button"
          onClick={() => onEdit({ dismissed: false })}
          style={{
            background: "transparent",
            border: "none",
            color: colors.accent,
            fontSize: FONT.size.label,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Undo
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${decision.status === "incomplete" ? `${meta.color}55` : colors.border}`,
        background: colors.surfaceMuted,
        borderRadius: RADIUS.md,
        padding: present ? "18px 22px" : "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "2px 8px",
            borderRadius: RADIUS.pill,
            background: tint(meta.color, colors.surfaceMuted),
          }}
        >
          <Icon size={present ? 18 : 14} color={meta.color} />
          <span
            style={{
              fontSize: present ? FONT.size.micro : 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              color: meta.color,
              textTransform: "uppercase",
            }}
          >
            {meta.label}
          </span>
        </span>
        {decision.owner && (
          <span style={{ fontSize: FONT.size.micro, color: colors.textDim }}>
            · {decision.owner}
          </span>
        )}
        {!present && (
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 2 }}>
            <button
              type="button"
              onClick={() => {
                setDraftText(decision.text);
                setEditingText(true);
              }}
              aria-label="Edit decision text"
              title="Edit wording (STT sometimes mishears)"
              style={{ background: "transparent", border: "none", color: colors.textDim, cursor: "pointer", padding: 4 }}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={() => onEdit({ dismissed: true })}
              aria-label="Dismiss decision"
              title="Not a real decision — dismiss (undoable)"
              style={{ background: "transparent", border: "none", color: colors.textDim, cursor: "pointer", padding: 4 }}
            >
              <X size={14} />
            </button>
          </span>
        )}
      </div>

      {editingText && !present ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={2}
            aria-label="Decision text"
            style={{
              background: colors.surface,
              border: `1px solid ${colors.borderLight}`,
              borderRadius: RADIUS.sm,
              color: colors.textPrimary,
              padding: "8px 10px",
              fontSize: FONT.size.body,
              lineHeight: 1.5,
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const clean = draftText.trim();
                if (clean && clean !== decision.text) onEdit({ text: clean });
                setEditingText(false);
              }}
            >
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditingText(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p
          style={{
            margin: 0,
            fontSize: present ? FONT.size.subheading : FONT.size.body,
            color: colors.textPrimary,
            lineHeight: 1.5,
            fontWeight: present ? 600 : 500,
          }}
        >
          {decision.text}
        </p>
      )}

      {decision.scope && (
        <p style={{ margin: 0, fontSize: FONT.size.label, color: colors.textMuted }}>
          {decision.scope}
        </p>
      )}

      {decision.dueDate ? (
        <span style={{ fontSize: FONT.size.label, color: colors.textMuted }}>
          Due: <strong style={{ color: colors.textPrimary }}>{decision.dueDate}</strong>
        </span>
      ) : decision.status === "open" ? (
        decision.revisit && (
          <span style={{ fontSize: FONT.size.label, color: colors.textMuted }}>
            Revisit: {decision.revisit}
          </span>
        )
      ) : (
        !present && (
          <span style={{ fontSize: FONT.size.label, color: colors.orange }}>
            {decision.missing || "No deadline set"}
          </span>
        )
      )}

      {!present && decision.status !== "open" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <input
            type="date"
            defaultValue={isoOrEmpty(decision.dueDate)}
            onChange={(e) =>
              onEdit({
                dueDate: e.target.value || null,
                status: e.target.value ? "complete" : "incomplete",
              })
            }
            aria-label="Due date"
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: RADIUS.sm,
              color: colors.textPrimary,
              padding: "5px 8px",
              fontSize: FONT.size.label,
            }}
          />
          <input
            type="text"
            placeholder="Owner"
            list={datalistId}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            onBlur={() => owner !== (decision.owner ?? "") && onEdit({ owner: owner || null })}
            aria-label="Owner"
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: RADIUS.sm,
              color: colors.textPrimary,
              padding: "5px 8px",
              fontSize: FONT.size.label,
              width: 120,
            }}
          />
          <datalist id={datalistId}>
            {speakers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => onEdit({ status: "open" })}
            style={{
              background: "transparent",
              border: `1px solid ${colors.border}`,
              borderRadius: RADIUS.pill,
              color: colors.textMuted,
              padding: "5px 10px",
              fontSize: FONT.size.micro,
              cursor: "pointer",
            }}
          >
            Deliberately open
          </button>
        </div>
      )}
    </div>
  );
}

export function CheckpointPanel({
  decisions,
  metric,
  extracting,
  speakers = [],
  present,
  onEdit,
  onReExtract,
  onTogglePresent,
  onClose,
}: CheckpointPanelProps) {
  const { colors } = useTheme();
  const rate = metric?.completenessRate;
  const live = decisions.filter((d) => !d.dismissed);
  const incomplete = live.filter((d) => d.status === "incomplete").length;

  const headline =
    live.length === 0
      ? extracting
        ? "Reading the meeting…"
        : "No decisions found yet"
      : incomplete > 0
        ? `${incomplete} decision${incomplete > 1 ? "s" : ""} still need a date`
        : "Every decision has a date";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SPACE[4],
        height: present ? "100%" : "auto",
        maxHeight: present ? "100%" : "70vh",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <span
            style={{
              display: "block",
              marginBottom: 4,
              fontFamily: FONT.mono,
              fontSize: FONT.size.micro,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: colors.textDim,
            }}
          >
            SYS.03.1 — CHECKPOINT
          </span>
          <h2
            style={{
              margin: 0,
              fontSize: present ? FONT.size.title : FONT.size.heading,
              fontWeight: 700,
              color: colors.textPrimary,
            }}
          >
            Before we close
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: FONT.size.body, color: incomplete > 0 ? colors.orange : colors.textMuted }}>
            {headline}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {rate != null && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: present ? FONT.size.heading : FONT.size.subheading, fontWeight: 800, color: rate === 100 ? colors.green : colors.orange }}>
                {rate}%
              </div>
              <div style={{ fontSize: FONT.size.micro, color: colors.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
                have a date
              </div>
            </div>
          )}
          {!present && (
            <button type="button" onClick={onClose} aria-label="Close checkpoint" style={{ background: "transparent", border: "none", color: colors.textMuted, cursor: "pointer", padding: 4 }}>
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: SPACE[2.5] }}>
        {decisions.length === 0 && !extracting ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: colors.textMuted, fontSize: FONT.size.body }}>
            Nothing to confirm yet. Run the checkpoint once the team has decided something.
          </div>
        ) : (
          decisions.map((d) => (
            <DecisionRow
              key={d.id}
              decision={d}
              speakers={speakers}
              present={present}
              onEdit={(patch) => onEdit(d.id, patch)}
            />
          ))
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <button
          type="button"
          onClick={onReExtract}
          disabled={extracting}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: `1px solid ${colors.border}`,
            borderRadius: RADIUS.pill,
            color: colors.textMuted,
            padding: "7px 12px",
            fontSize: FONT.size.label,
            cursor: extracting ? "default" : "pointer",
            opacity: extracting ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} style={extracting ? { animation: "spin 1s linear infinite" } : undefined} />
          {extracting ? "Reading…" : "Re-read meeting"}
        </button>

        <Button variant="ghost" size="sm" onClick={onTogglePresent} iconLeft={<Presentation size={14} />}>
          {present ? "Exit present" : "Present to room"}
        </Button>
      </div>
    </div>
  );
}
