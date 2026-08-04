import type { CSSProperties, ReactNode } from "react";
import { FONT, RADIUS, SPACE } from "../tokens/colors";
import { useTheme } from "../hooks/useTheme";

/**
 * Layout primitives shared by the settings, admin, and pricing screens.
 *
 * These pages are forms and tables, not the meeting surface, and every one of
 * them needs the same page frame, the same section card, and the same labelled
 * field. Kept here so the three cannot drift into three slightly different
 * versions of the same layout.
 */

export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <div style={{ height: "100%", overflowY: "auto", background: colors.bg }}>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: `${SPACE[4]}px ${SPACE[3]}px ${SPACE[6]}px` }}>
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: SPACE[2],
            marginBottom: SPACE[3],
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: FONT.size.title, fontWeight: 600, color: colors.text }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ margin: "6px 0 0", fontSize: FONT.size.body, color: colors.textMuted, maxWidth: 560 }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </header>
        {children}
      </div>
    </div>
  );
}

export function Card({
  title,
  description,
  footer,
  children,
  style,
}: {
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const { colors } = useTheme();
  return (
    <section
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: RADIUS.lg,
        marginBottom: SPACE[2.5],
        overflow: "hidden",
        ...style,
      }}
    >
      {(title || description) && (
        <div style={{ padding: `${SPACE[2]}px ${SPACE[2.5]}px`, borderBottom: children ? `1px solid ${colors.border}` : "none" }}>
          {title && (
            <h2 style={{ margin: 0, fontSize: FONT.size.body, fontWeight: 600, color: colors.text }}>
              {title}
            </h2>
          )}
          {description && (
            <p style={{ margin: "4px 0 0", fontSize: FONT.size.label, color: colors.textDim }}>
              {description}
            </p>
          )}
        </div>
      )}
      {children && <div style={{ padding: SPACE[2.5] }}>{children}</div>}
      {footer && (
        <div
          style={{
            padding: `${SPACE[1.5]}px ${SPACE[2.5]}px`,
            borderTop: `1px solid ${colors.border}`,
            background: colors.surfaceMuted,
            display: "flex",
            justifyContent: "flex-end",
            gap: SPACE[1],
          }}
        >
          {footer}
        </div>
      )}
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <label style={{ display: "block", marginBottom: SPACE[2] }}>
      <span
        style={{
          display: "block",
          fontSize: FONT.size.label,
          fontWeight: 500,
          color: colors.textMuted,
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      {children}
      {hint && !error && (
        <span style={{ display: "block", marginTop: 5, fontSize: FONT.size.caption, color: colors.textDim }}>
          {hint}
        </span>
      )}
      {error && (
        <span role="alert" style={{ display: "block", marginTop: 5, fontSize: FONT.size.caption, color: colors.danger }}>
          {error}
        </span>
      )}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { colors } = useTheme();
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "9px 11px",
        borderRadius: RADIUS.md,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        fontSize: FONT.size.body,
        fontFamily: "inherit",
        ...props.style,
      }}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { colors } = useTheme();
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        minHeight: 88,
        padding: "9px 11px",
        borderRadius: RADIUS.md,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        fontSize: FONT.size.body,
        fontFamily: "inherit",
        resize: "vertical",
        ...props.style,
      }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { colors } = useTheme();
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "9px 11px",
        borderRadius: RADIUS.md,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        fontSize: FONT.size.body,
        fontFamily: "inherit",
        ...props.style,
      }}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: SPACE[1.5],
        padding: `${SPACE[1.5]}px 0`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, accentColor: colors.accent, width: 16, height: 16 }}
      />
      <span>
        <span style={{ display: "block", fontSize: FONT.size.body, color: colors.text }}>{label}</span>
        {description && (
          <span style={{ display: "block", fontSize: FONT.size.caption, color: colors.textDim, marginTop: 2 }}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <div
      role="tablist"
      style={{
        display: "flex",
        gap: 2,
        borderBottom: `1px solid ${colors.border}`,
        marginBottom: SPACE[2.5],
        overflowX: "auto",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              padding: "9px 14px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${isActive ? colors.accent : "transparent"}`,
              color: isActive ? colors.text : colors.textDim,
              fontSize: FONT.size.body,
              fontWeight: isActive ? 600 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "danger";
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const palette = {
    info: { fg: colors.textMuted, bg: colors.surfaceMuted, border: colors.border },
    success: { fg: colors.green, bg: colors.tealBg, border: colors.tealLight },
    danger: { fg: colors.danger, bg: colors.dangerBg, border: colors.danger },
  }[tone];

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      style={{
        padding: `${SPACE[1.5]}px ${SPACE[2]}px`,
        borderRadius: RADIUS.md,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.fg,
        fontSize: FONT.size.label,
        marginBottom: SPACE[2],
      }}
    >
      {children}
    </div>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        flex: "1 1 140px",
        minWidth: 140,
        padding: SPACE[2],
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: RADIUS.md,
      }}
    >
      <div style={{ fontSize: FONT.size.caption, color: colors.textDim, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: colors.text, marginTop: 4, lineHeight: 1.1 }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: FONT.size.caption, color: colors.textDim, marginTop: 3 }}>{hint}</div>}
    </div>
  );
}
