import React, { useEffect, useId, useRef, useState } from "react";
import { COLORS, RADIUS, FONT, LETTER_SPACING, SPACE } from "../tokens/colors";
import { useTheme } from "../hooks/useTheme";

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

export type ButtonVariant = "primary" | "ghost" | "danger" | "subtle" | "quiet" | "link";
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
): React.CSSProperties {
  switch (variant) {
    case "primary":
      return {
        background: hovered ? colors.accentHover : colors.accent,
        border: `1px solid ${hovered ? colors.accentHover : colors.accent}`,
        color: "#10160b",
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
    /* Borderless inline action — the vocabulary the ad-hoc buttons inside cards
       and panels were reaching for. Reads as part of the card until hovered. */
    case "quiet":
      return {
        background: hovered ? colors.surfaceHover : "transparent",
        border: "1px solid transparent",
        color: hovered ? colors.text : colors.textMuted,
      };
    /* Text-only affordance for in-flow links (.ics download, ToC entries).
       The underline is always present — a link with no rest state is
       indistinguishable from static caption text — and just goes from faint to
       solid on hover. */
    case "link":
      return {
        background: "transparent",
        border: "1px solid transparent",
        color: hovered ? colors.text : colors.textMuted,
        textDecoration: "underline",
        textDecorationColor: hovered ? "currentColor" : `${colors.textDim}80`,
        textUnderlineOffset: 3,
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
  onMouseDown,
  onMouseUp,
  ...rest
}: ButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const active = hovered && !disabled;
  const { colors } = useTheme();

  const label = children;

  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseEnter={(e) => { setHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHovered(false); setPressed(false); onMouseLeave?.(e); }}
      onMouseDown={(e) => { setPressed(true); onMouseDown?.(e); }}
      onMouseUp={(e) => { setPressed(false); onMouseUp?.(e); }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        borderRadius: RADIUS.pill,
        fontWeight: 600,
        lineHeight: 1,
        width: fullWidth ? "100%" : undefined,
        /* `white-space` inherits, so a blanket `nowrap` here reaches multi-line
           children. It clipped the two-line clamp on queued suggestion rows
           mid-word. Pill-shaped variants still want it; the row-shaped `quiet`
           variant must not have it. */
        whiteSpace: variant === "quiet" ? "normal" : "nowrap",
        opacity: pressed && !disabled ? 0.82 : 1,
        transition: "background 0.15s, color 0.15s, border-color 0.15s, opacity 0.1s",
        ...SIZE_STYLE[size],
        ...variantBase(variant, active, colors),
        ...style,
      }}
    >
      {iconLeft}
      {label}
    </button>
  );
}

export function IconButton({
  title,
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const { colors } = useTheme();
  return (
    <button
      {...rest}
      title={title}
      onMouseEnter={(e) => { setHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHovered(false); setPressed(false); onMouseLeave?.(e); }}
      onMouseDown={(e) => { setPressed(true); onMouseDown?.(e); }}
      onMouseUp={(e) => { setPressed(false); onMouseUp?.(e); }}
      style={{
        width: 30,
        height: 30,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: RADIUS.sm,
        background: hovered ? colors.surfaceHover : "transparent",
        border: "none",
        opacity: pressed ? 0.82 : 1,
        transition: "background 0.15s, color 0.15s, opacity 0.1s",
        color: hovered ? colors.text : colors.textMuted,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

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
  closeOnBackdrop?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { colors, shadow } = useTheme();

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      /* Focus trap. `aria-modal="true"` only *claims* the rest of the page is
         inert; without this, Tab walks straight out of a destructive-confirm
         dialog into the page behind it. `inert` on the app root is not an
         option here because the modal renders inside that tree rather than a
         portal, so the cycle is enforced manually. */
      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        panel?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (active && panel && !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);

    // Land on the first real control rather than the panel shell.
    const items = focusable();
    (items[0] ?? panel)?.focus();

    // Prevent the page behind from scrolling under the dialog.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
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
        /* flex-start + `margin: auto` on the panel: still centred when it fits,
           but scrollable instead of clipped when it doesn't. `center` alone
           clips the top of an over-tall panel beyond reach. */
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
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
          maxHeight: "calc(100dvh - 48px)",
          margin: "auto",
          display: "flex",
          flexDirection: "column",
          background: colors.surfaceElevated,
          border: `1px solid ${colors.borderLight}`,
          borderRadius: RADIUS.lg,
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
            margin: 0,
            padding: "24px 24px 18px",
            flexShrink: 0,
          }}>
            {title}
          </h2>
        )}
        <div style={{
          overflowY: "auto",
          padding: title ? "0 24px" : "24px 24px 0",
          flex: "1 1 auto",
          minHeight: 0,
        }}>
          {children}
        </div>
        {footer && (
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: `${SPACE[5]}px 24px 24px`,
            flexShrink: 0,
            /* The primary action must never be the thing that falls off. */
            position: "sticky",
            bottom: 0,
            background: colors.surfaceElevated,
            borderBottomLeftRadius: RADIUS.lg,
            borderBottomRightRadius: RADIUS.lg,
          }}>
            {footer}
          </div>
        )}
        {!footer && <div style={{ height: 24, flexShrink: 0 }} />}
      </div>
    </div>
  );
}
