import {
  LayoutDashboard,
  FolderKanban,
  Video,
  FileText,
  LogOut,
  Zap,
  Sun,
  Moon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { NAV_ITEMS, FONT, RADIUS, SPACE } from "../constants";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import LetterStagger from "./LetterStagger";

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 200;

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
// colors.danger and colors.teal.
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
  theme,
  onToggleTheme,
}: {
  active: string;
  onNav: (id: string) => void;
  onLogout?: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const displayName = user?.name ?? "Guest";
  const initials    = nameToInitials(displayName);
  const avatarColor = user ? nameToColor(user.name) : colors.textDim;

  return (
    <nav
      aria-label="Primary"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        background: colors.bg,
        borderRight: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        paddingTop: SPACE[2.5],
        paddingBottom: 12,
        flexShrink: 0,
        overflow: "hidden",
        transition: "width 0.25s cubic-bezier(.4,0,.2,1)",
      }}
    >
      {/* Logo */}
      <button
        title="Dashboard"
        aria-label="Dashboard"
        onClick={() => onNav("dashboard")}
        style={{
          width: 44, height: 44, marginBottom: 16, marginLeft: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: colors.accent, background: "transparent", border: "none",
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
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNav(item.id)}
              style={{
                width: expanded ? EXPANDED_WIDTH - 8 : 56,
                height: 56, marginLeft: 4, borderRadius: RADIUS.lg,
                background: isActive ? colors.surfaceHover : "transparent",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "flex-start",
                gap: 14, paddingLeft: 17,
                color: isActive ? colors.accent : colors.textDim,
                transition: "background 0.15s, color 0.15s, width 0.25s cubic-bezier(.4,0,.2,1)",
              }}
            >
              <span style={{ display: "flex", flexShrink: 0 }}>
                {IconComp
                  ? <IconComp size={22} strokeWidth={1.75} />
                  : <span style={{ fontSize: FONT.size.heading }}>{item.icon}</span>
                }
              </span>
              <span style={{
                display: "inline-block", overflow: "hidden",
                width: expanded ? "auto" : 0,
                fontSize: FONT.size.body, fontWeight: 500, whiteSpace: "nowrap",
                opacity: expanded ? 1 : 0, transition: "opacity 0.15s, width 0.25s cubic-bezier(.4,0,.2,1)",
              }}>
                <LetterStagger text={item.label} accentColor={colors.accent} />
              </span>
            </button>

            {badge && (
              <div style={{
                position: "absolute", top: 8, left: 35,
                width: 14, height: 14, borderRadius: "50%",
                background: colors.red, fontSize: FONT.size.micro, fontWeight: 700,
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
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          title="Toggle theme"
          aria-label="Toggle theme"
          onClick={onToggleTheme}
          style={{
            width: expanded ? EXPANDED_WIDTH - 8 : 56, height: 44, marginLeft: 4,
            borderRadius: 8, background: "transparent", border: "none",
            color: colors.textDim, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "flex-start",
            gap: 14, paddingLeft: 17,
            transition: "width 0.25s cubic-bezier(.4,0,.2,1)",
          }}
        >
          <span style={{ display: "flex", flexShrink: 0 }}>
            {theme === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
          </span>
          <span style={{
            display: "inline-block", overflow: "hidden",
            width: expanded ? "auto" : 0,
            fontSize: FONT.size.body, fontWeight: 500, whiteSpace: "nowrap",
            opacity: expanded ? 1 : 0, transition: "opacity 0.15s, width 0.25s cubic-bezier(.4,0,.2,1)",
          }}>
            <LetterStagger text={theme === "dark" ? "Light mode" : "Dark mode"} accentColor={colors.accent} />
          </span>
        </button>

        <div
          title={displayName}
          style={{
            width: expanded ? EXPANDED_WIDTH - 8 : 56, height: 44, marginLeft: 4,
            display: "flex", alignItems: "center", justifyContent: "flex-start",
            gap: 14, paddingLeft: 11, cursor: "default",
            transition: "width 0.25s cubic-bezier(.4,0,.2,1)",
          }}
        >
          <span style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
            background: avatarColor,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: FONT.size.label, fontWeight: 600, color: "#fff",
          }}>
            {initials}
          </span>
          <span style={{
            display: "inline-block", overflow: "hidden",
            width: expanded ? "auto" : 0,
            fontSize: FONT.size.body, fontWeight: 500, whiteSpace: "nowrap", color: colors.text,
            opacity: expanded ? 1 : 0, transition: "opacity 0.15s, width 0.25s cubic-bezier(.4,0,.2,1)",
          }}>
            {displayName}
          </span>
        </div>

        {onLogout && (
          <button
            title="Sign out"
            aria-label="Sign out"
            onClick={onLogout}
            style={{
              width: expanded ? EXPANDED_WIDTH - 8 : 56, height: 44, marginLeft: 4,
              borderRadius: 8, background: "transparent", border: "none",
              color: colors.textDim, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "flex-start",
              gap: 14, paddingLeft: 17,
              transition: "color 0.15s, width 0.25s cubic-bezier(.4,0,.2,1)",
            }}
          >
            <span style={{ display: "flex", flexShrink: 0 }}>
              <LogOut size={16} strokeWidth={1.75} />
            </span>
            <span style={{
              display: "inline-block", overflow: "hidden",
              width: expanded ? "auto" : 0,
              fontSize: FONT.size.body, fontWeight: 500, whiteSpace: "nowrap",
              opacity: expanded ? 1 : 0, transition: "opacity 0.15s, width 0.25s cubic-bezier(.4,0,.2,1)",
            }}>
              <LetterStagger text="Sign out" accentColor={colors.accent} />
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}