"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark } from "lucide-react";
import { isBookmarked, toggleBookmark } from "@/lib/bookmarks";
import type { ContentLanguage } from "@edlight-news/types";

interface BookmarkButtonProps {
  /** content_version ID */
  articleId: string;
  lang: ContentLanguage;
  /** Visual size variant */
  variant?: "icon" | "button";
}

/**
 * Client component — bookmark toggle (heart/bookmark icon).
 * Renders nothing on SSR, hydrates on mount from localStorage.
 */
export function BookmarkButton({
  articleId,
  lang,
  variant = "icon",
}: BookmarkButtonProps) {
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSaved(isBookmarked(articleId));
  }, [articleId]);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // don't navigate if inside a Link
      e.stopPropagation();
      const result = toggleBookmark(articleId);
      setSaved(result.bookmarked);
    },
    [articleId],
  );

  // Don't render on SSR to avoid hydration mismatch
  if (!mounted) return null;

  const fr = lang === "fr";
  const label = saved
    ? (fr ? "Retirer des favoris" : "Retire nan favori")
    : (fr ? "Ajouter aux favoris" : "Ajoute nan favori");

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        className={[
          saved
            ? "group inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-all duration-200 hover:border-blue-300 hover:bg-blue-100 active:scale-95 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:border-blue-700 dark:hover:bg-blue-900/40"
            : "group inline-flex items-center gap-1.5 rounded-full border border-stone-200/80 px-3 py-1.5 text-xs font-medium text-stone-500 transition-all duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 active:scale-95 dark:border-stone-700 dark:text-stone-400 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 dark:hover:text-blue-400",
        ].join(" ")}
        aria-label={label}
        title={label}
      >
        <Bookmark
          className={saved
            ? "h-3.5 w-3.5 fill-blue-600 text-blue-600 transition-all duration-300 dark:fill-blue-400 dark:text-blue-400"
            : "h-3.5 w-3.5 text-stone-400 transition-all duration-300 group-hover:text-blue-600 dark:text-stone-500 dark:group-hover:text-blue-400"}
        />
        {saved ? (fr ? "Sauvegardé" : "Sove") : (fr ? "Sauvegarder" : "Sove")}
      </button>
    );
  }

  // Icon-only (used in article cards)
  return (
    <button
      type="button"
      onClick={handleToggle}
      className="group rounded-full p-1.5 transition-all duration-200 hover:bg-stone-100 active:scale-90 dark:hover:bg-stone-800"
      aria-label={label}
      title={label}
    >
      <Bookmark
        className={saved
          ? "h-4 w-4 fill-blue-600 text-blue-600 transition-all duration-300 dark:fill-blue-400 dark:text-blue-400"
          : "h-4 w-4 text-stone-400 transition-all duration-300 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-300"}
      />
    </button>
  );
}
