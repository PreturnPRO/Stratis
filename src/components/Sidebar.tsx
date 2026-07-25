import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  Video,
  FileText,
  LogOut,
  Zap,
  Sun,
  Moon,
  PanelLeft,
  PanelLeftClose,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { NAV_ITEMS, FONT, RADIUS, SPACE } from "../constants";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../hooks/useTheme";

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 200;
const STORAGE_KEY = "stratis-sidebar-expanded";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  Video,
  FileText,
};

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
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [pressedNav, setPressedNav] = useState<string | null>(null);
  const [themePressed, setThemePressed] = useState(false);
  const [logoutPressed, setLogoutPressed] = useState(false);
  const [togglePressed, setTogglePressed] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, expanded ? "1" : "0");
    } catch {
    }
  }, [expanded]);

  const displayName = user?.name ?? "Guest";
  const initials    = nameToInitials(displayName);
  const avatarColor = user ? nameToColor(user.name) : colors.textDim;

  const onRailClick = (e: ReactMouseEvent) => {
    if (expanded) return;
    if ((e.target as HTMLElement).closest("button")) return;
    setExpanded(true);
  };

  return (
    <nav
      aria-label="Primary"
      onClick={onRailClick}
      style={{
        width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        flexShrink: 0,
        background: colors.bg,
        borderRight: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        paddingTop: SPACE[2.5],
        paddingBottom: 12,
        overflow: "hidden",
        cursor: expanded ? "default" : "e-resize",
        transition: "width 0.2s cubic-bezier(.4,0,.2,1)",
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: expanded ? "space-between" : "center",
          gap: 4,
          height: 44,
          marginBottom: 16,
          paddingLeft: expanded ? 14 : 0,
          paddingRight: expanded ? 8 : 0,
          flexShrink: 0,
        }}
      >
        {expanded && (
          <button
            title="Dashboard"
            aria-label="Dashboard"
            onClick={() => onNav("dashboard")}
            style={{
              width: 32, height: 32,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: colors.accent, background: "transparent", border: "none",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <Zap size={20} strokeWidth={2} />
          </button>
        )}

        <button
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          onMouseLeave={() => setTogglePressed(false)}
          onMouseDown={() => setTogglePressed(true)}
          onMouseUp={() => setTogglePressed(false)}
          style={{
            width: 36, height: 36, borderRadius: RADIUS.sm,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: colors.textDim, background: "transparent", border: "none",
            cursor: "pointer", flexShrink: 0,
            opacity: togglePressed ? 0.7 : 1,
            transition: "opacity 0.1s, color 0.15s",
          }}
        >
          {expanded ? <PanelLeftClose size={18} strokeWidth={1.75} /> : <PanelLeft size={18} strokeWidth={1.75} />}
        </button>
      </div>

      {NAV_ITEMS.map((item: { id: string; icon: string; label: string }) => {
        const isActive = active === item.id;
        const IconComp = ICON_MAP[item.icon];

        return (
          <div key={item.id} style={{ position: "relative", marginBottom: 2 }}>
            <button
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onNav(item.id)}
              onMouseLeave={() => setPressedNav(null)}
              onMouseDown={() => setPressedNav(item.id)}
              onMouseUp={() => setPressedNav(null)}
              style={{
                width: expanded ? EXPANDED_WIDTH - 8 : 56,
                height: 56, marginLeft: 4, borderRadius: RADIUS.lg,
                background: isActive ? colors.surfaceHover : "transparent",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "flex-start",
                gap: 14, paddingLeft: 17,
                color: isActive ? colors.accent : colors.textDim,
                opacity: pressedNav === item.id ? 0.7 : 1,
                transition: "opacity 0.1s, background 0.15s, color 0.15s, width 0.2s cubic-bezier(.4,0,.2,1)",
              }}
            >
              <span style={{ display: "flex", flexShrink: 0 }}>
                {IconComp
                  ? <IconComp size={22} strokeWidth={1.75} />
                  : <span style={{ fontSize: FONT.size.heading }}>{item.icon}</span>
                }
              </span>
              <span style={{
                fontSize: FONT.size.body, fontWeight: 500, whiteSpace: "nowrap",
                opacity: expanded ? 1 : 0, transition: "opacity 0.15s",
              }}>
                {item.label}
              </span>
            </button>
          </div>
        );
      })}

      </div>

      <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          title="Toggle theme"
          aria-label="Toggle theme"
          onClick={onToggleTheme}
          onMouseLeave={() => setThemePressed(false)}
          onMouseDown={() => setThemePressed(true)}
          onMouseUp={() => setThemePressed(false)}
          style={{
            width: expanded ? EXPANDED_WIDTH - 8 : 56, height: 44, marginLeft: 4,
            borderRadius: 8, background: "transparent", border: "none",
            color: colors.textDim, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "flex-start",
            gap: 14, paddingLeft: 17,
            opacity: themePressed ? 0.7 : 1,
            transition: "opacity 0.1s, width 0.2s cubic-bezier(.4,0,.2,1)",
          }}
        >
          <span style={{ display: "flex", flexShrink: 0 }}>
            {theme === "dark" ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
          </span>
          <span style={{
            fontSize: FONT.size.body, fontWeight: 500, whiteSpace: "nowrap",
            opacity: expanded ? 1 : 0, transition: "opacity 0.15s",
          }}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </span>
        </button>

        <div
          title={displayName}
          style={{
            width: expanded ? EXPANDED_WIDTH - 8 : 56, height: 44, marginLeft: 4,
            display: "flex", alignItems: "center", justifyContent: "flex-start",
            gap: 14, paddingLeft: 11, cursor: "default",
            transition: "width 0.2s cubic-bezier(.4,0,.2,1)",
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
            fontSize: FONT.size.body, fontWeight: 500, whiteSpace: "nowrap", color: colors.text,
            opacity: expanded ? 1 : 0, transition: "opacity 0.15s",
          }}>
            {displayName}
          </span>
        </div>

        {onLogout && (
          <button
            title="Sign out"
            aria-label="Sign out"
            onClick={onLogout}
            onMouseLeave={() => setLogoutPressed(false)}
            onMouseDown={() => setLogoutPressed(true)}
            onMouseUp={() => setLogoutPressed(false)}
            style={{
              width: expanded ? EXPANDED_WIDTH - 8 : 56, height: 44, marginLeft: 4,
              borderRadius: 8, background: "transparent", border: "none",
              color: colors.textDim, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "flex-start",
              gap: 14, paddingLeft: 17,
              opacity: logoutPressed ? 0.7 : 1,
              transition: "opacity 0.1s, color 0.15s, width 0.2s cubic-bezier(.4,0,.2,1)",
            }}
          >
            <span style={{ display: "flex", flexShrink: 0 }}>
              <LogOut size={16} strokeWidth={1.75} />
            </span>
            <span style={{
              fontSize: FONT.size.body, fontWeight: 500, whiteSpace: "nowrap",
              opacity: expanded ? 1 : 0, transition: "opacity 0.15s",
            }}>
              Sign out
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}
