import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../lib/api";

export const ACTIVE_SESSION_KEY = "stratis.activeSessionId.v1";

// Planned meeting length drives the in-meeting countdown + wrap-up warning.
// Stored per session so the live Meeting page can read it back.
export const DURATION_PRESETS = [30, 45, 60, 90];
export const durationKey = (sessionId: string) => `stratis.duration.${sessionId}`;

export function projectIdFromTitle(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "default-project";
}

export interface CreateMeetingInput {
  title: string;
  projectId: string;
  goal?: string | null;
  brief?: string | null;
  durationMinutes: number;
}

/** Shared meeting-creation flow: POST /api/meeting -> POST /api/session ->
 * POST /api/session/:id/start -> navigate to the live Meeting page. Used both
 * by Dashboard.tsx (types a project name, which gets slugified into a fresh
 * projectId) and Projects.tsx (passes an existing project's real id directly,
 * so the new meeting continues that project instead of forking a new one). */
export function useCreateMeeting(onNav?: (id: string, params?: Record<string, string>) => void) {
  const { token } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const startSessionForMeeting = async (meetingId: string, durationMin: number): Promise<string> => {
    const createRes = await fetch(`${API_BASE}/api/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        meetingId,
        meeting_id: meetingId,
      }),
    });

    const createData = await createRes.json();

    if (!createData.ok) {
      throw new Error(createData.error ?? "Could not create session");
    }

    const session = createData.data?.session ?? createData.data;
    const sessionId = session?.id;

    if (!sessionId) {
      throw new Error("Session id missing from backend response");
    }

    await fetch(`${API_BASE}/api/session/${sessionId}/start`, {
      method: "POST",
      headers: authHeaders,
    }).catch(() => {
      // Non-fatal. Some backends create sessions directly as active.
    });

    window.localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    if (durationMin > 0) {
      window.localStorage.setItem(durationKey(sessionId), String(durationMin));
    }
    onNav?.("meeting", { sessionId });

    return sessionId;
  };

  const createMeeting = async (input: CreateMeetingInput): Promise<string | undefined> => {
    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/meeting`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          title: input.title,
          projectId: input.projectId,
          project_id: input.projectId,
          scheduledAt: null,
          scheduled_at: null,
          goal: input.goal?.trim() || null,
          brief: input.brief?.trim() || null,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error ?? "Could not create meeting");
      }

      const meeting = data.data?.meeting ?? data.data;
      const meetingId = meeting?.id;

      if (!meetingId) {
        throw new Error("Meeting id missing from backend response");
      }

      return await startSessionForMeeting(meetingId, input.durationMinutes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create meeting");
      return undefined;
    } finally {
      setCreating(false);
    }
  };

  return { createMeeting, startSessionForMeeting, creating, error, setError };
}
