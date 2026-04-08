"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { ArticleCard } from "@/components/ArticleCard";
import { withLangParam } from "@/lib/utils";
import type { FeedItem } from "@/components/news-feed";

const CATEGORY_FILTERS = [
  { id: "all",           fr: "Tout",          ht: "Tout"        },
  { id: "haiti",         fr: "Haïti",         ht: "Ayiti"       },
  { id: "world",         fr: "Monde",         ht: "Mond"        },
  { id: "education",     fr: "Éducation",     ht: "Edikasyon"   },
  { id: "business",      fr: "Business",      ht: "Biznis"      },
  { id: "technology",    fr: "Techno",        ht: "Teknoloji"   },
  { id: "opportunities", fr: "Opportunités",  ht: "Okazyon"     },
  { id: "explainers",    fr: "Explainers",    ht: "Eksplike"    },
];

const OPPORTUNITY_CATS = new Set([
  "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
]);

function matchesCategory(article: FeedItem, cat: string): boolean {
  if (cat === "all") return true;
  if (cat === "haiti")
    return article.geoTag === "HT" || article.category === "local_news";
  if (cat === "opportunities")
    return (
      article.vertical === "opportunites" ||
      OPPORTUNITY_CATS.has(article.category ?? "")
    );
  if (cat === "explainers")
    return (
      article.vertical === "explainers" ||
      ["explainer", "analysis", "synthesis"].includes(article.category ?? "")
    );
  if (cat === "education")
    return (
      article.vertical === "education" ||
      ["education", "higher_education", "universities", "research"].includes(
        article.category ?? ""
      )
    );
  if (cat === "business")
    return (
      article.vertical === "business" ||
      ["business", "economy", "finance", "entrepreneurship"].includes(
        article.category ?? ""
      )
    );
  if (cat === "technology")
    return (
      article.vertical === "technology" ||
      ["technology", "tech", "digital", "innovation"].includes(
        article.category ?? ""
      )
    );
  if (cat === "world")
    return (
      article.geoTag === "GLOBAL" ||
      article.vertical === "world" ||
      (!article.geoTag &&
        ["politics", "international", "diplomacy"].includes(
          article.category ?? ""
        ))
    );
  return true;
}

interface Props {
  articles: FeedItem[];
  lang: ContentLanguage;
  initialQuery?: string;
}

export function SearchFeed({ articles, lang, initialQuery = "" }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("all");
  const fr = lang === "fr";

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    return articles.filter((a) => {
      if (!matchesCategory(a, category)) return false;
      if (!q) return true;
      const text =
        `${a.title ?? ""} ${a.summary ?? ""} ${a.sourceName ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [articles, query, category]);

  return (
    <div className="space-y-6">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            fr
              ? "Rechercher des articles, bourses, opportunités…"
              : "Chèche atik, bous, okazyon…"
          }
          className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-11 pr-10 text-sm text-stone-900 placeholder-stone-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-stone-700 dark:bg-stone-900 dark:text-white dark:placeholder-stone-500"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setCategory(f.id)}
            className={[
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              category === f.id
                ? "bg-blue-600 text-white shadow"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700",
            ].join(" ")}
          >
            {fr ? f.fr : f.ht}
          </button>
        ))}
      </div>

      {/* Result count */}
      <p className="text-sm text-stone-400 dark:text-stone-500">
        {results.length}{" "}
        {fr
          ? results.length === 1
            ? "résultat"
            : "résultats"
          : "rezilta"}
        {query && (
          <>
            {" "}
            {fr ? "pour" : "pou"} &ldquo;
            <strong className="text-stone-700 dark:text-stone-200">
              {query}
            </strong>
            &rdquo;
          </>
        )}
      </p>

      {/* Results grid */}
      {results.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.slice(0, 60).map((article) => (
            <ArticleCard key={article.id} article={article} lang={lang} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <Search className="mx-auto mb-3 h-8 w-8 text-stone-300" />
          <p className="text-stone-400">
            {fr
              ? "Aucun résultat pour cette recherche."
              : "Pa gen rezilta pou rechèch sa."}
          </p>
          <button
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
            className="mt-3 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            {fr ? "Effacer les filtres" : "Efase filtè yo"}
          </button>
        </div>
      )}
    </div>
  );
}
