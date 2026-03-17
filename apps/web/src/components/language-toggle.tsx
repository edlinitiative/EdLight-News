"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/language-context";
import { withLangParam } from "@/lib/utils";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLanguage = () => {
    const next = language === "fr" ? "ht" : "fr";
    const currentHref = `${pathname}${typeof window === "undefined" ? "" : window.location.search}`;
    setLanguage(next);
    router.replace(withLangParam(currentHref, next), { scroll: false });
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
      aria-label={language === "fr" ? "Pase an Kreyòl" : "Passer en Français"}
    >
      <span className={language === "fr" ? "rounded px-1 font-bold text-blue-600 dark:text-blue-400" : "rounded px-1 text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"}>FR</span>
      <span className="text-stone-300 dark:text-stone-600">/</span>
      <span className={language === "ht" ? "rounded px-1 font-bold text-blue-600 dark:text-blue-400" : "rounded px-1 text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"}>HT</span>
    </button>
  );
}
