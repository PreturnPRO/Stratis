import { useEffect, useMemo, useState } from "react";
import { COLORS } from "../constants";
import { btnAccent, btnGhost } from "../components/ui";
<<<<<<< HEAD
import { EmptyState, LoadingState } from "../components/states";
import { useAuth } from "../context/AuthContext";

import { API_BASE } from "../lib/api";

interface ProjectItem {
  id: string;
  projectId: string;
  name: string;
  meetingCount: number;
  lastMeetingAt: string | null;
}

function formatDate(value: string | null): string {
  if (!value) return "No meetings yet";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}
=======
<<<<<<< Updated upstream
>>>>>>> 5cdca32a9d1ee7c78daa4fb40683219dced616a6

export default function Projects() {
  const { token } = useAuth();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNewProject, setShowNewProject] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [creating, setCreating] = useState(false);

  const authHeaders = useMemo((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const loadProjects = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/meeting/projects`, {
        headers: authHeaders,
      });

      const data: {
        ok: boolean;
        error?: string;
        data?: {
          projects: ProjectItem[];
        };
      } = await res.json();

      if (!data.ok) {
        setError(data.error ?? "Could not load projects");
        return;
      }

      setProjects(data.data?.projects ?? []);
    } catch {
      setError("Could not reach backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProjects();
  }, [token]);

  const handleCreateProject = async () => {
    const cleanName = projectName.trim();

    if (!cleanName) {
      setError("Project name is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/meeting/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ name: cleanName }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error ?? "Could not create project");
      }

      setProjectName("");
      setShowNewProject(false);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 500, margin: 0 }}>
          All projects
        </h1>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnGhost()} onClick={loadProjects}>
            Refresh
          </button>
          <button style={btnAccent()} onClick={() => setShowNewProject(true)}>
            + New project
          </button>
        </div>
      </div>

<<<<<<< HEAD
      {error && (
        <div style={{
          background: COLORS.redBg,
          border: `1px solid ${COLORS.red}`,
          color: COLORS.red,
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 18,
          fontSize: 13,
        }}>
=======
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {PROJECTS.map((p) => (
          <div
            key={p.id}
            style={{
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: "20px 22px",
              cursor: "pointer",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = COLORS.borderLight)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = COLORS.border)}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, marginTop: 2 }} />
                <span style={{ color: COLORS.text, fontWeight: 500, fontSize: 15 }}>{p.name}</span>
=======
import { EmptyState, LoadingState } from "../components/states";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../lib/api";

interface ProjectItem {
  id: string;
  projectId: string;
  name: string;
  meetingCount: number;
  lastMeetingAt: string | null;
}

function formatDate(value: string | null): string {
  if (!value) return "No meetings yet";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", year: "numeric",
  }).format(d);
}

interface Props {
  onNav?: (id: string, params?: Record<string, string>) => void;
}

export default function Projects({ onNav }: Props) {
  const { token, user } = useAuth();
  const isFacilitator = user?.role === "facilitator" || user?.role === "admin";

  const [projects, setProjects]     = useState<ProjectItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [showNewProject, setShowNewProject] = useState(false);
  const [projectName, setProjectName]       = useState("");
  const [creating, setCreating]             = useState(false);

  const [editProject, setEditProject]   = useState<ProjectItem | null>(null);
  const [editName, setEditName]         = useState("");
  const [saving, setSaving]             = useState(false);

  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [deleting, setDeleting]               = useState(false);

  const authHeaders = useMemo((): Record<string, string> => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const loadProjects = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/meeting/projects`, { headers: authHeaders });
      const data: { ok: boolean; error?: string; data?: { projects: ProjectItem[] } } = await res.json();
      if (!data.ok) { setError(data.error ?? "Could not load projects"); return; }
      setProjects(data.data?.projects ?? []);
    } catch { setError("Could not reach backend"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void loadProjects(); }, [token]);

  const handleCreateProject = async () => {
    const cleanName = projectName.trim();
    if (!cleanName) { setError("Project name is required"); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/meeting/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ name: cleanName }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Could not create project");
      setProjectName("");
      setShowNewProject(false);
      await loadProjects();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not create project"); }
    finally { setCreating(false); }
  };

  const handleSaveEdit = async () => {
    if (!editProject) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/meeting/projects/${editProject.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Could not update project");
      setEditProject(null);
      await loadProjects();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update project"); }
    finally { setSaving(false); }
  };

  const handleDeleteProject = async () => {
    if (!deleteProjectId) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/meeting/projects/${deleteProjectId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Could not delete project");
      setDeleteProjectId(null);
      await loadProjects();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not delete project"); }
    finally { setDeleting(false); }
  };

  return (
    <div style={{ padding: "40px 60px", overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 500, margin: 0 }}>
          All projects
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnGhost()} onClick={loadProjects}>Refresh</button>
          {isFacilitator && (
            <button style={btnAccent()} onClick={() => setShowNewProject(true)}>+ New project</button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: COLORS.redBg, border: `1px solid ${COLORS.red}`, color: COLORS.red, borderRadius: 8, padding: "10px 12px", marginBottom: 18, fontSize: 13 }}>
>>>>>>> 5cdca32a9d1ee7c78daa4fb40683219dced616a6
          {error}
        </div>
      )}

      {loading ? (
        <LoadingState count={4} persist />
      ) : projects.length === 0 ? (
        <EmptyState message="No projects yet. Create your first project." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {projects.map((p, index) => (
            <div
              key={p.projectId}
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: "20px 22px",
<<<<<<< HEAD
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: index % 3 === 0 ? COLORS.red : index % 3 === 1 ? COLORS.teal : COLORS.orange,
                      marginTop: 2,
                    }}
                  />
                  <span style={{ color: COLORS.text, fontWeight: 500, fontSize: 15 }}>
                    {p.name}
                  </span>
                </div>
=======
                cursor: "pointer",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = COLORS.borderLight)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = COLORS.border)}
              onClick={() => onNav?.("document", { projectId: p.projectId })}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%", marginTop: 2,
                    background: index % 3 === 0 ? COLORS.red : index % 3 === 1 ? COLORS.teal : COLORS.orange,
                  }} />
                  <span style={{ color: COLORS.text, fontWeight: 500, fontSize: 15 }}>{p.name}</span>
                </div>

                {isFacilitator && (
                  <div
                    style={{ display: "flex", gap: 6 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      style={btnGhost({ fontSize: 11, padding: "3px 9px" })}
                      onClick={() => { setEditProject(p); setEditName(p.name); }}
                    >
                      Edit
                    </button>
                    <button
                      style={btnGhost({ fontSize: 11, padding: "3px 9px", color: COLORS.red, borderColor: `${COLORS.red}66` })}
                      onClick={() => setDeleteProjectId(p.projectId)}
                    >
                      Remove
                    </button>
                  </div>
                )}
>>>>>>> Stashed changes
>>>>>>> 5cdca32a9d1ee7c78daa4fb40683219dced616a6
              </div>

              <div style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 12, paddingLeft: 16 }}>
                {p.projectId}
              </div>

              <div style={{ display: "flex", gap: 16, paddingLeft: 16, marginBottom: 12 }}>
                <span style={{ color: COLORS.textMuted, fontSize: 12 }}>
                  <span style={{ color: COLORS.textDim }}>{p.meetingCount}</span>{" "}
                  meeting{p.meetingCount === 1 ? "" : "s"}
                </span>
              </div>
