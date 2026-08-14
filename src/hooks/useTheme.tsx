import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { adaptAccent, inkOn } from "../tokens/accent";
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

export { adaptAccent, inkOn } from "../tokens/accent";

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
  const adaptedAccent = adaptAccent(sourceHex, theme);
  const colors = { ...base, accent: adaptedAccent, onAccent: inkOn(adaptedAccent) };
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
  const setCustomAccent = useCallback((hex: string) => {
    setCustomAccentState(hex);
    setAccentState("custom");
  }, []);

  // Rebuilt only when the theme actually changes. Every screen reads its
  // colours from here, so handing back a fresh object on each render of this
  // provider re-rendered all of them — and re-ran the accent adaptation — for a
  // palette that had not moved.
  const value = useMemo(
    () => buildValue(theme, setTheme, accent, setAccentState, customAccent, setCustomAccent),
    [theme, accent, customAccent, setCustomAccent],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
