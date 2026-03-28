"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import { ArticleCard } from "@/components/ArticleCard";
import {
  formatDate,
  formatRelativeDate,
  categoryLabel,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  SORT_LABELS,
  type FeedCategory,
  type SortOption,
} from "@/lib/utils";
import { classifyOpportunity, contentLooksLikeOpportunity } from "@/lib/opportunityClassifier";
import { SUBCAT_COLORS, SUBCAT_LABELS, type OpportunitySubCat } from "@/lib/opportunities";
import { useLanguage } from "@/lib/language-context";
import { isAllowedInStudentFeed } from "@/lib/studentFeedFilter";
import { isTauxDuJourArticle } from "@/lib/tauxFilter";

// ── Feed mode ───────────────────────────────────────────────────────────────
export type FeedMode = "student" | "all";

const LS_MODE_KEY = "edlight-feed-mode";
const PAGE_SIZE = 18;

function readPersistedMode(): FeedMode {
  if (typeof window === "undefined") return "student";
  try {
    const v = localStorage.getItem(LS_MODE_KEY);
    return v === "all" ? "all" : "student";
  } catch {
    return "student";
  }
}

function persistMode(mode: FeedMode): void {
  try {
    localStorage.setItem(LS_MODE_KEY, mode);
  } catch {
    /* noop – private browsing */
  }
}

