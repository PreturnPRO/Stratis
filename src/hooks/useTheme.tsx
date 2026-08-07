import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { COLORS, LIGHT_COLORS, SHADOW, LIGHT_SHADOW, AMBIENT } from "../tokens/colors";

export type Theme = "dark" | "light";
const STORAGE_KEY = "stratis-theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

function buildValue(theme: Theme, setTheme: (fn: (t: Theme) => Theme) => void) {
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const colors = theme === "light" ? { ...COLORS, ...LIGHT_COLORS } : { ...COLORS };
  const shadow = theme === "light" ? { ...SHADOW, ...LIGHT_SHADOW } : { ...SHADOW };
  const ambient = AMBIENT[theme];
  return { theme, toggleTheme, colors, shadow, ambient };
}

type ThemeValue = ReturnType<typeof buildValue>;

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = buildValue(theme, setTheme);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
