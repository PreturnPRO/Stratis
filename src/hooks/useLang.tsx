import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { startDomTranslation } from "../i18n/translateDom";

export type Lang = "en" | "th";
const STORAGE_KEY = "stratis-lang";

/** Label of the language the toggle switches *to*, mirroring the theme button. */
export const OTHER_LANG_LABEL: Record<Lang, string> = { en: "ไทย", th: "English" };

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(STORAGE_KEY) === "th" ? "th" : "en";
}

/**
 * Whether a human has actually chosen. Absent storage is not "English" — it is
 * "nobody has been asked yet", and for a product built for Thai teams that
 * difference is the whole first impression.
 */
function hasChosenLang(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) !== null;
}

type LangValue = {
  lang: Lang;
  /** False until the first-run picker has been answered. */
  chosen: boolean;
  setLang: (next: Lang) => void;
  toggleLang: () => void;
};

const LangContext = createContext<LangValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);
  const [chosen, setChosen] = useState<boolean>(hasChosenLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem(STORAGE_KEY, lang);
    // Thai is applied to the rendered DOM, so components keep their English
    // source strings and nothing has to be wrapped in a t() call.
    if (lang === "th") return startDomTranslation();
  }, [lang]);

  const setLang = (next: Lang) => {
    setChosen(true);
    setLangState(next);
  };

  const value: LangValue = {
    lang,
    chosen,
    setLang,
    toggleLang: () => setLang(lang === "en" ? "th" : "en"),
  };
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
}
