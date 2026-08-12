import { useState, useCallback } from "react";
import type { DecisionRecord, DecisionStatus } from "../../shared/types";
import { apiFetch } from "../lib/http";

export interface CompletenessMetric {
  committed: number;
  withDueDate: number;
  open: number;
  total: number;
  completenessRate: number | null;
}

export interface DecisionEdit {
  dueDate?: string | null;
  owner?: string | null;
  status?: DecisionStatus;
  revisit?: string | null;
  text?: string;
  dismissed?: boolean;
}

export interface UseCheckpointReturn {
  decisions: DecisionRecord[];
  metric: CompletenessMetric | null;
  loading: boolean;
  extracting: boolean;
  error: string | null;
  /** Resolves to how many decisions the server holds, so callers can decide
   *  whether an extraction is needed without trusting local state. */
  load: () => Promise<number>;
  extract: (force?: boolean) => Promise<void>;
  edit: (decisionId: string, patch: DecisionEdit) => Promise<void>;
}

interface DecisionPayload {
  decisions?: DecisionRecord[];
  metric?: CompletenessMetric;
}

const EMPTY_METRIC: CompletenessMetric = {
  committed: 0,
  withDueDate: 0,
  open: 0,
  total: 0,
  completenessRate: null,
};

export function useCheckpoint(
  sessionId: string | null,
  token: string | null,
): UseCheckpointReturn {
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [metric, setMetric] = useState<CompletenessMetric | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId || !token) return 0;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<DecisionPayload>(`/api/session/${sessionId}/decisions`);
      const next = data.decisions ?? [];
      setDecisions(next);
      setMetric(data.metric ?? EMPTY_METRIC);
      return next.length;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load decisions");
      return 0;
    } finally {
      setLoading(false);
    }
  }, [sessionId, token]);

  // `force` is the explicit "Re-run" affordance. Without it the server returns
  // what it already holds instead of asking the model again — which is what
  // kept the checkpoint changing under the facilitator on every refresh.
  const extract = useCallback(async (force = false) => {
    if (!sessionId || !token) return;
    setExtracting(true);
    setError(null);
    try {
      const data = await apiFetch<DecisionPayload>(
        `/api/session/${sessionId}/decisions/extract`,
        { method: "POST", body: { force } },
      );
      setDecisions(data.decisions ?? []);
      setMetric(data.metric ?? EMPTY_METRIC);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract decisions");
    } finally {
      setExtracting(false);
    }
  }, [sessionId, token]);

  const edit = useCallback(
    async (decisionId: string, patch: DecisionEdit) => {
      if (!sessionId || !token) return;
      setDecisions((prev) =>
        prev.map((d) =>
          d.id === decisionId
            ? {
                ...d,
                dueDate: patch.dueDate !== undefined ? patch.dueDate : d.dueDate,
                owner: patch.owner !== undefined ? patch.owner : d.owner,
                status: patch.status ?? d.status,
                revisit: patch.revisit !== undefined ? patch.revisit : d.revisit,
                text: patch.text && patch.text.trim() ? patch.text : d.text,
                dismissed: patch.dismissed !== undefined ? patch.dismissed : d.dismissed,
              }
            : d,
        ),
      );
      try {
        const data = await apiFetch<{ decision: DecisionRecord; metric?: CompletenessMetric }>(
          `/api/session/${sessionId}/decisions/${decisionId}`,
          { method: "PATCH", body: patch },
        );
        setDecisions((prev) => prev.map((d) => (d.id === decisionId ? data.decision : d)));
        setMetric(data.metric ?? EMPTY_METRIC);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save edit");
        await load();
      }
    },
    [sessionId, token, load],
  );

  return { decisions, metric, loading, extracting, error, load, extract, edit };
}
