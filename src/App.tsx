import { useState } from "react";
import { COLORS } from "./constants";
import Sidebar from "./components/Sidebar";
import MeetingTransition from "./components/MeetingTransition";
import Projects   from "./pages/Projects";
import StrategyMap from "./pages/StrategyMap";
import Meeting    from "./pages/Meeting";
import Decisions  from "./pages/Decisions";
import Inbox      from "./pages/Inbox";
import Settings   from "./pages/Settings";

function renderPage(active: string) {
  switch (active) {
    case "projects":  return <Projects />;
    case "map":       return <StrategyMap />;
    case "meeting":   return <Meeting />;
    case "decisions": return <Decisions />;
    case "inbox":     return <Inbox />;
    case "settings":  return <Settings />;
    default:          return <Projects />;
  }
}

export default function App() {
  const [active, setActive] = useState("projects");
  const [showTransition, setShowTransition] = useState(false);

const handleNav = (id: string) => {
    if (id === "meeting" && active !== "meeting") {
      setShowTransition(true);
    }
    setActive(id);
  };

return (
    <div style={{
      display: "flex",
      height: "100vh",
      background: COLORS.bg,
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      overflow: "hidden",
      color: COLORS.text,
    }}>
      {showTransition && (
        <MeetingTransition onDone={() => setShowTransition(false)} />
      )}
      <Sidebar active={active} onNav={handleNav} />

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>

        {/* Top bar */}
        <div style={{
          height: 48,
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          flexShrink: 0,
          color: COLORS.textMuted,
          fontSize: 13,
        }}>
          Top bar
        </div>

        {/* Content row */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

          {/* Main content */}
          <div style={{ flex: 1, overflow: "hidden", height: "100%" }}>
            {renderPage(active)}
          </div>

          {/* Transcript panel — meeting only, hidden since Meeting manages its own panels */}
         {false && (
          <div style={{
            width: 300,
           borderLeft: `1px solid ${COLORS.border}`,
           display: "flex",
           alignItems: "center",
           justifyContent: "center",
           flexShrink: 0,
           color: COLORS.textMuted,
            fontSize: 13,
         }}>
           Transcript panel
         </div>
         )}

        </div>
      </div>
    </div>
  );
}