// ─────────────────────────────────────────────────────────────────────────────
// STRATIS DESIGN TOKENS — single source of truth
//
// Both `import { COLORS } from "../tokens/colors"` and
// `import { COLORS } from "../constants"` resolve here (constants re-exports),
// so the whole app shares one palette. Keys are a superset of every token the
// codebase referenced before unification — `text` and `textPrimary` are aliases
// kept for backward compatibility.
//
// Visual direction: dark, depth-aware surfaces with a soft matcha-green accent
// and lifted muted-text for legibility.
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

  // Accent (soft matcha green — the app's one signal color)
  accent:        "#8FAE6D",
  accentHover:   "#A6C285",
  accentDim:     "#4B5C3A",
  amber:         "#8FAE6D",
  amberSubtle:   "#161D10",

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
// 4pt base. 8-12px = tight grouping (related elements); 48-96px = generous
// separation (distinct sections). See layout.md rhythm guidance.
export const SPACE = {
  0: 0, 1: 4,
  // half-steps — an unofficial pattern used often enough across the app
  // (icon-to-label gaps, tight badge padding) to promote to real tokens
  // rather than retrofit to the nearest full step.
  1.5: 6, 2: 8, 2.5: 10,
  3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 24: 96,
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
  xs: "0 1px 4px rgba(0,0,0,0.22)", // micro hover-lift on flat rows
  sm: "0 1px 2px rgba(0,0,0,0.30)",
  md: "0 4px 14px rgba(0,0,0,0.38)",
  // layered ambient + contact shadow for panels floating above scrolling
  // content (not standing surfaces) — e.g. the live suggestion stack.
  float: "0 10px 28px rgba(0,0,0,0.42), 0 2px 6px rgba(0,0,0,0.30)",
  lg: "0 16px 40px rgba(0,0,0,0.50)",
  // marketing-surface only — the deep product-shot lift on Landing, never used in-app
  hero: "0 30px 80px rgba(0,0,0,0.55)",
  // accent glow — pass any hex color
  glow: (c: string) => `0 0 0 1px ${c}33, 0 6px 20px ${c}22`,
} as const;

// ── Gradients ────────────────────────────────────────────────────────────────
// Restrained, low-alpha washes only — no marketing-style hero gradients here.
export const GRADIENT = {
  surfaceSheen: "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 45%)",
  accentGlow: (c: string) => `radial-gradient(circle at 30% 20%, ${c}26 0%, transparent 60%)`,
} as const;

// ── Glass ────────────────────────────────────────────────────────────────────
// Reserved exclusively for elements that float above scrolling content
// (never standing/base surfaces) — see DESIGN.md's Elevation section.
export const GLASS = {
  blur: "blur(12px)",
  bg: "rgba(20,20,23,0.72)",
} as const;

// ── Typography ──────────────────────────────────────────────────────────────────
// Semantic-role scale, not a value ladder. The old scale (xs:11, sm:12, md:13,
// base:14) crammed four sizes into a 3px band with no real distinction between
// them — "muddy hierarchy." This scale has one workhorse body size (14, kept
// dense on purpose for a live-meeting tool rather than the generic 16px
// minimum) and gives every other role real separation from its neighbor.
export const FONT = {
  sans: "'Inter', 'Helvetica Neue', Arial, sans-serif",
  mono: "'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, monospace",
  size: {
    micro: 10,      // tiny uppercase pill/tag labels (urgency chips, type tags)
    caption: 11,     // timestamps, dim metadata, mono technical readouts
    label: 12,       // uppercase tracked section/field labels, toggles
    body: 14,        // all primary + secondary reading text — the workhorse
    subheading: 16,   // card / modal / list-item titles
    heading: 20,      // section headers within a page
    title: 24,        // page-level headers
    display: 32,      // rare hero-scale emphasis
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
} as const;

// ── Letter spacing (px, for uppercase/tracked labels) ─────────────────────────
// ALL-CAPS text needs 5-12% tracking to read comfortably at small sizes.
export const LETTER_SPACING = {
  normal: 0,
  wide: 0.3,    // uppercase body-adjacent labels (chips, tags)
  label: 0.6,   // section/ToC labels
  eyebrow: 1.2, // wordmarks, rare all-caps emphasis
} as const;

// ── Motion ──────────────────────────────────────────────────────────────────────
export const TRANSITION = {
  fast: "0.12s ease",
  base: "0.18s ease",
  slow: "0.28s ease",
  // Restrained overshoot — reserved for discrete, user-initiated
  // micro-interactions (button/row hover-lift, toggles). Never used for
  // autonomous or AI-driven motion (suggestion cards, status pulses).
  springSoft: "0.32s cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;
