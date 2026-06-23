// S1-T02-G — Facilitator dashboard: upcoming meetings, recent summaries, Start Meeting.

import { COLORS } from "../constants";
import { btnAccent, btnGhost } from "../components/ui";

const MOCK_UPCOMING = [
  { id: "m1", title: "Q3 Pricing Review",     project: "Pricing v2",     time: "Today · 14:00",   participants: 5 },
  { id: "m2", title: "Mobile Launch Standup", project: "Mobile launch",  time: "Today · 16:30",   participants: 4 },
  { id: "m3", title: "Enterprise GTM Sync",   project: "Enterprise GTM", time: "Tomorrow · 10:00", participants: 6 },
]

const MOCK_SUMMARIES = [
  { id: "s1", title: "Pricing Strategy Session", project: "Pricing v2",     date: "Jun 10", decisions: 2, openItems: 3 },
  { id: "s2", title: "Mobile Sprint Planning",   project: "Mobile launch",  date: "Jun 9",  decisions: 1, openItems: 2 },
  { id: "s3", title: "GTM Kickoff",              project: "Enterprise GTM", date: "Jun 7",  decisions: 3, openItems: 5 },
]

interface DashboardProps {
  onNav?: (id: string, params?: Record<string, string>) => void;
}

export default function Dashboard({ onNav }: DashboardProps) {  return (
    <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
        <div>
          <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 500, margin: 0, marginBottom: 4 }}>
            Dashboard
          </h1>
          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Welcome back, Nick</span>
        </div>
        <button style={btnAccent()}>+ New meeting</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>

        {/* Upcoming meetings */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ color: COLORS.textDim, fontSize: 11, letterSpacing: 1 }}>UPCOMING</span>
            <button style={{ ...btnGhost(), fontSize: 11, padding: "2px 8px" }}>See all</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {MOCK_UPCOMING.map((m) => (
              <div
                key={m.id}
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
<<<<<<< Updated upstream
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 500, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.title}
=======
                Upcoming meetings
              </h2>
              <button style={btnGhost()} onClick={loadDashboard}>
                Refresh
              </button>
            </div>

            {meetings.length === 0 ? (
              <EmptyState message="No meetings yet. Create your first meeting." />
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {meetings.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 10,
                      padding: "16px 18px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: 16,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: COLORS.text,
                            fontSize: 14,
                            fontWeight: 500,
                            marginBottom: 6,
                          }}
                        >
                          {m.title}
                        </div>
                        <div style={{ color: COLORS.textMuted, fontSize: 12 }}>
                          {m.project ?? m.projectId ?? "Project"} ┬╖{" "}
                          {formatDate(m.scheduledAt ?? m.time)}
                        </div>
                      </div>

                      <button
                        style={btnAccent()}
                        onClick={() => void handleStartExisting(m)}
                      >
                        {m.activeSession ? "Resume" : "Start"}
                      </button>
                    </div>
>>>>>>> Stashed changes
                  </div>
                  <div style={{ display: "flex", gap: 10, fontSize: 12, color: COLORS.textMuted }}>
                    <span>{m.project}</span>
                    <span style={{ color: COLORS.textDim }}>·</span>
                    <span>{m.time}</span>
                    <span style={{ color: COLORS.textDim }}>·</span>
                    <span>{m.participants} people</span>
                  </div>
                </div>
                <button style={{
                  ...btnAccent(),
                  fontSize: 12,
                  padding: "5px 14px",
                  flexShrink: 0,
                }}>
                  Start
                </button>
              </div>
            ))}
          </div>
        </div>

<<<<<<< Updated upstream
        {/* Recent summaries */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <span style={{ color: COLORS.textDim, fontSize: 11, letterSpacing: 1 }}>RECENT SUMMARIES</span>
            <button style={{ ...btnGhost(), fontSize: 11, padding: "2px 8px" }}>See all</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {MOCK_SUMMARIES.map((s) => (
              <div
                key={s.id}
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  padding: "16px 18px",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = COLORS.borderLight)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = COLORS.border)}
                onClick={() => onNav?.('summary', { sessionId: s.id })}
=======
      {showNewMeeting && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2
              style={{
                color: COLORS.text,
                fontSize: 18,
                fontWeight: 500,
                margin: "0 0 18px",
              }}
            >
              New meeting
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                style={inputStyle}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting title"
              />

              <input
                style={inputStyle}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name"
              />

              <input
                style={inputStyle}
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />

              <input
                style={inputStyle}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Meeting goal (one line)"
              />

              <textarea
                style={{ ...inputStyle, minHeight: 72, resize: "vertical", fontFamily: "inherit" }}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="Brief / agenda ΓÇö context for the AI (optional)"
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 22,
              }}
            >
              <button
                style={btnGhost()}
                onClick={() => setShowNewMeeting(false)}
                disabled={creating}
>>>>>>> Stashed changes
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ color: COLORS.text, fontSize: 14, fontWeight: 500 }}>{s.title}</span>
                  <span style={{ color: COLORS.textDim, fontSize: 12, flexShrink: 0, marginLeft: 12 }}>{s.date}</span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 10 }}>{s.project}</div>
                <div style={{ display: "flex", gap: 16 }}>
                  <span style={{ fontSize: 12 }}>
                    <span style={{ color: COLORS.accent }}>{s.decisions}</span>
                    <span style={{ color: COLORS.textDim }}> decisions</span>
                  </span>
                  <span style={{ fontSize: 12 }}>
                    <span style={{ color: COLORS.orange }}>{s.openItems}</span>
                    <span style={{ color: COLORS.textDim }}> open items</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
<<<<<<< Updated upstream
  )
}
=======
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 200,
};

const modalStyle: React.CSSProperties = {
  width: 420,
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: 24,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};
>>>>>>> Stashed changes
