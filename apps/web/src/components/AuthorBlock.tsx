/**
 * AuthorBlock — Clickable author byline linking to /auteur/[slug].
 *
 * Renders the author name as a link when an authorSlug is available,
 * with an optional avatar/initial circle.  Falls back to plain text
 * when no slug is provided.
 */

import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import { withLangParam } from "@/lib/utils";

interface AuthorBlockProps {
  /** Author display name */
  name: string;
  /** Contributor slug for the /auteur/[slug] page */
  slug?: string | null;
  /** Optional photo URL */
  photoUrl?: string | null;
  /** Current language for locale-aware links */
  lang: ContentLanguage;
  /** Render variant: "inline" for article cards, "full" for article detail */
  variant?: "inline" | "full";
}

export function AuthorBlock({
  name,
  slug,
  photoUrl,
  lang,
  variant = "inline",
}: AuthorBlockProps) {
  const initial = name.charAt(0).toUpperCase();

  if (variant === "inline") {
    // Compact — just the name, optionally linked
    if (slug) {
      return (
        <Link
          href={withLangParam(`/auteur/${slug}`, lang)}
          className="font-medium text-stone-700 underline-offset-2 hover:underline dark:text-stone-200"
        >
          {name}
        </Link>
      );
    }
    return <span className="font-medium text-stone-700 dark:text-stone-200">{name}</span>;
  }

  // Full variant — avatar + name + link
  return (
    <div className="flex items-center gap-3">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={name}
          className="h-10 w-10 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {initial}
        </div>
      )}
      <div className="min-w-0">
        {slug ? (
          <Link
            href={withLangParam(`/auteur/${slug}`, lang)}
            className="text-sm font-semibold text-stone-900 underline-offset-2 hover:underline dark:text-white"
          >
            {name}
          </Link>
        ) : (
          <p className="text-sm font-semibold text-stone-900 dark:text-white">{name}</p>
        )}
        <p className="text-xs text-stone-400 dark:text-stone-500">
          {lang === "fr" ? "Contributeur EdLight" : "Kontribitè EdLight"}
        </p>
      </div>
    </div>
  );
}
