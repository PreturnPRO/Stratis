import { useEffect, useMemo, useState } from "react";
import { COLORS } from "../constants";
import { btnAccent, btnGhost } from "../components/ui";
import { EmptyState, LoadingState } from "../components/states";
import { useAuth } from "../context/AuthContext";

const API_BASE = "http://localhost:3001";

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
          </div>
        </div>
      )}
    </div>
  );
}

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