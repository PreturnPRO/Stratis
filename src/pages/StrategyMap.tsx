import { COLORS, INITIAL_NODES, ARROWS } from "../constants";
import { btnAccent, btnGhost, tagStyle } from "../components/ui";
import { useDraggableNodes, NodePosition } from "../hooks/useDraggableNodes";

// Compute arrow endpoints from node centers
function getArrowPoints(nodes: NodePosition[], arrow: { from: string; to: string; label?: string; dashed?: boolean }) {
  const from = nodes.find((n: NodePosition) => n.id === arrow.from);
  const to   = nodes.find((n: NodePosition) => n.id === arrow.to);
  if (!from || !to) return null;

  // Exit from right edge of source, enter left edge of target
  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;

  // Bezier control points for a smooth curve
  const cx1 = x1 + (x2 - x1) * 0.5;
  const cy1 = y1;
  const cx2 = x1 + (x2 - x1) * 0.5;
  const cy2 = y2;

  return { x1, y1, x2, y2, cx1, cy1, cx2, cy2, midX: (x1 + x2) / 2, midY: (y1 + y2) / 2 };
}

export default function StrategyMap() {
  const { nodes, pan, onNodeMouseDown, onCanvasMouseDown, resetLayout } = useDraggableNodes(INITIAL_NODES);

  // Canvas size (large enough for all nodes + drag room)
  const canvasW = 1600;
  const canvasH = 900;

  return (
    <div style={{ position: "relative", flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Top bar */}
      <div style={{
        position: "absolute", top: 12, left: 12, zIndex: 5,
        display: "flex", gap: 8, alignItems: "center",
      }}>
        <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Pricing v2</span>
        <span style={{ color: COLORS.textDim }}>/</span>
        <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Strategy map</span>
      </div>

      <div style={{
        position: "absolute", top: 12, right: 12, zIndex: 5,
        display: "flex", gap: 8, alignItems: "center",
      }}>
        <button style={btnGhost()} onClick={resetLayout} title="Reset layout">⊕ Reset</button>
        <button style={btnGhost()}>⚌</button>
        <button style={btnGhost()}>▶</button>
        <button style={btnAccent()}>+ Add node</button>
      </div>

      {/* Scrollable canvas */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          cursor: "grab",
          userSelect: "none",
          position: "relative",
        }}
        onMouseDown={onCanvasMouseDown}
      >
        {/* Inner panning layer */}
        <div style={{
          position: "absolute",
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          width: canvasW,
          height: canvasH,
        }}>

          {/* SVG arrows — rendered BELOW nodes */}
          <svg
            style={{ position: "absolute", inset: 0, width: canvasW, height: canvasH, pointerEvents: "none", overflow: "visible" }}
          >
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L7,3 L0,6" fill="none" stroke={COLORS.textDim} strokeWidth="1.2" />
              </marker>
            </defs>

            {ARROWS.map((arrow: { from: string; to: string; label?: string; dashed?: boolean }, i: number) => {
              const pts = getArrowPoints(nodes, arrow);
              if (!pts) return null;
              const { x1, y1, x2, y2, cx1, cy1, cx2, cy2, midX, midY } = pts;
              return (
                <g key={i}>
                  <path
                    d={`M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`}
                    fill="none"
                    stroke={COLORS.textDim}
                    strokeWidth={1.2}
                    strokeDasharray={arrow.dashed ? "5,4" : undefined}
                    markerEnd="url(#arrowhead)"
                  />
                  {arrow.label && (
                    <text x={midX} y={midY - 7} fill={COLORS.textDim} fontSize="10" textAnchor="middle">
                      {arrow.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Draggable nodes */}
          {nodes.map((node: NodePosition) => (
            <div
              key={node.id}
              style={{
                position: "absolute",
                left: node.x,
                top: node.y,
                width: node.w,
                height: node.h,
                background: COLORS.surface,
                border: `1.5px solid ${node.borderColor}`,
                borderRadius: 8,
                padding: "10px 12px",
                boxShadow: node.glow ? `0 0 14px ${node.borderColor}33` : "none",
                cursor: "grab",
                boxSizing: "border-box",
                transition: "box-shadow 0.15s",
              }}
              onMouseDown={(e) => onNodeMouseDown(e, node.id)}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 18px ${node.borderColor}55`; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = node.glow ? `0 0 14px ${node.borderColor}33` : "none"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ color: COLORS.text, fontSize: 13, flex: 1, lineHeight: 1.4 }}>
                  {node.label}
                </span>
                <span style={{ color: COLORS.textMuted, fontSize: 11, marginLeft: 8, flexShrink: 0 }}>
                  {node.age}
                </span>
              </div>
              {node.tag && (
                <div style={{ marginTop: 6 }}>
                  <span style={tagStyle(node.tag.color)}>{node.tag.label}</span>
                </div>
              )}
              {node.tags && (
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {node.tags!.map((t: { label: string; color: string }, i: number) => (
                    <span key={i} style={tagStyle(t.color)}>{t.label}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom status bar */}
      <div style={{
        background: COLORS.surface,
        borderTop: `1px solid ${COLORS.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["All", "Decisions", "Risks", "Assumptions", "Exec", "Standard", "Deep"].map((f, i) => (
            <button key={f} style={{
              ...btnGhost(),
              padding: "4px 10px", fontSize: 12,
              background: i === 5 ? COLORS.borderLight : "transparent",
              color: i === 5 ? COLORS.text : COLORS.textMuted,
            }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 12, color: COLORS.textMuted }}>
          <span>VELOCITY <span style={{ color: COLORS.red }}>Stalled</span></span>
          <span>DEBATE LOOPS <span style={{ color: COLORS.text }}>3</span></span>
          <span>BLOCKERS <span style={{ color: COLORS.text }}>2</span></span>
          <span>AI PREDICTION <span style={{ color: COLORS.red }}>-14d delay</span></span>
        </div>
      </div>

      {/* Change banner */}
      <div style={{
        position: "absolute", top: 60, left: "50%", transform: "translateX(-50%)",
        background: COLORS.surfaceHover,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20, padding: "6px 16px", fontSize: 13,
        color: COLORS.text, display: "flex", gap: 8, alignItems: "center",
        zIndex: 5, pointerEvents: "none",
      }}>
        <strong style={{ color: COLORS.accent }}>2 changes</strong> since your last visit
      </div>

      {/* Drag hint */}
      <div style={{
        position: "absolute", bottom: 60, right: 16,
        fontSize: 11, color: COLORS.textDim,
        background: COLORS.surface, border: `1px solid ${COLORS.border}`,
        borderRadius: 6, padding: "4px 10px",
        pointerEvents: "none",
      }}>
        drag nodes · pan canvas
      </div>
    </div>
  );
}
