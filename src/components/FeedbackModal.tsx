import { useState } from "react";
import type { FeedbackKind } from "@shared/types";
import { Button, Modal } from "./ui";
import { Banner, Field, Select, TextArea } from "./panels";
import { useTheme } from "../hooks/useTheme";
import { apiFetch } from "../lib/http";
import { FONT, RADIUS, SPACE } from "../tokens/colors";

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: "bug", label: "Something is broken" },
  { value: "idea", label: "I want something" },
  { value: "praise", label: "This worked well" },
  { value: "general", label: "Something else" },
];

/**
 * The way a beta tester tells us something without leaving the app.
 *
 * Rating is 0–10 and optional — asking for it every time trains people to
 * ignore the box, and one sentence of what actually went wrong is worth more
 * than a score. `surface` records which screen they were on, because "the
 * checkpoint is confusing" means something different from the meeting room
 * than from the summary.
 */
export default function FeedbackModal({
  surface,
  sessionId,
  onClose,
}: {
  surface: string;
  sessionId?: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/feedback", {
        method: "POST",
        body: { kind, message, rating, surface, sessionId: sessionId ?? null },
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <Modal
        title="Thank you"
        onClose={onClose}
        footer={<Button variant="primary" onClick={onClose}>Close</Button>}
      >
        <p style={{ margin: 0, fontSize: FONT.size.body, color: colors.textMuted, lineHeight: 1.7 }}>
          Sent. Your workspace admins can see it, and we read every one during the beta.
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Send feedback"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={busy || !message.trim()}>
            {busy ? "Sending…" : "Send"}
          </Button>
        </>
      }
    >
      {error && <Banner tone="danger">{error}</Banner>}

      <Field label="What kind of thing is this?">
        <Select value={kind} onChange={(e) => setKind(e.target.value as FeedbackKind)}>
          {KINDS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Tell us what happened"
        hint="What you were doing, what you expected, what you got."
      >
        <TextArea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4000}
          autoFocus
        />
      </Field>

      <Field label="How is Stratis going for you so far?" hint="Optional.">
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(rating === n ? null : n)}
              aria-pressed={rating === n}
              style={{
                width: 30,
                height: 30,
                borderRadius: RADIUS.sm,
                border: `1px solid ${rating === n ? colors.accent : colors.border}`,
                background: rating === n ? colors.accent : "transparent",
                color: rating === n ? colors.onAccent : colors.textMuted,
                fontSize: FONT.size.label,
                cursor: "pointer",
              }}
            >
              {n}
            </button>
          ))}
        </div>
      </Field>

      <p style={{ margin: `${SPACE[1]}px 0 0`, fontSize: FONT.size.caption, color: colors.textDim }}>
        Sent from {surface}. No transcript or meeting content is attached.
      </p>
    </Modal>
  );
}
