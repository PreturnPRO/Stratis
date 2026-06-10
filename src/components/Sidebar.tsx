import { COLORS, NAV_ITEMS } from "../constants";

export default function Sidebar({ active, onNav }: { active: string; onNav: (id: string) => void }) {
  return (
    <div style={{
      width: 48,
      background: COLORS.bg,
      borderRight: `1px solid ${COLORS.border}`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: 12,
      paddingBottom: 12,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        width: 28, height: 28, marginBottom: 20,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: COLORS.accent, fontSize: 18, cursor: "pointer",
      }}>
        ⌃
      </div>

      {NAV_ITEMS.map((item: { id: string; icon: string; label: string }) => {
        const isActive = active === item.id;
        const badge = item.id === "decisions" ? 2 : item.id === "inbox" ? 4 : null;
        const dot = item.id === "meeting";

        return (
          <div key={item.id} style={{ position: "relative", marginBottom: 4 }}>
            <button
              title={item.label}
              onClick={() => onNav(item.id)}
              style={{
                width: 36, height: 36, borderRadius: 8,
                background: isActive ? COLORS.surfaceHover : "transparent",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: isActive ? COLORS.accent : COLORS.textDim,
                fontSize: 16, transition: "all 0.15s",
              }}
            >
              {item.icon}
            </button>

            {badge && (
              <div style={{
                position: "absolute", top: 2, right: 2,
                width: 14, height: 14, borderRadius: "50%",
                background: COLORS.red, fontSize: 9, fontWeight: 700,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}>
                {badge}
              </div>
            )}

            {dot && (
              <div style={{
                position: "absolute", top: 4, right: 4,
                width: 6, height: 6, borderRadius: "50%",
                background: COLORS.red, pointerEvents: "none",
              }} />
            )}
          </div>
        );
      })}

      {/* User avatar */}
      <div style={{ marginTop: "auto" }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: "#c0392b",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 600, color: "#fff", cursor: "pointer",
        }}>
          SK
        </div>
      </div>
    </div>
  );
}
