import { useEffect, useRef } from "react";

// Fixed point set (viewBox 0-100) + edges — deterministic, not random-per-
// render, so layout doesn't shift between mounts. Biased toward the edges/
// corners, leaving the center-left column (where the hero text sits) clear.
const CONSTELLATION_POINTS: [number, number][] = [
  [4, 10], [8, 28], [6, 48], [10, 68], [5, 86],
  [22, 8], [18, 92],
  [38, 6], [34, 94],
  [56, 10], [52, 90],
  [70, 6], [66, 22], [72, 78], [68, 94],
  [84, 14], [90, 32], [86, 50], [92, 68], [88, 84],
  [98, 22], [97, 60],
];
const CONSTELLATION_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 7], [7, 9], [9, 11],
  [11, 12], [12, 15], [15, 16], [16, 17], [17, 18], [18, 19],
  [4, 6], [6, 8], [8, 10], [10, 13], [13, 14], [14, 19],
  [16, 20], [18, 21], [12, 20],
];

// Points safe for a coordinate readout label — away from the hero text
// column and from each other.
const COORD_POINT_INDICES = [16, 19, 7];

function formatCoord(x: number, y: number): string {
  // Cosmetic only — not real geolocation, just decorative HUD flavor tied to
  // the point's own position in the viewBox.
  const lat = (18 + y * 0.09).toFixed(4);
  const lon = (98 + x * 0.02).toFixed(4);
  return `${lat}° N, ${lon}° E`;
}

// Trionn.com research: thin animated lines connecting glowing points across
// the viewport, with a subtle mouse-parallax tilt. SVG + CSS + a throttled
// mousemove transform (no rAF loop) — inherits the global
// prefers-reduced-motion collapse for the breathe animation; the parallax
// itself is JS-driven so it's explicitly guarded by reducedMotion.
function Constellation({ theme, reducedMotion }: { theme: "dark" | "light"; reducedMotion: boolean }) {
  const groupRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2; // -1..1
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      groupRef.current?.style.setProperty("transform", `translate(${nx * -1.4}px, ${ny * -1}px)`);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reducedMotion]);

  const stroke = theme === "light" ? "rgba(60,56,36,.16)" : "rgba(255,255,255,.13)";
  const dot = theme === "light" ? "rgba(84,113,58,.55)" : "rgba(143,174,109,.75)";
  const dotHalo = theme === "light" ? "rgba(84,113,58,.18)" : "rgba(143,174,109,.22)";
  const coordColor = theme === "light" ? "rgba(60,56,36,.5)" : "rgba(255,255,255,.42)";

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
    >
      <g ref={groupRef} style={{ transition: "transform 0.6s ease-out" }}>
        {CONSTELLATION_EDGES.map(([a, b], i) => {
          const [x1, y1] = CONSTELLATION_POINTS[a];
          const [x2, y2] = CONSTELLATION_POINTS[b];
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={stroke}
              strokeWidth={0.08}
              style={{ animation: `constellationBreathe ${6 + (i % 4)}s ease-in-out ${i * 0.25}s infinite` }}
            />
          );
        })}
        {CONSTELLATION_POINTS.map(([x, y], i) => (
          <g
            key={i}
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              animation: `constellationGlow ${5 + (i % 5)}s ease-in-out ${i * 0.2}s infinite`,
            }}
          >
            <circle cx={x} cy={y} r={1.4} fill={dotHalo} />
            <circle cx={x} cy={y} r={0.35} fill={dot} />
          </g>
        ))}
        {COORD_POINT_INDICES.map((idx, i) => {
          const [x, y] = CONSTELLATION_POINTS[idx];
          const r = 1.1;
          const tick = 0.4;
          return (
            <g key={i}>
              {/* targeting-reticle corner brackets around the source point */}
              <path d={`M${x - r},${y - r + tick} L${x - r},${y - r} L${x - r + tick},${y - r}`} stroke={coordColor} strokeWidth={0.09} fill="none" />
              <path d={`M${x + r - tick},${y - r} L${x + r},${y - r} L${x + r},${y - r + tick}`} stroke={coordColor} strokeWidth={0.09} fill="none" />
              <path d={`M${x - r},${y + r - tick} L${x - r},${y + r} L${x - r + tick},${y + r}`} stroke={coordColor} strokeWidth={0.09} fill="none" />
              <path d={`M${x + r - tick},${y + r} L${x + r},${y + r} L${x + r},${y + r - tick}`} stroke={coordColor} strokeWidth={0.09} fill="none" />
              {/* leader line from reticle to label */}
              <line x1={x + r} y1={y - r} x2={x + r + 0.9} y2={y - r - 0.9} stroke={coordColor} strokeWidth={0.08} />
              <text
                x={x + r + 1.1}
                y={y - r - 0.9}
                fontSize={1.1}
                fontFamily="'SF Mono', ui-monospace, Menlo, monospace"
                fill={coordColor}
              >
                {formatCoord(x, y)}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// Light theme has no dark backdrop for glowing lines to read against, so it
// gets a different subtle texture instead: a soft dot-matrix (a step down
// from the linear grid, evoking paper/blueprint rather than "space").
function DotMatrix() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "radial-gradient(rgba(60,56,36,.10) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
      }}
    />
  );
}

export default function AmbientBackground({
  theme,
  constellation = false,
  reducedMotion = false,
}: {
  theme: "dark" | "light";
  constellation?: boolean;
  reducedMotion?: boolean;
}) {
  const grid = theme === "light" ? "rgba(60,56,36,.02)" : "rgba(255,255,255,.014)";
  const glow = theme === "light" ? "rgba(84,113,58,.10)" : "rgba(143,174,109,.10)";
  const glow2 = theme === "light" ? "rgba(23,127,156,.06)" : "rgba(42,179,212,.06)";
  const bg = theme === "light" ? "#f6f4ee" : "#09090b";

  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
          backgroundSize: "52px 52px",
          animation: "ambGridDrift 14s linear infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "-10%",
          right: "-10%",
          width: "70vw",
          height: "70vw",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
          filter: "blur(20px)",
          animation: "ambA 22s ease-in-out infinite alternate",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          left: "-10%",
          width: "60vw",
          height: "60vw",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glow2} 0%, transparent 65%)`,
          filter: "blur(24px)",
          animation: "ambB 28s ease-in-out infinite alternate",
        }}
      />
      {constellation && (theme === "light" ? <DotMatrix /> : <Constellation theme={theme} reducedMotion={reducedMotion} />)}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 40%, transparent 40%, ${bg} 100%)`,
        }}
      />
    </div>
  );
}
