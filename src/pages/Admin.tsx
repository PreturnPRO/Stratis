import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, ShieldOff, ShieldCheck, UserPlus, LogOut } from "lucide-react";
import type {
  AdminUserRow,
  BetaMetrics,
  FeedbackRecord,
  InviteRecord,
  InviteWithLink,
  Role,
} from "@shared/types";
import { Button, Chip, Modal } from "../components/ui";
import {
  Banner,
  Card,
  Field,
  PageShell,
  Select,
  StatTile,
  TabBar,
  TextArea,
  TextInput,
  Toggle,
} from "../components/panels";
import { EmptyState, LoadingState } from "../components/states";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import { apiFetch } from "../lib/http";
import { track } from "../lib/track";
import { FONT, RADIUS, SPACE } from "../tokens/colors";

const TABS = [
  { id: "team", label: "Team" },
  { id: "invites", label: "Invites" },
  { id: "usage", label: "Beta usage" },
  { id: "feedback", label: "Feedback" },
  { id: "release", label: "Release" },
];

export default function Admin() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("team");

  useEffect(() => {
    track("page_viewed", { page: "admin" }, "admin");
  }, []);

  if (!isAdmin) {
    return (
      <PageShell title="Admin">
        <Banner tone="danger">
          This area is for workspace admins. Ask an admin on your team to change your role if you need
          access.
        </Banner>
      </PageShell>
    );
  }

  return (
    <PageShell title="Admin" subtitle="Members, access, invite links, and how the beta is going.">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === "team" && <TeamTab />}
      {tab === "invites" && <InvitesTab />}
      {tab === "usage" && <UsageTab />}
      {tab === "feedback" && <FeedbackTab />}
      {tab === "release" && <ReleaseTab />}
    </PageShell>
  );
}

