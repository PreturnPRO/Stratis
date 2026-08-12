import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { FONT, RADIUS, SPACE } from "../constants";
import { useTheme } from "../hooks/useTheme";

/**
 * A Pro feature shown rather than hidden.
 *
 * Hiding what someone is not paying for means they never learn it exists, and
 * a control greyed to death reads as broken rather than as an offer. So the
 * real thing is rendered, at full contrast, with a lock on it — pressing it
 * explains what it is and where to get it instead of doing nothing.
 *
 * `locked={false}` renders the children untouched, so a paying workspace sees
 * no wrapper at all and there is only one code path to maintain.
 */
export function ProLock({
  locked,
  feature,
  blurb,
  onSeePricing,
  children,
}: {
  locked: boolean;
  /** What the thing is, in the customer's words. Used as the prompt heading. */
  feature: string;
  blurb: string;
  onSeePricing: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const [asking, setAsking] = useState(false);

  if (!locked) return <>{children}</>;

  return (
    <div>
      <div style={{ position: "relative" }}>
        {/* The controls stay visible and legible — this is a showroom window,
            not a disabled state. Pointer events are captured by the overlay so
            nothing underneath can actually be operated. */}
        <div style={{ opacity: 0.75 }} aria-hidden>
          {children}
        </div>

        <button
          type="button"
          onClick={() => setAsking((v) => !v)}
          aria-label={`${feature} — part of Pro`}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 6,
            padding: 0,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 9px",
              borderRadius: RADIUS.pill,
              background: colors.surfaceElevated,
              border: `1px solid ${colors.border}`,
              color: colors.textMuted,
              fontSize: FONT.size.micro,
              fontWeight: 600,
              letterSpacing: 0.4,
            }}
          >
            <Lock size={11} />
            PRO
          </span>
        </button>
      </div>

      {asking && (
        <div
          role="dialog"
          style={{
            marginTop: SPACE[1.5],
            padding: SPACE[2],
            borderRadius: RADIUS.md,
            border: `1px solid ${colors.accent}55`,
            background: colors.surfaceMuted,
          }}
        >
          <div style={{ fontSize: FONT.size.body, fontWeight: 500, marginBottom: 4 }}>
            {feature} is part of Pro
          </div>
          <p style={{ margin: `0 0 ${SPACE[1.5]}px`, fontSize: FONT.size.label, color: colors.textMuted }}>
            {blurb}
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onSeePricing}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                fontSize: FONT.size.label,
                color: colors.accent,
                cursor: "pointer",
              }}
            >
              See what Pro includes →
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                fontSize: FONT.size.label,
                color: colors.textMuted,
                cursor: "pointer",
              }}
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
