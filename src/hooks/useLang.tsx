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

type LangValue = { lang: Lang; toggleLang: () => void };

const LangContext = createContext<LangValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(readStoredLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem(STORAGE_KEY, lang);
    // Thai is applied to the rendered DOM, so components keep their English
    // source strings and nothing has to be wrapped in a t() call.
    if (lang === "th") return startDomTranslation();
  }, [lang]);

  const value: LangValue = {
    lang,
    toggleLang: () => setLang((l) => (l === "en" ? "th" : "en")),
  };
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
}
