---
name: Stratis
description: AI co-facilitator for team meetings — dark control-room UI with a single soft matcha-green signal color
colors:
  bg: "#09090b"
  surface: "#141417"
  surface-hover: "#1d1d21"
  surface-muted: "#101013"
  surface-elevated: "#1a1a1e"
  border: "#27272b"
  border-light: "#34343a"
  text: "#f2f2f3"
  text-muted: "#9a9aa3"
  text-dim: "#5c5c64"
  accent: "#8FAE6D"
  accent-hover: "#A6C285"
  accent-dim: "#4B5C3A"
  amber-subtle: "#161D10"
  teal: "#1fae8a"
  teal-light: "#0d5c49"
  teal-bg: "#0a2e26"
  green: "#2ec27e"
  danger: "#e5484d"
  danger-bg: "#2a1012"
  orange: "#f0640f"
  orange-bg: "#2a1208"
  cyan: "#2ab3d4"
  cyan-bg: "#0a2a33"
typography:
  display:
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.15
  headline:
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.02em"
  mono:
    fontFamily: "'SF Mono', 'JetBrains Mono', ui-monospace, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  10: "40px"
  12: "48px"
  16: "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#10160b"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "#10160b"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.pill}"
    padding: "3px 9px"
  modal-panel:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Stratis

## 1. Overview

**Creative North Star: "The Control Room"**

