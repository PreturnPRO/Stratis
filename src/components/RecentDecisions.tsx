import { FONT, LETTER_SPACING, SPACE } from "../tokens/colors";
import { useTheme } from "../hooks/useTheme";

/**
 * What the team settled, as its own object.
 *
 * "Recent summaries" answers what happened in a meeting. This answers what was
 * decided, which is the thing nobody can reconstruct six weeks later and the
 * reason the product exists. A resolved decision is deliberately quiet — muted
 * text, a small accent tick — because it needs nothing from anyone.
 */

export interface DecidedItem {
  id: string;
  text: string;
  owner: string | null;
  decidedAt: string;
  meetingTitle: string | null;
  projectName: string | null;
}

export function RecentDecisions({ items }: { items: DecidedItem[] }) {
  const { colors } = useTheme();
  if (items.length === 0) return null;

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
        Recent decisions
      </div>

      <div>
        {items.map((d) => (
          <div
            key={d.id}
            style={{
              display: "flex",
              gap: SPACE[1.5],
              alignItems: "flex-start",
              padding: "10px 2px",
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <span style={{ color: colors.accent, flexShrink: 0, lineHeight: 1.5 }}>✓</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: FONT.size.body, color: colors.text, lineHeight: 1.45 }}>
                {d.text}
              </div>
              <div style={{ fontSize: FONT.size.caption, color: colors.textDim, marginTop: 2 }}>
                {[d.projectName, d.meetingTitle, d.owner ? `owner ${d.owner}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
