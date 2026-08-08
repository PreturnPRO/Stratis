import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { COLORS, FONT, LETTER_SPACING, RADIUS, SPACE } from "./constants";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import CurtainTransition, { type CurtainState } from "./components/CurtainTransition";
import ErrorBoundary from "./components/ErrorBoundary";
import { useTheme, ThemeProvider } from "./hooks/useTheme";
import { LangProvider } from "./hooks/useLang";
import { useUpdateGuard } from "./hooks/useUpdateGuard";
import { installTrackFlush, track } from "./lib/track";
import { apiFetch } from "./lib/http";
import type { User } from "@shared/types";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Projects = lazy(() => import("./pages/Projects"));
const Meeting = lazy(() => import("./pages/Meeting"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Docket = lazy(() => import("./pages/Docket"));
const SummaryView = lazy(() => import("./pages/SummaryView"));
const DocumentView = lazy(() => import("./pages/DocumentView"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Join = lazy(() => import("./pages/Join"));
const FeedbackModal = lazy(() => import("./components/FeedbackModal"));

function RouteFallback({ colors }: { colors: { textDim: string } }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 160,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: colors.textDim,
        fontSize: 13,
      }}
    >
      Loading…
    </div>
  );
}

type AuthPage = "landing" | "login" | "register" | "app";
type AppPage =
  | "dashboard"
  | "docket"
  | "projects"
  | "meeting"
  | "summary"
  | "document"
  | "settings"
  | "admin"
  | "pricing";

const PAGE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  docket: "Docket",
  projects: "Projects",
  meeting: "Meeting",
  summary: "Summary",
  document: "Document",
  settings: "Settings",
  admin: "Admin",
  pricing: "Plans",
};

function LiveClock({ colors }: { colors: { accent: string } }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const align = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, (60 - new Date().getSeconds()) * 1000);
    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, []);

  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(now);
  const tz = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value ?? "";

  return (
    <span>
      {tz} <span style={{ color: colors.accent }}>→</span> {time}
    </span>
  );
}

function renderPage(
  active: string,
  navParams: Record<string, string>,
  handleNav: (id: string, params?: Record<string, string>) => void,
) {
  switch (active) {
    case "docket":
      return <Docket onNav={handleNav} />;
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
    case "settings":
      return <Settings onNav={handleNav} />;
    case "admin":
      return <Admin />;
    case "pricing":
      return <Pricing onNav={handleNav} />;
    default:
      return <Dashboard onNav={handleNav} />;
  }
}

/**
 * Routes that exist outside the signed-in shell.
 *
 * `join` has to render for someone with no account at all, and `oauth` is the
 * landing strip for a Google redirect — neither can sit behind the auth gate,
 * and both are read straight from the hash rather than from nav state because
 * the user arrives on them cold, from a link.
 */
function readEntryRoute(): { page: string; params: Record<string, string> } {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [page, query] = hash.split("?");
  const params: Record<string, string> = {};
  if (query) new URLSearchParams(query).forEach((v, k) => { params[k] = v; });
  return { page: page || "", params };
}

/**
 * Completes a Google sign-in. The backend redirects here with the token in the
 * URL fragment; this exchanges it for the user record, hands both to
 * AuthContext, and scrubs the fragment so the token does not sit in the address
 * bar or in history.
 */
function OAuthLanding({
  params,
  onDone,
}: {
  params: Record<string, string>;
  onDone: (error: string | null) => void;
}) {
  const { login } = useAuth();
  const doneRef = useRef(false);

  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    const token = params.token;
    if (!token) {
      onDone(params.error || "Google sign-in did not complete");
      return;
    }

    // The token is the one we were just handed, not a stored session, so a
    // rejection here is a failed sign-in — not a session to end.
    void apiFetch<User>("/api/auth/me", { token })
      .then((user) => {
        if (!user) throw new Error("Could not finish signing in");
        login(token, user);
        window.history.replaceState(null, "", "#/dashboard");
        onDone(null);
      })
      .catch((err: Error) => onDone(err.message));
  }, [params, login, onDone]);

  return (
    <div style={{ padding: 40, color: COLORS.textMuted, fontSize: FONT.size.body }}>
      Finishing sign-in…
    </div>
  );
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