function TeamTab() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ users: AdminUserRow[] }>("/api/admin/users");
      setUsers(data.users);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the team");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, message: string) => {
    setError(null);
    try {
      await fn();
      setNotice(message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work");
    }
  };

  if (!users) return <LoadingState persist count={3} />;

  return (
    <>
      {error && <Banner tone="danger">{error}</Banner>}
      {notice && <Banner tone="success">{notice}</Banner>}

      <Card
        title={`Members (${users.length})`}
        description="Changing a role or revoking access takes effect immediately — the member is signed out on their next request."
        footer={
          <Button variant="primary" iconLeft={<UserPlus size={14} />} onClick={() => setCreating(true)}>
            Add member
          </Button>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {users.map((member) => (
            <div
              key={member.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: SPACE[1.5],
                padding: `${SPACE[1.5]}px 0`,
                borderBottom: `1px solid ${colors.border}`,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <div style={{ fontSize: FONT.size.body, color: colors.text }}>
                  {member.name}
                  {member.id === user?.id && (
                    <span style={{ color: colors.textDim, fontSize: FONT.size.caption }}> · you</span>
                  )}
                </div>
                <div style={{ fontSize: FONT.size.caption, color: colors.textDim }}>
                  {member.email}
                  {member.lastActiveAt
                    ? ` · active ${new Date(member.lastActiveAt).toLocaleDateString()}`
                    : " · never signed in"}
                </div>
              </div>

              <Chip color={member.status === "active" ? colors.green : colors.danger}>
                {member.status}
              </Chip>

              <Select
                aria-label={`Role for ${member.name}`}
                value={member.role}
                style={{ width: 140 }}
                onChange={(e) =>
                  void act(
                    () =>
                      apiFetch(`/api/admin/users/${member.id}`, {
                        method: "PATCH",
                        body: { role: e.target.value as Role },
                      }),
                    `${member.name} is now ${e.target.value}`,
                  )
                }
              >
                <option value="participant">Participant</option>
                <option value="facilitator">Facilitator</option>
                <option value="admin">Admin</option>
              </Select>

              {member.status === "active" ? (
                <Button
                  variant="danger"
                  size="sm"
                  iconLeft={<ShieldOff size={13} />}
                  disabled={member.id === user?.id}
                  onClick={() =>
                    void act(
                      () =>
                        apiFetch(`/api/admin/users/${member.id}/status`, {
                          method: "POST",
                          body: { status: "suspended", reason: "Suspended by an admin" },
                        }),
                      `${member.name} has been suspended`,
                    )
                  }
                >
                  Suspend
                </Button>
              ) : (
                <Button
                  variant="subtle"
                  size="sm"
                  iconLeft={<ShieldCheck size={13} />}
                  onClick={() =>
                    void act(
                      () =>
                        apiFetch(`/api/admin/users/${member.id}/status`, {
                          method: "POST",
                          body: { status: "active" },
                        }),
                      `${member.name} has access again`,
                    )
                  }
                >
                  Restore
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                iconLeft={<LogOut size={13} />}
                title="End every session this member has open"
                onClick={() =>
                  void act(
                    () => apiFetch(`/api/admin/users/${member.id}/sign-out`, { method: "POST" }),
                    `${member.name} was signed out everywhere`,
                  )
                }
              >
                Sign out
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {creating && (
        <CreateMemberModal
          onClose={() => setCreating(false)}
          onCreated={async (message) => {
            setNotice(message);
            setCreating(false);
            await load();
          }}
        />
      )}
    </>
  );
}

function CreateMemberModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (message: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("participant");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ temporaryPassword: string }>("/api/admin/users", {
        method: "POST",
        body: { name, email, role },
      });
      setPassword(data.temporaryPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create that account");
    } finally {
      setBusy(false);
    }
  };

  if (password) {
    return (
      <Modal
        title="Account created"
        onClose={() => void onCreated(`${name} was added to the workspace`)}
        footer={
          <Button variant="primary" onClick={() => void onCreated(`${name} was added to the workspace`)}>
            Done
          </Button>
        }
      >
        <p style={{ margin: 0, fontSize: FONT.size.body, color: colors.textMuted }}>
          Send {name} this temporary password. It is shown once and cannot be retrieved again — if you
          lose it, create a new one by resetting their password.
        </p>
        <code
          style={{
            display: "block",
            marginTop: SPACE[2],
            padding: SPACE[1.5],
            background: colors.surfaceMuted,
            border: `1px solid ${colors.border}`,
            borderRadius: RADIUS.md,
            fontFamily: FONT.mono,
            fontSize: FONT.size.body,
            color: colors.text,
            wordBreak: "break-all",
          }}
        >
          {password}
        </code>
      </Modal>
    );
  }

  return (
    <Modal
      title="Add a member"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={busy || !name.trim() || !email.trim()}>
            {busy ? "Creating…" : "Create account"}
          </Button>
        </>
      }
    >
      {error && <Banner tone="danger">{error}</Banner>}
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Email">
        <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Role" hint="Participants join meetings. Facilitators run them. Admins manage the workspace.">
        <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="participant">Participant</option>
          <option value="facilitator">Facilitator</option>
          <option value="admin">Admin</option>
        </Select>
      </Field>
    </Modal>
  );
}

function InvitesTab() {
  const { colors } = useTheme();
  const [invites, setInvites] = useState<InviteRecord[] | null>(null);
  const [role, setRole] = useState<Role>("participant");
  const [label, setLabel] = useState("");
  const [expiresInHours, setExpiresInHours] = useState("168");
  const [maxUses, setMaxUses] = useState("");
  const [created, setCreated] = useState<InviteWithLink | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ invites: InviteRecord[] }>("/api/invite");
      setInvites(data.invites);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load invite links");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setError(null);
    try {
      const data = await apiFetch<{ invite: InviteWithLink }>("/api/invite", {
        method: "POST",
        body: {
          kind: "workspace",
          role,
          label: label || null,
          expiresInHours: Number(expiresInHours) || null,
          maxUses: maxUses ? Number(maxUses) : null,
        },
      });
      setCreated(data.invite);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create that link");
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    track("invite_link_copied", { kind: "workspace" }, "admin");
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      {error && <Banner tone="danger">{error}</Banner>}

      <Card
        title="Invite someone to this workspace"
        description="Anyone with the link can join with the role you pick, until it expires or is used up."
        footer={
          <Button variant="primary" iconLeft={<Link2 size={14} />} onClick={create}>
            Create link
          </Button>
        }
      >
        <Field label="Role they join as">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="participant">Participant</option>
            <option value="facilitator">Facilitator</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <Field label="Label" hint="For your own reference — e.g. 'Beta team, batch 2'.">
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <div style={{ display: "flex", gap: SPACE[2] }}>
          <div style={{ flex: 1 }}>
            <Field label="Expires in (hours)" hint="Leave blank for no expiry.">
              <TextInput
                inputMode="numeric"
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(e.target.value)}
              />
            </Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Maximum uses" hint="Blank means unlimited.">
              <TextInput inputMode="numeric" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
            </Field>
          </div>
        </div>

        {created && (
          <div
            style={{
              marginTop: SPACE[1],
              padding: SPACE[1.5],
              background: colors.surfaceMuted,
              border: `1px solid ${colors.border}`,
              borderRadius: RADIUS.md,
            }}
          >
            <div style={{ fontSize: FONT.size.caption, color: colors.textDim, marginBottom: 6 }}>
              Copy this now — the link is not shown again.
            </div>
            <div style={{ display: "flex", gap: SPACE[1], alignItems: "center" }}>
              <code
                style={{
                  flex: 1,
                  fontFamily: FONT.mono,
                  fontSize: FONT.size.label,
                  color: colors.text,
                  wordBreak: "break-all",
                }}
              >
                {created.url}
              </code>
              <Button size="sm" iconLeft={<Copy size={13} />} onClick={() => void copy(created.url)}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Existing links">
        {!invites ? (
          <LoadingState persist count={2} />
        ) : invites.length === 0 ? (
          <EmptyState message="No invite links yet" />
        ) : (
          invites.map((invite) => {
            const dead =
              Boolean(invite.revokedAt) ||
              (invite.expiresAt !== null && new Date(invite.expiresAt) < new Date()) ||
              (invite.maxUses !== null && invite.usedCount >= invite.maxUses);
            return (
              <div
                key={invite.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: SPACE[1.5],
                  padding: `${SPACE[1.5]}px 0`,
                  borderBottom: `1px solid ${colors.border}`,
                  opacity: dead ? 0.55 : 1,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: FONT.size.body, color: colors.text }}>
                    {invite.label || (invite.kind === "session" ? "Meeting link" : "Workspace link")}
                  </div>
                  <div style={{ fontSize: FONT.size.caption, color: colors.textDim }}>
                    {invite.role} · used {invite.usedCount}
                    {invite.maxUses !== null ? ` of ${invite.maxUses}` : ""}
                    {invite.expiresAt ? ` · expires ${new Date(invite.expiresAt).toLocaleDateString()}` : ""}
                  </div>
                </div>
                {invite.revokedAt ? (
                  <Chip color={colors.textDim}>revoked</Chip>
                ) : (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() =>
                      void apiFetch(`/api/invite/${invite.id}/revoke`, { method: "POST" }).then(load)
                    }
                  >
                    Revoke
                  </Button>
                )}
              </div>
            );
          })
        )}
      </Card>
    </>
  );
}

function UsageTab() {
  const { colors } = useTheme();
  const [metrics, setMetrics] = useState<BetaMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ metrics: BetaMetrics }>("/api/admin/metrics")
      .then((data) => setMetrics(data.metrics))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load metrics"));
  }, []);

  if (error) return <Banner tone="danger">{error}</Banner>;
  if (!metrics) return <LoadingState persist count={3} />;

  const peak = Math.max(1, ...metrics.dailyActive.map((d) => d.users));

  return (
    <>
      <Card title="Who is using it" description="Active members, counted from tracked events.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE[1.5] }}>
          <StatTile label="Active today" value={metrics.activeUsers.daily} />
          <StatTile label="Active this week" value={metrics.activeUsers.weekly} />
          <StatTile label="Active this month" value={metrics.activeUsers.monthly} />
          <StatTile label="Members" value={metrics.members.total} />
        </div>
      </Card>

      <Card title="Meetings and sessions">
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE[1.5] }}>
          <StatTile label="Meetings" value={metrics.meetings.total} hint={`${metrics.meetings.last7d} in 7 days`} />
          <StatTile label="Sessions" value={metrics.sessions.total} hint={`${metrics.sessions.last7d} in 7 days`} />
          <StatTile
            label="Avg length"
            value={metrics.sessions.avgMinutes ? `${Math.round(metrics.sessions.avgMinutes)}m` : "—"}
          />
        </div>
      </Card>

      <Card
        title="Alignment checkpoint"
        description="The number that says whether the product is doing its job."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE[1.5] }}>
          <StatTile label="Decisions captured" value={metrics.checkpoint.decisions} />
          <StatTile label="Sessions with decisions" value={metrics.checkpoint.sessionsWithDecisions} />
          <StatTile
            label="Complete rate"
            value={
              metrics.checkpoint.completeRate === null
                ? "—"
                : `${Math.round(metrics.checkpoint.completeRate * 100)}%`
            }
            hint="Decisions with an owner and a date"
          />
        </div>
      </Card>

      <Card title="Daily active members" description="Last 30 days.">
        {metrics.dailyActive.length === 0 ? (
          <EmptyState message="No activity recorded yet" />
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }}>
            {metrics.dailyActive.map((day) => (
              <div
                key={day.day}
                title={`${day.day}: ${day.users}`}
                style={{
                  flex: 1,
                  minWidth: 3,
                  height: `${Math.max(4, (day.users / peak) * 100)}%`,
                  background: colors.accent,
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
        )}
      </Card>

      <Card title="What they do most" description="Top tracked events, last 30 days.">
        {metrics.topEvents.length === 0 ? (
          <EmptyState message="No events recorded yet" />
        ) : (
          metrics.topEvents.map((row) => (
            <div
              key={row.event}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: `1px solid ${colors.border}`,
                fontSize: FONT.size.body,
              }}
            >
              <span style={{ color: colors.textMuted, fontFamily: FONT.mono, fontSize: FONT.size.label }}>
                {row.event}
              </span>
              <span style={{ color: colors.text }}>{row.count}</span>
            </div>
          ))
        )}
      </Card>
    </>
  );
}

