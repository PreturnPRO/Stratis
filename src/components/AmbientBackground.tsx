import { useEffect, useRef, useState } from "react";

// Live constellation simulation: points spawn, drift, connect, and fade over
// time. Positions/opacity are written straight to DOM refs every animation
// frame (no React state per-frame) so drift is always in sync with the lines
// that follow it — a React re-render can never "snap" a point back to a
// stale position. React state only bumps on structural changes (a point
// spawning or fading out), which is when the SVG actually needs new
// <line>/<g> elements.

interface Point {
  id: number;
  x: number;
  y: number;
  anchor: boolean; // anchors never fade/despawn — carry the coordinate labels
  bornAt: number;
  lifetime: number; // ms until fade begins (Infinity for anchors)
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
}

interface Edge {
  key: string;
  a: number;
  b: number;
}

const BOUNDS = { minX: 2, maxX: 98, minY: 4, maxY: 96 };
// Keep the center-left column (hero text) clear of spawns.
const TEXT_EXCLUSION = { minX: 0, maxX: 46, minY: 20, maxY: 78 };

const MIN_POINTS = 16;
const MAX_POINTS = 24;
const SPAWN_MIN_MS = 3000;
const SPAWN_MAX_MS = 7000;
const LIFETIME_MIN_MS = 26000;
const LIFETIME_MAX_MS = 48000;
const FADE_MS = 2600;
const SPAWN_FADE_MS = 1000;
const CANDIDATE_SAMPLES = 14;
const MIN_SPACING = 7;
const DRIFT_AMP = 0.55;
const MAX_CROSSINGS_PER_EDGE = 1;

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return idCounter;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function inTextExclusion(x: number, y: number) {
  return (
    x >= TEXT_EXCLUSION.minX &&
    x <= TEXT_EXCLUSION.maxX &&
    y >= TEXT_EXCLUSION.minY &&
    y <= TEXT_EXCLUSION.maxY
  );
}

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

// Orientation-based segment intersection (excludes shared endpoints).
function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

function edgeSegment(byId: Map<number, Point>, e: Edge) {
  const a = byId.get(e.a);
  const b = byId.get(e.b);
  if (!a || !b) return null;
  return { ax: a.x, ay: a.y, bx: b.x, by: b.y };
}

// How many times an existing edge is currently crossed by other edges.
function edgeCrossings(byId: Map<number, Point>, edges: Edge[], edge: Edge): number {
  const seg = edgeSegment(byId, edge);
  if (!seg) return 0;
  let count = 0;
  for (const other of edges) {
    if (other.key === edge.key) continue;
    if (other.a === edge.a || other.a === edge.b || other.b === edge.a || other.b === edge.b) continue;
    const oseg = edgeSegment(byId, other);
    if (!oseg) continue;
    if (segmentsIntersect(seg.ax, seg.ay, seg.bx, seg.by, oseg.ax, oseg.ay, oseg.bx, oseg.by)) count += 1;
  }
  return count;
}

// A candidate edge is only allowed if: (1) it crosses at most one existing
// edge, and (2) that existing edge hasn't already been crossed once itself
// — "a single line can only be passed through one time," enforced on both
// sides of the crossing.
function canConnect(byId: Map<number, Point>, edges: Edge[], aId: number, bId: number): boolean {
  const a = byId.get(aId);
  const b = byId.get(bId);
  if (!a || !b) return false;
  const crossed: Edge[] = [];
  for (const e of edges) {
    if (e.a === aId || e.a === bId || e.b === aId || e.b === bId) continue;
    const seg = edgeSegment(byId, e);
    if (!seg) continue;
    if (segmentsIntersect(a.x, a.y, b.x, b.y, seg.ax, seg.ay, seg.bx, seg.by)) crossed.push(e);
  }
  if (crossed.length > MAX_CROSSINGS_PER_EDGE) return false;
  for (const e of crossed) {
    if (edgeCrossings(byId, edges, e) >= MAX_CROSSINGS_PER_EDGE) return false;
  }
  return true;
}

// Sample random candidates, reject anything too close to an existing point,
// then pick the candidate whose nearest neighbor is FARTHEST away — i.e.
// bias spawns toward the sparsest region of the field.
function pickSpawnPosition(points: Point[]): { x: number; y: number } | null {
  let best: { x: number; y: number; score: number } | null = null;
  for (let i = 0; i < CANDIDATE_SAMPLES; i++) {
    const x = rand(BOUNDS.minX, BOUNDS.maxX);
    const y = rand(BOUNDS.minY, BOUNDS.maxY);
    if (inTextExclusion(x, y)) continue;
    let minDist = Infinity;
    let tooClose = false;
    for (const p of points) {
      const d = dist(x, y, p.x, p.y);
      if (d < MIN_SPACING) { tooClose = true; break; }
      if (d < minDist) minDist = d;
    }
    if (tooClose) continue;
    if (!best || minDist > best.score) best = { x, y, score: minDist };
  }
  return best;
}

