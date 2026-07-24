import React, { useEffect, useId, useRef, useState } from "react";
import { COLORS, RADIUS, FONT, LETTER_SPACING, SPACE } from "../tokens/colors";
import { useTheme } from "../hooks/useTheme";

// ─────────────────────────────────────────────────────────────────────────────
// Legacy style helpers — kept so pages not yet migrated keep working.
// Prefer the <Button> component below for new/updated UI.
// ─────────────────────────────────────────────────────────────────────────────

export function btnAccent(extra = {}) {
  return {
    background: COLORS.accent,
    border: `1px solid ${COLORS.accent}`,
    color: "#10160b",
    borderRadius: 6,
    padding: "7px 14px",
    fontSize: FONT.size.body,
    fontWeight: 600,
    cursor: "pointer",
    ...extra,
  };
}

export function btnGhost(extra = {}) {
  return {
    background: "transparent",
    border: `1px solid ${COLORS.border}`,
    color: COLORS.textMuted,
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: FONT.size.body,
    cursor: "pointer",
    ...extra,
  };
}

export function Avatar({ initials, color, size = 36 }: { initials: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.33, fontWeight: 600, color: "#fff",
    }}>
      {initials}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <div style={{ color: colors.textMuted, fontSize: FONT.size.label, letterSpacing: LETTER_SPACING.label, marginBottom: SPACE[4] }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Button — variants + sizes with real hover/active feedback. Focus ring comes
// from the global :focus-visible rule in index.css.
// ─────────────────────────────────────────────────────────────────────────────

export type ButtonVariant = "primary" | "ghost" | "danger" | "subtle";
export type ButtonSize = "sm" | "md";

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconLeft?: React.ReactNode;
  fullWidth?: boolean;
}

const SIZE_STYLE: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: "5px 11px", fontSize: FONT.size.label },
  md: { padding: "8px 16px", fontSize: FONT.size.body },
};

function variantBase(
  variant: ButtonVariant,
  hovered: boolean,
  colors: ReturnType<typeof useTheme>["colors"],
  shadow: ReturnType<typeof useTheme>["shadow"],
): React.CSSProperties {
  switch (variant) {
    case "primary":
      return {
        background: hovered ? colors.accentHover : colors.accent,
        border: `1px solid ${hovered ? colors.accentHover : colors.accent}`,
        color: "#10160b",
        boxShadow: hovered ? shadow.glow(colors.accent) : "none",
      };
    case "danger":
      return {
        background: hovered ? colors.dangerBg : "transparent",
        border: `1px solid ${hovered ? colors.danger : `${colors.danger}66`}`,
        color: colors.danger,
      };
    case "subtle":
      return {
        background: hovered ? colors.surfaceHover : colors.surface,
        border: `1px solid ${colors.border}`,
        color: colors.text,
      };
    case "ghost":
    default:
      return {
        background: hovered ? colors.surfaceHover : "transparent",
        border: `1px solid ${hovered ? colors.borderLight : colors.border}`,
        color: hovered ? colors.text : colors.textMuted,
      };
  }
}

export function Button({
  variant = "ghost",
  size = "md",
  iconLeft,
  fullWidth,
  style,
  children,
  disabled,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const active = hovered && !disabled;
  const { colors, shadow } = useTheme();

  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseEnter={(e) => { setHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHovered(false); onMouseLeave?.(e); }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        borderRadius: RADIUS.pill,
        fontWeight: 600,
        lineHeight: 1,
        width: fullWidth ? "100%" : undefined,
        whiteSpace: "nowrap",
        ...SIZE_STYLE[size],
        ...variantBase(variant, active, colors, shadow),
        ...style,
      }}
    >
      {iconLeft}
      {children}
    </button>
  );
}

// IconButton — square, icon-only, ghost hover.
export function IconButton({
  title,
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [hovered, setHovered] = useState(false);
  const { colors } = useTheme();
  return (
    <button
      {...rest}
      title={title}
      onMouseEnter={(e) => { setHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHovered(false); onMouseLeave?.(e); }}
      style={{
        width: 30,
        height: 30,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: RADIUS.sm,
        background: hovered ? colors.surfaceHover : "transparent",
        border: "none",
        color: hovered ? colors.text : colors.textMuted,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chip — compact status indicator.
// ─────────────────────────────────────────────────────────────────────────────

export function Chip({
  children,
  color,
  icon,
  mono,
}: {
  children: React.ReactNode;
  color?: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 9px",
      borderRadius: RADIUS.pill,
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      color: color ?? colors.textMuted,
      fontSize: FONT.size.caption,
      fontWeight: 500,
      fontFamily: mono ? "'SF Mono', ui-monospace, Menlo, monospace" : undefined,
      lineHeight: 1.4,
    }}>
      {icon}
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal — backdrop fade, panel pop, Esc-to-close, click-outside, focus capture.
// ─────────────────────────────────────────────────────────────────────────────

export function Modal({
  title,
  onClose,
  children,
  footer,
  width = 440,
  closeOnBackdrop = true,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  // Form modals pass false: a mouse slip onto the backdrop must not wipe the
  // user's inputs — those close on Cancel/Escape only.
  closeOnBackdrop?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { colors, shadow } = useTheme();

  // Keep the latest onClose in a ref so the effect below can stay mount-only
  // (empty deps) — depending on `onClose` directly re-ran this effect (and
  // re-stole focus onto the panel) on every keystroke, since callers pass a
  // fresh inline arrow function each render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      onClick={closeOnBackdrop ? onClose : undefined}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.66)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        animation: "fadeIn 0.15s ease",
        padding: 24,
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: "100%",
          background: colors.surfaceElevated,
          border: `1px solid ${colors.borderLight}`,
          borderRadius: RADIUS.lg,
          padding: 24,
          boxShadow: shadow.shadModal,
          animation: "modalIn 0.28s cubic-bezier(.22,1,.36,1)",
          outline: "none",
        }}
      >
        {title && (
          <h2 id={titleId} style={{
            color: colors.text,
            fontSize: FONT.size.heading,
            fontWeight: 600,
            margin: "0 0 18px",
          }}>
            {title}
          </h2>
        )}
        {children}
        {footer && (
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: SPACE[6],
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
