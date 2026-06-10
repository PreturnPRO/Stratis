import { useEffect, useRef, useState } from "react";
import { COLORS, MEETING_MESSAGES } from "../constants";
import { btnAccent, Avatar } from "../components/ui";
import BlockRenderer from "../components/BlockRenderer";
import { LoadingState } from "../components/states";

const TEST_NODES = [
  { id: "1", type: "TextBlock",    title: "Test text",     content: "Some content",    timestamp: "10:00" },
  { id: "2", type: "DecisionNode", title: "Test decision", content: "Decided to ship", timestamp: "10:05" },
  { id: "3", type: "EmptyPlaceholder" },
  { id: "4", type: "UnknownType",  title: "Bad block" },
];

const MOCK_SUMMARY = [
  {
    time: "00:00–01:48",
    speaker: "Sarah K.",
    color: "#c0392b",
    note: "Q2 revenue missed by 12%. Root cause: enterprise pricing misaligned with value delivery. 8 of 12 churned customers cited pricing as top-3 reason.",
  },
  {
    time: "02:05–03:38",
    speaker: "Mike R. + Alex T.",
    color: "#2e86c1",
    note: "Option A (seat-based) feels safest — closest to current model. Option B (usage-based) flagged by AI with 78% confidence. Intercom 2022 saw 23% uplift on same switch.",
  },
  {
    time: "04:00–04:21",
    speaker: "Sarah K. + Mike R.",
    color: "#c0392b",
    note: "Key assumption: SMB segment accepts metered billing — unvalidated. Engineering capacity risk flagged — mobile launch consuming more than planned.",
  },
];

export default function Meeting() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [blocksOpen, setBlocksOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [transcriptOpen, setTranscriptOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [isLoading]);

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

      {/* Transcript column */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minHeight: 0,
      }}>
        {/* Transcript header */}
        <div style={{
          padding: "12px 32px",
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: COLORS.textMuted }}>
              <span style={{ fontSize: 12 }}>⊞</span> Strategy map
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.red }} />
              <span style={{ color: COLORS.red, fontSize: 13, fontFamily: "monospace" }}>04:85</span>
            </div>
          </div>
          <button
            onClick={() => setBlocksOpen(o => !o)}
            style={{
              background: blocksOpen ? COLORS.surfaceHover : "transparent",
              border: `1px solid ${COLORS.border}`,
              borderRadius: 4,
              color: COLORS.textMuted,
              fontSize: 11,
              padding: "3px 10px",
              cursor: "pointer",
            }}
          >
            {blocksOpen ? "hide blocks" : "blocks"}
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflow: "auto",
            padding: "24px 32px",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            position: "relative",
          }}
        >
          {isLoading ? (
            <LoadingState
              count={4}
              delayMs={2000}
              onDone={() => setIsLoading(false)}
            />
          ) : (
            <div style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              animation: "fadeIn 0.4s ease forwards",
            }}>
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
          )}
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      </div>

      {/* Blocks column — shown only when open */}
      {blocksOpen && (
        <div style={{
          width: 280,
          borderLeft: `1px solid ${COLORS.border}`,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          alignSelf: "stretch",
        }}>
          <div style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${COLORS.border}`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 12, color: COLORS.textMuted, letterSpacing: 0.5 }}>BLOCKS</span>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
            <BlockRenderer nodes={TEST_NODES} />
          </div>
        </div>
      )}

      {/* Sidebar + transcript panel */}
      <div style={{
        width: 220,
        borderLeft: `1px solid ${COLORS.border}`,
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        alignSelf: "stretch",
        position: "relative",
      }}>

        {/* Sidebar content */}
        <div style={{
          flex: 1,
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          overflow: "auto",
        }}>
          {/* Transcript toggle button */}
          <button
            onClick={() => setTranscriptOpen(o => !o)}
            style={{
              background: transcriptOpen ? COLORS.tealBg : "transparent",
              border: `1px solid ${transcriptOpen ? COLORS.teal : COLORS.border}`,
              borderRadius: 4,
              color: transcriptOpen ? COLORS.teal : COLORS.textMuted,
              fontSize: 11,
              padding: "3px 10px",
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            {transcriptOpen ? "hide notes" : "AI notes"}
          </button>

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
            ⹎ End &amp; summarise
          </button>
        </div>

        {/* Transcript panel overlay */}
        {transcriptOpen && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: COLORS.bg,
            display: "flex",
            flexDirection: "column",
            zIndex: 10,
            animation: "fadeIn 0.2s ease forwards",
          }}>
            {/* Panel header */}
            <div style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${COLORS.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 12, color: COLORS.teal, letterSpacing: 0.5 }}>AI NOTES</span>
              <button
                onClick={() => setTranscriptOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: COLORS.textMuted,
                  fontSize: 11,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Summary entries */}
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
              {MOCK_SUMMARY.map((entry, i) => (
                <div key={i} style={{
                  borderLeft: `2px solid ${entry.color}`,
                  paddingLeft: 10,
                }}>
                  <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 3, fontFamily: "monospace" }}>
                    {entry.time}
                  </div>
                  <div style={{ fontSize: 11, color: entry.color, fontWeight: 600, marginBottom: 4 }}>
                    {entry.speaker}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>
                    {entry.note}
                  </div>
                </div>
              ))}
              <div style={{
                fontSize: 11,
                color: COLORS.textDim,
                borderTop: `1px solid ${COLORS.border}`,
                paddingTop: 12,
                fontStyle: "italic",
              }}>
                AI summary updates in real-time as the meeting progresses.
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}