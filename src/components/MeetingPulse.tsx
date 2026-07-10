import { useEffect, useRef, useState } from "react";
import { COLORS, FONT, LETTER_SPACING, RADIUS } from "../tokens/colors";

// ─────────────────────────────────────────────────────────────────────────────
// Live-meeting ambient signifiers:
//   AiPresenceChip — animated waveform chip showing what the AI is doing
//                    (off / listening / hearing speech / thinking / card ready)
//   AgendaPulse    — pomodoro-style ring card for the planned-duration agenda
//   TimeRiver      — 3px peripheral progress bar under the meeting header
//
// Phase colors follow one convention everywhere: accent while on track,
// orange inside the wrap-up window, red in overtime. All motion is calm ease
// (no springs) per the autonomous-motion rule in tokens/colors.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type PresenceMode = "off" | "listening" | "speech" | "thinking";

const MODE_LABEL: Record<PresenceMode, string> = {
  off: "Mic off",
  listening: "AI listening",
  speech: "Hearing you",
  thinking: "Thinking…",
};

const BAR_COUNT = 5;

// How long the "Suggestion ready" bloom holds before returning to the
// underlying mode.
const BLOOM_MS = 1600;

function barAnimation(mode: PresenceMode, index: number): React.CSSProperties {
  switch (mode) {
    case "listening":
      return {
        transform: "scaleY(0.45)",
        animation: `waveBar 2.4s ease-in-out ${index * 0.18}s infinite`,
      };
    case "speech":
      return {
        transform: "scaleY(0.45)",
        animation: `waveBar 1.1s ease-in-out ${index * 0.12}s infinite`,
      };
    case "thinking":
      return {
        transform: "scaleY(0.45)",
        animation: `thinkBlink 0.9s ease-in-out ${index * 0.12}s infinite`,
      };
    case "off":
    default:
      return { transform: "scaleY(0.3)" };
  }
}

export function AiPresenceChip({
  mode,
  cardCount,
  provider,
}: {
  mode: PresenceMode;
  // Number of suggestion cards received so far — an increase triggers a
  // one-shot "Suggestion ready" bloom on the chip.
  cardCount: number;
  provider?: string | null;
}) {
  const [bloom, setBloom] = useState(false);
  const prevCount = useRef(cardCount);

  useEffect(() => {
    if (cardCount > prevCount.current) {
      setBloom(true);
      const t = setTimeout(() => setBloom(false), BLOOM_MS);
      prevCount.current = cardCount;
      return () => clearTimeout(t);
    }
    prevCount.current = cardCount;
  }, [cardCount]);

  const label = bloom ? "Suggestion ready" : MODE_LABEL[mode];
  const off = mode === "off" && !bloom;
  const bright = bloom || mode === "speech";
  const barColor = off ? COLORS.textDim : bright ? COLORS.accentHover : COLORS.accent;
  const textColor = off ? COLORS.textMuted : bright ? COLORS.accentHover : COLORS.accent;

  return (
    <span
      role="status"
      aria-label={label}
      title={provider ? `AI provider: ${provider}` : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: RADIUS.pill,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        color: textColor,
        fontSize: FONT.size.caption,
        fontWeight: 500,
        lineHeight: 1.4,
        animation: bloom ? "chipBloom 1.2s ease-out" : undefined,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 2,
          height: 13,
          flexShrink: 0,
        }}
      >
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <span
            key={i}
            style={{
              width: 2.5,
              height: 12,
              borderRadius: 2,
              background: barColor,
              transformOrigin: "center",
              transition: "background 0.3s ease",
              ...barAnimation(bloom ? "speech" : mode, i),
            }}
          />
        ))}
      </span>
      {label}
    </span>
  );
}

// ── Agenda timer phase (shared by AgendaPulse + TimeRiver) ───────────────────

const DEFAULT_WRAP_UP_SEC = 15 * 60;

interface AgendaPhase {
  overtime: boolean;
  inWrapUp: boolean;
  color: string;
  frac: number;
}

