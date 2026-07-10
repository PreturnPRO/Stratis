import { useState, useEffect } from "react";
import { COLORS, FONT, LETTER_SPACING } from "../constants";

// Quiet priming beat between "start meeting" and the live session — reads as
// the tool getting ready, not an announcement. Hold, then a quick fade.
const HOLD_MS = 650;
const EXIT_MS = 300;

export default function MeetingTransition({ onDone }: { onDone: () => void }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), HOLD_MS);
    const t2 = setTimeout(() => onDone(), HOLD_MS + EXIT_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      role="status"
      aria-label="Preparing session"
      style={{
        position: "absolute", inset: 0,
        background: COLORS.bg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 16,
        opacity: exiting ? 0 : 1,
        transition: `opacity ${EXIT_MS}ms ease`,
        zIndex: 10,
      }}
    >
      <span style={{ position: "relative", display: "inline-flex", width: 14, height: 14 }}>
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: COLORS.accent,
            animation: "meetingPrimePulse 1.1s ease-out infinite",
          }}
        />
        <span
          style={{
            position: "relative",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: COLORS.accent,
            boxShadow: `0 0 10px ${COLORS.accent}`,
          }}
        />
      </span>

      <span
        style={{
          fontSize: FONT.size.label,
          fontWeight: 500,
          letterSpacing: LETTER_SPACING.label,
          textTransform: "uppercase",
          color: COLORS.textMuted,
        }}
      >
        Preparing session
      </span>

      <style>{`
        @keyframes meetingPrimePulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(3.2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
