/**
 * Dev-only backend stand-in for Dana Reviewer.
 *
 * The backend needs Postgres and a `.env`; when neither is around the whole app
 * renders empty states and "Could not reach backend", which makes it impossible
 * to look at the real UI. This patches `window.fetch` for `/api/*` only, so the
 * app's own data path is exercised end to end — nothing in the pages or hooks
 * knows it isn't talking to a server.
 *
 * OFF unless explicitly asked for. Enable with `?mock=1` (sticks in
 * localStorage), disable with `?mock=0`. `VITE_MOCK=1` also works.
 * Never installs outside `import.meta.env.DEV`.
 */

const FLAG_KEY = "stratis.mock";
const AUTH_KEY = "stratis.auth.v1";
const ACTIVE_SESSION_KEY = "stratis.activeSessionId.v1";

const USER = {
  id: "u_dana",
  name: "Dana Reviewer",
  email: "dana@demo.local",
  role: "facilitator",
  orgId: "org_demo",
};

/** Dates are relative so the docket bands (Now / This week / Later) stay right. */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

const PROJECTS = [
  { id: "pricing-strategy", name: "Pricing strategy", meetingCount: 6, lastMeetingAt: at(-2 * DAY) },
  { id: "q3-roadmap", name: "Q3 roadmap", meetingCount: 3, lastMeetingAt: at(-9 * DAY) },
  { id: "onboarding-rework", name: "Onboarding rework", meetingCount: 1, lastMeetingAt: at(-21 * DAY) },
];

const MEETINGS = [
  {
    id: "m_pricing_review",
    title: "Enterprise pricing review",
    projectId: "pricing-strategy",
    project: "Pricing strategy",
    goal: "Decide whether SMB moves to metered billing before the Q3 cutover.",
    durationMinutes: 45,
    scheduledAt: at(2 * HOUR),
    createdAt: at(-3 * DAY),
    participantCount: 5,
    participants: 5,
    activeSession: null,
  },
  {
    id: "m_churn_readout",
    title: "Churn readout — 12 accounts",
    projectId: "pricing-strategy",
    project: "Pricing strategy",
    goal: "Agree on the root cause before we commit engineering time.",
    durationMinutes: 30,
    scheduledAt: at(2 * DAY + 3 * HOUR),
    createdAt: at(-1 * DAY),
    participantCount: 4,
    participants: 4,
    activeSession: null,
  },
  {
    id: "m_roadmap_lock",
    title: "Q3 roadmap lock",
    projectId: "q3-roadmap",
    project: "Q3 roadmap",
    goal: "Cut scope to what engineering can actually ship in six weeks.",
    durationMinutes: 60,
    scheduledAt: at(11 * DAY),
    createdAt: at(-5 * DAY),
    participantCount: 8,
    participants: 8,
    activeSession: null,
  },
  {
    id: "m_onboarding_kickoff",
    title: "Onboarding rework kickoff",
    projectId: "onboarding-rework",
    project: "Onboarding rework",
    goal: null,
    durationMinutes: null,
    scheduledAt: null,
    createdAt: at(-14 * DAY),
    participantCount: 3,
    participants: 3,
    activeSession: null,
  },
];

/** Decisions that never got a date or an owner — the Docket's whole reason to exist. */
const WAITING = [
  {
    id: "w_pricing_owner",
    text: "Someone owns the enterprise pricing decision before the Q3 cutover.",
    status: "open" as const,
    owner: null,
    missing: "owner",
    sourceMeeting: "Enterprise pricing review",
    sourceMeetingId: "m_pricing_review",
    sourceAt: at(-6 * DAY),
    projectId: "pricing-strategy",
    since: at(-6 * DAY),
  },
  {
    id: "w_metered_validation",
    text: "Validate that SMB actually accepts metered billing.",
    status: "incomplete" as const,
    owner: "Mike R.",
    missing: "date",
    sourceMeeting: "Churn readout — 12 accounts",
    sourceMeetingId: "m_churn_readout",
    sourceAt: at(-13 * DAY),
    projectId: "pricing-strategy",
    since: at(-13 * DAY),
  },
  {
    id: "w_eng_capacity",
    text: "Confirm engineering capacity for the six-week window.",
    status: "open" as const,
    owner: null,
    missing: "owner",
    sourceMeeting: "Q3 roadmap lock",
    sourceMeetingId: "m_roadmap_lock",
    sourceAt: at(-4 * DAY),
    projectId: "q3-roadmap",
    since: at(-4 * DAY),
  },
];

