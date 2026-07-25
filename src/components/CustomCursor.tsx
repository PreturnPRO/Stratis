import { useEffect, useRef } from "react";

export default function CustomCursor({
  calmZone,
  theme,
}: {
  calmZone: boolean;
  theme: "dark" | "light";
}) {
  const dotRef = useRef<HTMLDivElement>(null);
  const isTouch = typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches;

  useEffect(() => {
    if (isTouch) return;
    // A body-level inline `cursor: none` doesn't win against elements that set
    // their own `cursor: pointer` inline (buttons/links throughout the app) —
    // inline beats inline only by source order, and those get re-applied on
    // every render. A class + !important stylesheet rule always wins instead.
    document.body.classList.toggle("custom-cursor-active", !calmZone);
    return () => {
      document.body.classList.remove("custom-cursor-active");
    };
  }, [calmZone, isTouch]);

  useEffect(() => {
    if (isTouch || calmZone) return;
    const dot = dotRef.current;
    if (!dot) return;

    // Magnet set is static per page mount — query once instead of on every
    // mousemove (was the layout-thrash source: getBoundingClientRect forces
    // a synchronous reflow, and doing that per-magnet on every mousemove
    // event, unthrottled, tanked frame rate on DOM-heavy pages).
    const magnets = Array.from(document.querySelectorAll<HTMLElement>("[data-magnet]"));

    const MAGNET_STRENGTH = 0.12;
    const MAGNET_MAX_PULL = 10;
    const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

    let lastX = 0;
    let lastY = 0;
    let lastInteractive = false;
    let rafId = 0;

    const applyFrame = () => {
      rafId = 0;
      dot.style.transform = `translate(${lastX - 6}px, ${lastY - 6}px)`;

      for (const el of magnets) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = lastX - cx;
        const dy = lastY - cy;
        const dist = Math.hypot(dx, dy);
        // Pull zone shrunk to just past the element's own edge (not its full
        // width/height radius) so nearby magnets don't both engage at once,
        // and pull is capped so they can't overlap each other or drift far.
        if (dist < Math.max(rect.width, rect.height) * 0.55) {
          const tx = clamp(dx * MAGNET_STRENGTH, MAGNET_MAX_PULL);
          const ty = clamp(dy * MAGNET_STRENGTH, MAGNET_MAX_PULL);
          el.style.transform = `translate(${tx}px, ${ty}px)`;
        } else {
          el.style.transform = "translate(0,0)";
        }
      }
    };

    const onMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      const interactive = !!(e.target as HTMLElement).closest("a, button");
      if (interactive !== lastInteractive) {
        lastInteractive = interactive;
        dot.style.width = interactive ? "30px" : "12px";
        dot.style.height = interactive ? "30px" : "12px";
      }
      if (!rafId) rafId = requestAnimationFrame(applyFrame);
    };

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafId) cancelAnimationFrame(rafId);
      for (const el of magnets) el.style.transform = "translate(0,0)";
    };
  }, [isTouch, calmZone]);

  if (isTouch || calmZone) return null;

  const dotColor = theme === "light" ? "rgba(27,27,22,.9)" : "#8FAE6D";

  return (
    <div
      ref={dotRef}
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 12,
        height: 12,
        borderRadius: "50%",
        background: dotColor,
        outline: theme === "light" ? "1.5px solid rgba(255,255,255,.7)" : "none",
        mixBlendMode: theme === "light" ? "normal" : "exclusion",
        pointerEvents: "none",
        zIndex: 2000,
        transition: "width .18s ease, height .18s ease",
      }}
    />
  );
}
