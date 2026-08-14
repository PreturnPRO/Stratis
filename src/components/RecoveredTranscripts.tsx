import { useState } from "react";
import { Button } from "./ui";
import { FONT, RADIUS, SPACE } from "../tokens/colors";
import { useTheme } from "../hooks/useTheme";
import { localeTag } from "../i18n/locale";
import {
  clearLocalTranscript,
  downloadTranscript,
  orphanedTranscripts,
  type LocalTranscript,
} from "../lib/localTranscript";

/**
 * A meeting whose transcript is still on this device because its summary was
 * never confirmed.
 *
 * Silence here would be the worst outcome: the words exist, the person who
 * needs them does not know, and clearing browser data destroys them. So it is
 * stated plainly, with the two things they can actually do — take the text, or
 * accept the loss deliberately.
 *
 * Read once at mount rather than polled: this is not live state, and a banner
 * that appears mid-typing is worse than one that appears on arrival.
 */
export function RecoveredTranscripts() {
  const { colors } = useTheme();
  const [records, setRecords] = useState<LocalTranscript[]>(() => orphanedTranscripts());

  if (records.length === 0) return null;

  const discard = (sessionId: string) => {
    clearLocalTranscript(sessionId);
    setRecords((prev) => prev.filter((r) => r.sessionId !== sessionId));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SPACE[1], marginBottom: SPACE[2] }}>
      {records.map((record) => (
        <div
          key={record.sessionId}
          style={{
            border: `1px solid ${colors.amber}`,
            background: colors.amberSubtle,
            borderRadius: RADIUS.md,
            padding: SPACE[2],
            display: "flex",
            gap: SPACE[2],
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: FONT.size.body, color: colors.text, fontWeight: 500 }}>
              An unsaved transcript is still on this device
            </div>
            <div style={{ fontSize: FONT.size.label, color: colors.textMuted, marginTop: 3 }}>
              {record.meetingTitle ?? "Meeting"} ·{" "}
              {new Date(record.startedAt).toLocaleString(localeTag())} · {record.lines.length} lines.
              Its summary was never confirmed, so Stratis kept the text here.
            </div>
          </div>

          <div style={{ display: "flex", gap: SPACE[1], flexShrink: 0 }}>
            <Button variant="primary" size="sm" onClick={() => downloadTranscript(record)}>
              Download the text
            </Button>
            <Button variant="ghost" size="sm" onClick={() => discard(record.sessionId)}>
              Discard
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
