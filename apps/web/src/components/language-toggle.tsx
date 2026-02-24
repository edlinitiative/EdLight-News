"use client";

import { Suspense } from "react";
import { useLanguage } from "@/lib/language-context";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

function LanguageToggleInner() {
  const { language, toggle } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleToggle = () => {
    toggle();
    const nextLang = language === "fr" ? "ht" : "fr";
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", nextLang);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <button
      onClick={handleToggle}
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold transition-all duration-200 hover:border-brand-300 hover:bg-brand-50 dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-500/50 dark:hover:bg-slate-700"
      aria-label="Toggle language"
    >
      {language === "fr" ? "KREYÒL" : "FRANÇAIS"}
    </button>
  );
}

export function LanguageToggle() {
  return (
    <Suspense
      fallback={
        <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-600 dark:text-slate-300">
          …
        </span>
      }
    >
      <LanguageToggleInner />
    </Suspense>
  );
}
