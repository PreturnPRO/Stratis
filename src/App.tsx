import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
// No COLORS here on purpose: it is the dark palette constant, and light is the
// default theme. Every colour in this shell comes from useTheme().
import { FONT, LETTER_SPACING, RADIUS, SPACE } from "./constants";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { RecordingProvider, useRecording } from "./context/RecordingContext";
import Sidebar from "./components/Sidebar";
import CurtainTransition, { type CurtainState } from "./components/CurtainTransition";
import ErrorBoundary from "./components/ErrorBoundary";
import { BackLink } from "./components/ui";
import { useTheme, ThemeProvider } from "./hooks/useTheme";
import { LangProvider, useLang } from "./hooks/useLang";
import { useUpdateGuard } from "./hooks/useUpdateGuard";
import { installTrackFlush, track } from "./lib/track";
import { apiFetch } from "./lib/http";
import type { User } from "@shared/types";
import { localeTag } from "./i18n/locale";
import {
  desktopRequestHash,
  parseDesktopRequest,
  rememberDesktopRequest,
  takeDesktopRequest,
} from "./lib/desktopHandoff";

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
const Room = lazy(() => import("./pages/Room"));
const DesktopSignIn = lazy(() => import("./pages/DesktopSignIn"));
const LanguageGate = lazy(() => import("./components/LanguageGate"));
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

  const time = new Intl.DateTimeFormat(localeTag(), { hour: "2-digit", minute: "2-digit" }).format(now);
  const tz = new Intl.DateTimeFormat(localeTag(), { timeZoneName: "short" })
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
      // Rendered by the shell instead, in a slot that survives navigation.
      return null;
    case "dashboard":
      return <Dashboard onNav={handleNav} />;
    case "summary":
      return (
        <SummaryView sessionId={navParams?.sessionId} onNav={handleNav} />
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
  const { colors } = useTheme();
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
    <div style={{ padding: 40, color: colors.textMuted, fontSize: FONT.size.body }}>
      Finishing sign-in…
    </div>
  );
}

function hashToEntry(): { page: AppPage; params: Record<string, string> } {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [page, query] = hash.split("?");
  const params: Record<string, string> = {};
  if (query) new URLSearchParams(query).forEach((v, k) => { params[k] = v; });
  // Validated, not cast. `#/room` and `#/join` are public routes that the
  // signed-in shell has no page for, and casting them straight to AppPage put
  // a breadcrumb labelled "room" in the nav trail that led nowhere. Anything
  // this shell does not own resolves to the dashboard.
  const known = Object.prototype.hasOwnProperty.call(PAGE_LABELS, page);
  return { page: (known ? page : "dashboard") as AppPage, params };
}

/**
 * `#/login` and `#/register` are not app pages — they are states of the
 * signed-out shell, which is why `hashToEntry` does not know them. Reading them
 * here is what makes the link someone actually sends ("sign in here") land on
 * the form instead of the marketing page.
 */
