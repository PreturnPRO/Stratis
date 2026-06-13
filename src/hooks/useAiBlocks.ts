// S1-T03-D/E + S1-T05-D — async AI calls with loading/timeout state.
// Calls POST /api/ai/structure and returns renderable blocks.
// QuestionSuggestion blocks are filtered out here; live cards use /api/ai/suggest + /ws.

import { useState, useCallback, useRef } from "react";
import type { AIBlock } from "../../shared/types";

export type AiBlocksStatus = "idle" | "loading" | "ok" | "error" | "timeout";

export interface UseAiBlocksReturn {
  status: AiBlocksStatus;
  blocks: AIBlock[];
  error: string | null;
  provider: string | null;
  isLoading: boolean;
  canSend: boolean;
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

  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    inFlightRef.current = false;
    setStatus("idle");
    setBlocks([]);
    setError(null);
    setProvider(null);
  }, []);

  const send = useCallback(async (input: string, opts?: { token?: string }) => {
    const clean = input.trim();
    if (!clean || inFlightRef.current) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    inFlightRef.current = true;

    setStatus("loading");
    setError(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (opts?.token) {
        headers.Authorization = `Bearer ${opts.token}`;
      }

      const res = await fetch(`${API_BASE}/api/ai/structure`, {
        method: "POST",
        headers,
        body: JSON.stringify({ input: clean }),
        signal: controller.signal,
      });

      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { provider: string; blocks: AIBlock[] };
      };

      if (requestId !== requestIdRef.current) return;

      if (!data.ok) {
        setError(data.error ?? "AI call failed");
        setStatus("error");
        return;
      }

      const allBlocks: AIBlock[] = data.data?.blocks ?? [];

      // QuestionSuggestion is delivered via /ws, not transcript renderer.
      const renderBlocks = allBlocks.filter(
        (b) => b.type !== "QuestionSuggestion",
      );

      setProvider(data.data?.provider ?? null);
      setBlocks((prev) => [...prev, ...renderBlocks]);
      setStatus("ok");
    } catch (err) {
      if (requestId !== requestIdRef.current) return;

      if ((err as Error).name === "AbortError") {
        setError("AI took too long — try again");
        setStatus("timeout");
      } else {
        setError((err as Error).message ?? "Network error");
        setStatus("error");
      }
    } finally {
      clearTimeout(timer);

      if (requestId === requestIdRef.current) {
        inFlightRef.current = false;
      }
    }
  }, []);

  const append = useCallback(
    (incoming: AIBlock[], nextProvider?: string | null) => {
      const renderBlocks = incoming.filter(
        (b) => b.type !== "QuestionSuggestion",
      );

      if (nextProvider !== undefined) setProvider(nextProvider);
      setBlocks((prev) => [...prev, ...renderBlocks]);
      setStatus("ok");
      setError(null);
    },
    [],
  );

  const isLoading = status === "loading";
  const canSend = !isLoading;

  return {
    status,
    blocks,
    error,
    provider,
    isLoading,
    canSend,
    send,
    append,
    reset,
  };
}