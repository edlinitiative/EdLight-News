"use client";

import { useState, useMemo, useEffect } from "react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { OpportunityCard } from "@/components/OpportunityCard";
import {
  deriveSubcategory,
  parseDeadline,
  SUBCAT_LABELS,
  type OpportunitySubCat,
} from "@/lib/opportunities";
import {
  classifyOpportunity,
  type OpportunitySubcategory,
} from "@/lib/opportunityClassifier";
import { getDeadlineStatus, type DeadlineStatus } from "@/lib/opportunityDeadline";

// ── Types ────────────────────────────────────────────────────────────────────

type SubCatFilter = "all" | OpportunitySubCat;

type SortMode = "deadline" | "relevance" | "latest";

const SORT_LABELS: Record<SortMode, { fr: string; ht: string }> = {
  deadline:  { fr: "Deadline proche", ht: "Dat limit" },
  relevance: { fr: "Pertinence",     ht: "Pètinans"  },
  latest:    { fr: "Dernières",      ht: "Dènye"     },
};

/** Map the new PascalCase subcategory to the existing lowercase OpportunitySubCat. */
function toSubCat(sc: OpportunitySubcategory): OpportunitySubCat {
  const map: Record<OpportunitySubcategory, OpportunitySubCat> = {
    Bourses: "bourses",
    Programmes: "programmes",
    Stages: "stages",
    Concours: "concours",
    Ressources: "ressources",
    Autre: "autre",
  };
  return map[sc];
}

/** Number of days after expiry beyond which items are hidden by default. */
const EXPIRED_HIDE_THRESHOLD_DAYS = 14;
const PAGE_SIZE = 18;

// ── Component ────────────────────────────────────────────────────────────────

export interface OpportunitiesFeedProps {
  articles: FeedItem[];
  lang: ContentLanguage;
}

