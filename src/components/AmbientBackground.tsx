// Fixed point set (viewBox 0-100) + the edges connecting them — deterministic,
// not random-per-render, so layout doesn't shift between mounts.
const CONSTELLATION_POINTS: [number, number][] = [
  [8, 15], [22, 40], [40, 12], [58, 30], [76, 10],
  [88, 38], [65, 55], [30, 65], [12, 78], [50, 85], [85, 82],
];
const CONSTELLATION_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [3, 6], [6, 7], [1, 7],
  [7, 8], [6, 9], [9, 10], [5, 6],
];

// Trionn.com research: thin animated lines connecting points across the
// viewport. Opt-in (Landing only) — SVG + CSS opacity breathing, no
// canvas/rAF, so it inherits the global prefers-reduced-motion collapse.
function Constellation({ theme }: { theme: "dark" | "light" }) {
  const stroke = theme === "light" ? "rgba(60,56,36,.14)" : "rgba(255,255,255,.10)";
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      {CONSTELLATION_EDGES.map(([a, b], i) => {
        const [x1, y1] = CONSTELLATION_POINTS[a];
        const [x2, y2] = CONSTELLATION_POINTS[b];
        return (
          <line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={stroke}
            strokeWidth={0.08}
            style={{ animation: `constellationBreathe ${6 + (i % 4)}s ease-in-out ${i * 0.3}s infinite` }}
          />
        );
      })}
    </svg>
  );
}

export default function AmbientBackground({
  theme,
  constellation = false,
}: {
  theme: "dark" | "light";
  constellation?: boolean;
}) {
  const grid = theme === "light" ? "rgba(60,56,36,.045)" : "rgba(255,255,255,.028)";
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
      {constellation && <Constellation theme={theme} />}
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