/**
 * A single strip across the top of the app for things the server told us:
 * a new build is available, or this session was ended. Deliberately one
 * component in one place — these messages must never compete with the meeting
 * surface or appear twice.
 */
function SystemNotice({
  tone,
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  tone: "info" | "danger";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
}) {
  const { colors } = useTheme();
  const isDanger = tone === "danger";
  return (
    <div
      role={isDanger ? "alert" : "status"}
      style={{
        // In the flow, not fixed. A fixed strip sat on top of the app header
        // and hid the breadcrumb underneath it; this pushes the page down
        // instead of covering it.
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "8px 14px",
        background: isDanger ? colors.dangerBg : colors.surfaceElevated,
        borderBottom: `1px solid ${isDanger ? colors.danger : colors.border}`,
        color: isDanger ? colors.danger : colors.text,
        fontSize: FONT.size.label,
      }}
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            padding: "4px 12px",
            borderRadius: RADIUS.pill,
            border: `1px solid ${colors.accent}`,
            background: "transparent",
            color: colors.accent,
            fontSize: FONT.size.label,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {actionLabel}
        </button>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            background: "transparent",
            border: "none",
            color: "inherit",
            opacity: 0.7,
            cursor: "pointer",
            fontSize: FONT.size.body,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

function AppShell() {
  const { isAuthed, logout, isAdmin, endedReason, clearEndedReason } = useAuth();
  const [authPage, setAuthPage] = useState<AuthPage>("landing");
  const initialEntry = hashToEntry();
  const [active, setActive] = useState<AppPage>(initialEntry.page);
  const [navParams, setNavParams] = useState<Record<string, string>>(initialEntry.params);
  const { theme, toggleTheme, colors } = useTheme();

  const [entryRoute, setEntryRoute] = useState(() => readEntryRoute());
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    const onHashChange = () => setEntryRoute(readEntryRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // The update check is paused during a meeting: a reload prompt over a live
  // recording is the one place this feature could do harm.
  const { update, reload, dismiss } = useUpdateGuard({ pause: active === "meeting" });

  useEffect(() => {
    installTrackFlush();
    track("app_opened");
  }, []);

  const [authCurtain, setAuthCurtain] = useState<CurtainState>("idle");
  const prevAuthedRef = useRef(isAuthed);
  useEffect(() => {
    if (!prevAuthedRef.current && isAuthed) setAuthCurtain("in");
    prevAuthedRef.current = isAuthed;
  }, [isAuthed]);

  useEffect(() => {
    if (authCurtain === "in") {
      const t = setTimeout(() => setAuthCurtain("out"), 240);
      return () => clearTimeout(t);
    }
    if (authCurtain === "out") {
      const t = setTimeout(() => setAuthCurtain("idle"), 300);
      return () => clearTimeout(t);
    }
  }, [authCurtain]);

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
    const page = id as AppPage;
    const resolvedParams = params ?? {};

    const current = history[historyIndex];
    const isSamePage = current?.page === page;
    const isSameParams =
      JSON.stringify(current?.params) === JSON.stringify(resolvedParams);
    if (isSamePage && isSameParams) return;

    commitNav(id, params);
  };

  useEffect(() => {
    const hash = entryToHash(active, navParams);
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  }, [active, navParams]);

  useEffect(() => {
    const onPopState = () => {
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

<<<<<<< HEAD
  // Sign out clears auth AND resets navigation to the dashboard — otherwise the
  // stale `active`/history/hash survive and the next login lands on whatever
  // page was open when logging out.
  const handleLogout = () => {
    logout();
    setActive("dashboard");
    setNavParams({});
    setHistory([{ page: "dashboard", params: {} }]);
    setHistoryIndex(0);
    setAuthPage("landing");
    window.history.replaceState(null, "", "#/dashboard");
  };
=======
  // An invite link and an OAuth return both have to render before, and
  // independently of, the signed-in shell.
  if (entryRoute.page === "join" && entryRoute.params.token) {
    return (
      <ErrorBoundary area="join">
        <Suspense fallback={<RouteFallback colors={colors} />}>
          <Join
            token={entryRoute.params.token}
            onNav={(id, params) => {
              window.location.hash = entryToHash(id as AppPage, params ?? {});
              setEntryRoute(readEntryRoute());
              handleNav(id, params);
            }}
            onNavigateAuth={(page) => {
              window.history.replaceState(null, "", "#/");
              setEntryRoute({ page: "", params: {} });
              setAuthPage(page);
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Pricing is public. Someone deciding whether Stratis is worth paying for
  // should not have to make an account to read the plans.
  if (!isAuthed && entryRoute.page === "pricing") {
    return (
      <div style={{ height: "100dvh", overflow: "auto", background: COLORS.bg, color: COLORS.text }}>
        <ErrorBoundary area="pricing">
          <Suspense fallback={<RouteFallback colors={colors} />}>
            <Pricing
              onNav={() => {
                window.history.replaceState(null, "", "#/");
                setEntryRoute({ page: "", params: {} });
                setAuthPage("register");
              }}
            />
          </Suspense>
        </ErrorBoundary>
      </div>
    );
  }

  if (entryRoute.page === "oauth") {
    return (
      <ErrorBoundary area="oauth">
        <Suspense fallback={<RouteFallback colors={colors} />}>
          <OAuthLanding
            params={entryRoute.params}
            onDone={(error) => {
              setOauthError(error);
              setEntryRoute({ page: "", params: {} });
              if (error) setAuthPage("login");
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }
>>>>>>> 52344f33d88b878311925b6cc781b1ce24e742fd

  if (!isAuthed) {
    return (
      <div
        style={{
          height: "100dvh",
          background: COLORS.bg,
          color: COLORS.text,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CurtainTransition state={authCurtain} routeLabel="DASHBOARD" onMidpoint={() => {}} theme={theme} />
        {(endedReason || oauthError) && (
          <SystemNotice
            tone="danger"
            message={oauthError ?? endedReason?.message ?? ""}
            onDismiss={() => {
              clearEndedReason();
              setOauthError(null);
            }}
          />
        )}
        <main style={{ flex: 1, minHeight: 0 }}>
          <ErrorBoundary key={authPage} area={authPage}>
            <Suspense fallback={<RouteFallback colors={colors} />}>
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
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        background: colors.bg,
        overflow: "hidden",
        color: colors.text,
      }}
    >
<<<<<<< HEAD
      {showTransition && (
        <MeetingTransition onDone={() => setShowTransition(false)} />
      )}

      <Sidebar active={active} onNav={handleSidebarNav} onLogout={handleLogout} />
=======
      <CurtainTransition
        state={authCurtain}
        routeLabel="DASHBOARD"
        onMidpoint={() => {}}
        theme={theme}
      />
      <Sidebar
        active={active}
        onNav={handleSidebarNav}
        onLogout={() => {
          logout();
          setAuthPage("landing");
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
        isAdmin={isAdmin}
        onFeedback={() => setFeedbackOpen(true)}
      />
>>>>>>> 52344f33d88b878311925b6cc781b1ce24e742fd

      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {update && (
          <SystemNotice
            tone="info"
            message={`Stratis ${update.version} is available. Reload to pick it up.`}
            actionLabel="Reload"
            onAction={reload}
            onDismiss={dismiss}
          />
        )}

        <header
          style={{
            height: 40,
            borderBottom: `1px solid ${COLORS.border}`,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: SPACE[1.5],
            flexShrink: 0,
            overflow: "hidden",
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
              minWidth: 0,
              overflow: "hidden",
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

          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              color: colors.textDim,
              fontFamily: FONT.mono,
              fontSize: FONT.size.caption,
              letterSpacing: LETTER_SPACING.wide,
              flexShrink: 0,
            }}
          >
            <LiveClock colors={colors} />
          </span>
        </header>

        <main
          style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}
        >
          <div
            key={active}
            style={{
              flex: 1,
              overflow: "hidden",
              height: "100%",
            }}
          >
            <ErrorBoundary key={active} area={active}>
              <Suspense fallback={<RouteFallback colors={colors} />}>
                {renderPage(active, navParams, handleNav)}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {feedbackOpen && (
        <Suspense fallback={null}>
          <FeedbackModal
            surface={active}
            sessionId={navParams.sessionId}
            onClose={() => setFeedbackOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary area="app shell">
      <ThemeProvider>
        <LangProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </LangProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
