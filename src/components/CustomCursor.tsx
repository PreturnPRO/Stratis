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
    document.body.style.cursor = calmZone ? "auto" : "none";
    return () => {
      document.body.style.cursor = "auto";
    };
  }, [calmZone, isTouch]);

  useEffect(() => {
    if (isTouch || calmZone) return;
    const dot = dotRef.current;
    if (!dot) return;

    const onMove = (e: MouseEvent) => {
      dot.style.transform = `translate(${e.clientX - 6}px, ${e.clientY - 6}px)`;
      const target = e.target as HTMLElement;
      const interactive = target.closest("a, button");
      dot.style.width = interactive ? "30px" : "12px";
      dot.style.height = interactive ? "30px" : "12px";
    };

    const magnets = () => Array.from(document.querySelectorAll<HTMLElement>("[data-magnet]"));
    const onMagnetMove = (e: MouseEvent) => {
      for (const el of magnets()) {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < Math.max(rect.width, rect.height)) {
          el.style.transform = `translate(${dx * 0.2}px, ${dy * 0.2}px)`;
        } else {
          el.style.transform = "translate(0,0)";
        }
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousemove", onMagnetMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousemove", onMagnetMove);
      for (const el of magnets()) el.style.transform = "translate(0,0)";
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
