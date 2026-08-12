import { useEffect, useState } from "react";
import { Check, Minus } from "lucide-react";
import type { FeatureKey, PlanDefinition } from "@shared/types";
import { Button, Chip } from "../components/ui";
import { Banner, Card, PageShell } from "../components/panels";
import { LoadingState } from "../components/states";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import { apiFetch } from "../lib/http";
import { track } from "../lib/track";
import { FONT, RADIUS, SPACE } from "../tokens/colors";

/**
 * Plan copy lives here, not in the plan table, because it is marketing and the
 * server's tier definitions are enforcement. No price is printed: pricing has
 * not been validated, and a number shown here would be read as a commitment.
 */
/** The two limit lines share the feature rows' layout so the list reads as one. */
function limitRowStyle(colors: { textMuted: string }) {
  return {
    display: "flex",
    gap: 7,
    alignItems: "flex-start",
    fontSize: FONT.size.label,
    color: colors.textMuted,
  } as const;
}

const FEATURE_LABELS: Record<FeatureKey, string> = {
  live_suggestions: "Live suggestion cards while you facilitate",
  checkpoint: "End-of-meeting alignment checkpoint",
  pm_document: "Living PM document per project",
  transcript_export: "Transcript export",
  session_invites: "Invite links for individual meetings",
  guest_access: "Guests can join without an account",
  analytics_dashboard: "Team usage dashboard",
  custom_theme: "Dark mode and workspace colours",
};

export default function Pricing({ onNav }: { onNav?: (id: string) => void }) {
  const { colors } = useTheme();
  const { subscription, refreshSubscription, isAuthed } = useAuth();
  const [plans, setPlans] = useState<PlanDefinition[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track("pricing_viewed", undefined, "pricing");
    void apiFetch<{ plans: PlanDefinition[] }>("/api/billing/plans", { anonymous: true })
      .then((data) => setPlans(data.plans))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load plans"));
  }, []);

  const request = async (planId: string) => {
    setBusy(planId);
    setError(null);
    try {
      await apiFetch("/api/billing/request", { method: "POST", body: { plan: planId } });
      setMessage("Added to the wishlist — we will email you when Pro opens up.");
      await refreshSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that request");
    } finally {
      setBusy(null);
    }
  };

  // The error banner lives below this early return, so a failed fetch used to
  // sit on "Loading…" forever. On a cold-starting backend that is the first
  // thing a prospective customer sees, and it never resolves itself.
  if (!plans) {
    return (
      <PageShell title="Plans">
        {error ? (
          <Banner tone="danger">
            {error} — the plans could not be loaded. Please try again in a moment.
          </Banner>
        ) : (
          <LoadingState persist count={2} />
        )}
      </PageShell>
    );
  }

  const currentPlanId = subscription?.plan.id;

  return (
    <PageShell
      title="Plans"
      subtitle="One price covers the whole workspace — there is no per-seat maths. Pro is not on sale yet: add it to your wishlist and we will email you when it opens."
    >
      {error && <Banner tone="danger">{error}</Banner>}
      {message && <Banner tone="success">{message}</Banner>}
      {subscription?.pendingRequest && (
        <Banner>{subscription.pendingRequest.toPlan} is on your wishlist — we will be in touch.</Banner>
      )}

      <div style={{ display: "flex", gap: SPACE[2], flexWrap: "wrap", marginBottom: SPACE[3] }}>
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <div
              key={plan.id}
              style={{
                flex: "1 1 260px",
                minWidth: 260,
                padding: SPACE[3],
                background: colors.surface,
                border: `1px solid ${isCurrent ? colors.accent : colors.border}`,
                borderRadius: RADIUS.lg,
                display: "flex",
                flexDirection: "column",
                gap: SPACE[1.5],
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: SPACE[1] }}>
                <h2 style={{ margin: 0, fontSize: FONT.size.subheading, fontWeight: 600, color: colors.text }}>
                  {plan.name}
                </h2>
                {isCurrent && <Chip color={colors.accent}>current</Chip>}
              </div>

              <p style={{ margin: 0, fontSize: FONT.size.body, color: colors.textMuted }}>{plan.tagline}</p>

              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 7 }}>
                {/* A dash, not a check: what the plan allows you is not the
                    same kind of line as what the plan gives you, and without
                    any mark at all these two read as a stray paragraph above
                    the list. */}
                <li style={limitRowStyle(colors)}>
                  <Minus size={13} style={{ marginTop: 2, color: colors.textDim, flexShrink: 0 }} />
                  {plan.limits.meetingsPerMonth === null
                    ? "Unlimited meetings"
                    : `${plan.limits.meetingsPerMonth} meetings a month`}
                </li>
                <li style={limitRowStyle(colors)}>
                  <Minus size={13} style={{ marginTop: 2, color: colors.textDim, flexShrink: 0 }} />
                  {plan.limits.seats === null ? "Unlimited members" : `Up to ${plan.limits.seats} members`}
                </li>
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    style={{
                      display: "flex",
                      gap: 7,
                      alignItems: "flex-start",
                      fontSize: FONT.size.label,
                      color: colors.textMuted,
                    }}
                  >
                    <Check size={13} style={{ marginTop: 2, color: colors.accent, flexShrink: 0 }} />
                    {FEATURE_LABELS[feature]}
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: "auto", paddingTop: SPACE[1.5] }}>
                {!isAuthed ? (
                  <Button fullWidth variant="primary" onClick={() => onNav?.("dashboard")}>
                    {/* Pro cannot be bought yet, and the paragraph at the top of
                        this page says so — a button reading "Get started" under
                        it promised a checkout that does not exist. */}
                    {plan.id === "pro" ? "Join the wishlist" : "Get started"}
                  </Button>
                ) : isCurrent ? (
                  <Button fullWidth disabled>
                    Your plan
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    variant="primary"
                    disabled={busy !== null}
                    onClick={() => void request(plan.id)}
                  >
                    {busy === plan.id ? "Adding…" : "Join the wishlist"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Card title="What the wishlist does">
        <p style={{ margin: 0, fontSize: FONT.size.body, color: colors.textMuted, lineHeight: 1.7 }}>
          Nothing is charged and nothing changes about your workspace. It records that this plan is
          the one you want, against your workspace, so we can email you when it is ready to buy.
          Everything you can do today, you keep doing.
        </p>
      </Card>
    </PageShell>
  );
}
