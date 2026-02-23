"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MapPin } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
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
import { useLanguage } from "@/lib/language-context";

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

function CategoryBadge({ category, lang }: { category?: string; lang: ContentLanguage }) {
  if (!category) return null;
  const color = CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {categoryLabel(category, lang)}
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
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
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
              className="hover:text-gray-600 hover:underline"
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
        <span className="text-gray-300">{lang === "fr" ? "Source indirecte" : "Sous endirèk"}</span>
      )}
      {item.missingDeadline && (
        <span className="text-gray-300">{lang === "fr" ? "Date à confirmer" : "Dat pou konfime"}</span>
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

    return [...collapsed, ...ungrouped];
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
    if (activeCategory === "all") return qualityFiltered;
    if (activeCategory === "scholarship") {
      return qualityFiltered.filter(
        (a) =>
          OPPORTUNITY_CATS.has(a.category ?? "") ||
          a.vertical === "opportunites",
      );
    }
    return qualityFiltered.filter((a) => a.category === activeCategory);
  }, [qualityFiltered, activeCategory]);

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

  // Navigate with category
  const handleCategory = (cat: FeedCategory) => {
    setActiveCategory(cat);
    const params = new URLSearchParams(searchParams.toString());
    if (cat !== "all") params.set("category", cat);
    else params.delete("category");
    router.push(`/news?${params.toString()}`, { scroll: false });
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          {lang === "fr" ? "Actualités" : "Nouvèl"}
        </h1>
        <span className="text-sm text-gray-400">
          {sorted.length} {lang === "fr" ? "articles" : "atik"}
        </span>
      </div>

      {/* Search + Sort bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === "fr" ? "Rechercher…" : "Chèche…"}
            className="w-full rounded-lg border px-4 py-2 pl-9 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
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
          className="rounded-lg border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
        >
          {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
            <option key={opt} value={opt}>
              {SORT_LABELS[opt][lang]}
            </option>
          ))}
        </select>
      </div>

      {/* Legacy toggle — only shown when not server-pre-ranked */}
      {!preRanked && legacyCount > 0 && (
        <label className="flex items-center gap-2 text-sm text-gray-500">
          <input
            type="checkbox"
            checked={showLegacy}
            onChange={(e) => setShowLegacy(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400"
          />
          {lang === "fr"
            ? `Afficher les anciens articles (${legacyCount})`
            : `Montre ansyen atik yo (${legacyCount})`}
        </label>
      )}

      {/* Category filter pills — always visible */}
      <div className="flex flex-wrap gap-2">
        {FIXED_NEWS_PILLS.map((cat) => {
          const label = CATEGORY_LABELS[cat]?.[lang] ?? cat;
          const isActive = cat === activeCategory;
          return (
            <button
              key={cat}
              onClick={() => handleCategory(cat)}
              className={
                "rounded-full px-3 py-1 text-sm font-medium transition " +
                (isActive
                  ? "bg-brand-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200")
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="rounded-lg border-2 border-dashed p-8 text-center text-gray-500">
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

      {/* Article grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        {sorted.map((article) => (
          <Link
            key={article.id}
            href={`/news/${article.id}?lang=${lang}`}
            className="group block rounded-lg border p-5 transition hover:border-brand-300 hover:shadow-md"
          >
            <div className="mb-2 flex items-center gap-2">
              <CategoryBadge category={article.category} lang={lang} />
              {article.itemType === "synthesis" && (
                <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {lang === "fr" ? "Synthèse" : "Sentèz"} · {article.sourceCount ?? 0}{" "}
                  {lang === "fr" ? "sources" : "sous"}
                </span>
              )}
              {article.geoTag === "HT" && (
                <span className="inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                  <MapPin className="inline-block h-3 w-3" />
                </span>
              )}
              {article.isLegacy && (
                <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                  {lang === "fr" ? "Ancien contenu" : "Ansyen kontni"}
                </span>
              )}
              {(article.dupeCount ?? 0) > 1 && article.itemType !== "synthesis" && (
                <span className="text-xs text-gray-400">
                  +{(article.dupeCount ?? 1) - 1}{" "}
                  {lang === "fr" ? "mises à jour" : "mizajou"}
                </span>
              )}
            </div>
            <h2 className="mb-2 text-lg font-semibold group-hover:text-brand-700">
              {article.title}
            </h2>
            <p className="line-clamp-3 text-sm text-gray-600">
              {article.summary || article.body?.slice(0, 200) || ""}
            </p>
            <TrustSignals item={article} lang={lang} mounted={mounted} />
          </Link>
        ))}
      </div>
    </section>
  );
}