const SUMMARIES = [
  {
    id: "s_churn",
    session_id: "sess_churn",
    kind: "summary",
    title: "Churn readout — 12 accounts",
    body: "8 of 12 churned accounts named pricing. Sales cycle also lengthened, which nobody had measured. Two decisions recorded, one left deliberately open.",
    read: 0,
    created_at: at(-2 * DAY),
    meeting_title: "Churn readout — 12 accounts",
    project_id: "pricing-strategy",
    decisions: 2,
    openItems: 1,
  },
  {
    id: "s_roadmap",
    session_id: "sess_roadmap",
    kind: "summary",
    title: "Q3 roadmap — scope pass",
    body: "Cut two workstreams. Engineering capacity is still an assumption nobody has tested against the six-week window.",
    read: 1,
    created_at: at(-9 * DAY),
    meeting_title: "Q3 roadmap lock",
    project_id: "q3-roadmap",
    decisions: 4,
    openItems: 2,
  },
];

/* ── Live meeting ─────────────────────────────────────────────────────────── */

const SESSION_ID = "sess_pricing_live";
const SESSION = {
  id: SESSION_ID,
  meeting_id: "m_pricing_review",
  meeting_title: "Enterprise pricing review",
  project_id: "pricing-strategy",
  status: "active" as const,
  started_at: at(-18 * 60_000),
};

const TRANSCRIPT = [
  ["Sarah K.", "We missed Q2 by twelve percent. Root cause looks like enterprise pricing.", -17],
  ["Mike R.", "Agreed, but the sales cycle lengthened too. That's a separate problem.", -16],
  ["Alex T.", "Eight of the twelve churned accounts cited pricing directly. That's signal, not noise.", -14],
  ["Sarah K.", "So do we move SMB to metered billing before the Q3 cutover, or after?", -12],
  ["Mike R.", "Before. If we wait we're re-forecasting twice.", -11],
  ["Dana Reviewer", "Let's be careful — has anyone actually tested that SMB accepts metered?", -9],
  ["Alex T.", "Not formally. We have three customer conversations, none of them written up.", -8],
  ["Sarah K.", "Then that's an assumption, not a finding. Let's mark it.", -6],
  ["Mike R.", "Engineering also needs to confirm the six-week window is real.", -4],
  ["Alex T.", "I can get capacity numbers by Thursday.", -2],
].map(([speaker, text, minsAgo], i) => ({
  id: `t_${i}`,
  session_id: SESSION_ID,
  speaker: speaker as string,
  text: text as string,
  timestamp: at((minsAgo as number) * 60_000),
}));

