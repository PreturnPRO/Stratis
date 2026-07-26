/**
 * Which unresolved decisions a meeting inherits.
 *
 * The count and the list must come from the same place. When the count was a
 * separate SQL aggregate it counted every open decision on the project except
 * the meeting's own — so every meeting on a project showed an identical number
 * and none of them described that meeting.
 */
export interface CarryItem {
  projectId: string | null;
  sourceMeetingId: string;
  sourceAt: string;
  owner: string | null;
}

export interface CarryTarget {
  id: string;
  projectId: string;
  at: string;
}

function ms(value: string): number {
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

/** Same project, from an earlier meeting, not the meeting's own items. */
export function carriedInto<T extends CarryItem>(items: T[], meeting: CarryTarget): T[] {
  const cutoff = ms(meeting.at);
  return items.filter(
    (item) =>
      item.projectId === meeting.projectId &&
      item.sourceMeetingId !== meeting.id &&
      ms(item.sourceAt) < cutoff,
  );
}

export function unownedCount(items: CarryItem[]): number {
  return items.filter((item) => !item.owner || item.owner.trim() === "").length;
}
