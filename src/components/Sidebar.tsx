import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  Video,
  FileText,
  LogOut,
  Zap,
  PanelLeft,
  PanelLeftClose,
  Settings as SettingsIcon,
  ShieldCheck,
  MessageSquarePlus,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { FONT, LETTER_SPACING, RADIUS, SPACE } from "../tokens/colors";
import { NAV_ITEMS } from "../constants";

type NavItem = { id: string; icon: string; label: string };

/**
 * Decisions first. A flat list of six destinations describes a file system;
 * this says what the product works on and where the record of it lives.
 */
const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  { label: null, items: [(NAV_ITEMS as NavItem[])[0]] },
  { label: "Decisions", items: (NAV_ITEMS as NavItem[]).filter((i) => i.id === "docket") },
  {
    label: "Workspace",
    items: (NAV_ITEMS as NavItem[]).filter((i) => ["projects", "meeting", "document"].includes(i.id)),
  },
  {
    label: null,
    items: [
      { id: "settings", icon: "SettingsIcon", label: "Settings" },
      { id: "admin", icon: "ShieldCheck", label: "Admin" },
    ],
  },
];
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../hooks/useTheme";

// The rail keeps a CONSTANT layout width and expansion is a deliberate,
// persisted click. Hover-expand animated the flex width, which relaid out the
// entire main column — transcript, panels, header — on every accidental graze.
const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 200;
const STORAGE_KEY = "stratis-sidebar-expanded";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  Video,
  FileText,
  SettingsIcon,
  ShieldCheck,
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
  isPlatformAdmin = false,
  onFeedback,
}: {
  active: string;
  onNav: (id: string) => void;
  onLogout?: () => void;
  /** Admin is the only nav entry that is not for everyone. */
  isPlatformAdmin?: boolean;
  onFeedback?: () => void;
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
  const [logoutPressed, setLogoutPressed] = useState(false);
  const [feedbackPressed, setFeedbackPressed] = useState(false);
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

  /**
   * The picture the profile has been storing all along.
   *
   * `avatarUrl` was saved, returned by the API and re-read on every refresh —
   * and drawn by nothing, so setting it looked like a save that did not take.
   * A link that 404s falls back to the initials rather than a broken-image
   * glyph, and the flag resets when the link changes so a corrected URL is
   * tried again.
   */
  const avatarUrl = user?.avatarUrl?.trim() || null;
  const [avatarBroken, setAvatarBroken] = useState(false);
  useEffect(() => setAvatarBroken(false), [avatarUrl]);

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

      {/* Grouped, because a flat list of six says nothing about what the product
          is for. Decisions first — that is the object Stratis works on; the
          workspace items are where the record lives. Headers only when the rail
          is expanded: on the icon rail they would be noise. */}
      {NAV_GROUPS.flatMap((group) =>
        (group.items as { id: string; icon: string; label: string }[])
          .filter((item) => item.id !== "admin" || isPlatformAdmin)
          .map((item, indexInGroup) => ({ group, item, indexInGroup })),
      ).map(({ group, item, indexInGroup }) => {
        const isActive = active === item.id;
        const IconComp = ICON_MAP[item.icon];

        return (
          <div key={item.id} style={{ position: "relative", marginBottom: 2 }}>
            {group.label && indexInGroup === 0 && (
              <div
                style={{
                  height: expanded ? 26 : 12,
                  marginTop: 10,
                  paddingLeft: 21,
                  display: "flex",
                  alignItems: "center",
                  fontFamily: FONT.mono,
                  fontSize: FONT.size.micro,
                  letterSpacing: LETTER_SPACING.wide,
                  textTransform: "uppercase",
                  color: colors.textDim,
                  opacity: expanded ? 1 : 0,
                  transition: "opacity 0.15s",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                }}
                aria-hidden={!expanded}
              >
                {group.label}
              </div>
            )}
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
        {onFeedback && (
          <button
            title="Send feedback"
            aria-label="Send feedback"
            onClick={onFeedback}
            onMouseLeave={() => setFeedbackPressed(false)}
            onMouseDown={() => setFeedbackPressed(true)}
            onMouseUp={() => setFeedbackPressed(false)}
            style={{
              width: expanded ? EXPANDED_WIDTH - 8 : 56, height: 44, marginLeft: 4,
              borderRadius: 8, background: "transparent", border: "none",
              color: colors.textDim, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "flex-start",
              gap: 14, paddingLeft: 17,
              opacity: feedbackPressed ? 0.7 : 1,
              transition: "opacity 0.1s, color 0.15s, width 0.2s cubic-bezier(.4,0,.2,1)",
            }}
          >
            <span style={{ display: "flex", flexShrink: 0 }}>
              <MessageSquarePlus size={16} strokeWidth={1.75} />
            </span>
            <span style={{
              fontSize: FONT.size.body, fontWeight: 500, whiteSpace: "nowrap",
              opacity: expanded ? 1 : 0, transition: "opacity 0.15s",
            }}>
              Send feedback
            </span>
          </button>
        )}

        {/* The theme control moved to Settings → Preferences. The rail is for
            navigation; a rarely-used appearance switch sitting next to the
            pages was crowding the thing people are actually here to click. */}
        {/* Language moved to Settings → Preferences with the theme. The rail
            is for destinations. */}

        <div
          title={displayName}
          style={{
            width: expanded ? EXPANDED_WIDTH - 8 : 56, height: 44, marginLeft: 4,
            display: "flex", alignItems: "center", justifyContent: "flex-start",
            gap: 14, paddingLeft: 11, cursor: "default",
            transition: "width 0.2s cubic-bezier(.4,0,.2,1)",
          }}
        >
          {avatarUrl && !avatarBroken ? (
            <img
              src={avatarUrl}
              alt=""
              width={34}
              height={34}
              onError={() => setAvatarBroken(true)}
              style={{
                width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                objectFit: "cover", background: colors.surfaceHover,
              }}
            />
          ) : (
            <span style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: avatarColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: FONT.size.label, fontWeight: 600, color: "#fff",
            }}>
              {initials}
            </span>
          )}
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