function FeedbackTab() {
  const { colors } = useTheme();
  const [items, setItems] = useState<FeedbackRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ feedback: FeedbackRecord[] }>("/api/admin/feedback");
      setItems(data.feedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load feedback");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <Banner tone="danger">{error}</Banner>;
  if (!items) return <LoadingState persist count={3} />;
  if (items.length === 0) {
    return <EmptyState message="No feedback yet. The button lives in the sidebar for everyone on the team." />;
  }

  return (
    <Card title={`Feedback (${items.length})`}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            padding: `${SPACE[1.5]}px 0`,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ display: "flex", gap: SPACE[1], alignItems: "center", marginBottom: 4 }}>
            <Chip>{item.kind}</Chip>
            {item.rating !== null && <Chip>{item.rating}/10</Chip>}
            <span style={{ fontSize: FONT.size.caption, color: colors.textDim }}>
              {item.userName ?? "Anonymous"} · {new Date(item.createdAt).toLocaleString()}
              {item.surface ? ` · ${item.surface}` : ""}
            </span>
            <div style={{ marginLeft: "auto" }}>
              <Select
                aria-label="Feedback status"
                value={item.status}
                style={{ width: 120 }}
                onChange={(e) =>
                  void apiFetch(`/api/admin/feedback/${item.id}`, {
                    method: "PATCH",
                    body: { status: e.target.value },
                  }).then(load)
                }
              >
                <option value="new">New</option>
                <option value="triaged">Triaged</option>
                <option value="resolved">Resolved</option>
                <option value="wontfix">Won't fix</option>
              </Select>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: FONT.size.body, color: colors.text, whiteSpace: "pre-wrap" }}>
            {item.message}
          </p>
        </div>
      ))}
    </Card>
  );
}

