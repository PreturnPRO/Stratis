
export interface MergeableRow {
  id: string;
  timestamp: string;
}

export function mergeTranscripts<T extends MergeableRow>(
  existing: T[],
  incoming: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const r of existing) byId.set(r.id, r);
  for (const r of incoming) byId.set(r.id, r);
  return [...byId.values()].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0,
  );
}
