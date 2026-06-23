<<<<<<< Updated upstream
import { useState } from 'react'
import { COLORS } from './constants'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import MeetingTransition from './components/MeetingTransition'
import Landing    from './pages/Landing'
import Login      from './pages/Login'
import Register   from './pages/Register'
import Projects   from './pages/Projects'
import StrategyMap from './pages/StrategyMap'
import Meeting    from './pages/Meeting'
import Decisions  from './pages/Decisions'
import Inbox      from './pages/Inbox'
import Settings   from './pages/Settings'
import Dashboard  from './pages/Dashboard'
import Documents  from './pages/Documents'
import SummaryView from './pages/SummaryView';

type AuthPage = 'landing' | 'login' | 'register' | 'app'

function renderPage(active: string, navParams: Record<string, string>, handleNav: (id: string, params?: Record<string, string>) => void) {  switch (active) {
    case 'projects':  return <Projects />
    case 'map':       return <StrategyMap />
    case 'meeting':   return <Meeting />
    case 'decisions': return <Decisions />
    case 'inbox':     return <Inbox />
    case 'settings':  return <Settings />
    case 'dashboard': return <Dashboard onNav={handleNav} />
    case 'documents': return <Documents />
    case 'summary':   return <SummaryView role="facilitator" sessionId={navParams?.sessionId} />
    default:          return <Projects />
=======
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { COLORS } from "./constants";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import MeetingTransition from "./components/MeetingTransition";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Projects from "./pages/Projects";
import Meeting from "./pages/Meeting";
import Dashboard from "./pages/Dashboard";
import SummaryView from "./pages/SummaryView";
import DocumentView from "./pages/DocumentView";

type AuthPage = "landing" | "login" | "register" | "app";
type AppPage = "dashboard" | "projects" | "meeting" | "summary" | "document";

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  projects:  "Projects",
  meeting:   "Meeting",
  summary:   "Summary",
  document:  "Document",
};

function renderPage(
  active: string,
  navParams: Record<string, string>,
  handleNav: (id: string, params?: Record<string, string>) => void,
) {
  switch (active) {
    case "projects":
      return <Projects onNav={handleNav} />;
    case "meeting":
      return <Meeting onNav={handleNav} />;
    case "dashboard":
      return <Dashboard onNav={handleNav} />;
    case "summary":
      return <SummaryView role="facilitator" sessionId={navParams?.sessionId} />;
    case "document":
      return <DocumentView sessionId={navParams?.sessionId} projectId={navParams?.projectId} onNav={handleNav} />;
    default:
      return <Dashboard onNav={handleNav} />;
>>>>>>> Stashed changes
  }
}

function AppShell() {
<<<<<<< Updated upstream
  const { isAuthed, logout } = useAuth()
  const [authPage, setAuthPage] = useState<AuthPage>('landing')
  const [active, setActive] = useState('projects')
  const [navParams, setNavParams] = useState<Record<string, string>>({})
  const [showTransition, setShowTransition] = useState(false)
=======
  const { isAuthed, logout } = useAuth();
  const [authPage, setAuthPage] = useState<AuthPage>("landing");
  const [active, setActive] = useState<AppPage>("dashboard");
  const [navParams, setNavParams] = useState<Record<string, string>>({});
  const [showTransition, setShowTransition] = useState(false);

  // ─── Nav history stores {page, params} tuples ──────────────────────────────
  type HistoryEntry = { page: AppPage; params: Record<string, string> };
  const [history, setHistory] = useState<HistoryEntry[]>([{ page: "dashboard", params: {} }]);
  const [historyIndex, setHistoryIndex] = useState(0);
>>>>>>> Stashed changes

  const handleNav = (id: string, params?: Record<string, string>) => {
    const page = id as AppPage;
    const resolvedParams = params ?? {};

    const current = history[historyIndex];
    const isSamePage   = current?.page === page;
    const isSameParams = JSON.stringify(current?.params) === JSON.stringify(resolvedParams);
    if (isSamePage && isSameParams) return;

    if (page === "meeting" && active !== "meeting") setShowTransition(true);

    const visibleHistory = history.slice(0, historyIndex + 1);
    const existingIndex = visibleHistory.findIndex(
      (e) => e.page === page && JSON.stringify(e.params) === JSON.stringify(resolvedParams)
    );

    if (existingIndex !== -1) {
      setHistoryIndex(existingIndex);
      setActive(page);
      setNavParams(resolvedParams);
      return;
    }

    const newEntry: HistoryEntry = { page, params: resolvedParams };
    const newHistory = [...history.slice(0, historyIndex + 1), newEntry];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setActive(page);
    setNavParams(resolvedParams);
  };

  const handleSidebarNav = (id: string) => {
    handleNav(id, {});
  };


  const handleBack = () => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setHistoryIndex(historyIndex - 1);
    setActive(prev.page);
    setNavParams(prev.params);
  };

  const handleForward = () => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setHistoryIndex(historyIndex + 1);
    setActive(next.page);
    setNavParams(next.params);
  };

  const canBack    = historyIndex > 0;
  const canForward = historyIndex < history.length - 1;

  // ─── Auth pages ────────────────────────────────────────────────────────────
  if (!isAuthed) {
<<<<<<< Updated upstream
    const page = authPage
    return (
      <div style={{ height: '100vh', background: COLORS.bg, color: COLORS.text, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
        {page === 'landing'  && <Landing  onNavigate={setAuthPage} />}
        {page === 'login'    && <Login    onNavigate={p => p === 'app' ? setAuthPage('app') : setAuthPage(p)} />}
        {page === 'register' && <Register onNavigate={p => p === 'app' ? setAuthPage('app') : setAuthPage(p)} />}
=======
    return (
      <div style={{ height: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
        {authPage === "landing"  && <Landing onNavigate={setAuthPage} />}
        {authPage === "login"    && <Login    onNavigate={(p) => p === "app" ? setAuthPage("app") : setAuthPage(p)} />}
        {authPage === "register" && <Register onNavigate={(p) => p === "app" ? setAuthPage("app") : setAuthPage(p)} />}
>>>>>>> Stashed changes
      </div>
    )
  }

  // ─── App shell ─────────────────────────────────────────────────────────────
  return (
<<<<<<< Updated upstream
    <div style={{
      display: 'flex', height: '100vh', background: COLORS.bg,
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      overflow: 'hidden', color: COLORS.text,
    }}>
      {showTransition && <MeetingTransition onDone={() => setShowTransition(false)} />}
      <Sidebar active={active} onNav={handleNav} onLogout={logout} />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div style={{
          height: 48, borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', padding: '0 20px',
          flexShrink: 0, color: COLORS.textMuted, fontSize: 13,
        }}>
          Top bar
        </div>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <div style={{ flex: 1, overflow: 'hidden', height: '100%' }}>
=======
    <div style={{ display: "flex", height: "100vh", background: COLORS.bg, fontFamily: "'Helvetica Neue', Arial, sans-serif", overflow: "hidden", color: COLORS.text }}>
      {showTransition && <MeetingTransition onDone={() => setShowTransition(false)} />}

      <Sidebar active={active} onNav={handleSidebarNav} onLogout={logout} />

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>

        {/* ─── Topbar ──────────────────────────────────────────────────────── */}
        <div style={{
          height: 40,
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 6,
          flexShrink: 0,
        }}>
          {/* Back */}
          <button
            onClick={handleBack}
            disabled={!canBack}
            title="Back"
            style={{
              width: 26, height: 26, borderRadius: 5,
              background: "transparent", border: "none",
              color: canBack ? COLORS.textMuted : COLORS.textDim,
              cursor: canBack ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={15} strokeWidth={1.75} />
          </button>

          {/* Forward */}
          <button
            onClick={handleForward}
            disabled={!canForward}
            title="Forward"
            style={{
              width: 26, height: 26, borderRadius: 5,
              background: "transparent", border: "none",
              color: canForward ? COLORS.textMuted : COLORS.textDim,
              cursor: canForward ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ChevronRight size={15} strokeWidth={1.75} />
          </button>

          {/* Breadcrumb path */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
            {history.slice(0, historyIndex + 1).map((entry, i) => {
              const isCurrent = i === historyIndex;
              const isClickable = !isCurrent;
              return (
                <div key={`${entry.page}-${i}`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {i > 0 && (
                    <span style={{ color: COLORS.textDim, fontSize: 12, userSelect: "none" }}>›</span>
                  )}
                  <button
                    onClick={() => {
                      if (!isClickable) return;
                      setActive(entry.page);
                      setHistoryIndex(i);
                      setNavParams(entry.params);
                    }}
                    style={{
                      background: "transparent", border: "none", padding: "2px 4px",
                      fontSize: 12, fontWeight: isCurrent ? 500 : 400,
                      color: isCurrent ? COLORS.text : COLORS.textMuted,
                      cursor: isClickable ? "pointer" : "default",
                      borderRadius: 4,
                    }}
                  >
                    {PAGE_LABELS[entry.page] ?? entry.page}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Page content ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          <div style={{ flex: 1, overflow: "hidden", height: "100%" }}>
>>>>>>> Stashed changes
            {renderPage(active, navParams, handleNav)}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
<<<<<<< Updated upstream
  )
=======
  );
>>>>>>> Stashed changes
}