function agendaPhase(durationMin: number, elapsedSec: number, wrapUpSec: number): AgendaPhase {
  const totalSec = durationMin * 60;
  const remaining = totalSec - elapsedSec;
  const overtime = remaining <= 0;
  const inWrapUp = !overtime && remaining <= wrapUpSec;
  return {
    overtime,
    inWrapUp,
    color: overtime ? COLORS.red : inWrapUp ? COLORS.orange : COLORS.accent,
    frac: totalSec > 0 ? Math.min(elapsedSec / totalSec, 1) : 0,
  };
}

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function AgendaPulse({
  durationMin,
  elapsedSec,
  wrapUpSec = DEFAULT_WRAP_UP_SEC,
}: {
  durationMin: number;
  elapsedSec: number;
  wrapUpSec?: number;
}) {
  const { overtime, inWrapUp, color, frac } = agendaPhase(durationMin, elapsedSec, wrapUpSec);
  const remaining = durationMin * 60 - elapsedSec;

  const centerNum = overtime
    ? `+${Math.max(1, Math.ceil(-remaining / 60))}m`
    : `${Math.max(1, Math.ceil(remaining / 60))}m`;
  const centerSub = overtime ? "over" : "left";
  const status = overtime ? "Overtime" : inWrapUp ? "Wrap-up window" : "On track";
  const statusColor = overtime || inWrapUp ? color : COLORS.text;
  const subline = overtime
    ? `planned ${durationMin} min`
    : `${Math.floor(elapsedSec / 60)} of ${durationMin} min`;

  return (
    <div
      role="timer"
      aria-label={`Agenda timer: ${centerNum} ${centerSub} — ${status}`}
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        marginBottom: 8,
        borderRadius: RADIUS.lg,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <svg width={62} height={62} viewBox="0 0 64 64" aria-hidden style={{ flexShrink: 0 }}>
        <circle cx={32} cy={32} r={RING_RADIUS} fill="none" stroke={COLORS.border} strokeWidth={5} />
        <circle
          cx={32}
          cy={32}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - frac)}
          transform="rotate(-90 32 32)"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }}
        />
        <text
          x={32}
          y={31}
          textAnchor="middle"
          fill={overtime ? COLORS.red : COLORS.text}
          fontSize={13}
          fontWeight={600}
          fontFamily={FONT.sans}
        >
          {centerNum}
        </text>
        <text
          x={32}
          y={43}
          textAnchor="middle"
          fill={COLORS.textMuted}
          fontSize={9.5}
          fontFamily={FONT.sans}
        >
          {centerSub}
        </text>
      </svg>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: FONT.size.micro,
            fontWeight: 700,
            letterSpacing: LETTER_SPACING.wide,
            textTransform: "uppercase",
            color: COLORS.textDim,
            marginBottom: 3,
          }}
        >
          Agenda
        </div>
        <div
          style={{
            fontSize: FONT.size.body,
            fontWeight: 600,
            color: statusColor,
            lineHeight: 1.3,
            marginBottom: 3,
          }}
        >
          {status}
        </div>
        <div style={{ fontSize: FONT.size.caption, color: COLORS.textMuted }}>{subline}</div>
      </div>
    </div>
  );
}

export function TimeRiver({
  durationMin,
  elapsedSec,
  wrapUpSec = DEFAULT_WRAP_UP_SEC,
}: {
  durationMin: number;
  elapsedSec: number;
  wrapUpSec?: number;
}) {
  const { color, frac } = agendaPhase(durationMin, elapsedSec, wrapUpSec);
  const totalSec = durationMin * 60;
  const tickPct = totalSec > wrapUpSec ? ((totalSec - wrapUpSec) / totalSec) * 100 : null;

  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        height: 3,
        background: COLORS.surfaceHover,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "100%",
          transform: `scaleX(${frac})`,
          transformOrigin: "left",
          background: color,
          transition: "transform 1s linear, background 0.3s ease",
        }}
      />
      {tickPct != null && (
        <div
          style={{
            position: "absolute",
            left: `${tickPct}%`,
            top: -2,
            bottom: -2,
            width: 1,
            background: COLORS.textDim,
          }}
        />
      )}
    </div>
  );
}
