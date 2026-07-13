import {
  LayoutDashboard,
  FolderKanban,
  Video,
  FileText,
  LogOut,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { COLORS, NAV_ITEMS, FONT, RADIUS, SPACE } from "../constants";
import { useAuth } from "../context/AuthContext";

// ─── Icon registry ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderKanban,
  Video,
  FileText,
};

// ─── Avatar helpers ────────────────────────────────────────────────────────────

// Kept independent from the semantic COLORS palette (name-hash lookup, not
// status meaning), but must not visually collide with it — avoid shades near
// COLORS.danger and COLORS.teal.
const AVATAR_COLORS = [
  "#a8556c", "#2e86c1", "#1a7a4a", "#8e44ad",
  "#d35400", "#5c7a89", "#2c3e50", "#7f8c8d",
];

function nameToInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({
  active,
  onNav,
  onLogout,
}: {
  active: string;
  onNav: (id: string) => void;
  onLogout?: () => void;
}) {
  const { user } = useAuth();

  const displayName = user?.name ?? "Guest";
  const initials    = nameToInitials(displayName);
  const avatarColor = user ? nameToColor(user.name) : COLORS.textDim;

  return (
    <div style={{
      width: 64,
      background: COLORS.bg,
      borderRight: `1px solid ${COLORS.border}`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      paddingTop: SPACE[2.5],
      paddingBottom: 12,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <button
        title="Dashboard"
        onClick={() => onNav("dashboard")}
        style={{
          width: 32, height: 32, marginBottom: 16,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: COLORS.accent, background: "transparent", border: "none",
          cursor: "pointer", flexShrink: 0,
        }}
      >
        <Zap size={20} strokeWidth={2} />
      </button>

      {/* Nav items */}
      {NAV_ITEMS.map((item: { id: string; icon: string; label: string }) => {
        const isActive = active === item.id;
        const badge    = item.id === "decisions" ? 2 : item.id === "inbox" ? 4 : null;
        const IconComp = ICON_MAP[item.icon];

        return (
          <div key={item.id} style={{ position: "relative", marginBottom: 2 }}>
            <button
              title={item.label}
              onClick={() => onNav(item.id)}
              style={{
                width: 56, height: 56, borderRadius: RADIUS.lg,
                background: isActive ? COLORS.surfaceHover : "transparent",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: isActive ? COLORS.accent : COLORS.textDim,
                transition: "all 0.15s",
              }}
            >
              {IconComp
                ? <IconComp size={22} strokeWidth={1.75} />
                : <span style={{ fontSize: FONT.size.heading }}>{item.icon}</span>
              }
            </button>

            {badge && (
              <div style={{
                position: "absolute", top: 8, right: 8,
                width: 14, height: 14, borderRadius: "50%",
                background: COLORS.red, fontSize: FONT.size.micro, fontWeight: 700,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                pointerEvents: "none",
              }}>
                {badge}
              </div>
            )}
          </div>
        );
      })}

      {/* Avatar + logout */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div
          title={displayName}
          style={{
            width: 34, height: 34, borderRadius: "50%",
            background: avatarColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: FONT.size.label, fontWeight: 600, color: "#fff", cursor: "default",
          }}
        >
          {initials}
        </div>

        {onLogout && (
          <button
            title="Sign out"
            onClick={onLogout}
            style={{
              width: 40, height: 40, borderRadius: 8,
              background: "transparent", border: "none",
              color: COLORS.textDim, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "color 0.15s",
            }}
          >
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );
}