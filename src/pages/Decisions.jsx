import { useState } from "react";
import { COLORS, DECISIONS } from "../constants";
import { btnAccent, btnGhost } from "../components/ui";

const statusColor = (s) => (s === "Blocked" ? COLORS.red : COLORS.orange);

export default function Decisions() {
  const [openId, setOpenId] = useState("RO-14");
  const [filter, setFilter] = useState("All");

  const filters = ["All", "Needs input", "Blocked", "Resolved"];

  const visible = filter === "All"
    ? DECISIONS
    : DECISIONS.filter((d) => d.status === filter);

  return (
    <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 500, margin: 0 }}>Decisions</h1>
        <button style={btnAccent()}>+ Add</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...btnGhost(),
              fontSize: 13,
              background: filter === f ? COLORS.borderLight : "transparent",
              color: filter === f ? COLORS.text : COLORS.textMuted,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((d) => (
          <div key={d.id} style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            overflow: "hidden",
          }}>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", cursor: "pointer" }}
              onClick={() => setOpenId(openId === d.id ? null : d.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: COLORS.textDim, fontSize: 12 }}>{d.id}</span>
                <span style={{ color: COLORS.text, fontSize: 14, fontWeight: 500 }}>{d.title}</span>
                <span style={{
                  background: `${statusColor(d.status)}22`,
                  color: statusColor(d.status),
                  fontSize: 11, padding: "2px 8px", borderRadius: 4,
                }}>
                  {d.status}
                </span>
              </div>
              <span style={{ color: COLORS.textDim }}>{openId === d.id ? "∧" : "∨"}</span>
            </div>

            {openId === d.id && d.desc && (
              <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${COLORS.border}` }}>
                <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "14px 0" }}>{d.desc}</p>
                <div style={{ display: "flex", gap: 32, marginBottom: 16 }}>
                  <div>
                    <div style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 4 }}>OWNER</div>
                    <div style={{ color: COLORS.text, fontSize: 13 }}>{d.owner}</div>
                  </div>
                  <div>
                    <div style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 4 }}>DUE</div>
                    <div style={{ color: COLORS.text, fontSize: 13 }}>{d.due}</div>
                  </div>
                </div>
                {d.options && (
                  <div>
                    <div style={{ color: COLORS.textDim, fontSize: 11, marginBottom: 8 }}>OPTIONS</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {d.options.map((o) => (
                        <button key={o} style={{
                          background: "transparent",
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: 6, padding: "6px 14px",
                          color: COLORS.text, fontSize: 13, cursor: "pointer",
                        }}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
