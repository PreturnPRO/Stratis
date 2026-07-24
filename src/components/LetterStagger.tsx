import { useState } from "react";

// Per-letter hover stagger — trionn.com wraps every nav link in per-letter
// spans and rolls them individually on hover. Same mechanic as RollingText's
// two-line roll, applied per character with an incrementing transition delay.
export default function LetterStagger({
  text,
  accentColor,
}: {
  text: string;
  accentColor?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const chars = text.split("");

  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "inline-flex" }}
    >
      {chars.map((ch, i) => (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", height: "1.2em", verticalAlign: "top" }}>
          <span
            style={{
              display: "block",
              transition: `transform .32s cubic-bezier(.76,0,.24,1) ${i * 0.02}s`,
              transform: hovered ? "translateY(-1.2em)" : "translateY(0)",
            }}
          >
            <span style={{ display: "block", height: "1.2em", lineHeight: "1.2em" }}>
              {ch === " " ? " " : ch}
            </span>
            <span style={{ display: "block", height: "1.2em", lineHeight: "1.2em", color: accentColor }}>
              {ch === " " ? " " : ch}
            </span>
          </span>
        </span>
      ))}
    </span>
  );
}
