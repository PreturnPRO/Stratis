import { useEffect, useState } from "react";
import { COLORS, LIGHT_COLORS, SHADOW, LIGHT_SHADOW, AMBIENT } from "../tokens/colors";

export type Theme = "dark" | "light";
const STORAGE_KEY = "stratis-theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const colors = theme === "light" ? { ...COLORS, ...LIGHT_COLORS } : COLORS;
  const shadow = theme === "light" ? { ...SHADOW, ...LIGHT_SHADOW } : SHADOW;
  const ambient = AMBIENT[theme];

  return { theme, toggleTheme, colors, shadow, ambient };
}