export function OpportunitiesFeed({ articles, lang }: OpportunitiesFeedProps) {
  const [subCat, setSubCat] = useState<SubCatFilter>("all");
  const [sort, setSort] = useState<SortMode>("relevance");
  const [includeNoDeadline, setIncludeNoDeadline] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Pre-compute derived classification + deadline per article (once)
  const enriched = useMemo(
    () =>
      articles.map((a) => {
        const classification = classifyOpportunity({
          title: a.title,
          summary: a.summary,
          body: a.body,
          category: a.category,
          publisher: a.sourceName,
          url: a.sourceUrl,
        });
        const derivedSubCat = toSubCat(classification.subcategory);
        const deadline = parseDeadline(a, lang);
        const deadlineStatus = getDeadlineStatus(
          a.deadline ?? deadline.iso,
        );
        return {
          article: a,
          subCat: derivedSubCat,
          classification,
          deadline,
          deadlineStatus,
        };
      }),
    [articles, lang],
  );

  // Pill counts — based on derived classification, not original category
  const pillCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const e of enriched) {
      counts.all = (counts.all ?? 0) + 1;
      counts[e.subCat] = (counts[e.subCat] ?? 0) + 1;
    }
    return counts;
  }, [enriched]);

  // Does the query match an item? (for search-based override of expired hiding)
  const matchesSearch = (a: typeof enriched[number]): boolean => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const blob = `${a.article.title ?? ""} ${a.article.summary ?? ""}`.toLowerCase();
    return blob.includes(q);
  };

  // Filter by selected subcategory pill + expired/search logic
  const filtered = useMemo(() => {
    let result =
      subCat === "all"
        ? enriched
        : enriched.filter((e) => e.subCat === subCat);

    // When sorting by deadline, hide items with missing deadlines unless toggled
    if (sort === "deadline" && !includeNoDeadline) {
      result = result.filter((e) => !e.deadline.missing);
    }

    // Hide deeply expired items (>14 days) unless user explicitly searches or toggles
    if (!showExpired) {
      result = result.filter(
        (e) =>
          !e.deadlineStatus.isExpired ||
          (e.deadlineStatus.daysPast ?? 0) <= EXPIRED_HIDE_THRESHOLD_DAYS ||
          matchesSearch(e),
      );
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched, subCat, sort, includeNoDeadline, showExpired, searchQuery]);

  // Sort: non-expired first, then expired by most recent deadline
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Non-expired items always come before expired
      const aExpired = a.deadlineStatus.isExpired ? 1 : 0;
      const bExpired = b.deadlineStatus.isExpired ? 1 : 0;
      if (aExpired !== bExpired) return aExpired - bExpired;

      if (sort === "deadline") {
        // Items with deadlines come first
        if (!a.deadline.missing && b.deadline.missing) return -1;
        if (a.deadline.missing && !b.deadline.missing) return 1;
        if (a.deadline.iso && b.deadline.iso) {
          // For expired items, most recently expired first (desc)
          if (a.deadlineStatus.isExpired && b.deadlineStatus.isExpired) {
            return (
              new Date(b.deadline.iso).getTime() -
              new Date(a.deadline.iso).getTime()
            );
          }
          // For non-expired, soonest deadline first (asc)
          return (
            new Date(a.deadline.iso).getTime() -
            new Date(b.deadline.iso).getTime()
          );
        }
      }
      if (sort === "relevance") {
        const diff =
          (b.article.audienceFitScore ?? 0) -
          (a.article.audienceFitScore ?? 0);
        if (diff !== 0) return diff;
      }
      const tA = a.article.publishedAt
        ? new Date(a.article.publishedAt).getTime()
        : 0;
      const tB = b.article.publishedAt
        ? new Date(b.article.publishedAt).getTime()
        : 0;
      return tB - tA;
    });
  }, [filtered, sort]);

  // Pagination
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [subCat, sort, searchQuery, showExpired, includeNoDeadline]);
  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  return (
    <div className="grid gap-3 sm:gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
      {/* Sidebar controls */}
      <aside className="section-shell p-3 sm:p-3.5 md:sticky md:top-20 lg:top-24">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="mb-2 w-full rounded-lg bg-stone-100 px-3 py-2 text-left text-sm font-medium text-stone-700 transition hover:bg-stone-200 dark:bg-stone-700 dark:text-stone-200 dark:hover:bg-stone-600 md:hidden"
          aria-expanded={filtersOpen}
        >
          {filtersOpen
            ? (lang === "fr" ? "Masquer les filtres" : "Kache filtè")
            : (lang === "fr" ? "Afficher les filtres" : "Montre filtè")}
        </button>

        <div className={["relative z-10 space-y-3.5", filtersOpen ? "block" : "hidden md:block"].join(" ")}>
          <div className="space-y-1.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === "fr" ? "Rechercher…" : "Chèche…"}
              className="w-full rounded-lg border border-stone-200/80 bg-white/80 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-stone-700 dark:bg-stone-900/70 dark:text-white dark:placeholder-stone-500"
            />
            <p className="text-[11px] text-stone-400 dark:text-stone-500 sm:text-xs">
              {sorted.length} {lang === "fr" ? "résultat(s)" : "rezilta"}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              {lang === "fr" ? "Type" : "Tip"}
            </p>
            <div className="space-y-1">
              {(
                ["all", "bourses", "programmes", "stages", "concours", "ressources"] as SubCatFilter[]
              ).map((s) => {
                const count = pillCounts[s] ?? 0;
                // Hide pills with zero count (except "all")
                if (s !== "all" && count === 0) return null;
                return (
                  <button
                    key={s}
                    onClick={() => setSubCat(s)}
                    className={[
                      "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition",
                      subCat === s
                        ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700",
                    ].join(" ")}
                  >
                    <span>{SUBCAT_LABELS[s][lang]}</span>
                    <span className="text-xs opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              {lang === "fr" ? "Trier" : "Triye"}
            </p>
            <div className="space-y-1">
              {(["deadline", "relevance", "latest"] as SortMode[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={[
                    "w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-medium transition",
                    sort === s
                      ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700",
                  ].join(" ")}
                >
                  {SORT_LABELS[s][lang]}
                </button>
              ))}
            </div>
          </div>

          {sort === "deadline" && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
              <input
                type="checkbox"
                checked={includeNoDeadline}
                onChange={(e) => setIncludeNoDeadline(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 dark:border-stone-600"
              />
              {lang === "fr" ? "Inclure sans deadline" : "Enkli san dat limit"}
            </label>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
            <input
              type="checkbox"
              checked={showExpired}
              onChange={(e) => setShowExpired(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 dark:border-stone-600"
            />
            {lang === "fr" ? "Afficher expirés" : "Montre ki ekspire"}
          </label>
        </div>
      </aside>

      {/* Results */}
      <div className="space-y-3 sm:space-y-4">
        {sorted.length === 0 ? (
          <div className="section-shell border-2 border-dashed py-20 text-center text-stone-400 dark:text-stone-500">
            <p className="relative z-10">
              {lang === "fr"
                ? "Aucune opportunité trouvée."
                : "Pa gen okazyon jwenn."}
            </p>
          </div>
        ) : (
          <>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((entry) => (
              <OpportunityCard
                key={entry.article.id}
                article={entry.article}
                lang={lang}
                derivedSubcategory={entry.subCat}
                classification={entry.classification}
                deadlineStatus={entry.deadlineStatus}
              />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="rounded-lg border border-stone-200 bg-white px-6 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                {lang === "fr" ? "Voir plus" : "Wè plis"} ({sorted.length - visibleCount}{" "}
                {lang === "fr" ? "restantes" : "ki rete"})
              </button>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
