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
    document.documentElement.lang = language === "ht" ? "ht" : "fr";
  }, [language]);

  return null;
}
