
export const COLORS = {
  bg:            "#09090b",
  surface:       "#141417",
  surfaceHover:  "#1d1d21",
  surfaceMuted:  "#101013",
  surfaceElevated: "#1a1a1e",

  border:        "#27272b",
  borderLight:   "#34343a",

  text:          "#f2f2f3",
  textPrimary:   "#f2f2f3",
  /* Lifted from #9a9aa3: once textDim moved up to meet AA, dim↔muted was only
     1.23:1 and the three-tier ramp read as two. Now 1.59 dim→muted and 1.93
     muted→text, so each rung is a visible step. */
  textMuted:     "#b0b0b8",
  /* Was #5c5c64 (2.54:1 at worst) — below the 4.5:1 the project commits to, and
     this tier carries transcript timestamps and card ages, which a facilitator
     reads mid-meeting. 4.91:1 against surfaceHover, the darkest surface it lands
     on. The tertiary tier is necessarily closer to textMuted than before; on
     these backgrounds a genuinely-AA third step cannot be much dimmer. */
  textDim:       "#8a8a93",

  accent:        "#8FAE6D",
  accentHover:   "#A6C285",
  accentDim:     "#4B5C3A",
  amber:         "#8FAE6D",
  amberSubtle:   "#161D10",

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
  onAccent:      "#10160b",
  curtain:       "#0c0c0e",
  curtainText:   "#f2f2f3",
  /* Same softening as the light theme, desaturated toward the muted grey so
     dark mode doesn't stay loud after light mode was calmed. All still AA. */
  spkA:          "#d17a99",
  spkB:          "#6da7d9",
  spkC:          "#5cc19b",
} as const;

export const LIGHT_COLORS = {
  bg:              "#f6f4ee",
  surface:         "#fdfcf9",
  surfaceHover:    "#efede5",
  surfaceMuted:    "#eceade",
  surfaceElevated: "#ffffff",
  border:          "#dcd8ca",
  borderLight:     "#c6c1af",
  text:            "#1b1b16",
  textPrimary:     "#1b1b16",
  textMuted:       "#54544c",
  /* Was #8f8d80 (2.76:1 at worst). 4.51:1 across every light surface. */
  textDim:         "#6b6a60",
  /* Darkened so each semantic foreground clears 4.5:1 against its OWN tint
     below, not just against the neutral surfaces. The first pass at these tints
     fixed differentiation and quietly cost legibility — red on redBg dropped to
     3.99:1 on a role="alert" banner. All five now clear 4.5 on their tint and
     on #ffffff. */
  accent:          "#4c6934",
  accentHover:     "#3f5729",
  accentDim:       "#9fb488",
  amber:           "#4c6934",
  /* These five were all byte-identical #e4ead6, which collapsed error, warning,
     success, info and selected onto one background in light theme. Each is now
     its own hue mixed 18% over the light bg, so the semantic vocabulary survives
     a theme switch. Ink stays above 11:1 on all of them. */
  /* Tinted 8% over the page bg rather than 18%. At 18% the type chips read as
     coloured blocks on a work surface that is meant to stay calm; at 8% they
     are washes that still tell the five semantics apart. Contrast improves as a
     side effect (~4.4 -> ~5.1) because less colour sits between text and fill. */
  amberSubtle:     "#e8e9df",
  onAccent:        "#f7f8f2",
  teal:            "#0c6d50",
  tealLight:       "#0c6d50",
  tealBg:          "#e3e9e1",
  green:           "#0c6d50",
  red:             "#ac2f34",
  redBg:           "#f0e4df",
  danger:          "#ac2f34",
  dangerBg:        "#f0e4df",
  orange:          "#9f4406",
  orangeBg:        "#efe6db",
  cyan:            "#0d6983",
  cyanBg:          "#e3e9e5",
  curtain:         "#181813",
  curtainText:     "#f4f2ea",
  /* Pulled toward the ink. Speaker identity still has to be scannable at a
     glance mid-meeting, but at full saturation the names shouted over the
     transcript body they label. Hue is preserved; only the shout is gone. */
  spkA:            "#722b40",
  spkB:            "#214974",
  spkC:            "#19563b",
} as const;

