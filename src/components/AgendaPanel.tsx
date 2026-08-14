import { ArrowRight, ChevronRight } from "lucide-react";
import { FONT, RADIUS, SPACE } from "../tokens/colors";
import { useTheme } from "../hooks/useTheme";
import {
  AssumptionIcon,
  DriftIcon,
  LooseEndIcon,
  OpenQuestionIcon,
} from "./AgendaIcons";

/**
 * The backlog, split by what kind of gap each item is.
 *
 * The overview tiles above say how much is outstanding; this says of what sort,
 * which is what decides where you start. The four rows are the four
 * `live_cards.card_type` values, so a number here can never disagree with the
 * meeting screen — there is no dashboard-only taxonomy to drift out of sync.
 *
 * Every row goes to the same place. The Docket is where an item is acted on;
 * this panel is a way in, not a second place to work.
 */

export interface AgendaCounts {
  missingDecision: number;
  openQuestions: number;
  unresolvedAssumptions: number;
  drift: number;
}

type RowSpec = {
  key: keyof AgendaCounts;
  label: string;
  Icon: typeof LooseEndIcon;
  tint: (c: ReturnType<typeof useTheme>["colors"]) => string;
};

/** Labels are the English keys the Thai dictionary matches against. */
const ROWS: RowSpec[] = [
  {
    key: "missingDecision",
    label: "Might not be settled",
    Icon: LooseEndIcon,
    tint: (c) => c.accent,
  },
  {
    key: "openQuestions",
    label: "Questions still open",
    Icon: OpenQuestionIcon,
    tint: (c) => c.teal,
  },
  {
    key: "unresolvedAssumptions",
    label: "Assumptions not checked",
    Icon: AssumptionIcon,
    tint: (c) => c.textMuted,
  },
  {
    key: "drift",
    label: "Might have gone off track",
    Icon: DriftIcon,
    tint: (c) => c.orange,
  },
];

export function AgendaPanel({
  counts,
  loading = false,
  onOpenDocket,
}: {
  counts: AgendaCounts | null;
  loading?: boolean;
  onOpenDocket: () => void;
}) {
  const { colors } = useTheme();

  return (
    <section
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: RADIUS.lg,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: `${SPACE[2]}px ${SPACE[2.5]}px` }}>
        <h2
          style={{
            margin: 0,
            fontSize: FONT.size.body,
            fontWeight: 600,
            color: colors.text,
          }}
        >
          Your agenda
        </h2>
      </div>

      <div style={{ padding: `0 ${SPACE[1]}px`, flex: 1 }}>
        {ROWS.map(({ key, label, Icon, tint }) => {
          // A count that has not arrived is "…", never 0 — a dashboard that
          // says zero while it is still loading is telling you something false.
          const value = counts ? counts[key] : null;
          const quiet = value === 0;

          return (
            <button
              key={key}
              type="button"
              className="agenda-row"
              onClick={onOpenDocket}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: SPACE[1.5],
                padding: `${SPACE[1.5]}px ${SPACE[1.5]}px`,
                background: "transparent",
                border: "none",
                borderRadius: RADIUS.md,
                cursor: "pointer",
                textAlign: "left",
                color: colors.text,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  color: quiet ? colors.textDim : tint(colors),
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </span>

              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: FONT.size.body,
                  color: quiet ? colors.textMuted : colors.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>

              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: FONT.size.body,
                  fontWeight: 600,
                  color: quiet ? colors.textDim : colors.text,
                }}
              >
                {loading && value === null ? "…" : value ?? "—"}
              </span>

              <ChevronRight size={15} style={{ color: colors.textDim, flexShrink: 0 }} />
            </button>
          );
        })}
      </div>

      <div style={{ padding: SPACE[1.5], borderTop: `1px solid ${colors.border}` }}>
        <button
          type="button"
          onClick={onOpenDocket}
          style={{
            width: "100%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: `${SPACE[1.5]}px ${SPACE[2]}px`,
            background: "transparent",
            border: `1px solid ${colors.border}`,
            borderRadius: RADIUS.md,
            color: colors.text,
            fontSize: FONT.size.label,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Go to the docket
          <ArrowRight size={14} />
        </button>
      </div>
    </section>
  );
}
