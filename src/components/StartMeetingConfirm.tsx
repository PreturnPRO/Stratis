import { Button, Modal } from "./ui";
import { FONT, SPACE } from "../tokens/colors";
import { useTheme } from "../hooks/useTheme";

/**
 * The step between pressing Start and the microphone opening.
 *
 * Start used to begin recording on the spot. On a list where the same meeting
 * can appear twice and the titles are whatever anyone typed in July, that is a
 * button whose consequence you cannot read before you press it — and on a Free
 * workspace it also spends one of five meetings a month.
 *
 * So this says the three things that decide whether it is the right one:
 * which project the record will be filed under, what the meeting is for, and
 * how long Stratis will pace it. No new decisions here — anything missing is
 * fixed by editing the meeting, not by filling in a field on the way past.
 */
export interface StartTarget {
  id: string;
  title: string;
  projectLabel: string;
  goal: string | null;
  durationMinutes: number | null;
}

export function StartMeetingConfirm({
  target,
  busy,
  onCancel,
  onConfirm,
}: {
  target: StartTarget;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { colors } = useTheme();

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", gap: SPACE[2], padding: "7px 0" }}>
      <span
        style={{
          width: 84,
          flexShrink: 0,
          fontSize: FONT.size.label,
          color: colors.textDim,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: FONT.size.body, color: colors.text }}>{value}</span>
    </div>
  );

  return (
    <Modal
      title="Start recording?"
      width={480}
      onClose={() => !busy && onCancel()}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={busy}>
            {busy ? "Starting…" : "Start recording"}
          </Button>
        </>
      }
    >
      <div>
        {row("Meeting", target.title)}
        {row("Project", target.projectLabel)}
        {row(
          "Goal",
          target.goal ?? (
            <span style={{ color: colors.amber }}>
              No goal set — Stratis has nothing to aim at
            </span>
          ),
        )}
        {row("Length", target.durationMinutes ? `${target.durationMinutes} minutes` : "60 minutes")}
      </div>

      <p
        style={{
          margin: `${SPACE[2]}px 0 0`,
          fontSize: FONT.size.label,
          color: colors.textMuted,
        }}
      >
        The microphone opens as soon as you confirm, and everyone in the room should know
        they are being recorded.
      </p>
    </Modal>
  );
}
