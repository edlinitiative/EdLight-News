"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bookmark, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { withLangParam } from "@/lib/utils";
import { getBookmarks, removeBookmark } from "@/lib/bookmarks";
import { ImageWithFallback } from "@/components/ImageWithFallback";

interface SavedArticle {
  id: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  sourceName: string | null;
  publishedAt: string | null;
}

/**
 * /saved — Saved articles page.
 *
 * Client component: reads bookmarks from localStorage,
 * then fetches article metadata via a lightweight API.
 * No login required.
 */
export default function SavedPage() {
  const { language: lang } = useLanguage();
  const fr = lang === "fr";

  const [bookmarkIds, setBookmarkIds] = useState<string[]>([]);
  const [articles, setArticles] = useState<SavedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Read bookmarks from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const ids = getBookmarks();
    setBookmarkIds(ids);

    if (ids.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch article metadata
    fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, lang }),
    })
      .then((r) => r.json())
      .then((data) => {
        setArticles(data.articles ?? []);
      })
      .catch(() => {
        /* non-critical */
      })
      .finally(() => setLoading(false));
  }, [lang]);

  const handleRemove = useCallback(
    (id: string) => {
      const updated = removeBookmark(id);
      setBookmarkIds(updated);
      setArticles((prev) => prev.filter((a) => a.id !== id));
    },
    [],
  );

  if (!mounted) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Bookmark className="h-6 w-6 text-amber-500" />
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white">
            {fr ? "Articles sauvegardés" : "Atik sove yo"}
          </h1>
        </div>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {fr
            ? "Vos articles favoris, enregistrés localement sur cet appareil."
            : "Atik favori ou yo, anrejistre lokalman sou aparèy sa a."}
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-300 border-t-blue-600" />
        </div>
      )}

      {/* Empty state */}
      {!loading && bookmarkIds.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
            <Bookmark className="h-8 w-8 text-stone-400" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-stone-700 dark:text-stone-200">
              {fr ? "Aucun article sauvegardé" : "Okenn atik sove"}
            </p>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {fr
                ? "Appuyez sur l'icône signet sur un article pour le retrouver ici."
                : "Peze ikòn sove a sou yon atik pou jwenn li isit la."}
            </p>
          </div>
          <Link
            href={withLangParam("/news", lang)}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-500"
          >
            {fr ? "Explorer les actualités" : "Eksplore nouvèl yo"}
          </Link>
        </div>
      )}

      {/* Article list */}
      {!loading && articles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <div
              key={article.id}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-stone-100 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-stone-800 dark:bg-stone-900"
            >
              <Link
                href={withLangParam(`/news/${article.id}`, lang)}
                className="flex flex-1 flex-col"
              >
                {article.imageUrl && (
                  <div className="relative aspect-video overflow-hidden bg-stone-100 dark:bg-stone-800">
                    <ImageWithFallback
                      src={article.imageUrl}
                      alt={article.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <h3 className="text-base font-bold leading-snug text-stone-900 line-clamp-2 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
                    {article.title}
                  </h3>
                  {article.summary && (
                    <p className="text-sm text-stone-500 line-clamp-2 dark:text-stone-400">
                      {article.summary}
                    </p>
                  )}
                  <p className="mt-auto pt-1 text-xs text-stone-400 dark:text-stone-500">
                    {article.sourceName}
                  </p>
                </div>
              </Link>

              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(article.id)}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-stone-400 shadow-sm backdrop-blur transition-colors hover:bg-red-50 hover:text-red-500 dark:bg-stone-900/80 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                aria-label={fr ? "Retirer" : "Retire"}
                title={fr ? "Retirer des favoris" : "Retire nan favori"}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