function readAuthPageFromHash(): AuthPage | null {
  const page = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  if (page === "login" || page === "register") return page;
  // Stratis Desktop sends a signed-out browser here: the form comes first.
  return page === "desktop" ? "login" : null;
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
  const { isAuthed, logout, isPlatformAdmin, endedReason, clearEndedReason } = useAuth();
  const [authPage, setAuthPage] = useState<AuthPage>(() => readAuthPageFromHash() ?? "landing");
  const initialEntry = hashToEntry();
  const [active, setActive] = useState<AppPage>(initialEntry.page);
  const [navParams, setNavParams] = useState<Record<string, string>>(initialEntry.params);
  const { theme, colors } = useTheme();
  // The meeting screen stays mounted while it is on screen OR while it is
  // recording — so navigating away hides it rather than ending the recording.
  const { recording } = useRecording();
  const meetingMounted = active === "meeting" || recording;
  const { chosen: langChosen } = useLang();

  const [entryRoute, setEntryRoute] = useState(() => readEntryRoute());
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  /**
   * Into the room-code screen from the public pages. The hash is written as
   * well as the state so the page can be reloaded, and shared, from there.
   */
  const goToRoom = () => {
    window.history.pushState(null, "", "#/room");
    setEntryRoute({ page: "room", params: {} });
  };

  /** The public plans page, reachable without an account. */
  const goToPricing = () => {
    window.history.pushState(null, "", "#/pricing");
    setEntryRoute({ page: "pricing", params: {} });
  };

  /** Back out of a public entry screen to the marketing site. */
  const goToLanding = () => {
    window.history.pushState(null, "", "#/");
    setEntryRoute({ page: "", params: {} });
    setAuthPage("landing");
  };

  useEffect(() => {
    const onHashChange = () => setEntryRoute(readEntryRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Back, forward and reload all have to move between the marketing page and
  // the form. None of that works while the auth screen lives only in state.
  useEffect(() => {
    const onHashChange = () => setAuthPage(readAuthPageFromHash() ?? "landing");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (isAuthed || entryRoute.page) return;
    const wanted = authPage === "login" || authPage === "register" ? `#/${authPage}` : "#/";
    if (window.location.hash !== wanted) window.history.replaceState(null, "", wanted);
  }, [authPage, isAuthed, entryRoute.page]);

  // The tab strip is a wayfinding surface the moment someone has Stratis open
  // three times — which is the normal state during a meeting. Every tab said
  // "Stratis".
  useEffect(() => {
    // `active` defaults to "dashboard" for a signed-out visitor, so reading it
    // unconditionally titled the marketing page "Dashboard · Stratis".
    const page = entryRoute.page || (isAuthed ? active : "");
    const label =
      PAGE_LABELS[page] ?? (page === "room" ? "Join a room" : "");
    document.title = label ? `${label} · Stratis` : "Stratis";
  }, [entryRoute, active, isAuthed]);

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

  // Only the signed-in shell owns the hash. Unauthenticated, this still wrote
  // `#/dashboard` over whatever public page was on screen, so backing out of
  // Sign in to the landing page left a URL that described somewhere else — and
  // sharing it sent someone to the wrong door.
  useEffect(() => {
    if (!isAuthed) return;
    const hash = entryToHash(active, navParams);
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  }, [active, navParams, isAuthed]);

  /**
   * Stratis Desktop signs in through `#/desktop` (desktop spec §6). A signed-out
   * browser keeps the request for the trip through sign-in — Google's redirect
   * included, which is why it lives in sessionStorage — and goes to the form.
   */
  useEffect(() => {
    if (isAuthed || entryRoute.page !== "desktop") return;
    const request = parseDesktopRequest(entryRoute.params);
    if (request) rememberDesktopRequest(window.sessionStorage, request);
    window.history.replaceState(null, "", "#/login");
    setEntryRoute({ page: "", params: {} });
    setAuthPage("login");
  }, [isAuthed, entryRoute]);

  // Signed in with a desktop request waiting: back to the page that asks for Continue.
  // It runs after the effect above that writes the shell's hash, so it has the last word.
  useEffect(() => {
    if (!isAuthed || entryRoute.page) return;
    const request = takeDesktopRequest(window.sessionStorage);
    if (!request) return;
    window.history.replaceState(null, "", desktopRequestHash(request));
    setEntryRoute(readEntryRoute());
  }, [isAuthed, entryRoute.page]);

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

  // Before any route renders. Someone arriving for the first time picks their
  // language before they see the product, not after they have already read a
  // screen of English.
  if (!langChosen) {
    return (
      <Suspense fallback={null}>
        <LanguageGate />
      </Suspense>
    );
  }

  // The room code is the one route a participant reaches with no account, no
  // invite link and no signup — they were told six characters across a table.
  // It renders ahead of the auth gate for exactly that reason.
  if (entryRoute.page === "room") {
    return (
      <ErrorBoundary area="room">
        <Suspense fallback={<RouteFallback colors={colors} />}>
          <Room code={entryRoute.params.code} onBack={goToLanding} />
        </Suspense>
      </ErrorBoundary>
    );
  }

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
      // COLORS is the dark palette constant, not the themed one, so this page
      // rendered dark whatever the user had chosen — visible the moment light
      // became the default.
      <div style={{ height: "100dvh", overflow: "auto", background: colors.bg, color: colors.text }}>
        <ErrorBoundary area="pricing">
          <Suspense fallback={<RouteFallback colors={colors} />}>
            <BackLink onClick={goToLanding} />
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

  if (entryRoute.page === "desktop" && isAuthed) {
    const request = parseDesktopRequest(entryRoute.params);
    if (request) {
      return (
        <ErrorBoundary area="desktop">
          <Suspense fallback={<RouteFallback colors={colors} />}>
            <div style={{ height: "100dvh", background: colors.bg, color: colors.text }}>
              <DesktopSignIn
                request={request}
                onUseAnotherAccount={() => {
                  rememberDesktopRequest(window.sessionStorage, request);
                  logout();
                  window.history.replaceState(null, "", "#/login");
                  setEntryRoute({ page: "", params: {} });
                  setAuthPage("login");
                }}
              />
            </div>
          </Suspense>
        </ErrorBoundary>
      );
    }
  }

  if (!isAuthed) {
    return (
      <div
        style={{
          height: "100dvh",
          background: colors.bg,
          color: colors.text,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CurtainTransition state={authCurtain} routeLabel="DASHBOARD" onMidpoint={() => {}} theme={theme} />
        {/* An expired token is news on the sign-in screen, where "sign in
            again" is something the reader can act on, and noise on the
            marketing page, where a visitor who never asked for a session met a
            red error strip above the headline. */}
        {(oauthError || (endedReason && authPage !== "landing")) && (
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
              {authPage === "landing" && (
                <Landing
                  onNavigate={setAuthPage}
                  onJoinRoom={goToRoom}
                  onPricing={goToPricing}
                />
              )}
              {authPage === "login" && (
                <Login
                  onNavigate={(p) =>
                    p === "app" ? setAuthPage("app") : setAuthPage(p)
                  }
                  onJoinRoom={goToRoom}
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
        isPlatformAdmin={isPlatformAdmin}
        onFeedback={() => setFeedbackOpen(true)}
      />

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
            borderBottom: `1px solid ${colors.border}`,
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
              color: canBack ? colors.textMuted : colors.textDim,
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
              color: canForward ? colors.textMuted : colors.textDim,
              cursor: canForward ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ChevronRight size={15} strokeWidth={1.75} />
          </button>

          {/* Where you are, not where you have been.
              This was a trail of every page visited — "Dashboard › Docket ›
              Projects › Document › Settings › Meeting" — which looks like a
              hierarchy and is really browser history. It duplicated the
              sidebar, and the deeper someone worked the more of it there was to
              read and the less any of it meant. The name of the current screen
              is the whole of what the header owes the reader; back and forward
              already handle the history. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginLeft: 4,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <span
              aria-current="page"
              style={{
                fontSize: FONT.size.label,
                fontWeight: 500,
                color: colors.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {PAGE_LABELS[active] ?? active}
            </span>

            {/* A recording that survives navigation must never be a recording
                you cannot see. This is the only always-visible sign that the
                microphone is open, and the way back to it. */}
            {recording && active !== "meeting" && (
              <button
                type="button"
                onClick={() => handleNav("meeting")}
                title="Recording — back to the meeting"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginLeft: 10,
                  padding: "3px 9px",
                  borderRadius: RADIUS.pill,
                  border: `1px solid ${colors.red}`,
                  background: "transparent",
                  color: colors.red,
                  fontSize: FONT.size.caption,
                  cursor: "pointer",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: colors.red,
                    animation: "recPulse 1.5s ease-out infinite",
                  }}
                />
                Recording
              </button>
            )}
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
              display: active === "meeting" ? "none" : undefined,
            }}
          >
            <ErrorBoundary key={active} area={active}>
              <Suspense fallback={<RouteFallback colors={colors} />}>
                {renderPage(active, navParams, handleNav)}
              </Suspense>
            </ErrorBoundary>
          </div>

          {/* The meeting lives in its own slot, outside the keyed container, so
              navigation cannot unmount it. Stopping a recording because someone
              clicked Docket to check a date would lose the meeting; leaving the
              old behaviour alone was worse still — the microphone stayed open
              with no owner, kept uploading, and coming back mounted a second
              recorder beside the first. It is hidden when another page is
              showing, and dropped only once the recording has stopped. */}
          {meetingMounted && (
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                height: "100%",
                display: active === "meeting" ? undefined : "none",
              }}
            >
              <ErrorBoundary area="meeting">
                <Suspense fallback={<RouteFallback colors={colors} />}>
                  <Meeting onNav={handleNav} />
                </Suspense>
              </ErrorBoundary>
            </div>
          )}
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
            <RecordingProvider>
            <AppShell />
            </RecordingProvider>
          </AuthProvider>
        </LangProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
