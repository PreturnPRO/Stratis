import { useCallback, useEffect, useState } from "react";
import { DEFAULT_USER_SETTINGS, type SubscriptionView, type User, type UserSettings } from "@shared/types";
import { Button } from "../components/ui";
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
import { LoadingState } from "../components/states";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import { ApiError, apiFetch } from "../lib/http";
import { track } from "../lib/track";
import { FONT, SPACE } from "../tokens/colors";

interface ProfileResponse {
  profile: User;
  organization: { id: string; name: string; plan: string; isBeta: boolean };
  canSetPassword: boolean;
}

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "preferences", label: "Preferences" },
  { id: "plan", label: "Plan & usage" },
  { id: "security", label: "Security" },
];

export default function Settings({ onNav }: { onNav?: (id: string, params?: Record<string, string>) => void }) {
  const { colors } = useTheme();
  const { refreshUser, subscription, refreshSubscription } = useAuth();
  const [tab, setTab] = useState("profile");
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiFetch<ProfileResponse>("/api/profile"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    track("page_viewed", { page: "settings" }, "settings");
  }, [load]);

  if (loading && !data) {
    return (
      <PageShell title="Settings">
        <LoadingState persist count={2} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Settings"
      subtitle={data ? `${data.profile.email} · ${data.organization.name}` : undefined}
    >
      {error && <Banner tone="danger">{error}</Banner>}
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === "profile" && data && (
        <ProfileTab profile={data.profile} onSaved={async () => { await load(); await refreshUser(); }} />
      )}

      {tab === "preferences" && data && <PreferencesTab initial={data.profile.settings ?? DEFAULT_USER_SETTINGS} />}

      {tab === "plan" && (
        <PlanTab
          subscription={subscription}
          onRefresh={refreshSubscription}
          onSeePricing={() => onNav?.("pricing")}
        />
      )}

      {tab === "security" && data && (
        <SecurityTab
          profile={data.profile}
          canSetPassword={data.canSetPassword}
          colors={colors}
        />
      )}
    </PageShell>
  );
}

function ProfileTab({ profile, onSaved }: { profile: User; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(profile.name);
  const [jobTitle, setJobTitle] = useState(profile.jobTitle ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [timezone, setTimezone] = useState(
    profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
  );
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        body: {
          name,
          jobTitle: jobTitle || null,
          bio: bio || null,
          timezone: timezone || null,
          avatarUrl: avatarUrl || null,
        },
      });
      await onSaved();
      setMessage("Profile saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {message && <Banner tone="success">{message}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}

      <Card
        title="Your profile"
        description="How your name appears on decisions, summaries, and the meeting room."
        footer={
          <Button variant="primary" onClick={save} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        }
      >
        <Field label="Display name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Role or title" hint="Shown next to your name — e.g. Product Lead">
          <TextInput value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Time zone" hint="Used for meeting times and due dates.">
          <TextInput
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="Asia/Bangkok"
          />
        </Field>
        <Field
          label="Avatar image URL"
          hint="An https link to an image. There is no file upload in this build yet."
        >
          <TextInput
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="About" hint="Optional. A line of context for teammates.">
          <TextArea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={400} />
        </Field>
      </Card>

      <Card title="Account">
        <ReadOnlyRow label="Email" value={profile.email} />
        <ReadOnlyRow label="Role" value={profile.role} />
        <ReadOnlyRow label="Sign-in method" value={profile.authProvider === "google" ? "Google" : "Email & password"} />
        <ReadOnlyRow label="Member since" value={new Date(profile.createdAt).toLocaleDateString()} />
      </Card>
    </>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: SPACE[2],
        padding: `${SPACE[1.5]}px 0`,
        borderBottom: `1px solid ${colors.border}`,
        fontSize: FONT.size.body,
      }}
    >
      <span style={{ color: colors.textDim }}>{label}</span>
      <span style={{ color: colors.text }}>{value}</span>
    </div>
  );
}

