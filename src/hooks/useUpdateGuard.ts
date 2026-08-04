import { useCallback, useEffect, useRef, useState } from "react";
import type { ReleaseInfo } from "@shared/types";
import { apiFetch } from "../lib/http";
import { setTrackedVersion, track } from "../lib/track";

const POLL_INTERVAL_MS = 5 * 60_000;

/**
 * Notices when the server has moved on from the build this tab is running.
 *
 * Two things can change under a running client: the bundle it was served, and
 * the validity of the token it holds. This watches the first and reports it as
 * an offer to reload — a facilitator mid-meeting must never be reloaded out
 * from under a live recording, so the decision stays theirs. The second is the
 * server's business: requests carrying a token from before a forced-logout
 * release are already being refused, and apiFetch turns that into a sign-out.
 */
export function useUpdateGuard(options: { pause?: boolean } = {}) {
  const [current, setCurrent] = useState<string | null>(null);
  const [available, setAvailable] = useState<ReleaseInfo | null>(null);
  const baselineRef = useRef<string | null>(null);
  const pause = options.pause ?? false;

  const check = useCallback(async () => {
    try {
      const info = await apiFetch<ReleaseInfo>("/api/system/version", { anonymous: true });

      if (baselineRef.current === null) {
        baselineRef.current = info.version;
        setCurrent(info.version);
        setTrackedVersion(info.version);
        return;
      }

      if (info.version !== baselineRef.current) {
        setAvailable(info);
        track("update_reload_prompted", { from: baselineRef.current, to: info.version });
      }
    } catch {
      // An unreachable version endpoint is not worth surfacing — the app keeps
      // running on the build it already has.
    }
  }, []);

  useEffect(() => {
    void check();
    const id = setInterval(() => {
      if (!pause && document.visibilityState === "visible") void check();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [check, pause]);

  const reload = useCallback(() => {
    track("update_reload_accepted", { to: available?.version });
    window.location.reload();
  }, [available]);

  const dismiss = useCallback(() => setAvailable(null), []);

  return { currentVersion: current, update: available, reload, dismiss };
}
