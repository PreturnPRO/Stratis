import { useEffect, useState } from "react";
import type { GuestSession, InvitePreview } from "@shared/types";
import { Button } from "../components/ui";
import { Banner, Card, Field, TextInput } from "../components/panels";
import { LoadingState } from "../components/states";
import { useAuth } from "../context/AuthContext";
import { ACTIVE_SESSION_KEY } from "../hooks/useCreateMeeting";
import { useTheme } from "../hooks/useTheme";
import { apiFetch } from "../lib/http";
import { track } from "../lib/track";
import { FONT, RADIUS, SPACE } from "../tokens/colors";

const GUEST_STORAGE_KEY = "stratis.guest.v1";

/**
 * The landing page for every invite link, signed in or not.
 *
 * It has to work for four arrivals: a member who is already signed in, a
 * member who is not, someone with no account at all, and someone holding a link
 * that has expired. The preview call is deliberately unauthenticated so the
 * fourth case gets a straight answer instead of a login wall.
 */
export default function Join({
  token,
  onNav,
  onNavigateAuth,
}: {
  token: string;
  onNav?: (id: string, params?: Record<string, string>) => void;
  onNavigateAuth?: (page: "login" | "register" | "landing") => void;
}) {
  const { colors } = useTheme();
  const { isAuthed, logout } = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [guestName, setGuestName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    track("join_page_viewed", undefined, "join");
    void apiFetch<{ preview: InvitePreview }>(`/api/invite/preview/${encodeURIComponent(token)}`, {
      anonymous: true,
    })
      .then((data) => setPreview(data.preview))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not read that link"));
  }, [token]);

  const acceptAsMember = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{
        kind: "workspace" | "session";
        sessionId?: string;
        reauthRequired?: boolean;
      }>(`/api/invite/${encodeURIComponent(token)}/accept`, { method: "POST" });

      if (data.kind === "session" && data.sessionId) {
        // The Meeting page opens whatever session id is in this key — passing
        // it as a nav param alone would land them in the room they were last
        // in, not the one they were invited to.
        window.localStorage.setItem(ACTIVE_SESSION_KEY, data.sessionId);
        onNav?.("meeting", { sessionId: data.sessionId });
        return;
      }

      if (data.reauthRequired) {
        // The token still says the old workspace. Sign out rather than let the
        // app run for a minute against a workspace this account has left.
        setDone("You have joined the workspace. Please sign in again to continue.");
        logout();
        return;
      }
      setDone("You are already a member of this workspace.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept that invite");
    } finally {
      setBusy(false);
    }
  };

  const joinAsGuest = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ guest: GuestSession }>(
        `/api/invite/${encodeURIComponent(token)}/guest`,
        { method: "POST", anonymous: true, body: { name: guestName } },
      );
      window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(data.guest));
      setDone(
        `You are in as ${data.guest.displayName}. The facilitator can see you have joined and you are on the record for this meeting. Guest accounts cannot open the summary yet — ask the facilitator to send it to you.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join as a guest");
    } finally {
      setBusy(false);
    }
  };

  const frame = (children: React.ReactNode) => (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.bg,
        color: colors.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: SPACE[3],
      }}
    >
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div
          style={{
            fontSize: FONT.size.caption,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: colors.accent,
            marginBottom: SPACE[2],
          }}
        >
          Stratis
        </div>
        {children}
      </div>
    </div>
  );

  if (error && !preview) return frame(<Banner tone="danger">{error}</Banner>);
  if (!preview) return frame(<LoadingState persist count={1} />);

  if (!preview.valid) {
    return frame(
      <Card title="This link no longer works" description={preview.reason}>
        <Button variant="primary" onClick={() => onNavigateAuth?.("landing")}>
          Go to Stratis
        </Button>
      </Card>,
    );
  }

  if (done) {
    return frame(
      <Card title="You're in">
        <p style={{ margin: 0, fontSize: FONT.size.body, color: colors.textMuted, lineHeight: 1.7 }}>
          {done}
        </p>
        <div style={{ marginTop: SPACE[2] }}>
          <Button variant="primary" onClick={() => onNavigateAuth?.("login")}>
            Continue
          </Button>
        </div>
      </Card>,
    );
  }

  const heading =
    preview.kind === "session"
      ? preview.meetingTitle
        ? `Join “${preview.meetingTitle}”`
        : "Join this meeting"
      : `Join ${preview.orgName}`;

  return frame(
    <>
      {error && <Banner tone="danger">{error}</Banner>}

      <Card
        title={heading}
        description={
          preview.kind === "session"
            ? preview.sessionStatus === "ended"
              ? "This meeting has already ended — you can still join to see the summary."
              : "You have been invited to a meeting on Stratis."
            : `You have been invited to ${preview.orgName} as a ${preview.role}.`
        }
      >
        {isAuthed ? (
          <Button variant="primary" fullWidth onClick={acceptAsMember} disabled={busy}>
            {busy ? "Joining…" : "Join with my account"}
          </Button>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1] }}>
              <Button variant="primary" fullWidth onClick={() => onNavigateAuth?.("register")}>
                Create an account
              </Button>
              <Button fullWidth onClick={() => onNavigateAuth?.("login")}>
                I already have an account
              </Button>
            </div>

            {preview.allowGuest && (
              <div
                style={{
                  marginTop: SPACE[2.5],
                  paddingTop: SPACE[2],
                  borderTop: `1px solid ${colors.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: FONT.size.caption,
                    color: colors.textDim,
                    marginBottom: SPACE[1.5],
                  }}
                >
                  Or join as a guest — no account, this meeting only.
                </div>
                <Field label="Your name">
                  <TextInput
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="How you appear in the room"
                    maxLength={60}
                  />
                </Field>
                <Button fullWidth onClick={joinAsGuest} disabled={busy || !guestName.trim()}>
                  {busy ? "Joining…" : "Join as guest"}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <p
        style={{
          margin: `${SPACE[2]}px 0 0`,
          fontSize: FONT.size.caption,
          color: colors.textDim,
          lineHeight: 1.6,
          padding: SPACE[1.5],
          borderRadius: RADIUS.md,
          background: colors.surfaceMuted,
        }}
      >
        Stratis records and transcribes the meeting to build the summary. Everyone in the room should
        know it is running.
      </p>
    </>,
  );
}
