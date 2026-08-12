import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { DEFAULT_USER_SETTINGS, type SubscriptionView, type User, type UserSettings } from "@shared/types";
import { Button } from "../components/ui";
import {
  Banner,
  Card,
  Field,
  PageShell,
  StatTile,
  TabBar,
  TextArea,
  TextInput,
  Toggle,
} from "../components/panels";
import { LoadingState } from "../components/states";
import { useAuth } from "../context/AuthContext";
import { ACCENTS, adaptAccent, useTheme } from "../hooks/useTheme";
import { useLang } from "../hooks/useLang";
import { ProLock } from "../components/ProLock";
import { useCachedQuery } from "../lib/cache";
import { ApiError, apiFetch } from "../lib/http";
import { track } from "../lib/track";
import { FONT, SPACE } from "../tokens/colors";
import { localeTag } from "../i18n/locale";

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
  const { user, refreshUser, subscription, refreshSubscription } = useAuth();
  const [tab, setTab] = useState("profile");

  // Your own settings are the last thing that should need a round trip to be
  // readable. The cached copy is shown at once and corrected in place when the
  // server answers, so a slow or unreachable backend costs you freshness
  // rather than the whole screen.
  const query = useCachedQuery<ProfileResponse>(
    "profile",
    useCallback(() => apiFetch<ProfileResponse>("/api/profile"), []),
    { scope: user?.id },
  );

  const data = query.data;
  const loading = query.loading;
  const error = query.error;
  const load = query.refresh;

  useEffect(() => {
    track("page_viewed", { page: "settings" }, "settings");
  }, []);

  return (
    <PageShell
      title="Settings"
      subtitle={data ? `${data.profile.email} · ${data.organization.name}` : undefined}
    >
      {/* A failed load is not announced. The page renders as it always does,
          and the failure is reported by whichever action actually needs the
          server — at the moment it is pressed, where it means something. */}
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === "profile" && (
        <ProfileTab
          profile={data?.profile ?? null}
          loading={loading}
          onSaved={async () => { await load(); await refreshUser(); }}
        />
      )}

      {tab === "preferences" && (
        <PreferencesTab
          initial={data?.profile.settings ?? DEFAULT_USER_SETTINGS}
          canTheme={Boolean(subscription?.features?.includes("custom_theme"))}
          onSeePricing={() => onNav?.("pricing")}
        />
      )}

      {tab === "plan" && (
        <PlanTab
          subscription={subscription}
          failed={Boolean(error)}
          onRefresh={refreshSubscription}
          onSeePricing={() => onNav?.("pricing")}
        />
      )}

      {tab === "security" && (
        <SecurityTab
          profile={data?.profile ?? null}
          canSetPassword={data?.canSetPassword ?? false}
          colors={colors}
        />
      )}
    </PageShell>
  );
}

/**
 * Renders its own structure whether or not the profile has arrived.
 *
 * The page used to gate on the fetch: no data meant no cards, no field labels,
 * nothing — a blank panel under a tab bar. But the shape of this screen is
 * static. Only the values need the server, so only the values wait for it, and
 * the fields stay on screen (disabled) until they can be filled.
 */
function ProfileTab({
  profile,
  loading,
  onSaved,
}: {
  profile: User | null;
  loading: boolean;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(profile?.name ?? "");
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [timezone, setTimezone] = useState(
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
  );
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? "");

  // The profile can arrive after the first paint — from the cache, or from a
  // retry that finally reached the server. Adopt it, but never over a field the
  // person has already started editing.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!profile || hydrated.current) return;
    hydrated.current = true;
    setName(profile.name);
    setJobTitle(profile.jobTitle ?? "");
    setBio(profile.bio ?? "");
    setTimezone(profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
    setAvatarUrl(profile.avatarUrl ?? "");
  }, [profile]);
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

  // Dashes rather than blanks: an empty row reads as "you have no email".
  const placeholder = loading ? "…" : "—";

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
          label="Profile picture"
          hint="A link to an image — jpg, png or gif."
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
        <ReadOnlyRow label="Email" value={profile?.email ?? placeholder} />
        <ReadOnlyRow label="Role" value={profile?.role ?? placeholder} />
        <ReadOnlyRow
          label="Sign-in method"
          value={
            profile ? (profile.authProvider === "google" ? "Google" : "Email & password") : placeholder
          }
        />
        <ReadOnlyRow
          label="Member since"
          value={profile ? new Date(profile.createdAt).toLocaleDateString(localeTag()) : placeholder}
        />
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