// ── Types for serialized data from server ───────────────────────────────────
export interface FeedItem {
  id: string;
  /** Parent item ID (used for cross-section dedup on homepage) */
  itemId?: string;
  title: string;
  summary: string;
  body: string;
  status: string;
  category?: string;
  draftReason?: string;
  citations: { sourceName: string; sourceUrl: string }[];
  // v2 fields from parent item (denormalized server-side)
  sourceName?: string;
  sourceUrl?: string;
  weakSource?: boolean;
  missingDeadline?: boolean;
  offMission?: boolean;
  audienceFitScore?: number;
  dedupeGroupId?: string;
  publishedAt?: string | null; // ISO string
  deadline?: string | null;
  geoTag?: string;
  /** High-level content vertical (e.g. "opportunites") */
  vertical?: string;
  /** How many items share the same dedupeGroupId */
  dupeCount?: number;
  /** True when item has no audienceFitScore (pre-v2 legacy) */
  isLegacy?: boolean;
  /** Public URL of the article image (Firebase Storage or publisher CDN) */
  imageUrl?: string | null;
  /** How the image was obtained: publisher | wikidata | branded | screenshot */
  imageSource?: string;
  /** Image attribution info (e.g., Wikidata) */
  imageAttribution?: { name?: string; url?: string; license?: string };
  // synthesis fields
  /** Item type: "source" (default), "synthesis", or "utility" (student-focused) */
  itemType?: string;
  /** Utility type: deadline, exam, admissions, scholarship, internship, guide */
  utilityType?: string;
  /** Utility magazine series (e.g. StudyAbroad, Career, ScholarshipRadar) */
  series?: string;
  /** Number of source articles (synthesis only) */
  sourceCount?: number;
  /** Publisher domains contributing to synthesis */
  publisherDomains?: string[];
  /** When synthesis was last updated (ISO string) */
  lastMajorUpdateAt?: string | null;
  /** What changed in the latest synthesis update */
  whatChanged?: string;
  /** Status tags: confirmed, unconfirmed, evolving */
  synthesisTags?: string[];
  /** Source article refs (synthesis only) */
  sourceList?: { itemId: string; title: string; sourceName: string; publishedAt?: string }[];
  /** Explicitly tagged as a success / achievement story */
  successTag?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Return the item's audienceFitScore, or 0 if missing (legacy). */
function getAudienceFitScore(item: FeedItem): number {
  return item.audienceFitScore ?? 0;
}

/** Whether an item is legacy (no audienceFitScore set). */
function isLegacyItem(item: FeedItem): boolean {
  return item.audienceFitScore === undefined || item.audienceFitScore === null;
}

const SCORE_THRESHOLD = 0.65;

// ── Sub-components ──────────────────────────────────────────────────────────

const OPP_CATEGORIES = new Set([
  "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
]);

const SUBCAT_MAP: Record<string, OpportunitySubCat> = {
  Bourses: "bourses", Programmes: "programmes", Stages: "stages",
  Concours: "concours", Ressources: "ressources", Autre: "autre",
};

function looksLikeOpportunity(article: FeedItem): boolean {
  if (article.itemType === "utility") return true;
  return contentLooksLikeOpportunity(article.title ?? "", article.summary);
}

function CategoryBadge({ article, lang }: { article: FeedItem; lang: ContentLanguage }) {
  const isOpp =
    (article.vertical === "opportunites" ||
     OPP_CATEGORIES.has(article.category ?? "")) &&
    looksLikeOpportunity(article);

  if (isOpp) {
    const result = classifyOpportunity({
      title: article.title ?? "",
      summary: article.summary,
      body: article.body,
      category: article.category,
      publisher: article.sourceName,
      url: article.sourceUrl,
    });
    const sc = SUBCAT_MAP[result.subcategory] ?? "autre";
    return (
      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${SUBCAT_COLORS[sc]}`}>
        {SUBCAT_LABELS[sc][lang]}
      </span>
    );
  }

  if (!article.category) return null;
  // Category is opp-adjacent but content doesn't look like an opportunity
  // → remap to avoid misleading "Concours"/"Stages" labels on general news.
  const displayCat = OPP_CATEGORIES.has(article.category)
    ? (article.geoTag === "HT" || article.vertical === "haiti" ? "local_news" : "news")
    : article.category;
  const color = CATEGORY_COLORS[displayCat] ?? "bg-stone-100 text-stone-600";
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${color}`}>
      {categoryLabel(displayCat, lang)}
    </span>
  );
}

function TrustSignals({
  item,
  lang,
  mounted = false,
}: {
  item: FeedItem;
  lang: ContentLanguage;
  mounted?: boolean;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-400">
      {/* Source name or source count for synthesis */}
      {item.itemType === "synthesis" && item.sourceCount ? (
        <span>
          {item.sourceCount} {lang === "fr" ? "sources" : "sous"}
        </span>
      ) : item.sourceName ? (
        <span>
          {item.sourceUrl ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {item.sourceName}
            </a>
          ) : (
            item.sourceName
          )}
        </span>
      ) : null}
      {(item.sourceName || (item.itemType === "synthesis" && item.sourceCount)) && item.publishedAt && <span>·</span>}
      {/* Last updated date for synthesis, or published date */}
      {item.itemType === "synthesis" && item.lastMajorUpdateAt && (
        <span suppressHydrationWarning>
          {mounted
            ? `${lang === "fr" ? "Mis à jour" : "Mizajou"} ${formatRelativeDate(item.lastMajorUpdateAt, lang)}`
            : ""}
        </span>
      )}
      {item.itemType !== "synthesis" && item.publishedAt && (
        <span suppressHydrationWarning>
          {mounted ? formatRelativeDate(item.publishedAt, lang) : ""}
        </span>
      )}
      {/* Subtle quality labels */}
      {item.weakSource && (
        <span className="text-stone-300">{lang === "fr" ? "Source indirecte" : "Sous endirèk"}</span>
      )}
      {item.missingDeadline && (
        <span className="text-stone-300">{lang === "fr" ? "Date à confirmer" : "Dat pou konfime"}</span>
      )}
    </div>
  );
}

// ── Main client component ───────────────────────────────────────────────────