/** Spread across types and urgencies so the stack's triage and cap are visible. */
const CARDS = [
  {
    id: "c_owner",
    question: "Who owns the pricing decision before the next meeting?",
    reason: "Discussed for six minutes, but no owner was named.",
    answered: false,
    cardType: "MISSING_DECISION",
    urgency: "HIGH",
    createdAt: at(-6 * 60_000),
  },
  {
    id: "c_metered",
    question: "Has anyone validated that SMB accepts metered billing?",
    reason: "A core assumption behind the Q3 cutover that nobody has tested.",
    answered: false,
    cardType: "UNRESOLVED_ASSUMPTION",
    urgency: "HIGH",
    createdAt: at(-9 * 60_000),
  },
  {
    id: "c_capacity",
    question: "Is the six-week engineering window a commitment or an estimate?",
    reason: "The date is being treated as fixed, but it hasn't been confirmed.",
    answered: false,
    cardType: "UNRESOLVED_ASSUMPTION",
    urgency: "MEDIUM",
    createdAt: at(-4 * 60_000),
  },
  {
    id: "c_drift",
    question: "The room has moved to sales cycle. Was pricing settled?",
    reason: "Topic changed without a decision being recorded on the original question.",
    answered: false,
    cardType: "DRIFT_ALERT",
    urgency: "MEDIUM",
    createdAt: at(-3 * 60_000),
  },
  {
    id: "c_segment",
    question: "Does this apply to all SMB, or only new logos?",
    reason: "Scope of the pricing change hasn't been bounded.",
    answered: false,
    cardType: "QUESTION_SUGGESTION",
    urgency: "LOW",
    createdAt: at(-12 * 60_000),
  },
  {
    id: "c_comms",
    question: "Who tells existing customers, and when?",
    reason: "A pricing change with no comms plan attached.",
    answered: false,
    cardType: "QUESTION_SUGGESTION",
    urgency: "LOW",
    createdAt: at(-15 * 60_000),
  },
  {
    id: "c_answered",
    question: "What did the twelve churned accounts actually say?",
    reason: "Answered — eight of twelve cited pricing.",
    answered: true,
    cardType: "QUESTION_SUGGESTION",
    urgency: "MEDIUM",
    createdAt: at(-14 * 60_000),
  },
];

/** One of each status so the checkpoint's completeness metric has something to say. */
const DECISIONS = [
  {
    id: "d_metered",
    sessionId: SESSION_ID,
    meetingId: "m_pricing_review",
    text: "Move SMB to metered billing before the Q3 cutover.",
    dueDate: at(21 * DAY),
    owner: "Sarah K.",
    scope: "SMB new logos",
    status: "complete" as const,
    revisit: null,
    missing: null,
    confidence: 0.9,
    source: "ai" as const,
    dismissed: false,
    createdAt: at(-11 * 60_000),
    updatedAt: at(-11 * 60_000),
  },
  {
    id: "d_capacity",
    sessionId: SESSION_ID,
    meetingId: "m_pricing_review",
    text: "Engineering confirms the six-week capacity window.",
    dueDate: null,
    owner: "Alex T.",
    scope: null,
    status: "incomplete" as const,
    revisit: null,
    missing: "date",
    confidence: 0.7,
    source: "ai" as const,
    dismissed: false,
    createdAt: at(-4 * 60_000),
    updatedAt: at(-4 * 60_000),
  },
  {
    id: "d_comms",
    sessionId: SESSION_ID,
    meetingId: "m_pricing_review",
    text: "Customer comms plan for the pricing change.",
    dueDate: null,
    owner: null,
    scope: null,
    status: "open" as const,
    revisit: "next meeting",
    missing: "owner",
    confidence: 0.6,
    source: "ai" as const,
    dismissed: false,
    createdAt: at(-2 * 60_000),
    updatedAt: at(-2 * 60_000),
  },
];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: status < 400, data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Returns the mock payload for a path, or `null` to fall through to the network. */
function route(path: string, method: string): Response | null {
  if (path.includes("/api/auth/login") || path.includes("/api/auth/signup")) {
    return json({ token: "mock-token", user: USER });
  }
  if (path.includes("/api/auth/me")) return json(USER);

  if (path.includes("/api/meeting/dashboard")) {
    return json({
      upcomingMeetings: MEETINGS.filter((m) => m.scheduledAt),
      recentSummaries: SUMMARIES,
      activeSession: null,
    });
  }

  if (path.includes("/api/meeting/docket")) {
    return json({ meetings: MEETINGS, waiting: WAITING, waitingTotal: WAITING.length });
  }

  if (path.includes("/api/meeting/projects")) {
    // POST creates; echo something plausible so the create flow doesn't dead-end.
    if (method === "POST") {
      return json({ project: { id: "new-project", name: "New project", meetingCount: 0, lastMeetingAt: null } });
    }
    return json({ projects: PROJECTS });
  }

  /* ── Live meeting ──────────────────────────────────────────────────────── */

  if (path.includes("/api/session/recover")) {
    return json({ recovered: true, session: SESSION });
  }
  if (path.includes("/api/transcript/session/")) {
    return json({ transcripts: TRANSCRIPT });
  }
  if (path.includes("/api/transcript/audio-chunk")) {
    // Recording is a no-op here — there is no STT service to hand audio to.
    return json({ accepted: true, transcripts: [] });
  }
  if (path.includes("/decisions/extract")) {
    return json({ decisions: DECISIONS });
  }
  if (/\/decisions\/[^/]+$/.test(path)) {
    return json({ decision: DECISIONS[0] });
  }
  if (path.includes("/decisions")) {
    return json({ decisions: DECISIONS });
  }
  if (path.includes("/api/ai/suggest/answer") || path.includes("/api/ai/suggest/dismiss")) {
    return json({ updated: true });
  }
  if (path.includes("/api/ai/suggest/")) {
    return json({ cards: CARDS });
  }
  if (path.includes("/api/ai/structure")) {
    return json({ blocks: [] });
  }
  if (/\/api\/session\/[^/]+\/(start|end)$/.test(path)) {
    return json({ session: { ...SESSION, status: path.endsWith("/end") ? "ended" : "active" } });
  }

  // Anything else under /api stays unmocked rather than returning a fake shape
  // that the caller would misread as real. Those surfaces show their own error
  // state, which is the honest result.
  return null;
}

