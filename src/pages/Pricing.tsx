import { useEffect, useState } from "react";
import { Check } from "lucide-react";
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
const FEATURE_LABELS: Record<FeatureKey, string> = {
  live_suggestions: "Live suggestion cards while you facilitate",
  checkpoint: "End-of-meeting alignment checkpoint",
  pm_document: "Living PM document per project",
  transcript_export: "Transcript export",
  session_invites: "Invite links for individual meetings",
  guest_access: "Guests can join without an account",
  analytics_dashboard: "Team usage dashboard",
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
      setMessage("Thanks — we have your request and will be in touch to arrange it.");
      await refreshSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that request");
    } finally {
      setBusy(null);
    }
  };

  if (!plans) return <PageShell title="Plans"><LoadingState persist count={2} /></PageShell>;

  const currentPlanId = subscription?.plan.id;

  return (
    <PageShell
      title="Plans"
      subtitle="One price covers the whole workspace — there is no per-seat maths. During the beta, upgrades are arranged by the Stratis team rather than charged in the app."
    >
      {error && <Banner tone="danger">{error}</Banner>}
      {message && <Banner tone="success">{message}</Banner>}
      {subscription?.pendingRequest && (
        <Banner>Your request to move to {subscription.pendingRequest.toPlan} is with us.</Banner>
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
                <li style={{ fontSize: FONT.size.label, color: colors.textMuted }}>
                  {plan.limits.meetingsPerMonth === null
                    ? "Unlimited meetings"
                    : `${plan.limits.meetingsPerMonth} meetings a month`}
                </li>
                <li style={{ fontSize: FONT.size.label, color: colors.textMuted }}>
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
                    Get started
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
                    {busy === plan.id ? "Sending…" : `Request ${plan.name}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Card title="What happens when you request an upgrade">
        <p style={{ margin: 0, fontSize: FONT.size.body, color: colors.textMuted, lineHeight: 1.7 }}>
          Nothing is charged. Your request is recorded against your workspace, and a member of the
          Stratis team activates the plan and arranges billing with you directly. Beta workspaces keep
          full access throughout.
        </p>
      </Card>
    </PageShell>
  );
}
