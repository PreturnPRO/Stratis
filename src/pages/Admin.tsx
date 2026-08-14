import { useCallback, useEffect, useState } from "react";
import type { FeedbackRecord } from "@shared/types";
import { Button, Chip } from "../components/ui";
import {
  Banner,
  Card,
  Field,
  PageShell,
  Select,
  TabBar,
  TextArea,
  TextInput,
  Toggle,
} from "../components/panels";
import { EmptyState, LoadingState } from "../components/states";
import { PlanCodesTab } from "../components/PlanCodesTab";
import { OperatorUsageTab } from "../components/OperatorUsageTab";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import { apiFetch } from "../lib/http";
import { track } from "../lib/track";
import { FONT, SPACE } from "../tokens/colors";
import { localeTag } from "../i18n/locale";

/**
 * Monitoring first, administration second.
 *
 * Admin is a place to see how the beta is going and what people are saying —
 * not a way into anyone's meeting. The content access that used to come with
 * the role (every session, transcript, summary and document in the workspace)
 * is gone from the API, so there is nothing here that opens a meeting someone
 * else is running.
 */
/**
 * The operator console — the Stratis team's screen, not a customer's.
 *
 * Members and Invites used to live here, which is what made this page read as a
 * workspace-admin panel. They belong to the facilitator and now sit in
 * Settings → Workspace; what is left is the two things only the Stratis team
 * can do, and neither of them reaches inside a meeting.
 */
const TABS = [
  { id: "usage", label: "Usage" },
  { id: "codes", label: "Beta codes" },
  { id: "feedback", label: "Feedback" },
  { id: "release", label: "Release" },
];

export default function Admin() {
  const { isPlatformAdmin } = useAuth();
  const [tab, setTab] = useState("usage");

  useEffect(() => {
    track("page_viewed", { page: "admin" }, "admin");
  }, []);

  if (!isPlatformAdmin) {
    return (
      <PageShell title="Admin">
        <Banner tone="danger">
          This is the Stratis operator console. Your team and invite links are in Settings →
          Workspace.
        </Banner>
      </PageShell>
    );
  }

  return (
    <PageShell title="Admin" subtitle="How the beta is going and what people are reporting. Meeting content stays with whoever ran the meeting — nothing here can reach inside one.">
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      {tab === "usage" && <OperatorUsageTab />}
      {tab === "codes" && <PlanCodesTab />}
      {tab === "feedback" && <FeedbackTab />}
      {tab === "release" && <ReleaseTab />}
    </PageShell>
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
            {item.rating !== null && <Chip>{item.rating}/5</Chip>}
            <span style={{ fontSize: FONT.size.caption, color: colors.textDim }}>
              {item.userName ?? "Anonymous"} · {new Date(item.createdAt).toLocaleString(localeTag())}
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