export type ColorToken = keyof typeof COLORS;

export const SPACE = {
  0: 0, 1: 4,
  1.5: 6, 2: 8, 2.5: 10,
  3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 24: 96,
} as const;

export const RADIUS = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const SHADOW = {
  xs: "0 1px 4px rgba(0,0,0,0.22)",
  sm: "0 1px 2px rgba(0,0,0,0.30)",
  md: "0 4px 14px rgba(0,0,0,0.38)",
  float: "0 10px 28px rgba(0,0,0,0.42), 0 2px 6px rgba(0,0,0,0.30)",
  lg: "0 16px 40px rgba(0,0,0,0.50)",
  hero: "0 30px 80px rgba(0,0,0,0.55)",
  glow: (c: string) => `0 0 0 1px ${c}33, 0 6px 20px ${c}22`,
  shadCard:  "0 1px 2px rgba(0,0,0,.35), 0 10px 30px rgba(0,0,0,.30)",
  shadFloat2: "0 2px 6px rgba(0,0,0,.30), 0 14px 34px rgba(0,0,0,.40)",
  shadModal: "0 24px 70px rgba(0,0,0,.60), 0 4px 12px rgba(0,0,0,.40)",
} as const;

export const LIGHT_SHADOW = {
  shadCard:  "0 1px 2px rgba(80,74,52,.05), 0 8px 22px rgba(80,74,52,.08)",
  shadFloat2: "0 2px 6px rgba(80,74,52,.07), 0 14px 30px rgba(80,74,52,.11)",
  shadModal: "0 24px 60px rgba(70,64,42,.20), 0 4px 12px rgba(70,64,42,.09)",
  hero: "0 30px 80px rgba(70,64,42,.18)",
  glowAccent: "0 0 0 1px rgba(84,113,58,.22), 0 6px 18px rgba(84,113,58,.14)",
} as const;

export const AMBIENT = {
  dark:  { grid: "rgba(255,255,255,.028)", glow: "rgba(143,174,109,.10)", glow2: "rgba(42,179,212,.06)" },
  light: { grid: "rgba(60,56,36,.045)",    glow: "rgba(84,113,58,.10)",   glow2: "rgba(23,127,156,.06)" },
} as const;

export const GRADIENT = {
  surfaceSheen: "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 45%)",
  accentGlow: (c: string) => `radial-gradient(circle at 30% 20%, ${c}26 0%, transparent 60%)`,
} as const;

export const GLASS = {
  blur: "blur(12px)",
  bg: "rgba(20,20,23,0.72)",
} as const;

export const LIGHT_GLASS = {
  blur: "blur(12px)",
  bg: "rgba(246,244,238,0.72)",
} as const;

export function tint(semanticHex: string, bgHex: string, pct = 15): string {
  return `color-mix(in srgb, ${semanticHex} ${pct}%, ${bgHex})`;
}

export const FONT = {
  /* `'Inter Variable'` is the family fontsource actually registers; plain
     `'Inter'` matches nothing, so every consumer of this token silently fell
     through to Arial even after the font was installed. */
  sans: "'Inter Variable', 'Inter', 'Helvetica Neue', Arial, sans-serif",
  mono: "'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, monospace",
  size: {
    micro: 10,
    caption: 11,
    label: 12,
    body: 14,
    subheading: 16,
    heading: 20,
    title: 24,
    display: 32,
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
} as const;

export const LETTER_SPACING = {
  normal: 0,
  wide: 0.3,
  label: 0.6,
  eyebrow: 1.2,
} as const;

export const TRANSITION = {
  fast: "0.12s ease",
  base: "0.18s ease",
  slow: "0.28s ease",
  springSoft: "0.32s cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;
