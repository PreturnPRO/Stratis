// Merge transcript rows by id, sorted chronologically.
//
// Used on WebSocket reconnect (src/pages/Meeting.tsx): the client refetches the
// full transcript and merges it with what it already has, so rows finalized
// during the disconnect gap are backfilled without duplicating rows that
// arrived live. Timestamps are ISO-8601, which sort lexically == chronologically.

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
  for (const r of incoming) byId.set(r.id, r); // server row wins on conflict
  return [...byId.values()].sort((a, b) =>
    a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0,
  );
}
