"use client";

import { useEffect } from "react";
import { useLanguage } from "@/lib/language-context";

/**
 * Syncs the <html lang="…"> attribute with the current app language.
 * Ensures screen readers and translation tools see the correct language
 * even though the root layout is a Server Component.
 */
export function HtmlLangSync() {
  const { language } = useLanguage();

  useEffect(() => {
    const lang = language === "ht" ? "ht" : "fr";
    document.documentElement.lang = lang;
    // Persist to a server-readable cookie so the next SSR renders <html lang>
    // correctly (client-side fallback for the cookie the server reads).
    try {
      document.cookie = `lang=${lang}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // document.cookie unavailable — ignore
    }
  }, [language]);

  return null;
}
