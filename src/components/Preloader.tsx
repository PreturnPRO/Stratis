import { useEffect, useState } from "react";

const SESSION_KEY = "stratis-preloaded";
const COUNT_MS = 1400;
const HOLD_MS = 250;
const EXIT_MS = 600;

export default function Preloader({
  onDone,
  theme,
}: {
  onDone: () => void;
  theme: "dark" | "light";
}) {
  const alreadyPreloaded = typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1";
  const [count, setCount] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [done, setDone] = useState(alreadyPreloaded);

  useEffect(() => {
    if (alreadyPreloaded) return;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const pct = Math.min(100, Math.round((elapsed / COUNT_MS) * 100));
      setCount(pct);
      if (pct < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        setTimeout(() => setExiting(true), HOLD_MS);
        setTimeout(() => {
          sessionStorage.setItem(SESSION_KEY, "1");
          setDone(true);
          onDone();
        }, HOLD_MS + EXIT_MS);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (alreadyPreloaded) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) return null;

  const curtainBg = theme === "light" ? "#181813" : "#0c0c0e";
  const accent = theme === "light" ? "#54713a" : "#8FAE6D";
  const curtainText = theme === "light" ? "#f4f2ea" : "#f2f2f3";

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        background: curtainBg,
        zIndex: 1000,
        transform: exiting ? "translateY(-135vh)" : "translateY(0)",
        transition: exiting ? "transform 0.6s cubic-bezier(.76,0,.24,1)" : "none",
        pointerEvents: "none",
      }}
    >
      <div style={{ position: "absolute", left: "12vw", right: "12vw", top: "16vh", height: "100vh" }}>
        <div style={{ color: accent, fontSize: 14, fontWeight: 700, letterSpacing: 4, textAlign: "center" }}>
          STRATIS
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: "4vw",
          bottom: "6vh",
          fontFamily: "'SF Mono','JetBrains Mono',ui-monospace,Menlo,monospace",
          fontSize: "clamp(56px,9vw,120px)",
          fontVariantNumeric: "tabular-nums",
          color: curtainText,
        }}
      >
        {count}
      </div>
      <div
        style={{
          position: "absolute",
          left: "4vw",
          bottom: "6vh",
          fontFamily: "'SF Mono','JetBrains Mono',ui-monospace,Menlo,monospace",
          fontSize: 11,
          letterSpacing: 3,
          color: accent,
          textTransform: "uppercase",
        }}
      >
        LOADING WORKSPACE
      </div>
    </div>
  );
}
