import { useState, useEffect } from "react";
import { COLORS } from "../constants";

export default function MeetingTransition({ onDone }) {
  const [phase, setPhase] = useState("enter");
  const [color, setColor] = useState("#ffffff");

  useEffect(() => {
    const t1 = setTimeout(() => setColor(COLORS.accent), 200);
    const t2 = setTimeout(() => setPhase("exit"), 1400);
    const t3 = setTimeout(() => onDone(), 2000);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [onDone]);

  return (
    <div style={{
      position: "absolute", inset: 0,
      background: COLORS.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: "8vw", overflow: "hidden",
      opacity: phase === "exit" ? 0 : 1,
      transition: phase === "exit" ? "opacity 0.5s ease" : "none",
      zIndex: 10,
    }}>
      {["left", "right"].map((dir) => (
        <div
          key={dir}
          style={{
            fontFamily: "'Arial Black', 'Impact', sans-serif",
            fontWeight: 900,
            fontSize: "clamp(60px, 10vw, 120px)",
            letterSpacing: "-2px",
            color,
            transition: "color 0.6s ease",
            animation: `slideIn${dir === "left" ? "Left" : "Right"} 0.4s cubic-bezier(0.22,1,0.36,1) forwards`,
          }}
        >
          MEETING
        </div>
      ))}

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-120%); }
          to   { transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { transform: translateX(120%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