<<<<<<< HEAD

              <div style={{ paddingLeft: 16, fontSize: 12, color: COLORS.cyan }}>
                Last meeting: {formatDate(p.lastMeetingAt)}
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewProject && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 500, margin: "0 0 18px" }}>
              New project
            </h2>

            <input
              style={inputStyle}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name"
              autoFocus
            />

            <p style={{ color: COLORS.textMuted, fontSize: 12, lineHeight: 1.6, margin: "12px 0 0" }}>
              Sprint 1 creates a starter kickoff meeting for this project.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
              <button style={btnGhost()} onClick={() => setShowNewProject(false)} disabled={creating}>
                Cancel
              </button>
              <button style={btnAccent()} onClick={() => void handleCreateProject()} disabled={creating}>
                {creating ? "Creating..." : "Create project"}
              </button>
            </div>
=======
<<<<<<< Updated upstream
            )}
>>>>>>> 5cdca32a9d1ee7c78daa4fb40683219dced616a6
          </div>
        </div>
      )}
    </div>
  );
}
<<<<<<< HEAD

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 200,
};

const modalStyle: React.CSSProperties = {
  width: 400,
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  padding: 24,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: COLORS.bg,
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
};
=======
=======
            </div>
          ))}
        </div>
      )}

      {showNewProject && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 500, margin: "0 0 18px" }}>New project</h2>
            <input
              style={inputStyle}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreateProject(); }}
            />
            <p style={{ color: COLORS.textMuted, fontSize: 12, lineHeight: 1.6, margin: "12px 0 0" }}>
              A starter kickoff meeting will be created for this project.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
              <button style={btnGhost()} onClick={() => setShowNewProject(false)} disabled={creating}>Cancel</button>
              <button style={btnAccent()} onClick={() => void handleCreateProject()} disabled={creating}>
                {creating ? "Creating..." : "Create project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editProject && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <h2 style={{ color: COLORS.text, fontSize: 18, fontWeight: 500, margin: "0 0 18px" }}>Edit project</h2>
            <input
              style={inputStyle}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Project name"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") void handleSaveEdit(); }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
              <button style={btnGhost()} onClick={() => setEditProject(null)} disabled={saving}>Cancel</button>
              <button style={btnAccent()} onClick={() => void handleSaveEdit()} disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteProjectId && (
        <div style={overlayStyle}>
          <div style={{ ...modalStyle, width: 360 }}>
            <h2 style={{ color: COLORS.text, fontSize: 17, fontWeight: 500, margin: "0 0 12px" }}>Remove project?</h2>
            <p style={{ color: COLORS.textMuted, fontSize: 13, margin: "0 0 22px", lineHeight: 1.6 }}>
              This will permanently delete the project and all its meetings.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={btnGhost()} onClick={() => setDeleteProjectId(null)} disabled={deleting}>Cancel</button>
              <button
                style={btnAccent({ background: COLORS.red, borderColor: COLORS.red })}
                onClick={() => void handleDeleteProject()}
                disabled={deleting}
              >
                {deleting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
};

const modalStyle: React.CSSProperties = {
  width: 400, background: COLORS.surface,
  border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 24,
};

const inputStyle: React.CSSProperties = {
  width: "100%", background: COLORS.bg, border: `1px solid ${COLORS.border}`,
  color: COLORS.text, borderRadius: 6, padding: "10px 12px", fontSize: 14, outline: "none",
};
>>>>>>> Stashed changes
>>>>>>> 5cdca32a9d1ee7c78daa4fb40683219dced616a6
