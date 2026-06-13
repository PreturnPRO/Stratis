// S1-T03-D/E — calls POST /api/ai/structure and returns renderable blocks.
// Handles async state, loading, and the 10s timeout.
//
// S1-T03-E: /api/ai/structure does NOT filter QuestionSuggestion blocks
// server-side (that endpoint is generic). Suggestion cards are produced by
// the separate /api/ai/suggest flow and delivered over /ws — see
// useSuggestionSocket. QuestionSuggestion blocks are filtered out here so
// they never reach BlockRenderer / the transcript panel.

import { useState, useCallback } from "react";
import type { AIBlock } from "../../shared/types";

export type AiBlocksStatus = "idle" | "loading" | "ok" | "error" | "timeout";

export interface UseAiBlocksReturn {
  status: AiBlocksStatus;
  blocks: AIBlock[];
  error: string | null;
  provider: string | null;
  send: (input: string, opts?: { token?: string }) => Promise<void>;
  reset: () => void;
  append: (blocks: AIBlock[], provider?: string | null) => void;
}

const API_BASE = "http://localhost:3001";
const TIMEOUT_MS = 10_000;

export function useAiBlocks(): UseAiBlocksReturn {
  const [status, setStatus] = useState<AiBlocksStatus>("idle");
  const [blocks, setBlocks] = useState<AIBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setBlocks([]);
    setError(null);
    setProvider(null);
  }, []);

  const send = useCallback(async (input: string, opts?: { token?: string }) => {
    if (!input.trim()) return;
    setStatus("loading");
    setError(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (opts?.token) headers["Authorization"] = `Bearer ${opts.token}`;

      const res = await fetch(`${API_BASE}/api/ai/structure`, {
        method: "POST",
        headers,
        body: JSON.stringify({ input }),
        signal: controller.signal,
      });

      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { provider: string; blocks: AIBlock[] };
      };

      if (!data.ok) {
        setError(data.error ?? "AI call failed");
        setStatus("error");
        return;
      }

      const allBlocks: AIBlock[] = data.data?.blocks ?? [];
      // QuestionSuggestion is delivered via /ws (S1-T03-E), not BlockRenderer.
      const renderBlocks = allBlocks.filter(
        (b) => b.type !== "QuestionSuggestion",
      );

      setProvider(data.data?.provider ?? null);
      setBlocks((prev: AIBlock[]) => [...prev, ...renderBlocks]);
      setStatus("ok");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError("AI took too long — try again");
        setStatus("timeout");
      } else {
        setError((err as Error).message ?? "Network error");
        setStatus("error");
      }
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const append = useCallback(
    (incoming: AIBlock[], nextProvider?: string | null) => {
      const renderBlocks = incoming.filter(
        (b) => b.type !== "QuestionSuggestion",
      );
      if (nextProvider !== undefined) setProvider(nextProvider);
      setBlocks((prev: AIBlock[]) => [...prev, ...renderBlocks]);
      setStatus("ok");
    },
    [],
  );

  return { status, blocks, error, provider, send, append, reset };
}
