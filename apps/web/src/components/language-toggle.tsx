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
      className="rounded-md border px-3 py-1 text-sm font-medium transition hover:bg-gray-100"
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
        <span className="rounded-md border px-3 py-1 text-sm font-medium">
          …
        </span>
      }
    >
      <LanguageToggleInner />
    </Suspense>
  );
}
