// Closing checkpoint state (alignment checkpoint, Feature 2).
//
// Reads the decisions the backend extracted from the session, lets the
// facilitator trigger a fresh extract at wrap-up, and applies edits (set a due
// date, mark deliberately open, fix wording). The completeness metric comes back
// with every call so the UI never computes it locally.
import { useState, useCallback } from "react";
import type { DecisionRecord, DecisionStatus } from "../../shared/types";
import { API_BASE } from "../lib/api";

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
}

export interface UseCheckpointReturn {
  decisions: DecisionRecord[];
  metric: CompletenessMetric | null;
  loading: boolean;
  extracting: boolean;
  error: string | null;
  load: () => Promise<void>;
  extract: () => Promise<void>;
  edit: (decisionId: string, patch: DecisionEdit) => Promise<void>;
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

  const authHeaders = useCallback(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const load = useCallback(async () => {
    if (!sessionId || !token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/session/${sessionId}/decisions`, {
        headers: authHeaders(),
      });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setDecisions(payload.data.decisions ?? []);
        setMetric(payload.data.metric ?? EMPTY_METRIC);
      } else {
        setError(payload.error || "Failed to load decisions");
      }
    } catch {
      setError("Network error loading decisions");
    } finally {
      setLoading(false);
    }
  }, [sessionId, token, authHeaders]);

  const extract = useCallback(async () => {
    if (!sessionId || !token) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/session/${sessionId}/decisions/extract`, {
        method: "POST",
        headers: authHeaders(),
      });
      const payload = await res.json();
      if (res.ok && payload.ok) {
        setDecisions(payload.data.decisions ?? []);
        setMetric(payload.data.metric ?? EMPTY_METRIC);
      } else {
        setError(payload.error || "Failed to extract decisions");
      }
    } catch {
      setError("Network error extracting decisions");
    } finally {
      setExtracting(false);
    }
  }, [sessionId, token, authHeaders]);

  const edit = useCallback(
    async (decisionId: string, patch: DecisionEdit) => {
      if (!sessionId || !token) return;
      // Optimistic: reflect the edit immediately; reconcile with the server's
      // authoritative row + metric when the response lands.
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
              }
            : d,
        ),
      );
      try {
        const res = await fetch(
          `${API_BASE}/api/session/${sessionId}/decisions/${decisionId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify(patch),
          },
        );
        const payload = await res.json();
        if (res.ok && payload.ok) {
          setDecisions((prev) =>
            prev.map((d) => (d.id === decisionId ? payload.data.decision : d)),
          );
          setMetric(payload.data.metric ?? EMPTY_METRIC);
        } else {
          setError(payload.error || "Failed to save edit");
          await load();
        }
      } catch {
        setError("Network error saving edit");
        await load();
      }
    },
    [sessionId, token, authHeaders, load],
  );

  return { decisions, metric, loading, extracting, error, load, extract, edit };
}
