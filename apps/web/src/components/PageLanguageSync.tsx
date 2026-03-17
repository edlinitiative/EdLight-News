"use client";

import { useEffect } from "react";
import type { ContentLanguage } from "@edlight-news/types";
import { useLanguage } from "@/lib/language-context";

export function PageLanguageSync({ lang }: { lang: ContentLanguage }) {
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    if (language !== lang) {
      setLanguage(lang);
    }
  }, [lang, language, setLanguage]);

  return null;
}
