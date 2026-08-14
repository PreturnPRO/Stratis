/**
 * Four icons drawn for the four things Stratis tracks.
 *
 * Not emoji: an emoji renders in the OS's font, so the same row is a flat glyph
 * on Windows, a colour sticker on macOS and a tofu box on some Thai keyboards —
 * and none of them take the accent colour. These are inline SVG on
 * `currentColor`, so they inherit the row's colour in both themes and cost no
 * request and no font.
 *
 * Each one says something about its category rather than decorating it: the
 * loose end is a thread that stops short, the question is a mark with no
 * answer under it, the assumption is a shape resting on a dashed line that was
 * never verified, the drift is an arrow leaving its own track.
 *
 * Motion is on hover only, and only on the row you are pointing at. The
 * workbench does not animate on its own (DECISIONS.md §9) — a dashboard where
 * four icons breathe at you is the thing that decision removed. Transforms and
 * opacity only, so it composites without a repaint, and `prefers-reduced-motion`
 * turns it off entirely (see index.css).
 */

interface IconProps {
  size?: number;
  /** Colour comes from the row; `currentColor` unless a category tint is passed. */
  color?: string;
}

function frame(size: number, color?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: color ?? "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

/** MISSING_DECISION — a thread that runs out before it is tied off. */
export function LooseEndIcon({ size = 18, color }: IconProps) {
  return (
    <svg {...frame(size, color)} className="agenda-icon">
      <path className="agenda-icon-draw" d="M4 17c3.5 0 4.5-9 8-9 2.2 0 3 2.4 3 4.5" />
      <path className="agenda-icon-tail" d="M15 12.5c0 2 .8 3.4 2.4 3.4" strokeDasharray="1.5 2.5" />
      <circle className="agenda-icon-dot" cx="19.6" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** QUESTION_SUGGESTION — asked, with nothing settled underneath it yet. */
export function OpenQuestionIcon({ size = 18, color }: IconProps) {
  return (
    <svg {...frame(size, color)} className="agenda-icon">
      <circle className="agenda-icon-ring" cx="12" cy="12" r="8.5" opacity="0.35" />
      <path className="agenda-icon-draw" d="M9.4 9.4a2.7 2.7 0 1 1 3.4 2.9c-.6.2-.9.8-.9 1.5v.4" />
      <circle className="agenda-icon-dot" cx="11.9" cy="17.1" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** UNRESOLVED_ASSUMPTION — weight resting on a line nobody checked. */
export function AssumptionIcon({ size = 18, color }: IconProps) {
  return (
    <svg {...frame(size, color)} className="agenda-icon">
      <path className="agenda-icon-draw" d="M12 4.5 18 11H6l6-6.5Z" />
      <path className="agenda-icon-tail" d="M4 15.5h16" strokeDasharray="3 3" />
      <path className="agenda-icon-tail" d="M8.5 19.5h7" strokeDasharray="2 3" opacity="0.5" />
    </svg>
  );
}

/** DRIFT_ALERT — the arrow has left the track it was on. */
export function DriftIcon({ size = 18, color }: IconProps) {
  return (
    <svg {...frame(size, color)} className="agenda-icon">
      <path className="agenda-icon-track" d="M3.5 18h17" opacity="0.35" />
      <path className="agenda-icon-draw" d="M4.5 14.5c4 0 6.5-1 9-4" />
      <path className="agenda-icon-arrow" d="M11 10h3.5v3.5" />
    </svg>
  );
}
