"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/language-context";

export function RouteLanguageSync() {
  const searchParams = useSearchParams();
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    const param = searchParams.get("lang");
    // Only react when the URL explicitly carries a `lang` param.
    // Otherwise let page-level components (e.g. PageLanguageSync) decide,
    // which prevents an infinite render loop on pages whose content
    // language differs from the default ("fr").
    if (param !== "fr" && param !== "ht") return;
    if (language !== param) {
      setLanguage(param);
    }
  }, [searchParams, language, setLanguage]);

  return null;
}
