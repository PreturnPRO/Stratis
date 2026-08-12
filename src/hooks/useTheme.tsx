import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { COLORS, LIGHT_COLORS, SHADOW, LIGHT_SHADOW, AMBIENT } from "../tokens/colors";

export type Theme = "dark" | "light";
const STORAGE_KEY = "stratis-theme";
const ACCENT_KEY = "stratis-accent";

/**
 * Workspace colours.
 *
 * Each preset is one vivid hex — the *hue* the workspace picks — not a pair of
 * hand-tuned values. Readability is derived instead: `adaptAccent` pushes the
 * lightness into a band that works on the current theme while holding the
 * saturation up. Hand-picking a "safe" value per theme is what produced the
 * muddy, depressing set this replaces; a colour can be both vivid and legible,
 * it just cannot be any lightness it likes.
 */
export const ACCENTS = [
  { id: "matcha", label: "Signal Matcha", hex: "#7ac943" },
  { id: "cobalt", label: "Cobalt", hex: "#2f86ff" },
  { id: "violet", label: "Violet", hex: "#8b5cf6" },
  { id: "magenta", label: "Magenta", hex: "#ec4899" },
  { id: "coral", label: "Coral", hex: "#ff5a3c" },
  { id: "amber", label: "Amber", hex: "#f5a524" },
  { id: "teal", label: "Teal", hex: "#00c2a8" },
  { id: "indigo", label: "Indigo", hex: "#6366f1" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"] | "custom";

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * Keeps the hue the workspace chose, moves only what has to move.
 *
 * `accent` is used for text as well as fills, so an unconstrained pick — a
 * bright yellow on white, a navy on black — makes labels unreadable. Rather
 * than reject the colour, the lightness is clamped into a band that reads on
 * this theme, and saturation is floored so the result stays a colour rather
 * than a grey.
 */
export function adaptAccent(hex: string, theme: Theme): string {
  const { h, s, l } = hexToHsl(hex);
  const saturation = Math.min(1, Math.max(0.5, s));
  const lightness =
    theme === "light"
      ? Math.min(0.44, Math.max(0.3, l))
      : Math.min(0.72, Math.max(0.58, l));
  return hslToHex(h, saturation, lightness);
}

const CUSTOM_KEY = "stratis-accent-custom";

function readStoredAccent(): AccentId {
  if (typeof window === "undefined") return "matcha";
  const stored = window.localStorage.getItem(ACCENT_KEY);
  if (stored === "custom") return "custom";
  return ACCENTS.some((a) => a.id === stored) ? (stored as AccentId) : "matcha";
}

function readStoredCustom(): string {
  if (typeof window === "undefined") return "#2f86ff";
  const stored = window.localStorage.getItem(CUSTOM_KEY);
  return stored && /^#[0-9a-fA-F]{6}$/.test(stored) ? stored : "#2f86ff";
}

/**
 * Light is the default. Someone opening Stratis for the first time is usually
 * mid-meeting and often on a projector, and white is what reads there. Dark is
 * a choice, remembered once it is made.
 */
function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

function buildValue(
  theme: Theme,
  setTheme: (fn: (t: Theme) => Theme) => void,
  accent: AccentId,
  setAccent: (next: AccentId) => void,
  customAccent: string,
  setCustomAccent: (hex: string) => void,
) {
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const base = theme === "light" ? { ...COLORS, ...LIGHT_COLORS } : { ...COLORS };
  const sourceHex =
    accent === "custom"
      ? customAccent
      : (ACCENTS.find((a) => a.id === accent) ?? ACCENTS[0]).hex;
  // Overridden after the theme spread so the workspace colour wins over the
  // palette default, in both themes.
  const colors = { ...base, accent: adaptAccent(sourceHex, theme) };
  const shadow = theme === "light" ? { ...SHADOW, ...LIGHT_SHADOW } : { ...SHADOW };
  const ambient = AMBIENT[theme];
  return {
    theme,
    toggleTheme,
    colors,
    shadow,
    ambient,
    accent,
    setAccent,
    customAccent,
    setCustomAccent,
  };
}

type ThemeValue = ReturnType<typeof buildValue>;

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const [accent, setAccentState] = useState<AccentId>(readStoredAccent);
  const [customAccent, setCustomAccentState] = useState<string>(readStoredCustom);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(ACCENT_KEY, accent);
  }, [accent]);

  useEffect(() => {
    window.localStorage.setItem(CUSTOM_KEY, customAccent);
  }, [customAccent]);

  // Picking a custom colour selects it — otherwise the swatch changes and
  // nothing on screen does.
  const setCustomAccent = (hex: string) => {
    setCustomAccentState(hex);
    setAccentState("custom");
  };

  const value = buildValue(
    theme,
    setTheme,
    accent,
    setAccentState,
    customAccent,
    setCustomAccent,
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
