// ─────────────────────────────────────────────────────────────────────────────
// STRATIS DESIGN TOKENS — single source of truth
//
// Both `import { COLORS } from "../tokens/colors"` and
// `import { COLORS } from "../constants"` resolve here (constants re-exports),
// so the whole app shares one palette. Keys are a superset of every token the
// codebase referenced before unification — `text` and `textPrimary` are aliases
// kept for backward compatibility.
//
// Visual direction: dark, depth-aware surfaces with a refined amber accent and
// lifted muted-text for legibility.
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS = {
  // Base / surfaces (low → high elevation)
  bg:            "#09090b",
  surface:       "#141417",
  surfaceHover:  "#1d1d21",
  surfaceMuted:  "#101013",
  surfaceElevated: "#1a1a1e", // modals, popovers — sits above surface

  // Borders
  border:        "#27272b",
  borderLight:   "#34343a",

  // Text (text === textPrimary; both referenced across the app)
  text:          "#f2f2f3",
  textPrimary:   "#f2f2f3",
  textMuted:     "#9a9aa3", // lifted from the old #666 for readability
  textDim:       "#5c5c64",

  // Accent (amber)
  accent:        "#f5a623",
  accentHover:   "#ffb53d",
  accentDim:     "#7a4f08",
  amber:         "#f5a623",
  amberSubtle:   "#1e1505",

  // Semantic
  teal:          "#1fae8a",
  tealLight:     "#0d5c49",
  tealBg:        "#0a2e26",
  green:         "#2ec27e",
  red:           "#e5484d",
  redBg:         "#2a1012",
  danger:        "#e5484d",
  dangerBg:      "#2a1012",
  orange:        "#f0640f",
  orangeBg:      "#2a1208",
  cyan:          "#2ab3d4",
  cyanBg:        "#0a2a33",
} as const;

export type ColorToken = keyof typeof COLORS;

// ── Spacing scale (px) ────────────────────────────────────────────────────────
export const SPACE = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64,
} as const;

// ── Corner radii ──────────────────────────────────────────────────────────────
export const RADIUS = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

// ── Elevation shadows ───────────────────────────────────────────────────────────
export const SHADOW = {
  sm: "0 1px 2px rgba(0,0,0,0.30)",
  md: "0 4px 14px rgba(0,0,0,0.38)",
  lg: "0 16px 40px rgba(0,0,0,0.50)",
  // accent glow — pass any hex color
  glow: (c: string) => `0 0 0 1px ${c}33, 0 6px 20px ${c}22`,
} as const;

// ── Typography ──────────────────────────────────────────────────────────────────
export const FONT = {
  sans: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  mono: "'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, monospace",
  size: {
    xs: 11, sm: 12, md: 13, base: 14, lg: 16, xl: 20, xxl: 24, display: 34,
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
} as const;

// ── Motion ──────────────────────────────────────────────────────────────────────
export const TRANSITION = {
  fast: "0.12s ease",
  base: "0.18s ease",
  slow: "0.28s ease",
} as const;
