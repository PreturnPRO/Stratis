import { useEffect, useRef } from "react";
import { COLORS, MEETING_MESSAGES } from "../constants";
import { btnAccent, Avatar } from "../components/ui";

export default function Meeting() {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* Transcript */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px 32px" }} ref={scrollRef}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: COLORS.textMuted }}>
            <span style={{ fontSize: 12 }}>⊞</span> Strategy map
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.red }} />
            <span style={{ color: COLORS.red, fontSize: 13, fontFamily: "monospace" }}>04:85</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {MEETING_MESSAGES.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 14 }}>
              <Avatar initials={m.initials} color={m.color} />
              <div>
                <div style={{ display: "flex", gap: 10, marginBottom: 4 }}>
                  <span style={{ color: COLORS.text, fontSize: 13, fontWeight: 500 }}>{m.user}</span>
                  <span style={{ color: COLORS.textDim, fontSize: 12, fontFamily: "monospace" }}>{m.time}</span>
                </div>
                <p style={{ color: COLORS.textMuted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{m.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <div style={{
        width: 220,
        borderLeft: `1px solid ${COLORS.border}`,
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        overflow: "auto",
        flexShrink: 0,
      }}>
        <div>
          <div style={{ color: COLORS.textDim, fontSize: 11, letterSpacing: 1, marginBottom: 12 }}>PARTICIPANTS</div>
          {[
            { name: "Sarah K.", color: "#c0392b", initials: "SK" },
            { name: "Mike R.",  color: "#2e86c1", initials: "MR" },
            { name: "Alex T.",  color: "#1a7a4a", initials: "AT" },
          ].map((p) => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Avatar initials={p.initials} color={p.color} size={26} />
              <span style={{ fontSize: 13, color: COLORS.text }}>{p.name}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ color: COLORS.textDim, fontSize: 11, letterSpacing: 1, marginBottom: 12 }}>CAPTURED</div>
          {[
            { type: "DECISION", label: "Restructure pricing tiers", color: COLORS.red },
            { type: "RISK",     label: "Engineering capacity",      color: COLORS.red },
            { type: "SIGNAL",   label: "Pure usage-based",          color: COLORS.teal },
          ].map((c) => (
            <div key={c.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} />
                <span style={{ fontSize: 10, color: c.color, fontWeight: 600, letterSpacing: 0.5 }}>{c.type}</span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, paddingLeft: 12 }}>{c.label}</div>
            </div>
          ))}
        </div>

        <button style={{ ...btnAccent(), background: COLORS.red, borderColor: COLORS.red, marginTop: "auto", fontSize: 12 }}>
          ⏹ End &amp; summarise
        </button>
      </div>
    </div>
  );
}