function seedPoints(): Point[] {
  // Anchors: fixed, never fade, carry coordinate-readout labels.
  const anchors: [number, number][] = [
    [84, 14], [88, 84], [22, 8],
  ];
  const rest: [number, number][] = [
    [8, 28], [6, 48], [10, 68], [5, 86],
    [18, 92], [38, 6], [34, 94],
    [56, 10], [52, 90], [70, 6], [66, 22], [72, 78], [68, 94],
    [90, 32], [86, 50], [92, 68],
    [64, 42], [78, 46], [62, 64], [82, 58],
  ];
  const points: Point[] = anchors.map(([x, y]) => ({
    id: nextId(), x, y, anchor: true, bornAt: 0, lifetime: Infinity,
    freqX: rand(0.05, 0.09), freqY: rand(0.05, 0.09),
    phaseX: rand(0, Math.PI * 2), phaseY: rand(0, Math.PI * 2),
  }));
  // Stagger birth times so seeded points don't all expire in the same
  // window — without this the whole non-anchor field dies at once ~30s in.
  rest.forEach(([x, y], i) => {
    points.push({
      id: nextId(), x, y, anchor: false,
      bornAt: -i * 1200,
      lifetime: rand(LIFETIME_MIN_MS, LIFETIME_MAX_MS),
      freqX: rand(0.05, 0.09), freqY: rand(0.05, 0.09),
      phaseX: rand(0, Math.PI * 2), phaseY: rand(0, Math.PI * 2),
    });
  });
  return points;
}

function seedEdges(points: Point[]): Edge[] {
  const byId = new Map(points.map((p) => [p.id, p]));
  const edges: Edge[] = [];
  for (const p of points) {
    const others = points
      .filter((o) => o.id !== p.id)
      .sort((x, y) => dist(p.x, p.y, x.x, x.y) - dist(p.x, p.y, y.x, y.y))
      .slice(0, 2);
    for (const o of others) {
      if (edges.some((e) => (e.a === p.id && e.b === o.id) || (e.a === o.id && e.b === p.id))) continue;
      if (!canConnect(byId, edges, p.id, o.id)) continue;
      edges.push({ key: `${p.id}-${o.id}`, a: p.id, b: o.id });
    }
  }
  return edges;
}

function formatCoord(x: number, y: number): string {
  const lat = (18 + y * 0.09).toFixed(4);
  const lon = (98 + x * 0.02).toFixed(4);
  return `${lat}° N, ${lon}° E`;
}

