import { useCallback, useEffect, useMemo, useState } from "react";
import { FONT, LETTER_SPACING, RADIUS, SPACE } from "../tokens/colors";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../lib/api";
import { Button } from "../components/ui";
import { EmptyState, LoadingState } from "../components/states";
import { NewMeetingModal, type MeetingSeed, type NewMeetingFormValues } from "../components/NewMeetingModal";
import { useCreateMeeting, projectIdFromTitle } from "../hooks/useCreateMeeting";

// The Docket is deliberately NOT a calendar. A month grid answers "when am I
// busy?" — a question every team already has Google Calendar for, and which
// Stratis would only ever answer worse. This page answers the one only Stratis
// can: "what needs deciding next, and when will we decide it?" So the unit is a
// DECISION, not a time block: the goal leads each card, time is a stamp, and
// "Awaiting a date" turns unresolved checkpoint items into future meetings.
// Busy-time stays with the real calendar via the per-meeting .ics link.
interface DocketMeeting {
  id: string;
  title: string;
  projectId: string;
  goal: string | null;
  durationMinutes: number | null;
  scheduledAt: string | null;
  createdAt: string;
  activeSession: { id: string; status: string } | null;
  carriedOpen: number;
  carriedUnowned: number;
}

interface WaitingItem {
  id: string;
  text: string;
  status: "open" | "incomplete";
  owner: string | null;
  missing: string | null;
  sourceMeeting: string | null;
  projectId: string | null;
  since: string;
}

type Band = "now" | "week" | "later";

function bandFor(m: DocketMeeting): Band {
  if (m.activeSession) return "now";
  if (!m.scheduledAt) return "later";
  const when = new Date(m.scheduledAt).getTime();
  const weekOut = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return when <= weekOut ? "week" : "later";
}

const BAND_LABEL: Record<Band, string> = {
  now: "Now",
  week: "This week",
  later: "Later",
};

