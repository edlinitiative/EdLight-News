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
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
          saved
            ? "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-900/40"
            : "bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700",
        ].join(" ")}
        aria-label={label}
        title={label}
      >
        <Bookmark
          className={`h-3.5 w-3.5 ${saved ? "fill-amber-500 text-amber-500" : ""}`}
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
      className={[
        "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors",
        saved
          ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          : "text-stone-300 hover:bg-stone-100 hover:text-stone-500 dark:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-400",
      ].join(" ")}
      aria-label={label}
      title={label}
    >
      <Bookmark
        className={`h-4 w-4 ${saved ? "fill-amber-500" : ""}`}
      />
    </button>
  );
}
