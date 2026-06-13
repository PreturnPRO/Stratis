import { COLORS } from "../constants";
import { btnGhost, SectionLabel } from "../components/ui";

const INTEGRATIONS = [
  { icon: "#", name: "Slack",           status: "connected",     detail: "Capturing #pricing-discuss",  iconBg: "#4a0080" },
  { icon: "N", name: "Notion",          status: "connected",     detail: "Synced: Product strategy doc", iconBg: "#1a1a1a" },
  { icon: "C", name: "Google Calendar", status: "connected",     detail: "Monitoring 3 calendars",       iconBg: "#0a2a6a" },
  { icon: "J", name: "Jira",            status: "disconnected",  detail: null,                           iconBg: "#0a1a4a" },
];

export default function Settings() {
  return (
    <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1 }}>
      <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 500, margin: "0 0 32px" }}>Settings</h1>

      <SectionLabel>INTEGRATIONS</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
        {INTEGRATIONS.map((ig) => (
          <div key={ig.name} style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: "16px 18px",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              background: ig.iconBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, color: "#aaa", flexShrink: 0,
            }}>
              {ig.icon}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span style={{ color: COLORS.text, fontSize: 14, fontWeight: 500 }}>{ig.name}</span>
                <button style={{
                  fontSize: 12,
                  color: ig.status === "connected" ? COLORS.red : COLORS.teal,
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                }}>
                  {ig.status === "connected" ? "Disconnect" : "Connect"}
                </button>
              </div>

              {ig.status === "connected" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: COLORS.teal, margin: "4px 0" }}>
                  ✓ Connected
                </div>
              ) : (
                <div style={{ fontSize: 12, color: COLORS.textDim, margin: "4px 0" }}>✗ Not connected</div>
              )}

              {ig.detail && (
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{ig.detail}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <SectionLabel>PEBBLE DEVICE</SectionLabel>
      <div style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: "18px 20px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "#1a2a3a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
            }}>
              📡
            </div>
            <div>
              <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 500 }}>Pebble</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: COLORS.teal }}>
                ⚡ Paired
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: COLORS.red }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.red }} />
            Recording
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[["DEVICE ID", "PEB-2841"], ["FIRMWARE", "3.2.1"], ["BATTERY", "78%"]].map(([k, v]) => (
            <div key={k} style={{ background: COLORS.bg, borderRadius: 6, padding: "10px 12px" }}>
              <div style={{ color: COLORS.textDim, fontSize: 10, letterSpacing: 0.5, marginBottom: 4 }}>{k}</div>
              <div style={{ color: COLORS.text, fontSize: 14 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {["Pair now", "Firmware"].map((b) => (
            <button key={b} style={btnGhost()}>{b}</button>
          ))}
          <button style={{ ...btnGhost(), color: COLORS.red, borderColor: `${COLORS.red}44` }}>
            Forget
          </button>
        </div>
      </div>
    </div>
  );
}
