import { useId, useState } from "react";
import { Check, CircleAlert, PauseCircle, Pencil, Presentation, RefreshCw, X } from "lucide-react";
import { FONT, RADIUS, SPACE, tint } from "../tokens/colors";
import { useTheme } from "../hooks/useTheme";
import { Button, IconButton } from "./ui";
import { LoadingState } from "./states";
import { toggleOpenStatus } from "../lib/decisionStatus";
import type { DecisionRecord, DecisionStatus } from "../../shared/types";
import type { CompletenessMetric, DecisionEdit } from "../hooks/useCheckpoint";

export interface DecisionReactions {
  agree: number;
  flag: number;
  flags: Array<{ name: string; note: string | null }>;
}

interface CheckpointPanelProps {
  decisions: DecisionRecord[];
  metric: CompletenessMetric | null;
  extracting: boolean;
  speakers?: string[];
  present: boolean;
  /** Load/extract/save failure from useCheckpoint. Edits roll back on failure,
   *  so without this line the revert is invisible and reads as data loss. */
  error?: string | null;
  onEdit: (decisionId: string, patch: DecisionEdit) => void;
  onReExtract: () => void;
  /** The spoken room code, once the facilitator has opened the room. */
  roomCode?: string | null;
  openingRoom?: boolean;
  onOpenRoom?: () => void;
  /** What the room said back, keyed by decision id. */
  reactions?: Record<string, DecisionReactions>;
  onTogglePresent: () => void;
  onClose: () => void;
  /**
   * Rendered below the panel's own actions. Used by the end-of-meeting layer to
   * put its exit at the bottom, so reading the list is the path to the button.
   */
  footer?: React.ReactNode;
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
  reactions,
  onEdit,
}: {
  decision: DecisionRecord;
  speakers: string[];
  present: boolean;
  reactions?: DecisionReactions;
  onEdit: (patch: DecisionEdit) => void;
}) {
  const { colors } = useTheme();
  const meta = statusMeta(colors)[decision.status];
  const Icon = meta.icon;
  const isOpen = decision.status === "open";
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
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={() => onEdit({ dismissed: false })}
          style={{
            color: colors.accent,
            fontSize: FONT.size.label,
            fontWeight: 600,
            padding: 0,
            flexShrink: 0,
          }}
        >
          Undo
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${decision.status === "incomplete" ? `${meta.color}55` : colors.border}`,
        // The status as a left edge, not only as a pill. Six decisions are read
        // by scanning down the margin; a badge has to be read one at a time.
        borderLeft: `3px solid ${meta.color}`,
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
            <IconButton
              type="button"
              onClick={() => {
                setDraftText(decision.text);
                setEditingText(true);
              }}
              aria-label="Edit decision text"
              title="Edit wording (STT sometimes mishears)"
              style={{ width: 24, height: 24 }}
            >
              <Pencil size={13} />
            </IconButton>
            <IconButton
              type="button"
              onClick={() => onEdit({ dismissed: true })}
              aria-label="Dismiss decision"
              title="Not a real decision — dismiss (undoable)"
              style={{ width: 24, height: 24 }}
            >
              <X size={14} />
            </IconButton>
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
            // Present mode is read from across a room, not from a laptop.
            fontSize: present ? FONT.size.heading : FONT.size.body,
            color: colors.textPrimary,
            lineHeight: present ? 1.35 : 1.5,
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

      {/* The controls sit below a hairline, quieter than the decision itself.
          Ungrouped, a bare date field and a text field carried the same weight
          as the sentence they were about, and the card read as a form. */}
      {!present && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            marginTop: 4,
            paddingTop: 10,
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <input
            type="date"
            value={isoOrEmpty(decision.dueDate)}
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
          <Button
            type="button"
            variant="ghost"
            aria-pressed={isOpen}
            title={
              isOpen
                ? "Currently parked as open — click to bring it back for a date"
                : "Park this as deliberately undecided"
            }
            onClick={() => onEdit({ status: toggleOpenStatus(decision.status, decision.dueDate) })}
            style={{
              /* Only pinned when pressed. Leaving `background` unset in the
                 unpressed case lets the ghost variant supply the hover fill. */
              ...(isOpen
                ? {
                    background: tint(colors.cyan, colors.surfaceMuted),
                    border: `1px solid ${colors.cyan}`,
                    color: colors.cyan,
                  }
                : null),
              borderRadius: RADIUS.pill,
              padding: "5px 10px",
              fontSize: FONT.size.micro,
              fontWeight: isOpen ? 600 : 400,
            }}
          >
            Deliberately open
          </Button>
        </div>
      )}

      {/* What the room said. A count alone only says something is wrong; the
          notes are what tell the facilitator where to look. */}
      {reactions && (reactions.agree > 0 || reactions.flag > 0) && (
        <div
          style={{
            marginTop: SPACE[1],
            paddingTop: SPACE[1],
            borderTop: `1px solid ${colors.border}`,
            fontSize: FONT.size.micro,
            color: colors.textDim,
            fontFamily: FONT.mono,
          }}
        >
          {reactions.agree > 0 && <span>{reactions.agree} agreed</span>}
          {reactions.agree > 0 && reactions.flag > 0 && <span> · </span>}
          {reactions.flag > 0 && (
            <span style={{ color: colors.orange }}>{reactions.flag} flagged</span>
          )}
          {reactions.flags
            .filter((f) => f.note)
            .map((f, i) => (
              <div
                key={i}
                style={{
                  marginTop: 4,
                  color: colors.textMuted,
                  fontFamily: FONT.sans,
                  fontSize: FONT.size.caption,
                }}
              >
                <strong style={{ color: colors.text }}>{f.name}:</strong> {f.note}
              </div>
            ))}
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
  error,
  onEdit,
  onReExtract,
  roomCode,
  openingRoom,
  onOpenRoom,
  reactions,
  onTogglePresent,
  onClose,
  footer,
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
        // Was SPACE[4] between every section, which spaced the header, the
        // list and the actions equally and left no grouping to read.
        gap: SPACE[2.5],
        height: present ? "100%" : "auto",
        maxHeight: present ? "100%" : "70vh",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
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
            <div style={{ textAlign: "right", minWidth: present ? 140 : 108 }}>
              <div
                style={{
                  fontSize: present ? FONT.size.heading : FONT.size.subheading,
                  fontWeight: 800,
                  color: rate === 100 ? colors.green : colors.orange,
                  lineHeight: 1.1,
                }}
              >
                {rate}%
              </div>
              {/* A bar as well as a number: "70%" is a fact, a bar is a glance. */}
              <div
                role="img"
                aria-label={`${rate}% of decisions have a date`}
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: colors.border,
                  overflow: "hidden",
                  margin: "5px 0 4px",
                }}
              >
                <div
                  style={{
                    width: `${rate}%`,
                    height: "100%",
                    background: rate === 100 ? colors.green : colors.orange,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
              <div style={{ fontSize: FONT.size.micro, color: colors.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
                have a date
              </div>
            </div>
          )}
          {!present && (
            <IconButton type="button" onClick={onClose} aria-label="Close checkpoint">
              <X size={20} />
            </IconButton>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: colors.redBg,
            border: `1px solid ${colors.red}55`,
            color: colors.red,
            borderRadius: RADIUS.sm,
            padding: "8px 12px",
            fontSize: FONT.size.label,
          }}
        >
          {error} — your change was not saved.
        </div>
      )}

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: SPACE[1.5],
          // Breathing room against the actions below without a hard rule.
          paddingBottom: 2,
        }}
      >
        {decisions.length === 0 && extracting ? (
          <LoadingState count={3} persist />
        ) : decisions.length === 0 ? (
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
              reactions={reactions?.[d.id]}
              onEdit={(patch) => onEdit(d.id, patch)}
            />
          ))
        )}
      </div>

      {/* The room's way in. Shown as the code itself once opened, because the
          facilitator's next action is to read it out loud. */}
      {onOpenRoom && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: SPACE[1.5],
            padding: SPACE[1.5],
            marginBottom: SPACE[1.5],
            background: colors.surfaceMuted,
            border: `1px solid ${colors.border}`,
            borderRadius: RADIUS.md,
          }}
        >
          {roomCode ? (
            <>
              <span style={{ fontSize: FONT.size.micro, color: colors.textDim, letterSpacing: 1 }}>
                ROOM CODE
              </span>
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: present ? 32 : 22,
                  letterSpacing: 4,
                  color: colors.accent,
                  fontWeight: 600,
                }}
              >
                {roomCode}
              </span>
              <span style={{ fontSize: FONT.size.micro, color: colors.textDim, marginLeft: "auto" }}>
                stratis-beta.vercel.app/#/room
              </span>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenRoom}
              disabled={openingRoom}
            >
              {openingRoom ? "Opening…" : "Open to the room"}
            </Button>
          )}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Button
          type="button"
          variant="ghost"
          onClick={onReExtract}
          disabled={extracting}
          iconLeft={<RefreshCw size={14} style={extracting ? { animation: "spin 1s linear infinite" } : undefined} />}
          style={{ padding: "7px 12px", fontSize: FONT.size.label, fontWeight: 400 }}
        >
          {extracting ? "Reading…" : "Re-read meeting"}
        </Button>

        <Button variant="ghost" size="sm" onClick={onTogglePresent} iconLeft={<Presentation size={14} />}>
          {present ? "Exit present" : "Present to room"}
        </Button>
      </div>

      {footer}
    </div>
  );
}
