import { useState } from "react";
import { COLORS } from "./constants";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import MeetingTransition from "./components/MeetingTransition";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Projects from "./pages/Projects";
//import StrategyMap from './pages/StrategyMap'
import Meeting from "./pages/Meeting";
//import Decisions  from './pages/Decisions'
//import Inbox      from './pages/Inbox'
//import Settings   from './pages/Settings'
import Dashboard from "./pages/Dashboard";
//import Documents  from './pages/Documents'
import SummaryView from "./pages/SummaryView";

//For Ai testing
//import LiveVoicePipelineTest from './pages/LiveVoicePipelineTest'

type AuthPage = "landing" | "login" | "register" | "app";

function renderPage(
  active: string,
  navParams: Record<string, string>,
  handleNav: (id: string, params?: Record<string, string>) => void,
) {
  switch (active) {
    //    case 'live-voice-test':return <LiveVoicePipelineTest /> // Temporary page for AI testing

    case "projects":
      return <Projects />;
    //    case 'map':       return <StrategyMap />
    case "meeting":   return <Meeting onNav={handleNav} />
    //    case 'decisions': return <Decisions />
    //    case 'inbox':     return <Inbox />
    //    case 'settings':  return <Settings />
    case "dashboard":
      return <Dashboard onNav={handleNav} />;
    //   case 'documents': return <Documents />
    case "summary":
      return (
        <SummaryView role="facilitator" sessionId={navParams?.sessionId} />
      );
    default:
      return <Dashboard onNav={handleNav} />;
  }
}

function AppShell() {
  const { isAuthed, logout } = useAuth();
  const [authPage, setAuthPage] = useState<AuthPage>("landing");
  const [active, setActive] = useState("dashboard");
  const [navParams, setNavParams] = useState<Record<string, string>>({});
  const [showTransition, setShowTransition] = useState(false);

  const ALLOWED_PAGES = new Set([
    "dashboard",
    "projects",
    "meeting",
    "summary",
  ]);

  const handleNav = (id: string, params?: Record<string, string>) => {
    const nextPage = ALLOWED_PAGES.has(id) ? id : "dashboard";

    if (nextPage === "meeting" && active !== "meeting") {
      setShowTransition(true);
    }

    setActive(nextPage);
    setNavParams(nextPage === id ? (params ?? {}) : {});
  };

  // Auth pages — no sidebar
  if (!isAuthed) {
    const page = authPage;
    return (
      <div
        style={{
          height: "100vh",
          background: COLORS.bg,
          color: COLORS.text,
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
        }}
      >
        {page === "landing" && <Landing onNavigate={setAuthPage} />}
        {page === "login" && (
          <Login
            onNavigate={(p) =>
              p === "app" ? setAuthPage("app") : setAuthPage(p)
            }
          />
        )}
        {page === "register" && (
          <Register
            onNavigate={(p) =>
              p === "app" ? setAuthPage("app") : setAuthPage(p)
            }
          />
        )}
      </div>
    );
  }

  // Authenticated app shell
  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: COLORS.bg,
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        overflow: "hidden",
        color: COLORS.text,
      }}
    >
      {showTransition && (
        <MeetingTransition onDone={() => setShowTransition(false)} />
      )}
      <Sidebar active={active} onNav={handleNav} onLogout={logout} />
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <div
          style={{
            height: 48,
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            flexShrink: 0,
            color: COLORS.textMuted,
            fontSize: 13,
          }}
        >
          Top bar
        </div>
        <div
          style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}
        >
          <div style={{ flex: 1, overflow: "hidden", height: "100%" }}>
            {renderPage(active, navParams, handleNav)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
