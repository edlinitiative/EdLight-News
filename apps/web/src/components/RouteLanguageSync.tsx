"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/language-context";

export function RouteLanguageSync() {
  const searchParams = useSearchParams();
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    const next = searchParams.get("lang") === "ht" ? "ht" : "fr";
    if (language !== next) {
      setLanguage(next);
    }
  }, [searchParams, language, setLanguage]);

  return null;
}