Stratis reads like an instrument panel for a live conversation, not a marketing surface. Surfaces sit at near-black (#09090b) and step up in small, deliberate increments — bg → surface → surfaceHover → surfaceElevated — so the facilitator can tell at a glance what layer they're looking at without any of it competing for attention. One signal color, a soft matcha green, is reserved for what actually needs the facilitator's eyes: a primary action, an active recording state, an AI suggestion worth noticing. Everything else recedes into muted grays so the signal stays a signal.

This system explicitly rejects generic SaaS-dashboard scaffolding: no hero-metric tiles, no gradient text, no tiny uppercase eyebrows stacked above every section, no identical icon-card grids. It also rejects marketing-surface bleed — Stratis's core pages are a working tool used *during* a live meeting, not a pitch to be admired, so density and legibility win over decorative flourish.

**Key Characteristics:**
- Near-black base with soft matcha green as the only saturated color in the system
- Layered surface elevation communicates structure, not decoration
- Small, deliberate hover/active feedback, plus a single restrained spring curve reserved for discrete micro-interactions (button/row hover-lift, toggles) — never for autonomous or AI-driven state changes (suggestion cards, status pulses, recording indicator)
- Semantic colors (teal, green, red, orange, cyan) exist only for status meaning, never as decoration

## 2. Colors

A near-monochrome dark palette with a single warm signal color; every other hue is reserved for status meaning.

### Primary
- **Signal Matcha** (#8FAE6D): The one saturated color in the system — a soft, muted matcha green used sparingly to mean "this needs you." Primary buttons, active recording indicators, the accent glow on hover/focus. Never used decoratively.
- **Signal Matcha, Hover** (#A6C285): Lightened step for hover/active states on accent elements.
- **Signal Matcha, Dim** (#4B5C3A): Low-emphasis accent for disabled or de-emphasized usage.
- **Accent Subtle** (#161D10): Near-black green-tinted background wash, for accent-themed containers (e.g. a highlighted row) that must stay quiet.

### Neutral
- **Void** (#09090b): The base app background. The darkest surface in the system.
- **Panel** (#141417): Primary content surface — cards, sidebars, the main working layer above Void.
- **Panel Hover** (#1d1d21): Hover state for interactive panel-level surfaces.
- **Panel Muted** (#101013): A quieter sibling to Panel, for recessed/secondary containers.
- **Panel Elevated** (#1a1a1e): Modals and popovers — sits above Panel, paired with the `lg` shadow.
- **Hairline** (#27272b): Default border color between surfaces.
- **Hairline Light** (#34343a): Slightly brighter border for hover states or emphasis dividers.
- **Ink** (#f2f2f3): Primary text color.
- **Ink Muted** (#9a9aa3): Secondary text — labels, metadata, supporting copy. Lifted from an earlier #666 specifically for legibility; do not darken it back down.
- **Ink Dim** (#5c5c64): Tertiary text — placeholders, disabled labels, the quietest tier.

### Semantic
- **Teal** (#1fae8a) / bg (#0a2e26): Positive/confirmed states distinct from the accent (e.g. committed document versions).
- **Green** (#2ec27e): Success states.
- **Red / Danger** (#e5484d) / bg (#2a1012): Errors, destructive actions.
- **Orange** (#f0640f) / bg (#2a1208): Secondary warning tier, distinct from Signal Matcha so the two don't compete.
- **Cyan** (#2ab3d4) / bg (#0a2a33): Informational/neutral-positive status (e.g. live/connected indicators).

### Named Rules
**The One Signal Rule.** Signal Matcha is the only saturated, attention-seeking color in the system. If a screen has more than one element competing for attention via color, one of them is wrong — reach for weight, size, or position before reaching for a second bright color.

## 3. Typography

**Display/Body/Label Font:** Inter (with Helvetica Neue, Arial fallback)
**Mono Font:** SF Mono (with JetBrains Mono, ui-monospace, Menlo fallback) — timestamps, session IDs, technical metadata

**Character:** A single, highly legible grotesque carries the whole system at varying weights — no display/body pairing drama. This matches the Control Room posture: information density and clarity over typographic personality.

### Hierarchy
- **Display** (700, 34px, 1.15): Rare — top-level page headers only.
- **Headline** (600, 24px, 1.25): Section headers within a page (e.g. a Dashboard panel title).
- **Title** (600, 18px, 1.3): Card/modal/component titles (Modal's `<h2>` uses this).
- **Body** (400, 14px, 1.5): Default UI text. Cap prose blocks at 65–75ch where they appear.
- **Label** (500, 11px, letter-spacing 0.02em): SectionLabel and similar small metadata captions.
- **Mono** (400, 12px): Technical/status readouts.

### Named Rules
**The No-Drama Pairing Rule.** One family (Inter), weight and size carry all hierarchy. Do not introduce a second display face — it fights the Control Room's instrument-panel restraint.

## 4. Elevation

Elevation is structural, not ambient. Surface layering (Void → Panel → Panel Elevated) exists to separate functional layers — base app, standing content, and transient overlays like modals — not to add decorative depth. Shadows follow the same rule: `xs`/`sm`/`md` mark small functional lifts (a hovering row, a dropdown), `float` marks a genuinely floating-over-content panel (e.g. the live suggestion stack sitting above the scrolling transcript), and `lg` is reserved for modal/popover panels sitting above everything else. The Signal Matcha `glow()` helper is a distinct, deliberate signal — not a general-purpose shadow — reserved for primary actions and focus states so it stays legible as "this is the one thing to notice."

A restrained backdrop-blur/glass treatment (`GLASS`) exists alongside `float` for the same narrow case: elements that float above scrolling content, not standing/base surfaces. This is still structural, not decorative — the blur marks a real "this sits above the scrolling content beneath it" relationship.

### Shadow Vocabulary
- **xs** (`0 1px 4px rgba(0,0,0,0.22)`): Micro hover-lift on an otherwise flat, interactive row.
- **sm** (`0 1px 2px rgba(0,0,0,0.30)`): Minimal separation — subtle card lift.
- **md** (`0 4px 14px rgba(0,0,0,0.38)`): Standard floating element (dropdown, popover).
- **float** (`0 10px 28px rgba(0,0,0,0.42), 0 2px 6px rgba(0,0,0,0.30)`): Layered ambient + contact shadow for panels that float above scrolling content — paired with `GLASS`, never used on standing surfaces.
- **lg** (`0 16px 40px rgba(0,0,0,0.50)`): Modal panels — the deepest functional layer.
- **glow(color)** (`0 0 0 1px {c}33, 0 6px 20px {c}22`): Reserved for the Signal Matcha accent on hover/focus of primary actions — a signal, not a general elevation tool.

### Named Rules
**The Structural Shadow Rule.** A shadow's depth must match a real layering relationship (this sits above that). Never add a shadow purely to make an element "feel important" — use the accent glow for that instead. `float` and `GLASS` extend this rule to genuinely floating-over-content panels; they are not a general license for glass/blur elsewhere.

## 5. Components

Buttons, chips, and cards feel tactile and precise: small, deliberate hover/active feedback (a border or background shift, glow only on primary) — responsive without being playful. Nothing bounces or overshoots.

### Buttons
- **Shape:** 8px radius (`RADIUS.md`), consistent across all variants.
- **Primary:** Signal Matcha background (#8FAE6D → #A6C285 on hover), near-black text (#10160b) for contrast against the accent, 8px/16px padding at `md` size, 5px/11px at `sm`. Hover adds the accent glow.
- **Ghost (default):** Transparent background, muted text (#9a9aa3), hairline border. Hover fills with Panel Hover (#1d1d21) and brightens text/border.
- **Subtle:** Panel background at rest, Panel Hover on hover, full-contrast text — for secondary actions that need more presence than ghost but less than primary.
- **Danger:** Transparent at rest, danger-red text and dimmed red border; hover fills with dangerBg and solidifies the red border.
- **Icon Button:** 30×30px square, no border, transparent at rest, Panel Hover fill on hover, `sm` radius (6px).

### Chips (Pill/Chip)
- **Style:** Pill radius (999px), Panel background with hairline border, 11px text, semantic color passed per-instance. `Pill` variant uses a 20% color-tinted background instead of Panel, for stronger status emphasis (uppercase, letter-spacing 0.4).
- **State:** Chips are read-only status indicators, not interactive controls — no hover state defined.

### Cards / Containers
- **Corner Style:** 8px radius as the default container radius; modals step up to 12px (`lg`).
- **Background:** Panel (#141417) for standing content, Panel Elevated (#1a1a1e) for anything overlaying other content.
- **Shadow Strategy:** See Elevation — cards at rest are flat or `sm`; only truly overlaying elements (modals) use `lg`.
- **Border:** 1px hairline (#27272b) is the default container border.
- **Internal Padding:** 12px/16px for compact cards (SkeletonCard), 24px for modal panels.

### Empty / Loading States
- **Empty:** Dashed hairline border, 8px radius, centered muted-dim content, generous padding (48px/24px) — reads as an intentional absence, not a broken layout.
- **Loading:** Skeleton cards in Panel/border grays (no shimmer animation), paired with a small accent-topped spinner and a 1.2s pulse — deliberately quiet, never attention-grabbing since loading isn't what the signal color is reserved for.

### Modal
- **Style:** Backdrop at rgba(0,0,0,0.66) with a 2px blur, centered Panel Elevated panel, 12px radius, `lg` shadow, hairline-light border. Esc-to-close, click-outside-to-close, focus capture on open. Entrance uses a short (0.15–0.2s) fade/pop — no bounce.

## 6. Do's and Don'ts

### Do:
- **Do** keep Signal Matcha (#8FAE6D) as the only saturated, attention-seeking color on any given screen — the One Signal Rule.
- **Do** use surface layering (Void → Panel → Panel Elevated) to communicate structure, matching a real layering relationship.
- **Do** keep hover/active feedback small and deliberate — border or background shift, glow only on primary actions; `TRANSITION.springSoft` may add a restrained overshoot to discrete, user-initiated micro-interactions (buttons, toggles, row hover-lift) only.
- **Do** reserve the accent glow() for primary actions and focus states, not general decoration.
- **Do** reserve `SHADOW.float` and `GLASS` for elements that float above scrolling content (e.g. the live suggestion stack), never standing/base surfaces.
- **Do** cap body text line length around 65–75ch and keep body text at #f2f2f3 or #9a9aa3 minimum for contrast (never drop to Ink Dim for body copy).
- **Do** support `prefers-reduced-motion` alternatives for any animation (WCAG AA baseline from PRODUCT.md).

### Don't:
- **Don't** introduce a second saturated/bright accent color competing with Signal Matcha on the same screen.
- **Don't** use hero-metric tiles, gradient text, tiny uppercase eyebrows above every section, or identical icon-card grids — generic SaaS-dashboard scaffolding this system explicitly rejects.
- **Don't** let marketing/campaign visual language (large decorative hero sections, pitch-toned copy) bleed into the core facilitator/meeting product surfaces; glass/blur is allowed only on the narrow floating-panel case described in Elevation, never on standing surfaces.
- **Don't** add shadows purely for decorative "importance" — depth must reflect a real layering relationship.
- **Don't** use bounce/elastic easing for autonomous or AI-driven motion (suggestion cards, recording pulse, status chips) — `TRANSITION.springSoft` is reserved for discrete, user-initiated micro-interactions only.
- **Don't** darken Ink Muted (#9a9aa3) back toward the old #666 — it was lifted specifically for legibility.
