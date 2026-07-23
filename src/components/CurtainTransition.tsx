import { useEffect, useRef } from "react";

export type CurtainState = "idle" | "in" | "hold" | "out";

const SWEEP = "cubic-bezier(.76,0,.24,1)";

export default function CurtainTransition({
  state,
  routeLabel,
  onMidpoint,
  theme,
}: {
  state: CurtainState;
  routeLabel: string;
  onMidpoint: () => void;
  theme: "dark" | "light";
}) {
  const firedMidpoint = useRef(false);

  useEffect(() => {
    if (state === "in" && !firedMidpoint.current) {
      firedMidpoint.current = true;
      const t = setTimeout(onMidpoint, 480);
      return () => clearTimeout(t);
    }
    if (state === "idle") firedMidpoint.current = false;
  }, [state, onMidpoint]);

  if (state === "idle") return null;

  const translateY = state === "in" || state === "hold" ? "0" : state === "out" ? "-135vh" : "135vh";
  const duration = state === "in" ? "0.48s" : state === "out" ? "0.6s" : "0s";
  const curtainBg = theme === "light" ? "#181813" : "#0c0c0e";
  const curtainText = theme === "light" ? "#f4f2ea" : "#f2f2f3";
  const accent = theme === "light" ? "#54713a" : "#8FAE6D";

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: "-12vw",
        right: "-12vw",
        top: "-16vh",
        height: "132vh",
        background: curtainBg,
        borderRadius: "50% / 7vh",
        zIndex: 500,
        pointerEvents: "none",
        transform: `translateY(${translateY})`,
        transition: `transform ${duration} ${SWEEP}`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "12vw",
          right: "12vw",
          top: "16vh",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          opacity: state === "in" || state === "hold" ? 1 : 0,
          transition: "opacity 0.2s ease",
        }}
      >
        <div style={{ color: accent, fontSize: 14, fontWeight: 700, letterSpacing: 4 }}>STRATIS</div>
        <div style={{ fontSize: "clamp(18px,2.4vw,30px)", fontWeight: 600, color: curtainText, textAlign: "center" }}>
          The meeting runs itself.{" "}
          <span style={{ color: accent }}>The record writes itself.</span>
        </div>
        <div
          style={{
            fontFamily: "'SF Mono','JetBrains Mono',ui-monospace,Menlo,monospace",
            fontSize: 11,
            letterSpacing: 3,
            color: curtainText,
            opacity: 0.7,
            textTransform: "uppercase",
          }}
        >
          {routeLabel}
        </div>
      </div>
    </div>
  );
}
