import type { ParticipantSummaryOutput } from "../mocks/summaryMock";

/**
 * The summary as a document the PM owns.
 *
 * Stratis does not send anything to anyone. There is no mail provider, and an
 * in-app inbox would only reach people who already have accounts — which, for a
 * tool used by one PM on behalf of a room, is most of the room missing. So the
 * summary is written out as Markdown and handed to the person who knows who
 * should receive it.
 *
 * Markdown because it pastes into LINE, email, Notion and Google Docs with its
 * structure intact, and because it is the one format that needs no dependency
 * to produce.
 */

function block(title: string, body: string): string {
  const clean = body.trim();
  return clean ? `## ${title}\n\n${clean}\n` : "";
}

export function summaryToMarkdown(summary: ParticipantSummaryOutput): string {
  const parts: string[] = [];

  parts.push(`# ${summary.summary_title || "Meeting summary"}`);
  if (summary.summary_subtitle) parts.push(`_${summary.summary_subtitle}_`);

  const facts: string[] = [];
  if (summary.participants.length > 0) {
    facts.push(`**Present:** ${summary.participants.join(", ")}`);
  }
  if (summary.duration_minutes > 0) {
    facts.push(`**Duration:** ${summary.duration_minutes} min`);
  }
  if (facts.length > 0) parts.push(facts.join("  \n"));

  for (const b of summary.summary_blocks) {
    // Facilitator-only blocks are exactly the ones that must not travel.
    if (!b.visible_to_participants) continue;
    parts.push(block(b.title, b.content));
  }

  if (summary.action_items.length > 0) {
    const rows = summary.action_items
      .map((item) => {
        const owner = item.owner || "unowned";
        const due = item.due_date || "no date";
        return `| ${item.done ? "x" : " "} | ${item.task} | ${owner} | ${due} |`;
      })
      .join("\n");
    parts.push(
      `## Action items\n\n| Done | Task | Owner | Due |\n| --- | --- | --- | --- |\n${rows}\n`,
    );
  }

  parts.push(`---\n\n_Recorded with Stratis._`);

  return parts.filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** A filename that sorts by date and survives every filesystem. */
export function summaryFilename(summary: ParticipantSummaryOutput): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = (summary.summary_title || "meeting-summary")
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${date}-${slug || "meeting-summary"}.md`;
}

/** Triggers the browser download. Object URL revoked so the blob is not held. */
export function downloadMarkdown(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
