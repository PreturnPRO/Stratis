import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Last-good copies of what the server told us, so a screen can paint before the
 * network answers.
 *
 * The rule this encodes: a page whose content the user has already seen must
 * not go blank waiting on a request. The server is still the authority — every
 * cached read is followed by a real one, and the fresh answer replaces what was
 * shown. What changes is the order: show, then verify, instead of wait, then
 * show.
 *
 * Entries are namespaced by user because one browser can hold two accounts in
 * sequence, and are dropped wholesale on sign-out.
 */
const PREFIX = "stratis.cache.";

/** Anything older than this is treated as absent — better blank than wrong. */
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;

interface Envelope<T> {
  at: number;
  value: T;
}

function storageKey(key: string, scope?: string | null): string {
  return `${PREFIX}${scope ?? "anon"}.${key}`;
}

export function readCache<T>(key: string, scope?: string | null): T | null {
  try {
    const raw = window.localStorage.getItem(storageKey(key, scope));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > MAX_AGE_MS) return null;

    return parsed.value;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T, scope?: string | null): void {
  try {
    const envelope: Envelope<T> = { at: Date.now(), value };
    window.localStorage.setItem(storageKey(key, scope), JSON.stringify(envelope));
  } catch {
    // A full or disabled localStorage costs us the head start, nothing more.
  }
}

/** Drops every cached payload. Called on sign-out. */
export function clearCache(): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) doomed.push(key);
    }
    for (const key of doomed) window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export interface CachedQuery<T> {
  data: T | null;
  /** True only while we have nothing to show — a cache hit is not loading. */
  loading: boolean;
  /** True while a background revalidation is in flight over cached data. */
  revalidating: boolean;
  error: string | null;
  /** What is on screen came from storage and has not been confirmed yet. */
  fromCache: boolean;
  refresh: () => Promise<void>;
  set: (value: T) => void;
}

/**
 * Reads from cache first, then from the server.
 *
 * `enabled` exists so a screen can hold the request until it has a token,
 * without losing the cached paint in the meantime.
 */
export function useCachedQuery<T>(
  key: string,
  loader: () => Promise<T>,
  options: { scope?: string | null; enabled?: boolean } = {},
): CachedQuery<T> {
  const { scope, enabled = true } = options;

  const [data, setData] = useState<T | null>(() => readCache<T>(key, scope));
  const [fromCache, setFromCache] = useState(() => readCache<T>(key, scope) !== null);
  const [loading, setLoading] = useState(() => readCache<T>(key, scope) === null);
  const [revalidating, setRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const set = useCallback(
    (value: T) => {
      setData(value);
      setFromCache(false);
      writeCache(key, value, scope);
    },
    [key, scope],
  );

  const refresh = useCallback(async () => {
    if (!enabled) return;

    setError(null);
    setRevalidating(true);

    try {
      const fresh = await loaderRef.current();
      if (!aliveRef.current) return;
      setData(fresh);
      setFromCache(false);
      writeCache(key, fresh, scope);
    } catch (err) {
      if (!aliveRef.current) return;
      // The cached copy stays on screen. An error next to real content is a
      // better answer than an empty page.
      setError(err instanceof Error ? err.message : "Could not reach the server");
    } finally {
      if (aliveRef.current) {
        setRevalidating(false);
        setLoading(false);
      }
    }
  }, [enabled, key, scope]);

  useEffect(() => {
    const cached = readCache<T>(key, scope);
    setData(cached);
    setFromCache(cached !== null);
    setLoading(enabled && cached === null);
  }, [key, scope, enabled]);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  return { data, loading, revalidating, error, fromCache, refresh, set };
}
