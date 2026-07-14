import { useCallback, useEffect, useMemo, useState } from "react";
import { COLORS, RADIUS, FONT, LETTER_SPACING, SPACE } from "../tokens/colors";
import { Button, Modal } from "../components/ui";
import { NewMeetingModal } from "../components/NewMeetingModal";
import { useAuth } from "../context/AuthContext";
import { useCreateMeeting } from "../hooks/useCreateMeeting";
import { API_BASE } from "../lib/api";

interface Props {
  onNav?: (id: string, params?: Record<string, string>) => void;
}

interface Project {
  id: string;
  name: string;
  meetingCount: number;
  lastMeetingAt?: string | null;
}

function formatDate(value?: string | null): string {
  if (!value) return "No meetings yet";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(d);
}

// Stable-ish dot color derived from the project name.
const DOT_COLORS = [COLORS.accent, COLORS.teal, COLORS.cyan, COLORS.orange, COLORS.red];
function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return DOT_COLORS[Math.abs(hash) % DOT_COLORS.length];
}

export default function Projects({ onNav }: Props) {
  const { token, user } = useAuth();

  const authHeaders = useMemo(
    (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token],
  );

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [newMeetingProject, setNewMeetingProject] = useState<Project | null>(null);
  const create = useCreateMeeting(onNav);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/meeting/projects`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not load projects");
        return;
      }
      setProjects(data.data?.projects ?? []);
    } catch {
      setError("Could not reach the server");
    } finally {
      setLoading(false);
    }
  }, [token, authHeaders]);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/meeting/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not create project");
        return;
      }
      setShowNew(false);
      setNewName("");
      await load();
    } catch {
      setError("Could not reach the server");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateMeetingForProject = async (input: {
    title: string;
    durationMinutes: number;
    goal: string;
    brief: string;
  }) => {
    if (!newMeetingProject) return;
    const sessionId = await create.createMeeting({
      title: input.title,
      projectId: newMeetingProject.id,
      goal: input.goal,
      brief: input.brief,
      durationMinutes: input.durationMinutes,
    });
    if (sessionId) setNewMeetingProject(null);
  };

  const owner = user?.name ?? "You";

  return (
    <div className="page-padding" style={{ overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <h1 style={{ color: COLORS.text, fontSize: FONT.size.title, fontWeight: 600, margin: 0 }}>All projects</h1>
        <Button variant="primary" onClick={() => setShowNew(true)}>+ New project</Button>
      </div>

      {error && (
        <div style={{
          background: COLORS.redBg, border: `1px solid ${COLORS.red}`, color: COLORS.red,
          borderRadius: RADIUS.md, padding: "10px 14px", fontSize: FONT.size.body, marginBottom: SPACE[5],
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: COLORS.textMuted, fontSize: FONT.size.body }}>Loading projects…</p>
      ) : projects.length === 0 ? (
        <div style={{
          border: `1px dashed ${COLORS.border}`, borderRadius: RADIUS.lg, padding: "48px 24px",
          textAlign: "center", color: COLORS.textMuted, fontSize: FONT.size.body,
        }}>
          No projects yet. Create one, or start a meeting from the dashboard.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {projects.map((p) => {
            const dot = colorFor(p.name);
            const openDocument = () => onNav?.("document", { projectId: p.id });
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={openDocument}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDocument();
                  }
                }}
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.lg,
                  padding: "20px 22px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                    <span style={{ color: COLORS.text, fontWeight: 600, fontSize: FONT.size.body }}>{p.name}</span>
                  </div>
                  <span aria-hidden="true" style={{ color: COLORS.textMuted, fontSize: FONT.size.label }}>↗</span>
                </div>

                <div style={{ color: COLORS.textMuted, fontSize: FONT.size.label, marginBottom: 12, paddingLeft: 16 }}>
                  {owner}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 16 }}>
                  <div style={{ display: "flex", gap: 16, fontSize: FONT.size.label, color: COLORS.textMuted }}>
                    <span><span style={{ color: COLORS.text }}>{p.meetingCount}</span> meeting{p.meetingCount === 1 ? "" : "s"}</span>
                    <span style={{ color: COLORS.textMuted }}>Last: {formatDate(p.lastMeetingAt)}</span>
                  </div>
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewMeetingProject(p);
                    }}
                  >
                    + New meeting
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && (
        <Modal
          title="New project"
          width={420}
          onClose={() => !creating && setShowNew(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowNew(false)} disabled={creating}>Cancel</Button>
              <Button variant="primary" onClick={() => void handleCreate()} disabled={creating || !newName.trim()}>
                {creating ? "Creating…" : "Create project"}
              </Button>
            </>
          }
        >
          <label htmlFor="new-project-name" style={{ color: COLORS.textMuted, fontSize: FONT.size.label, letterSpacing: LETTER_SPACING.wide, display: "block", marginBottom: SPACE[1.5] }}>
            Project name
          </label>
          <input
            id="new-project-name"
            autoFocus
            style={{
              width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
              color: COLORS.text, borderRadius: RADIUS.sm, padding: "10px 12px", fontSize: FONT.size.body, outline: "none",
            }}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
            placeholder="e.g. Pricing v2"
          />
        </Modal>
      )}

      <NewMeetingModal
        open={!!newMeetingProject}
        onClose={() => setNewMeetingProject(null)}
        onSubmit={handleCreateMeetingForProject}
        submitting={create.creating}
        error={create.error}
        lockedProject={newMeetingProject ? { id: newMeetingProject.id, name: newMeetingProject.name } : undefined}
      />
    </div>
  );
}