function dayStamp(iso: string | null): string {
  if (!iso) return "Unscheduled";
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function timeStamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function daysOpen(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default function Docket({
  onNav,
}: {
  onNav?: (id: string, params?: Record<string, string>) => void;
}) {
  const { colors } = useTheme();
  const { token, logout } = useAuth();
  const create = useCreateMeeting(onNav);

  const [meetings, setMeetings] = useState<DocketMeeting[]>([]);
  const [waiting, setWaiting] = useState<WaitingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [seed, setSeed] = useState<MeetingSeed | undefined>(undefined);
  const [starting, setStarting] = useState<string | null>(null);
  const [lockedProject, setLockedProject] = useState<{ id: string; name: string } | undefined>();

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/meeting/docket`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        logout();
        return;
      }
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Could not load the docket");
      setMeetings(data.data?.meetings ?? []);
      setWaiting(data.data?.waiting ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the docket");
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const out: Record<Band, DocketMeeting[]> = { now: [], week: [], later: [] };
    for (const m of meetings) out[bandFor(m)].push(m);
    return out;
  }, [meetings]);

  const scheduledCount = meetings.filter((m) => !m.activeSession).length;

  const openModal = (withSeed?: MeetingSeed, project?: { id: string; name: string }) => {
    setSeed(withSeed);
    setLockedProject(project);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSeed(undefined);
    setLockedProject(undefined);
  };

  const handleCreate = async (input: NewMeetingFormValues) => {
    const created = await create.createMeeting({
      title: input.title,
      projectId: lockedProject?.id ?? projectIdFromTitle(input.projectName),
      goal: input.goal,
      brief: input.brief,
      durationMinutes: input.durationMinutes,
      scheduledAt: input.scheduledAt,
    });
    if (!created) return;
    closeModal();
    if (input.scheduledAt) void load();
  };

  const startScheduled = async (m: DocketMeeting) => {
    setStarting(m.id);
    try {
      await create.startSessionForMeeting(m.id, m.durationMinutes ?? 60);
    } finally {
      setStarting(null);
    }
  };

  const downloadIcs = (m: DocketMeeting) => {
    if (!token) return;
    void fetch(`${API_BASE}/api/meeting/${m.id}/ics`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("no ics"))))
      .then((text) => {
        const url = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `${m.title.replace(/[^\w-]+/g, "-").toLowerCase()}.ics`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => setError("Could not build the calendar file for that meeting."));
  };

  const styles = makeStyles(colors);

  return (
    <div className="page-padding" style={styles.page}>
      <header style={styles.head}>
        <div>
          <h1 style={styles.h1}>Docket</h1>
          <p style={styles.sub}>
            {scheduledCount === 0
              ? "Nothing booked yet"
              : `${scheduledCount} meeting${scheduledCount === 1 ? "" : "s"} ahead`}
            {waiting.length > 0 && (
              <>
                {" · "}
                <span style={{ color: colors.amber, fontWeight: 600 }}>
                  {waiting.length} decision{waiting.length === 1 ? "" : "s"} waiting for a date
                </span>
              </>
            )}
          </p>
        </div>
        <Button variant="primary" onClick={() => openModal()}>
          New meeting
        </Button>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <LoadingState />
      ) : (
        <>
          {(["now", "week", "later"] as Band[]).map((band) =>
            grouped[band].length === 0 ? null : (
              <section key={band}>
                <div style={styles.band}>
                  <span>{BAND_LABEL[band]}</span>
                  {band !== "now" && <span style={styles.bandCount}>{grouped[band].length}</span>}
                  <span style={styles.bandRule} />
                </div>

                {grouped[band].map((m) => {
                  const live = !!m.activeSession;
                  const isOpen = expanded === m.id;
                  return (
                    <article
                      key={m.id}
                      style={{
                        ...styles.card,
                        borderColor: live ? colors.accentDim : colors.border,
                      }}
                    >
                      <div style={styles.when}>
                        {live ? (
                          <span style={styles.livePill}>Live</span>
                        ) : (
                          <span style={styles.whenDay}>{dayStamp(m.scheduledAt)}</span>
                        )}
                        <span style={styles.whenTime}>
                          {live ? "in progress" : timeStamp(m.scheduledAt)}
                        </span>
                        <span style={styles.whenDur}>
                          {m.durationMinutes ? `${m.durationMinutes} min` : ""}
                        </span>
                      </div>

                      <div style={styles.body}>
                        <div style={styles.topRow}>
                          <span style={styles.title}>{m.title}</span>
                          <span style={styles.proj}>{m.projectId}</span>
                        </div>

                        {m.goal ? (
                          <p style={styles.goal}>
                            Goal: <b style={{ color: colors.text }}>{m.goal}</b>
                          </p>
                        ) : (
                          <p style={{ ...styles.goal, color: colors.amber }}>
                            No goal yet — the AI has nothing to aim at.
                          </p>
                        )}

                        {(m.carriedOpen > 0 || m.carriedUnowned > 0) && (
                          <div style={styles.tags}>
                            {m.carriedOpen > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpanded(isOpen ? null : m.id)}
                                aria-expanded={isOpen}
                                style={{ ...styles.tag, ...styles.tagOpen }}
                              >
                                {m.carriedOpen} open thread{m.carriedOpen === 1 ? "" : "s"} carried in{" "}
                                {isOpen ? "▴" : "▾"}
                              </button>
                            )}
                            {m.carriedUnowned > 0 && (
                              <span style={{ ...styles.tag, ...styles.tagWarn }}>
                                {m.carriedUnowned} decision{m.carriedUnowned === 1 ? "" : "s"} still unowned
                              </span>
                            )}
                          </div>
                        )}

                        {isOpen && (
                          <div style={styles.threads}>
                            <p style={styles.threadsNote}>
                              Carried from earlier meetings on <b style={{ color: colors.text }}>{m.projectId}</b>.
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onNav?.("document", { projectId: m.projectId })}
                            >
                              Open project document
                            </Button>
                          </div>
                        )}

                        <div style={styles.acts}>
                          {live ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => onNav?.("meeting", { sessionId: m.activeSession!.id })}
                            >
                              Join
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={starting === m.id}
                              onClick={() => void startScheduled(m)}
                            >
                              {starting === m.id ? "Starting…" : "Start"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onNav?.("document", { projectId: m.projectId })}
                          >
                            Prep — project document
                          </Button>
                          {m.scheduledAt && (
                            <button type="button" style={styles.ics} onClick={() => downloadIcs(m)}>
                              add to your calendar (.ics)
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            ),
          )}

          {meetings.length === 0 && waiting.length === 0 && (
            <EmptyState
              message="Nothing on the docket. Meetings you schedule — and decisions still waiting for one — land here."
              action={
                <Button variant="primary" size="sm" onClick={() => openModal()}>
                  Schedule the first one
                </Button>
              }
            />
          )}

          {waiting.length > 0 && (
            <section>
              <div style={{ ...styles.band, color: colors.amber }}>
                <span>Awaiting a date</span>
                <span style={{ ...styles.bandCount, color: colors.amber }}>{waiting.length}</span>
                <span style={styles.bandRule} />
              </div>
              <p style={styles.awaitNote}>
                Unresolved from your checkpoints, with no meeting booked to settle them. Scheduling
                one carries its wording into the new meeting's goal.
              </p>

              <div style={styles.awaitBox}>
                {waiting.map((w) => (
                  <div key={w.id} style={styles.awaitRow}>
                    <span style={styles.awaitSrc}>{w.sourceMeeting ?? "Checkpoint"}</span>
                    <span style={styles.awaitText}>{w.text}</span>
                    <span style={styles.awaitAge}>open {daysOpen(w.since)}d</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        openModal(
                          {
                            goal: `Decide: ${w.text.replace(/\?+$/, "")}`,
                            title: "Decision meeting",
                          },
                          w.projectId ? { id: w.projectId, name: w.projectId } : undefined,
                        )
                      }
                    >
                      Schedule
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <NewMeetingModal
        open={modalOpen}
        onClose={closeModal}
        onSubmit={handleCreate}
        submitting={create.creating}
        error={create.error}
        defaultScheduled
        seed={seed}
        lockedProject={lockedProject}
      />
    </div>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]): Record<string, React.CSSProperties> {
  return {
    page: { height: "100%", overflowY: "auto", background: colors.bg },
    head: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 16,
      flexWrap: "wrap",
      marginBottom: SPACE[4],
    },
    h1: {
      margin: 0,
      color: colors.text,
      fontSize: "clamp(24px, 3vw, 34px)",
      fontWeight: 600,
      letterSpacing: "-.02em",
    },
    sub: { margin: "6px 0 0", color: colors.textMuted, fontSize: FONT.size.body },
    error: {
      background: colors.redBg,
      border: `1px solid ${colors.red}`,
      color: colors.red,
      borderRadius: 8,
      padding: "9px 11px",
      fontSize: FONT.size.label,
      marginBottom: SPACE[3],
    },
    band: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      margin: "26px 0 12px",
      fontFamily: FONT.mono,
      fontSize: FONT.size.micro,
      fontWeight: 700,
      letterSpacing: LETTER_SPACING.wide,
      textTransform: "uppercase",
      color: colors.textDim,
    },
    bandCount: { color: colors.accent },
    bandRule: { flex: 1, height: 1, background: colors.border },
    card: {
      display: "grid",
      gridTemplateColumns: "104px minmax(0,1fr)",
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: RADIUS.lg,
      overflow: "hidden",
      marginBottom: 10,
    },
    when: {
      padding: "13px 12px",
      borderRight: `1px solid ${colors.border}`,
      background: colors.surfaceMuted,
      display: "flex",
      flexDirection: "column",
      gap: 3,
    },
    whenDay: {
      fontFamily: FONT.mono,
      fontSize: FONT.size.label,
      fontWeight: 700,
      color: colors.text,
    },
    whenTime: { fontFamily: FONT.mono, fontSize: FONT.size.caption, color: colors.textMuted },
    whenDur: { fontFamily: FONT.mono, fontSize: FONT.size.micro, color: colors.textDim, marginTop: "auto" },
    livePill: {
      alignSelf: "flex-start",
      fontFamily: FONT.mono,
      fontSize: FONT.size.micro,
      fontWeight: 700,
      letterSpacing: LETTER_SPACING.wide,
      textTransform: "uppercase",
      background: colors.accent,
      color: colors.onAccent,
      borderRadius: RADIUS.pill,
      padding: "2px 8px",
    },
    body: { padding: "12px 14px", minWidth: 0 },
    topRow: { display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" },
    title: { color: colors.text, fontSize: 15.5, fontWeight: 600 },
    proj: {
      fontFamily: FONT.mono,
      fontSize: FONT.size.micro,
      letterSpacing: LETTER_SPACING.wide,
      textTransform: "uppercase",
      color: colors.textDim,
    },
    goal: { margin: "5px 0 0", color: colors.textMuted, fontSize: FONT.size.label, lineHeight: 1.5 },
    tags: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 },
    tag: {
      fontFamily: FONT.mono,
      fontSize: FONT.size.caption,
      padding: "3px 9px",
      borderRadius: RADIUS.pill,
      border: `1px solid ${colors.border}`,
      background: colors.surfaceMuted,
      color: colors.textMuted,
      cursor: "pointer",
    },
    tagOpen: { borderColor: colors.tealLight, background: colors.tealBg, color: colors.teal },
    tagWarn: { borderColor: colors.accentDim, background: colors.amberSubtle, color: colors.amber, cursor: "default" },
    threads: {
      marginTop: 9,
      padding: "10px 12px",
      background: colors.surfaceMuted,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
    },
    threadsNote: { margin: "0 0 8px", fontSize: FONT.size.label, color: colors.textMuted },
    acts: { display: "flex", alignItems: "center", gap: 8, marginTop: 11, flexWrap: "wrap" },
    ics: {
      marginLeft: "auto",
      background: "none",
      border: "none",
      borderBottom: `1px dotted ${colors.textDim}`,
      color: colors.textDim,
      fontFamily: FONT.mono,
      fontSize: FONT.size.caption,
      cursor: "pointer",
      padding: 0,
    },
    awaitNote: {
      margin: "0 0 10px",
      fontSize: FONT.size.label,
      color: colors.textMuted,
      lineHeight: 1.55,
      maxWidth: "70ch",
    },
    awaitBox: {
      background: colors.surface,
      border: `1px dashed ${colors.borderLight}`,
      borderRadius: RADIUS.lg,
      padding: "4px 14px 8px",
    },
    awaitRow: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
      padding: "11px 2px",
      borderBottom: `1px solid ${colors.border}`,
    },
    awaitSrc: {
      width: 110,
      flexShrink: 0,
      fontFamily: FONT.mono,
      fontSize: FONT.size.micro,
      letterSpacing: LETTER_SPACING.wide,
      textTransform: "uppercase",
      color: colors.textDim,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    awaitText: { flex: 1, minWidth: 200, color: colors.text, fontSize: FONT.size.body, lineHeight: 1.45 },
    awaitAge: { flexShrink: 0, fontFamily: FONT.mono, fontSize: FONT.size.caption, color: colors.amber },
  };
}