function PreferencesTab({
  initial,
  canTheme,
  onSeePricing,
}: {
  initial: UserSettings;
  /** Whether this workspace's plan includes changing the theme. */
  canTheme: boolean;
  onSeePricing: () => void;
}) {
  const { theme, toggleTheme, colors, accent, setAccent, customAccent, setCustomAccent } =
    useTheme();
  const { lang, setLang } = useLang();
  const [settings, setSettings] = useState<UserSettings>({ ...DEFAULT_USER_SETTINGS, ...initial });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const update = async (patch: Partial<UserSettings>) => {
    // Move the control now — a toggle that waits on the network feels broken.
    // But if the write is refused, put it back: a switch left showing ON for a
    // preference the server never accepted is a lie the user acts on later.
    const previous = settings;
    setSettings({ ...settings, ...patch });
    setSaving(true);
    try {
      await apiFetch("/api/profile/settings", { method: "PATCH", body: patch });
      setMessage("Saved");
      setTimeout(() => setMessage(null), 1500);
    } catch {
      setSettings(previous);
      setMessage("Could not save that");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {message && <Banner tone={message === "Saved" ? "success" : "danger"}>{message}</Banner>}

      {/* Every control here changes something. Transcript language, suggestion
          sound, auto-send, email delivery and reduce-motion were all removed:
          each wrote a value to the database that nothing anywhere read, which
          is worse than the setting not existing — it tells the customer a
          promise the product does not keep. */}
      <Card title="Notifications">
        <Toggle
          checked={Boolean(settings.inAppNotifications)}
          onChange={(v) => void update({ inAppNotifications: v })}
          label="In-app notifications"
          description="Tells you when a project document is updated after a meeting."
          disabled={saving}
        />
      </Card>

      {/* Language and appearance both live here now. The sidebar rail is for
          destinations; these are preferences you set once. */}
      <Card title="Language" description="Applies to the whole interface.">
        <div style={{ display: "flex", alignItems: "center", gap: SPACE[1.5], flexWrap: "wrap" }}>
          {([["en", "English"], ["th", "ไทย"]] as const).map(([code, label]) => {
            const active = lang === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setLang(code)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: `1px solid ${active ? colors.accent : colors.border}`,
                  background: active ? colors.surfaceHover : "transparent",
                  color: active ? colors.text : colors.textMuted,
                  fontSize: FONT.size.label,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Appearance lives here rather than in the sidebar rail: the rail is for
          navigation, and a control you touch once a month was crowding the
          pages people click every day. */}
      <Card
        title="Appearance"
        description="Theme and workspace colour. Applies to this browser."
      >
        <ProLock
          locked={!canTheme}
          feature="Theme and workspace colour"
          blurb="Dark mode, eight workspace colours, and any custom colour you like."
          onSeePricing={onSeePricing}
        >
          <div style={{ display: "flex", alignItems: "center", gap: SPACE[1.5], flexWrap: "wrap" }}>
            {(["light", "dark"] as const).map((option) => {
              const active = theme === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    if (active) return;
                    toggleTheme();
                  }}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 999,
                    border: `1px solid ${active ? colors.accent : colors.border}`,
                    background: active ? colors.surfaceHover : "transparent",
                    color: active ? colors.text : colors.textMuted,
                    fontSize: FONT.size.label,
                    cursor: "pointer",
                  }}
                >
                  {option === "light" ? "Light" : "Dark"}
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACE[1],
              flexWrap: "wrap",
              marginTop: SPACE[2],
            }}
          >
            {ACCENTS.map((option) => {
              const active = accent === option.id;
              // The swatch shows the colour as it will actually be applied on
              // this theme, not the raw hue — otherwise you pick one colour and
              // the app takes on another.
              const swatch = adaptAccent(option.hex, theme);
              return (
                <button
                  key={option.id}
                  type="button"
                  title={option.label}
                  aria-label={option.label}
                  aria-pressed={active}
                  onClick={() => setAccent(option.id)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: swatch,
                    border: active ? `2px solid ${colors.text}` : `1px solid ${colors.border}`,
                    cursor: "pointer",
                  }}
                />
              );
            })}

            {/* Any colour at all. The native picker is the one control every
                platform already knows how to render well. */}
            <label
              title="Custom colour"
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: adaptAccent(customAccent, theme),
                border:
                  accent === "custom"
                    ? `2px solid ${colors.text}`
                    : `1px dashed ${colors.borderLight}`,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Plus size={14} color={colors.onAccent} />
              <input
                type="color"
                value={customAccent}
                onChange={(e) => setCustomAccent(e.target.value)}
                aria-label="Custom colour"
                style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
              />
            </label>
          </div>

          <p
            style={{
              margin: `${SPACE[1.5]}px 0 0`,
              fontSize: FONT.size.caption,
              color: colors.textDim,
            }}
          >
            Colours are adjusted to stay readable on the theme you are using.
          </p>
        </ProLock>
      </Card>

    </>
  );
}

function PlanTab({
  subscription,
  failed,
  onRefresh,
  onSeePricing,
}: {
  subscription: SubscriptionView | null;
  /** The page-level load error, so a failure stops looking like loading. */
  failed?: boolean;
  onRefresh: () => Promise<void>;
  onSeePricing: () => void;
}) {
  useEffect(() => {
    void onRefresh();
  }, [onRefresh]);

  // Without the `failed` branch this skeleton was permanent: a failed request
  // leaves `subscription` null forever, so the tab shimmered indefinitely and
  // never said why.
  if (!subscription) {
    return failed ? (
      <Banner tone="danger">
        Your plan and usage could not be loaded. Nothing about your subscription has changed.
      </Banner>
    ) : (
      <LoadingState persist count={2} />
    );
  }

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
  /** Null while the profile is unavailable — the form still renders. */
  profile: User | null;
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
        {profile?.lastActiveAt && (
          <p style={{ margin: `${SPACE[1.5]}px 0 0`, fontSize: FONT.size.label, color: colors.textMuted }}>
            Last seen {new Date(profile.lastActiveAt).toLocaleString(localeTag())}
          </p>
        )}
      </Card>
    </>
  );
}
