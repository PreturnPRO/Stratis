import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { COLORS, FONT, RADIUS, SPACE } from "./constants";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import CurtainTransition, { type CurtainState } from "./components/CurtainTransition";
import CustomCursor from "./components/CustomCursor";
import Preloader from "./components/Preloader";
import { useTheme } from "./hooks/useTheme";
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
  projects: "Projects",
  meeting: "Meeting",
  summary: "Summary",
  document: "Document",
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
      return (
        <SummaryView sessionId={navParams?.sessionId} />
      );
    case "document":
      return (
        <DocumentView
          sessionId={navParams?.sessionId}
          projectId={navParams?.projectId}
          onNav={handleNav}
        />
      );
    default:
      return <Dashboard onNav={handleNav} />;
  }
}

function hashToEntry(): { page: AppPage; params: Record<string, string> } {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [page, query] = hash.split("?");
  const params: Record<string, string> = {};
  if (query) new URLSearchParams(query).forEach((v, k) => { params[k] = v; });
  return { page: (page || "dashboard") as AppPage, params };
}

function entryToHash(page: AppPage, params: Record<string, string>): string {
  const query = new URLSearchParams(params).toString();
  return `#/${page}${query ? `?${query}` : ""}`;
}

function AppShell() {
  const { isAuthed, logout } = useAuth();
  const [authPage, setAuthPage] = useState<AuthPage>("landing");
  const initialEntry = hashToEntry();
  const [active, setActive] = useState<AppPage>(initialEntry.page);
  const [navParams, setNavParams] = useState<Record<string, string>>(initialEntry.params);
  const { theme, toggleTheme, colors } = useTheme();
  const [curtainState, setCurtainState] = useState<CurtainState>("idle");
  const [pendingNav, setPendingNav] = useState<{ id: string; params?: Record<string, string> } | null>(null);

  type HistoryEntry = { page: AppPage; params: Record<string, string> };
  const [history, setHistory] = useState<HistoryEntry[]>([initialEntry]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const commitNav = (id: string, params?: Record<string, string>) => {
    const page = id as AppPage;
    const resolvedParams = params ?? {};

    const visibleHistory = history.slice(0, historyIndex + 1);
    const existingIndex = visibleHistory.findIndex(
      (e) =>
        e.page === page &&
        JSON.stringify(e.params) === JSON.stringify(resolvedParams),
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

  const handleNav = (id: string, params?: Record<string, string>) => {
    if (curtainState !== "idle") return;

    const page = id as AppPage;
    const resolvedParams = params ?? {};

    const current = history[historyIndex];
    const isSamePage = current?.page === page;
    const isSameParams =
      JSON.stringify(current?.params) === JSON.stringify(resolvedParams);
    if (isSamePage && isSameParams) return;

    setPendingNav({ id, params });
    setCurtainState("in");
  };

  useEffect(() => {
    if (curtainState === "in") {
      const t = setTimeout(() => {
        if (pendingNav) commitNav(pendingNav.id, pendingNav.params);
        setCurtainState("hold");
      }, 480);
      return () => clearTimeout(t);
    }
    if (curtainState === "hold") {
      const t = setTimeout(() => setCurtainState("out"), 240);
      return () => clearTimeout(t);
    }
    if (curtainState === "out") {
      const t = setTimeout(() => setCurtainState("idle"), 600);
      return () => clearTimeout(t);
    }
  }, [curtainState, pendingNav]);

  useEffect(() => {
    const hash = entryToHash(active, navParams);
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  }, [active, navParams]);

  useEffect(() => {
    const onPopState = () => {
      if (curtainState !== "idle") {
        window.history.pushState(null, "", entryToHash(active, navParams));
        return;
      }
      const entry = hashToEntry();
      handleNav(entry.page, entry.params);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  });

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

  const canBack = historyIndex > 0;
  const canForward = historyIndex < history.length - 1;

  if (!isAuthed) {
    return (
      <div
        style={{
          height: "100vh",
          background: COLORS.bg,
          color: COLORS.text,
          fontFamily: "'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <Preloader onDone={() => {}} theme={theme} />
        {authPage === "landing" && <Landing onNavigate={setAuthPage} />}
        {authPage === "login" && (
          <Login
            onNavigate={(p) =>
              p === "app" ? setAuthPage("app") : setAuthPage(p)
            }
          />
        )}
        {authPage === "register" && (
          <Register
            onNavigate={(p) =>
              p === "app" ? setAuthPage("app") : setAuthPage(p)
            }
          />
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: colors.bg,
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        overflow: "hidden",
        color: colors.text,
      }}
    >
      <CurtainTransition
        state={curtainState}
        routeLabel={(PAGE_LABELS[pendingNav?.id ?? active] ?? active).toUpperCase()}
        onMidpoint={() => {}}
        theme={theme}
      />
      <CustomCursor calmZone={active === "meeting"} theme={theme} />

      <Sidebar active={active} onNav={handleSidebarNav} onLogout={logout} theme={theme} onToggleTheme={toggleTheme} />

      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <header
          style={{
            height: 40,
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: SPACE[1.5],
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleBack}
            disabled={!canBack}
            title="Back"
            aria-label="Go back"
            style={{
              width: 32,
              height: 32,
              borderRadius: 5,
              background: "transparent",
              border: "none",
              color: canBack ? COLORS.textMuted : COLORS.textDim,
              cursor: canBack ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={15} strokeWidth={1.75} />
          </button>

          <button
            onClick={handleForward}
            disabled={!canForward}
            title="Forward"
            aria-label="Go forward"
            style={{
              width: 32,
              height: 32,
              borderRadius: 5,
              background: "transparent",
              border: "none",
              color: canForward ? COLORS.textMuted : COLORS.textDim,
              cursor: canForward ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ChevronRight size={15} strokeWidth={1.75} />
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginLeft: 4,
            }}
          >
            {history.slice(0, historyIndex + 1).map((entry, i) => {
              const isCurrent = i === historyIndex;
              const isClickable = !isCurrent;
              return (
                <div
                  key={`${entry.page}-${i}`}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  {i > 0 && (
                    <span
                      style={{
                        color: COLORS.textMuted,
                        fontSize: FONT.size.label,
                        userSelect: "none",
                      }}
                    >
                      ›
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (!isClickable) return;
                      setActive(entry.page);
                      setHistoryIndex(i);
                      setNavParams(entry.params);
                    }}
                    aria-current={isCurrent ? "page" : undefined}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "6px 4px",
                      fontSize: FONT.size.label,
                      fontWeight: isCurrent ? 500 : 400,
                      color: isCurrent ? COLORS.text : COLORS.textMuted,
                      cursor: isClickable ? "pointer" : "default",
                      borderRadius: RADIUS.sm,
                    }}
                  >
                    {PAGE_LABELS[entry.page] ?? entry.page}
                  </button>
                </div>
              );
            })}
          </div>
        </header>

        <main
          style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}
        >
          <div style={{ flex: 1, overflow: "hidden", height: "100%" }}>
            {renderPage(active, navParams, handleNav)}
          </div>
        </main>
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
