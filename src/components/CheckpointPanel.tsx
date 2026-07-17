// Closing checkpoint (alignment checkpoint, Feature 2 + 3).
//
// The facilitator's last-three-minutes instrument: shows the decisions the room
// made, flags the ones leaving without a due date, and lets the facilitator fix
// them in place or mark one deliberately open. `present` renders the same list
// large and read-only for a projector / screenshare (Feature 3) — the room reads
// along while the facilitator speaks; edits happen in normal mode.
import { useState } from "react";
import { Check, CircleAlert, PauseCircle, Presentation, RefreshCw, X } from "lucide-react";
import { COLORS, FONT, RADIUS, SPACE } from "../constants";
import { Button } from "./ui";
import type { DecisionRecord, DecisionStatus } from "../../shared/types";
import type { CompletenessMetric, DecisionEdit } from "../hooks/useCheckpoint";

interface CheckpointPanelProps {
  decisions: DecisionRecord[];
  metric: CompletenessMetric | null;
  extracting: boolean;
  ownerTracking?: boolean;
  present: boolean;
  onEdit: (decisionId: string, patch: DecisionEdit) => void;
  onReExtract: () => void;
  onTogglePresent: () => void;
  onClose: () => void;
}

const STATUS_META: Record<
  DecisionStatus,
  { label: string; color: string; icon: typeof Check }
> = {
  complete: { label: "READY", color: COLORS.green, icon: Check },
  incomplete: { label: "NEEDS A DATE", color: COLORS.orange, icon: CircleAlert },
  open: { label: "OPEN", color: COLORS.cyan, icon: PauseCircle },
};

// The AI sometimes returns a spoken phrase ("end of month") rather than an ISO
// date; a native date input can only bind YYYY-MM-DD, so only prefill it then.
function isoOrEmpty(due: string | null): string {
  return due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : "";
}

function DecisionRow({
  decision,
  ownerTracking,
  present,
  onEdit,
}: {
  decision: DecisionRecord;
  ownerTracking: boolean;
  present: boolean;
  onEdit: (patch: DecisionEdit) => void;
}) {
  const meta = STATUS_META[decision.status];
  const Icon = meta.icon;
  const [owner, setOwner] = useState(decision.owner ?? "");

  return (
    <div
      style={{
        border: `1px solid ${decision.status === "incomplete" ? `${meta.color}55` : COLORS.border}`,
        background: COLORS.surfaceMuted,
        borderRadius: RADIUS.md,
        padding: present ? "18px 22px" : "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
        {decision.owner && (
          <span style={{ fontSize: FONT.size.micro, color: COLORS.textDim }}>
            · {decision.owner}
          </span>
        )}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: present ? FONT.size.subheading : FONT.size.body,
          color: COLORS.textPrimary,
          lineHeight: 1.5,
          fontWeight: present ? 600 : 500,
        }}
      >
        {decision.text}
      </p>

      {decision.scope && (
        <p style={{ margin: 0, fontSize: FONT.size.label, color: COLORS.textMuted }}>
          {decision.scope}
        </p>
      )}

      {decision.dueDate ? (
        <span style={{ fontSize: FONT.size.label, color: COLORS.textMuted }}>
          Due: <strong style={{ color: COLORS.textPrimary }}>{decision.dueDate}</strong>
        </span>
      ) : decision.status === "open" ? (
        decision.revisit && (
          <span style={{ fontSize: FONT.size.label, color: COLORS.textMuted }}>
            Revisit: {decision.revisit}
          </span>
        )
      ) : (
        !present && (
          <span style={{ fontSize: FONT.size.label, color: COLORS.orange }}>
            {decision.missing || "No deadline set"}
          </span>
        )
      )}

      {/* Edit controls — normal mode only; present mode is read-only for the room. */}
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
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
              color: COLORS.textPrimary,
              padding: "5px 8px",
              fontSize: FONT.size.label,
            }}
          />
          {ownerTracking && (
            <input
              type="text"
              placeholder="Owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              onBlur={() => owner !== (decision.owner ?? "") && onEdit({ owner: owner || null })}
              aria-label="Owner"
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                color: COLORS.textPrimary,
                padding: "5px 8px",
                fontSize: FONT.size.label,
                width: 120,
              }}
            />
          )}
          <button
            type="button"
            onClick={() => onEdit({ status: "open" })}
            style={{
              background: "transparent",
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.pill,
              color: COLORS.textMuted,
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
  ownerTracking = false,
  present,
  onEdit,
  onReExtract,
  onTogglePresent,
  onClose,
}: CheckpointPanelProps) {
  const rate = metric?.completenessRate;
  const incomplete = decisions.filter((d) => d.status === "incomplete").length;

  const headline =
    decisions.length === 0
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
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: present ? FONT.size.title : FONT.size.heading,
              fontWeight: 700,
              color: COLORS.textPrimary,
            }}
          >
            Before we close
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: FONT.size.body, color: incomplete > 0 ? COLORS.orange : COLORS.textMuted }}>
            {headline}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {rate != null && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: present ? FONT.size.heading : FONT.size.subheading, fontWeight: 800, color: rate === 100 ? COLORS.green : COLORS.orange }}>
                {rate}%
              </div>
              <div style={{ fontSize: FONT.size.micro, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
                have a date
              </div>
            </div>
          )}
          {!present && (
            <button type="button" onClick={onClose} aria-label="Close checkpoint" style={{ background: "transparent", border: "none", color: COLORS.textMuted, cursor: "pointer", padding: 4 }}>
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Decision list */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: SPACE[2.5] }}>
        {decisions.length === 0 && !extracting ? (
          <div style={{ padding: "32px 0", textAlign: "center", color: COLORS.textMuted, fontSize: FONT.size.body }}>
            Nothing to confirm yet. Run the checkpoint once the team has decided something.
          </div>
        ) : (
          decisions.map((d) => (
            <DecisionRow
              key={d.id}
              decision={d}
              ownerTracking={ownerTracking}
              present={present}
              onEdit={(patch) => onEdit(d.id, patch)}
            />
          ))
        )}
      </div>

      {/* Actions */}
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
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.pill,
            color: COLORS.textMuted,
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
