import { COLORS, SIGNALS } from "../constants";
import { btnGhost } from "../components/ui";

const tagColors: Record<string, string> = {
  historical: "#1a9fc0",
  signal:     "#1a8c6e",
  risk:       "#c0392b",
  doc:        "#444444",
};

export default function Inbox() {
  return (
    <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 500, margin: 0 }}>Signals inbox</h1>
        <button style={btnGhost()}>✓ Mark all read</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SIGNALS.map((s, i) => (
          <div
            key={i}
            style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 8,
              padding: "14px 18px",
              cursor: "pointer",
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = COLORS.borderLight)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = COLORS.border)}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              background: s.iconBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600, color: "#aaa", flexShrink: 0,
            }}>
              {s.icon}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ color: COLORS.text, fontSize: 14, fontWeight: s.unread ? 500 : 400 }}>
                  {s.title}
                </span>
                {s.unread && (
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.red, flexShrink: 0 }} />
                )}
              </div>

              <p style={{ color: COLORS.textMuted, fontSize: 12, margin: "0 0 8px", lineHeight: 1.5 }}>
                {s.desc}
              </p>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{
                  fontSize: 10, padding: "2px 7px", borderRadius: 4,
                  background: `${tagColors[s.tag]}22`,
                  color: tagColors[s.tag],
                }}>
                  {s.tag}
                </span>
                <span style={{ color: COLORS.textDim, fontSize: 11 }}>{s.date}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