/**
 * Minimal stand-in for the suggestion socket. `useSuggestionSocket` only ever
 * reads `onopen` / `onmessage` / `onclose` / `onerror` and calls `close()`, so
 * this covers the surface it actually uses. Without it the hook would retry a
 * dead connection every 3s and the card stack would never populate.
 */
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;

  private timers: ReturnType<typeof setTimeout>[] = [];

  constructor(public url: string) {
    this.timers.push(
      setTimeout(() => {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.({});
        this.send_({ type: "connected", role: "facilitator" });
      }, 120),
    );
  }

  private send_(payload: unknown) {
    if (this.readyState !== MockWebSocket.OPEN) return;
    this.onmessage?.({ data: JSON.stringify(payload) });
  }

  send() { /* client never sends anything this mock needs to answer */ }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    // No onclose call: the real hook schedules a 3s reconnect on close, and
    // firing it here would spin a pointless loop for a socket that is fake.
  }

  addEventListener() {}
  removeEventListener() {}
}

export function isDevMockEnabled(): boolean {
  if (!import.meta.env.DEV) return false;

  const params = new URLSearchParams(window.location.search);
  const asked = params.get("mock");
  if (asked === "1" || asked === "0") {
    window.localStorage.setItem(FLAG_KEY, asked);
    params.delete("mock");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
    );
  }

  return (
    window.localStorage.getItem(FLAG_KEY) === "1" ||
    import.meta.env.VITE_MOCK === "1"
  );
}

export function installDevMock(): void {
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (url.includes("/api/")) {
      const mocked = route(url, method);
      if (mocked) {
        // A beat of latency so loading states actually render instead of
        // resolving inside the same tick and never being seen.
        await new Promise((r) => setTimeout(r, 180));
        return mocked;
      }
    }
    return realFetch(input, init);
  };

  // The suggestion stack is driven by a socket, not by fetch — without this the
  // Meeting page renders its shell and no cards.
  (window as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;

  // Land straight in the app as Dana rather than making you sign in to a
  // backend that isn't there.
  if (!window.localStorage.getItem(AUTH_KEY)) {
    window.localStorage.setItem(AUTH_KEY, JSON.stringify({ token: "mock-token", user: USER }));
  }

  // Meeting reads the active session from here before falling back to recovery.
  window.localStorage.setItem(ACTIVE_SESSION_KEY, SESSION_ID);

  console.info(
    "%c[stratis] dev mock ON — Dana Reviewer. Disable with ?mock=0",
    "color:#8FAE6D;font-weight:600",
  );
}
