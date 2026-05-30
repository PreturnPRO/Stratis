import { COLORS } from "../constants";

export function btnAccent(extra = {}) {
  return {
    background: COLORS.accent,
    border: `1px solid ${COLORS.accent}`,
    color: "#000",
    borderRadius: 6,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    ...extra,
  };
}

export function btnGhost(extra = {}) {
  return {
    background: "transparent",
    border: `1px solid ${COLORS.border}`,
    color: COLORS.textMuted,
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
    ...extra,
  };
}

export function tagStyle(color) {
  return {
    display: "inline-block",
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 4,
    background: `${color}22`,
    color,
  };
}

export function Avatar({ initials, color, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.33, fontWeight: 600, color: "#fff",
    }}>
      {initials}
    </div>
  );
}

export function Badge({ label, color }) {
  return (
    <span style={tagStyle(color)}>{label}</span>
  );
}

export function SectionLabel({ children }) {
  return (
    <div style={{ color: COLORS.textDim, fontSize: 11, letterSpacing: 1, marginBottom: 14 }}>
      {children}
    </div>
  );
}
