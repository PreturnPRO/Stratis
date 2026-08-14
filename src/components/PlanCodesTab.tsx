import { useCallback, useEffect, useState } from "react";
import { Copy, Ticket } from "lucide-react";
import { Button, Chip } from "./ui";
import { Banner, Card, Field, Select, TextInput } from "./panels";
import { EmptyState, LoadingState } from "./states";
import { useTheme } from "../hooks/useTheme";
import { apiFetch } from "../lib/http";
import { FONT, RADIUS, SPACE } from "../tokens/colors";
import { localeTag } from "../i18n/locale";

/**
 * Beta access codes — the Stratis team's half of the plan bypass.
 *
 * Issuing a grant is worth money, so it is a platform-operator action and never
 * a role: `requirePlatformAdmin` guards every call here, and the console is not
 * even rendered for anybody else.
 *
 * Two different withdrawals live on this screen, and confusing them is how a
 * team loses its plan mid-meeting:
 *
 * - **Revoke the code** stops the *next* workspace redeeming it. Grants already
 *   made keep running.
 * - **Withdraw** on a redemption row takes the plan back from that one
 *   workspace, now.
 */

interface Redemption {
  orgId: string;
  orgName: string | null;
  email: string | null;
  name: string | null;
  redeemedAt: string;
  grantedUntil: string | null;
  active: boolean;
}

interface PlanCode {
  id: string;
  code: string;
  plan: string;
  label: string | null;
  grant_days: number | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  revoked_at: string | null;
  created_at: string;
  redemptions: Redemption[];
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(localeTag(), { day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function PlanCodesTab() {
  const { colors } = useTheme();
  const [codes, setCodes] = useState<PlanCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [plan, setPlan] = useState("pro");
  const [label, setLabel] = useState("");
  const [grantDays, setGrantDays] = useState("90");
  const [maxUses, setMaxUses] = useState("1");
  const [creating, setCreating] = useState(false);
  /** Shown once, big, because it is the thing you are about to send someone. */
  const [freshCode, setFreshCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ codes: PlanCode[] }>("/api/admin/plan-codes");
      setCodes(data.codes ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the codes");
      setCodes([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiFetch<{ code: string }>("/api/admin/plan-codes", {
        method: "POST",
        body: {
          plan,
          label: label.trim() || null,
          grantDays: Number(grantDays) || null,
          maxUses: Number(maxUses) || null,
        },
      });
      setFreshCode(data.code);
      setLabel("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the code");
    } finally {
      setCreating(false);
    }
  };

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

  return (
    <>
      {error && <Banner tone="danger">{error}</Banner>}
      {notice && <Banner tone="success">{notice}</Banner>}

      <Card
        title="Issue a beta code"
        description="A team redeems this once and their whole workspace gets the plan for the number of days you set."
        footer={
          <Button variant="primary" iconLeft={<Ticket size={14} />} onClick={() => void create()} disabled={creating}>
            {creating ? "Creating…" : "Create code"}
          </Button>
        }
      >
        {freshCode && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: SPACE[1.5],
              padding: SPACE[2],
              marginBottom: SPACE[2],
              borderRadius: RADIUS.md,
              border: `1px solid ${colors.accent}`,
              background: colors.surfaceMuted,
            }}
          >
            <span style={{ fontFamily: FONT.mono, fontSize: FONT.size.subheading, color: colors.text }}>
              {freshCode}
            </span>
            <Button
              variant="ghost"
              size="sm"
              iconLeft={<Copy size={13} />}
              onClick={() => {
                void navigator.clipboard?.writeText(freshCode);
                setNotice("Code copied");
              }}
            >
              Copy
            </Button>
          </div>
        )}

        <Field label="Plan">
          <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="pro">Pro</option>
            <option value="beta">Beta</option>
          </Select>
        </Field>
        <Field label="Who it is for" hint="Only you see this — it is how you recognise the code later.">
          <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Chiang Mai Digital" />
        </Field>
        <Field label="Days the plan lasts" hint="Counted from the day it is redeemed. Empty means no end date.">
          <TextInput value={grantDays} onChange={(e) => setGrantDays(e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="How many workspaces may use it">
          <TextInput value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" />
        </Field>
      </Card>

      <Card title="Codes" description="Who redeemed what, and whether their grant is still running.">
        {codes === null ? (
          <LoadingState persist count={2} />
        ) : codes.length === 0 ? (
          <EmptyState message="No codes yet. Issue one above and send it to the team." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: SPACE[2] }}>
            {codes.map((c) => (
              <div
                key={c.id}
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: RADIUS.md,
                  padding: SPACE[2],
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: SPACE[1.5], flexWrap: "wrap" }}>
                  <span style={{ fontFamily: FONT.mono, fontSize: FONT.size.body, color: colors.text }}>
                    {c.code}
                  </span>
                  <Chip color={c.revoked_at ? colors.textDim : colors.accent}>
                    {c.revoked_at ? "revoked" : c.plan}
                  </Chip>
                  {c.label && (
                    <span style={{ fontSize: FONT.size.label, color: colors.textMuted }}>{c.label}</span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: FONT.size.caption, color: colors.textDim }}>
                    {c.used_count}
                    {c.max_uses ? ` / ${c.max_uses}` : ""} used
                    {c.grant_days ? ` · ${c.grant_days} days` : " · no end date"}
                  </span>
                  {!c.revoked_at && (
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() =>
                        void act(
                          () => apiFetch(`/api/admin/plan-codes/${c.id}/revoke`, { method: "POST" }),
                          "That code cannot be redeemed again. Grants already made keep running.",
                        )
                      }
                    >
                      Revoke code
                    </Button>
                  )}
                </div>

                {c.redemptions.length > 0 && (
                  <div style={{ marginTop: SPACE[1.5], display: "flex", flexDirection: "column", gap: 6 }}>
                    {c.redemptions.map((r) => (
                      <div
                        key={r.orgId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: SPACE[1.5],
                          flexWrap: "wrap",
                          paddingTop: 6,
                          borderTop: `1px solid ${colors.border}`,
                        }}
                      >
                        <span style={{ fontSize: FONT.size.label, color: colors.text }}>
                          {r.email ?? "account deleted"}
                        </span>
                        <span style={{ fontSize: FONT.size.caption, color: colors.textDim }}>
                          {r.orgName ?? r.orgId} · {formatDate(r.redeemedAt)}
                          {r.grantedUntil ? ` → ${formatDate(r.grantedUntil)}` : ""}
                        </span>
                        <span style={{ flex: 1 }} />
                        <Chip color={r.active ? colors.green : colors.textDim}>
                          {r.active ? "on plan" : "free"}
                        </Chip>
                        {r.active && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() =>
                              void act(
                                () =>
                                  apiFetch(
                                    `/api/admin/plan-codes/${c.id}/redemptions/${r.orgId}/revoke`,
                                    { method: "POST" },
                                  ),
                                `${r.orgName ?? r.orgId} is back on the free plan`,
                              )
                            }
                          >
                            Withdraw
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
