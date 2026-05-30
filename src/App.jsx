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

function renderPage(active) {
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
  const [active, setActive]           = useState("projects");
  const [showTransition, setShowTransition] = useState(false);

  const handleNav = (id) => {
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
      <Sidebar active={active} onNav={handleNav} />

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
        {showTransition && (
          <MeetingTransition onDone={() => setShowTransition(false)} />
        )}
        {renderPage(active)}
      </div>
    </div>
  );
}