export function NewsFeed({
  articles: rawArticles,
  serverLang,
  preRanked = false,
}: {
  articles: FeedItem[];
  serverLang: ContentLanguage;
  /**
   * When true, the server already applied score filtering, dedup, and
   * publisher balancing. Skip the equivalent client-side gates.
   */
  preRanked?: boolean;
}) {
  const { language: clientLang, setLanguage } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Guard: only render time-dependent content after hydration
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Sync language from URL param
  const urlLang = searchParams.get("lang") as ContentLanguage | null;
  const lang = urlLang ?? clientLang ?? serverLang;

  useEffect(() => {
    if (urlLang && urlLang !== clientLang) {
      setLanguage(urlLang);
    }
  }, [urlLang, clientLang, setLanguage]);

  // Feed mode (student-first vs all)
  const urlMode = searchParams.get("mode") as FeedMode | null;
  const [feedMode, setFeedMode] = useState<FeedMode>(
    urlMode === "all" ? "all" : urlMode === "student" ? "student" : readPersistedMode(),
  );

  // Keep URL + localStorage in sync when mode changes
  const handleModeChange = (mode: FeedMode) => {
    setFeedMode(mode);
    persistMode(mode);
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", mode);
    router.push(`/news?${params.toString()}`, { scroll: false });
  };

  // State
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("latest");
  const [showLegacy, setShowLegacy] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FeedCategory>(
    (searchParams.get("category") as FeedCategory) ?? "all",
  );

  // Dedupe collapsing: keep only newest per dedupeGroupId
  const dedupedArticles = useMemo(() => {
    const groups = new Map<string, FeedItem[]>();
    const ungrouped: FeedItem[] = [];

    for (const a of rawArticles) {
      if (a.dedupeGroupId) {
        const list = groups.get(a.dedupeGroupId) ?? [];
        list.push(a);
        groups.set(a.dedupeGroupId, list);
      } else {
        ungrouped.push(a);
      }
    }

    const collapsed: FeedItem[] = [];
    for (const [, group] of groups) {
      // Sort by publishedAt desc within group, take newest
      group.sort((a, b) => {
        const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return tb - ta;
      });
      collapsed.push({ ...group[0]!, dupeCount: group.length });
    }

    // Suppress "taux du jour" articles (the widget handles exchange rates)
    return [...collapsed, ...ungrouped].filter((a) => !isTauxDuJourArticle(a));
  }, [rawArticles]);

  // Audience-fit filtering.
  // When preRanked=true the server already applied threshold + dedup;
  // skip client-side gates so server-curated legacy items remain visible.
  const qualityFiltered = useMemo(() => {
    if (preRanked) {
      return dedupedArticles.map((a) => ({ ...a, isLegacy: isLegacyItem(a) }));
    }
    return dedupedArticles
      .filter((a) => {
        if (isLegacyItem(a)) return showLegacy;
        return getAudienceFitScore(a) >= SCORE_THRESHOLD;
      })
      .map((a) => ({ ...a, isLegacy: isLegacyItem(a) }));
  }, [dedupedArticles, showLegacy, preRanked]);

  // Count legacy items available (for the toggle label)
  const legacyCount = useMemo(() => {
    return dedupedArticles.filter((a) => isLegacyItem(a)).length;
  }, [dedupedArticles]);

  // ── Student-mode filter ─────────────────────────────────────────────────
  const studentFiltered = useMemo(() => {
    if (feedMode === "all") return qualityFiltered;
    return qualityFiltered.filter((a) =>
      isAllowedInStudentFeed({
        title: a.title,
        summary: a.summary,
        category: a.category,
        tags: a.synthesisTags,
        publisher: a.sourceName,
        geoLabel: a.geoTag,
        vertical: a.vertical,
        itemType: a.itemType,
      }),
    );
  }, [qualityFiltered, feedMode]);

  /** True when student mode actually hid some items */
  const studentModeFiltered =
    feedMode === "student" && studentFiltered.length < qualityFiltered.length;

  // Fixed category pills — always visible even if count is 0
  const FIXED_NEWS_PILLS: FeedCategory[] = [
    "all",
    "news",
    "local_news",
    "scholarship",
    "resource",
  ];

  // Category filter — "scholarship" pill matches all opportunity subcategories
  const OPPORTUNITY_CATS = new Set([
    "scholarship",
    "opportunity",
    "bourses",
    "concours",
    "stages",
    "programmes",
  ]);

  const categoryFiltered = useMemo(() => {
    if (activeCategory === "all") return studentFiltered;
    if (activeCategory === "scholarship") {
      return studentFiltered.filter(
        (a) =>
          OPPORTUNITY_CATS.has(a.category ?? "") ||
          a.vertical === "opportunites",
      );
    }
    return studentFiltered.filter((a) => a.category === activeCategory);
  }, [studentFiltered, activeCategory]);

  // Pill counts — reflect the student-filtered (or full) set
  const pillCounts = useMemo(() => {
    const counts: Partial<Record<FeedCategory, number>> = {};
    counts.all = studentFiltered.length;
    for (const pill of FIXED_NEWS_PILLS) {
      if (pill === "all") continue;
      if (pill === "scholarship") {
        counts.scholarship = studentFiltered.filter(
          (a) =>
            OPPORTUNITY_CATS.has(a.category ?? "") ||
            a.vertical === "opportunites",
        ).length;
      } else {
        counts[pill] = studentFiltered.filter(
          (a) => a.category === pill,
        ).length;
      }
    }
    return counts;
  }, [studentFiltered]);

  // Search filter
  const searchFiltered = useMemo(() => {
    if (!search.trim()) return categoryFiltered;
    const q = search.toLowerCase();
    return categoryFiltered.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.summary ?? "").toLowerCase().includes(q),
    );
  }, [categoryFiltered, search]);

  // Sort
  const sorted = useMemo(() => {
    const items = [...searchFiltered];
    switch (sort) {
      case "relevance":
        items.sort((a, b) => {
          const scoreDiff = (b.audienceFitScore ?? 0) - (a.audienceFitScore ?? 0);
          if (scoreDiff !== 0) return scoreDiff;
          const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          return tb - ta;
        });
        break;
      case "deadline":
        items.sort((a, b) => {
          // Only Bourses items with deadline
          const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          return da - db;
        });
        break;
      case "latest":
      default:
        // Already sorted by publishedAt desc from server
        break;
    }
    return items;
  }, [searchFiltered, sort]);

  // Pagination: show items in pages
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Reset visible count when filters / search change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [activeCategory, search, sort, feedMode]);
  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  // Navigate with category
  const handleCategory = (cat: FeedCategory) => {
    setActiveCategory(cat);
    const params = new URLSearchParams(searchParams.toString());
    if (cat !== "all") params.set("category", cat);
    else params.delete("category");
    router.push(`/news?${params.toString()}`, { scroll: false });
  };

  return (
    <section className="space-y-5">
      {/* Controls bar — compact single row */}
      <div className="flex flex-col gap-2.5">
        {/* Row 1: mode toggle + search + sort */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="inline-flex shrink-0 rounded-lg border border-stone-200 bg-stone-100 p-0.5 dark:border-stone-700 dark:bg-stone-800">
            {(["student", "all"] as const).map((mode) => {
              const isActive = mode === feedMode;
              const label =
                mode === "student"
                  ? lang === "fr"
                    ? "Fil étudiant"
                    : "Fil etidyan"
                  : lang === "fr"
                    ? "Tout"
                    : "Tout";
              return (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={
                    "rounded-md px-2.5 py-1 text-xs font-medium transition " +
                    (isActive
                      ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                      : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200")
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === "fr" ? "Rechercher…" : "Chèche…"}
              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 pl-8 text-sm text-stone-900 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            />
            <svg
              className="absolute left-2.5 top-2 h-3.5 w-3.5 text-stone-400 dark:text-stone-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="shrink-0 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm text-stone-900 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
          >
            {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
              <option key={opt} value={opt}>
                {SORT_LABELS[opt][lang]}
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: category pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {FIXED_NEWS_PILLS.map((cat) => {
            const label = CATEGORY_LABELS[cat]?.[lang] ?? cat;
            const count = pillCounts[cat] ?? 0;
            const isActive = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => handleCategory(cat)}
                className={
                  "rounded-md px-2.5 py-1 text-xs font-medium transition " +
                  (isActive
                    ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700")
                }
              >
                {label}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            );
          })}
          {/* Legacy toggle — inline */}
          {!preRanked && legacyCount > 0 && (
            <label className="ml-auto flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
              <input
                type="checkbox"
                checked={showLegacy}
                onChange={(e) => setShowLegacy(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-stone-300 text-blue-600 focus:ring-blue-400"
              />
              {lang === "fr" ? `Anciens (${legacyCount})` : `Ansyen (${legacyCount})`}
            </label>
          )}
        </div>

        {/* Student-mode note — slim inline */}
        {studentModeFiltered && (
          <p className="text-xs text-stone-400 dark:text-stone-500">
            {lang === "fr"
              ? "Fil étudiant — certains articles masqués."
              : "Fil etidyan — kèk atik kache."}
            {" "}
            <button
              onClick={() => handleModeChange("all")}
              className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {lang === "fr" ? "Voir tout" : "Wè tout"}
            </button>
          </p>
        )}
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="section-shell border-2 border-dashed p-8 text-center text-stone-500 dark:text-stone-400">
          <p className="text-lg">
            {search
              ? lang === "fr"
                ? "Aucun résultat pour cette recherche."
                : "Pa gen rezilta pou rechèch sa a."
              : lang === "fr"
                ? "Aucun article pour le moment."
                : "Pa gen atik pou kounye a."}
          </p>
        </div>
      )}

      {/* Lead story + sidebar (newspaper layout) */}
      {visible.length > 0 && (
        <>
          <div className="section-rule" />
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Lead article + secondary stories */}
            <div>
              <ArticleCard article={visible[0]!} lang={lang} variant="featured" />
              {visible.length > 1 && (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {visible.slice(1, 3).map((a) => (
                    <ArticleCard key={a.id} article={a} lang={lang} />
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar: more articles */}
            {visible.length > 3 && (
              <aside className="space-y-4 lg:border-l lg:border-stone-200 lg:pl-6 dark:lg:border-stone-800">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">
                  {lang === "fr" ? "Aussi dans l'actu" : "Tou nan aktyalite"}
                </h3>
                <div className="space-y-0">
                  {visible.slice(3, 8).map((a, i) => (
                    <Link
                      key={a.id}
                      href={`/news/${a.id}?lang=${lang}`}
                      className="news-item-compact group"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-sm font-bold text-stone-300 dark:text-stone-600">
                        {i + 4}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium leading-snug text-stone-800 line-clamp-2 transition-colors dark:text-stone-200">
                          {a.title}
                        </h3>
                        <div className="source-line mt-0.5">
                          {a.sourceName && <span className="source-name">{a.sourceName}</span>}
                          {a.sourceName && a.publishedAt && <span className="source-dot">·</span>}
                          {a.publishedAt && (
                            <span>
                              {new Date(a.publishedAt).toLocaleDateString(
                                lang === "fr" ? "fr-FR" : "fr-HT",
                                { day: "numeric", month: "short" },
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </>
      )}

      {/* Remaining articles grid */}
      {visible.length > 8 && (
        <>
          <div className="section-rule-light" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.slice(8).map((a) => (
              <ArticleCard key={a.id} article={a} lang={lang} />
            ))}
          </div>
        </>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="rounded-lg border border-stone-200 bg-white px-6 py-2.5 text-sm font-medium text-stone-700 shadow-sm transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            {lang === "fr" ? "Voir plus" : "Wè plis"} ({sorted.length - visibleCount}{" "}
            {lang === "fr" ? "restants" : "ki rete"})
          </button>
        </div>
      )}
    </section>
  );
}
