import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../lib/api";

export const ACTIVE_SESSION_KEY = "stratis.activeSessionId.v1";

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
  scheduledAt?: string | null;
}

export function useCreateMeeting(onNav?: (id: string, params?: Record<string, string>) => void) {
  const { token, logout } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authHeaders = useMemo((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const guardAuth = (res: Response) => {
    if (res.status === 401) {
      logout();
      throw new Error("Session expired — please log in again");
    }
  };

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

    guardAuth(createRes);
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

    const scheduledAt = input.scheduledAt ?? null;

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
          scheduledAt,
          scheduled_at: scheduledAt,
          goal: input.goal?.trim() || null,
          brief: input.brief?.trim() || null,
          durationMinutes: input.durationMinutes,
          duration_minutes: input.durationMinutes,
        }),
      });

      guardAuth(res);
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error ?? "Could not create meeting");
      }

      const meeting = data.data?.meeting ?? data.data;
      const meetingId = meeting?.id;

      if (!meetingId) {
        throw new Error("Meeting id missing from backend response");
      }

      if (scheduledAt) return meetingId;

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
