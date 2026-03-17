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
  const [language, setLang] = useState<ContentLanguage>(() => {
    if (typeof window === "undefined") return "fr";
    const urlLang = new URLSearchParams(window.location.search).get("lang");
    return urlLang === "ht" ? "ht" : "fr";
  });

  // Persist the last applied language for client-only surfaces.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // localStorage unavailable — ignore
    }
  }, [language]);

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