function ReleaseTab() {
  const { colors } = useTheme();
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [forceLogout, setForceLogout] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/admin/release", {
        method: "POST",
        body: { version, notes: notes || null, forceLogout },
      });
      setResult(
        forceLogout
          ? `Release ${version} published. Everyone signed in before now will be asked to sign in again.`
          : `Release ${version} recorded.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish that release");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && <Banner tone="danger">{error}</Banner>}
      {result && <Banner tone="success">{result}</Banner>}

      <Card
        title="Publish a release"
        description="Records the version you have just deployed, and optionally ends every session that started before it."
        footer={
          <Button variant="primary" onClick={publish} disabled={busy || !version.trim()}>
            {busy ? "Publishing…" : "Publish release"}
          </Button>
        }
      >
        <Field label="Version" hint="Whatever you deployed — a tag, a date, or a commit.">
          <TextInput value={version} onChange={(e) => setVersion(e.target.value)} placeholder="2026-08-01" />
        </Field>
        <Field label="Notes" hint="Optional. Shown to admins, not to participants.">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Toggle
          checked={forceLogout}
          onChange={setForceLogout}
          label="Sign everyone out"
          description="Use this when the release changes the API or the login flow. Do not use it while a meeting is being recorded — it will end the facilitator's session."
        />
      </Card>

      <Card title="Before you publish">
        <ul style={{ margin: 0, paddingLeft: 18, color: colors.textMuted, fontSize: FONT.size.body, lineHeight: 1.7 }}>
          <li>Check no session is active. A forced sign-out cuts a live recording.</li>
          <li>Open suggestion cards are held in memory — deploying the backend loses them.</li>
          <li>Run the database migration first if the release adds columns.</li>
        </ul>
      </Card>
    </>
  );
}