function PreferencesTab({ initial }: { initial: UserSettings }) {
  const [settings, setSettings] = useState<UserSettings>({ ...DEFAULT_USER_SETTINGS, ...initial });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = async (patch: Partial<UserSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await apiFetch("/api/profile/settings", { method: "PATCH", body: patch });
      setMessage("Saved");
      setTimeout(() => setMessage(null), 1500);
    } catch {
      setMessage("Could not save that");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {message && <Banner tone={message === "Saved" ? "success" : "danger"}>{message}</Banner>}

      <Card title="Meeting" description="How Stratis behaves while you are running a session.">
        <Field label="Transcript language" hint="The primary language Stratis listens for.">
          <Select
            value={settings.transcriptLanguage}
            onChange={(e) => void update({ transcriptLanguage: e.target.value })}
          >
            <option value="th-TH">Thai (th-TH)</option>
            <option value="en-US">English (en-US)</option>
          </Select>
        </Field>
        <Toggle
          checked={Boolean(settings.suggestionSound)}
          onChange={(v) => void update({ suggestionSound: v })}
          label="Sound on new suggestion"
          description="A quiet tone when a card arrives. Off by default — the room can hear you."
          disabled={saving}
        />
        <Toggle
          checked={Boolean(settings.autoSendSummary)}
          onChange={(v) => void update({ autoSendSummary: v })}
          label="Send the summary automatically"
          description="Skip the review step and release the summary to participants when the meeting ends."
          disabled={saving}
        />
      </Card>

      <Card title="Notifications">
        <Toggle
          checked={Boolean(settings.inAppNotifications)}
          onChange={(v) => void update({ inAppNotifications: v })}
          label="In-app notifications"
          disabled={saving}
        />
        <Toggle
          checked={Boolean(settings.emailSummary)}
          onChange={(v) => void update({ emailSummary: v })}
          label="Email me the post-meeting summary"
          description="Email delivery is not connected in this build — the preference is stored and will apply when it is."
          disabled={saving}
        />
      </Card>

      <Card title="Accessibility">
        <Toggle
          checked={Boolean(settings.reduceMotion)}
          onChange={(v) => void update({ reduceMotion: v })}
          label="Reduce motion"
          description="Shorter transitions between screens."
          disabled={saving}
        />
      </Card>
    </>
  );
}

function PlanTab({
  subscription,
  onRefresh,
  onSeePricing,
}: {
  subscription: SubscriptionView | null;
  onRefresh: () => Promise<void>;
  onSeePricing: () => void;
}) {
  useEffect(() => {
    void onRefresh();
  }, [onRefresh]);

  if (!subscription) return <LoadingState persist count={2} />;

  const { plan, usage, limits, state, pendingRequest } = subscription;
  const meetingLimit = limits.meetingsPerMonth;
  const seatLimit = limits.seats;

  return (
    <>
      {state.isBeta && (
        <Banner tone="success">
          This workspace is on the beta programme — thank you. Your feedback shapes what ships next.
        </Banner>
      )}
      {pendingRequest && (
        <Banner>
          An upgrade to {pendingRequest.toPlan} is waiting on us. We will be in touch to arrange it.
        </Banner>
      )}

      <Card title={`${plan.name} plan`} description={plan.tagline}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE[1.5] }}>
          <StatTile
            label="Meetings this month"
            value={usage.meetingsThisMonth}
            hint={meetingLimit === null ? "Unlimited" : `of ${meetingLimit}`}
          />
          <StatTile
            label="Members"
            value={usage.seatsUsed}
            hint={seatLimit === null ? "Unlimited" : `of ${seatLimit}`}
          />
          <StatTile label="Sessions this month" value={usage.sessionsThisMonth} />
        </div>
      </Card>

      <Card
        title="Change plan"
        description="During beta, upgrades are arranged by the Stratis team rather than charged in-app."
        footer={<Button variant="primary" onClick={onSeePricing}>See plans</Button>}
      />
    </>
  );
}

function SecurityTab({
  profile,
  canSetPassword,
  colors,
}: {
  profile: User;
  canSetPassword: boolean;
  colors: { textMuted: string };
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (next !== confirm) {
      setError("The two new passwords do not match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/profile/password", {
        method: "POST",
        body: { currentPassword: current, newPassword: next },
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change your password");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Banner tone="success">
        Password changed. Every device signed in as this account has been signed out — including this
        one. Please sign in again.
      </Banner>
    );
  }

  return (
    <>
      {error && <Banner tone="danger">{error}</Banner>}
      <Card
        title={canSetPassword ? "Add a password" : "Change password"}
        description={
          canSetPassword
            ? "You sign in with Google. Adding a password gives you a second way in."
            : "Changing your password signs out every device, including this one."
        }
        footer={
          <Button variant="primary" onClick={submit} disabled={busy || next.length < 8}>
            {busy ? "Saving…" : canSetPassword ? "Set password" : "Change password"}
          </Button>
        }
      >
        {!canSetPassword && (
          <Field label="Current password">
            <TextInput
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
        )}
        <Field label="New password" hint="At least 8 characters.">
          <TextInput
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password">
          <TextInput
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </Card>

      <Card title="Sessions">
        <p style={{ margin: 0, fontSize: FONT.size.body, color: colors.textMuted }}>
          Stratis signs you in for up to a week at a time. A workspace admin can end your sessions,
          and a Stratis release ends every session that started before it — you will be asked to sign
          in again when that happens.
        </p>
        {profile.lastActiveAt && (
          <p style={{ margin: `${SPACE[1.5]}px 0 0`, fontSize: FONT.size.label, color: colors.textMuted }}>
            Last seen {new Date(profile.lastActiveAt).toLocaleString()}
          </p>
        )}
      </Card>
    </>
  );
}
