import { COLORS, PROJECTS } from "../constants";
import { btnAccent, btnGhost } from "../components/ui";

export default function Projects() {
  return (
    <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 500, margin: 0 }}>All projects</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnGhost()}>⚌</button>
          <button style={btnAccent()}>+ New project</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {PROJECTS.map((p) => (
          <div
            key={p.id}
            style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: "20px 22px",
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = COLORS.borderLight)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = COLORS.border)}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, marginTop: 2 }} />
                <span style={{ color: COLORS.text, fontWeight: 500, fontSize: 15 }}>{p.name}</span>
              </div>
              <span style={{ color: COLORS.textMuted, fontSize: 13 }}>↗</span>
            </div>

            <div style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 10, paddingLeft: 16 }}>
              {p.owner} · {p.status}
            </div>

            <div style={{ display: "flex", gap: 16, paddingLeft: 16, marginBottom: 12 }}>
              {[["decisions", p.decisions], ["assumptions", p.assumptions], ["risks", p.risks]].map(([k, v]) => (
                <span key={k} style={{ color: COLORS.textMuted, fontSize: 12 }}>
                  <span style={{ color: COLORS.textDim }}>{v}</span> {k}
                </span>
              ))}
            </div>

            {p.last && (
              <div style={{ paddingLeft: 16, fontSize: 12, color: COLORS.cyan }}>
                Last: {p.last}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
