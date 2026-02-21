"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { ContentLanguage } from "@edlight-news/types";

const STORAGE_KEY = "edlight_news_lang";

interface LanguageContextValue {
  language: ContentLanguage;
  toggle: () => void;
  setLanguage: (lang: ContentLanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "fr",
  toggle: () => {},
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<ContentLanguage>("fr");

  // Hydrate from URL (?lang=) → localStorage → default "fr"
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlLang = params.get("lang");
      if (urlLang === "ht" || urlLang === "fr") {
        setLang(urlLang);
        localStorage.setItem(STORAGE_KEY, urlLang);
        return;
      }
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "ht" || stored === "fr") {
        setLang(stored);
      }
    } catch {
      // SSR or localStorage unavailable — keep default
    }
  }, []);

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = prev === "fr" ? "ht" : "fr";
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      return next;
    });
  }, []);

  const setLanguage = useCallback((lang: ContentLanguage) => {
    setLang(lang);
    try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  }, []);

  return (
    <LanguageContext.Provider value={{ language, toggle, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
