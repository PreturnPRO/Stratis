import { useState } from "react";
import { apiFetch } from "../lib/http";

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
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSessionForMeeting = async (meetingId: string, durationMin: number): Promise<string> => {
    // apiFetch signs out on a 401 by itself, so there is no local auth guard
    // here any more — a dead session is handled the same way on every screen.
    const created = await apiFetch<{ session?: { id?: string }; id?: string }>("/api/session", {
      method: "POST",
      body: { meetingId, meeting_id: meetingId },
    });

    const sessionId = created?.session?.id ?? created?.id;

    if (!sessionId) {
      throw new Error("Session id missing from backend response");
    }

    await apiFetch(`/api/session/${sessionId}/start`, { method: "POST" }).catch(() => {});

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
      const data = await apiFetch<{ meeting?: { id?: string }; id?: string }>("/api/meeting", {
        method: "POST",
        body: {
          title: input.title,
          projectId: input.projectId,
          project_id: input.projectId,
          scheduledAt,
          scheduled_at: scheduledAt,
          goal: input.goal?.trim() || null,
          brief: input.brief?.trim() || null,
          durationMinutes: input.durationMinutes,
          duration_minutes: input.durationMinutes,
        },
      });

      const meetingId = data?.meeting?.id ?? data?.id;

      if (!meetingId) {
        throw new Error("Meeting id missing from backend response");
      }

      // Booked for later: do NOT start a session. Starting one here would
      // begin recording an empty room. It waits on the Docket until someone
      // presses Start.
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
