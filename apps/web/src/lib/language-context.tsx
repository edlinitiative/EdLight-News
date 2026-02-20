"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { ContentLanguage } from "@edlight-news/types";

interface LanguageContextValue {
  language: ContentLanguage;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "fr",
  toggle: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<ContentLanguage>("fr");

  const toggle = useCallback(() => {
    setLanguage((prev) => (prev === "fr" ? "ht" : "fr"));
  }, []);

  return (
    <LanguageContext.Provider value={{ language, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