function Constellation({ theme, reducedMotion }: { theme: "dark" | "light"; reducedMotion: boolean }) {
  const groupRef = useRef<SVGGElement>(null);
  const pointsRef = useRef<Point[]>(seedPoints());
  const edgesRef = useRef<Edge[]>(seedEdges(pointsRef.current));
  const nextSpawnAtRef = useRef(rand(SPAWN_MIN_MS, SPAWN_MAX_MS));
  const pointEls = useRef(new Map<number, SVGGElement>());
  const lineEls = useRef(new Map<string, SVGLineElement>());
  const [, bump] = useState(0);

  // Mouse parallax on the whole group — unchanged from before.
  useEffect(() => {
    if (reducedMotion) return;
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      groupRef.current?.style.setProperty("transform", `translate(${nx * -1.4}px, ${ny * -1}px)`);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reducedMotion]);

  useEffect(() => {
    let raf = 0;
    let running = true;
    let last = performance.now();
    let elapsed = 0;

    const trySpawn = () => {
      const points = pointsRef.current;
      if (points.length >= MAX_POINTS) return;
      const pos = pickSpawnPosition(points);
      if (!pos) return;
      const point: Point = {
        id: nextId(), x: pos.x, y: pos.y, anchor: false,
        bornAt: elapsed, lifetime: rand(LIFETIME_MIN_MS, LIFETIME_MAX_MS),
        freqX: rand(0.05, 0.09), freqY: rand(0.05, 0.09),
        phaseX: rand(0, Math.PI * 2), phaseY: rand(0, Math.PI * 2),
      };
      const byId = new Map(points.map((p) => [p.id, p]));
      byId.set(point.id, point);
      const candidates = points
        .slice()
        .sort((a, b) => dist(point.x, point.y, a.x, a.y) - dist(point.x, point.y, b.x, b.y));
      const newEdges: Edge[] = [];
      for (const c of candidates) {
        if (newEdges.length >= 2) break;
        if (!canConnect(byId, [...edgesRef.current, ...newEdges], point.id, c.id)) continue;
        newEdges.push({ key: `${point.id}-${c.id}`, a: point.id, b: c.id });
      }
      if (newEdges.length === 0) return; // no orphan dots — must join the graph
      edgesRef.current = [...edgesRef.current, ...newEdges];
      pointsRef.current = [...points, point];
      bump((t) => t + 1);
    };

    const removeStale = () => {
      const points = pointsRef.current;
      const alive = points.filter((p) => p.anchor || elapsed - p.bornAt < p.lifetime + FADE_MS);
      // Never cull below the floor — let a slow spawn cadence catch up first.
      if (alive.length !== points.length && alive.length >= MIN_POINTS) {
        const aliveIds = new Set(alive.map((p) => p.id));
        edgesRef.current = edgesRef.current.filter((e) => aliveIds.has(e.a) && aliveIds.has(e.b));
        pointsRef.current = alive;
        bump((t) => t + 1);
      }
    };

    const tick = (now: number) => {
      if (!running) return;
      const dt = now - last;
      last = now;
      elapsed += dt;

      if (!reducedMotion) {
        nextSpawnAtRef.current -= dt;
        if (nextSpawnAtRef.current <= 0) {
          trySpawn();
          nextSpawnAtRef.current = rand(SPAWN_MIN_MS, SPAWN_MAX_MS);
        }
        removeStale();
      }

      const drifted = new Map<number, { x: number; y: number }>();
      for (const p of pointsRef.current) {
        const age = elapsed - p.bornAt;
        let opacity = 1;
        if (!p.anchor) {
          if (age < SPAWN_FADE_MS) opacity = Math.max(0, age / SPAWN_FADE_MS);
          else if (age > p.lifetime) opacity = Math.max(0, 1 - (age - p.lifetime) / FADE_MS);
        }
        const t = elapsed / 1000;
        const dx = reducedMotion ? 0 : Math.sin(t * p.freqX + p.phaseX) * DRIFT_AMP;
        const dy = reducedMotion ? 0 : Math.cos(t * p.freqY + p.phaseY) * DRIFT_AMP;
        const x = p.x + dx;
        const y = p.y + dy;
        drifted.set(p.id, { x, y });

        const g = pointEls.current.get(p.id);
        if (g) {
          g.setAttribute("transform", `translate(${x}, ${y})`);
          g.style.opacity = String(opacity);
        }
      }

      for (const e of edgesRef.current) {
        const a = drifted.get(e.a);
        const b = drifted.get(e.b);
        const line = lineEls.current.get(e.key);
        if (a && b && line) {
          line.setAttribute("x1", String(a.x));
          line.setAttribute("y1", String(a.y));
          line.setAttribute("x2", String(b.x));
          line.setAttribute("y2", String(b.y));
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  const stroke = theme === "light" ? "rgba(60,56,36,.16)" : "rgba(255,255,255,.13)";
  const dot = theme === "light" ? "rgba(84,113,58,.55)" : "rgba(143,174,109,.75)";
  const dotHalo = theme === "light" ? "rgba(84,113,58,.18)" : "rgba(143,174,109,.22)";
  const coordColor = theme === "light" ? "rgba(60,56,36,.5)" : "rgba(255,255,255,.42)";

  // Only re-renders on structural changes (spawn/fade-removal) — per-frame
  // motion is written directly to the DOM refs above.
  const points = pointsRef.current;
  const edges = edgesRef.current;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
    >
      <g ref={groupRef} style={{ transition: "transform 0.6s ease-out" }}>
        {edges.map((e, i) => (
          <line
            key={e.key}
            ref={(el) => {
              if (el) lineEls.current.set(e.key, el);
              else lineEls.current.delete(e.key);
            }}
            x1={0} y1={0} x2={0} y2={0}
            stroke={stroke}
            strokeWidth={0.08}
            style={{ animation: `constellationBreathe ${6 + (i % 4)}s ease-in-out ${i * 0.25}s infinite` }}
          />
        ))}
        {points.map((p, i) => {
          const r = 1.1;
          const tick = 0.4;
          return (
            <g
              key={p.id}
              ref={(el) => {
                if (el) pointEls.current.set(p.id, el);
                else pointEls.current.delete(p.id);
              }}
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            >
              <g
                style={{
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  animation: reducedMotion ? undefined : `constellationGlow ${5 + (i % 5)}s ease-in-out ${i * 0.2}s infinite`,
                }}
              >
                <circle cx={0} cy={0} r={1.4} fill={dotHalo} />
                <circle cx={0} cy={0} r={0.35} fill={dot} />
              </g>
              {/* Reticle + coord label live in the same drifting group as the
                  dot, so they track it instead of staying pinned to the
                  point's original static coordinates. */}
              {p.anchor && (
                <>
                  <path d={`M${-r},${-r + tick} L${-r},${-r} L${-r + tick},${-r}`} stroke={coordColor} strokeWidth={0.09} fill="none" />
                  <path d={`M${r - tick},${-r} L${r},${-r} L${r},${-r + tick}`} stroke={coordColor} strokeWidth={0.09} fill="none" />
                  <path d={`M${-r},${r - tick} L${-r},${r} L${-r + tick},${r}`} stroke={coordColor} strokeWidth={0.09} fill="none" />
                  <path d={`M${r - tick},${r} L${r},${r} L${r},${r - tick}`} stroke={coordColor} strokeWidth={0.09} fill="none" />
                  <line x1={r} y1={-r} x2={r + 0.9} y2={-r - 0.9} stroke={coordColor} strokeWidth={0.08} />
                  <text
                    x={r + 1.1}
                    y={-r - 0.9}
                    fontSize={1.1}
                    fontFamily="'SF Mono', ui-monospace, Menlo, monospace"
                    fill={coordColor}
                  >
                    {formatCoord(p.x, p.y)}
                  </text>
                </>
              )}
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
