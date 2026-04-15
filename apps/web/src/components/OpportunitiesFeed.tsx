"use client";

/**
 * OpportunitiesFeed — Client component for /opportunites page (v2 — premium redesign).
 *
 * Provides:
 * - Sticky filter/search bar with sort controls (mirrors /bourses)
 * - URL-driven filter chips (Subcategory, Deadline, Expired)
 * - Client-side text search (in-memory)
 * - "Suivis" (saved) toggle with localStorage persistence
 * - Renders OpportunityCards in full-width grid (no sidebar)
 *
 * All filter state is URL-driven so external links / presets work.
 */

import { useMemo, useCallback, useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { ContentLanguage } from "@edlight-news/types";
import { Heart } from "lucide-react";
import type { FeedItem } from "@/components/news-feed";
import { OpportunityCard } from "@/components/OpportunityCard";
import {
  classifyOpportunity,
  type OpportunitySubcategory,
} from "@/lib/opportunityClassifier";
import {
  parseDeadline,
  SUBCAT_LABELS,
  type OpportunitySubCat,
} from "@/lib/opportunities";
import { getDeadlineStatus } from "@/lib/opportunityDeadline";
import { OPPORTUNITY_FILTER_PARAM_KEYS } from "@/lib/opportunity-params";
import { getSavedIds, toggleSaved, matchesSearch } from "@/lib/opportunities-ui";
import { CompactFiltersRow } from "@/app/opportunites/_components/CompactFiltersRow";
import { FiltersDrawer } from "@/app/opportunites/_components/FiltersDrawer";
import { ActiveFilterChips } from "@/app/opportunites/_components/ActiveFilterChips";
import type { FilterGroup } from "@/app/opportunites/_components/FiltersDrawer";
import type { ActiveFilter } from "@/app/opportunites/_components/ActiveFilterChips";

// ── Types ────────────────────────────────────────────────────────────────────

type SortMode = "deadline" | "relevance" | "latest";

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

const DEADLINE_FILTER_CHIPS: { key: string; fr: string; ht: string }[] = [
  { key: "all",      fr: "Tous",                ht: "Tout" },
  { key: "with",     fr: "Avec deadline",       ht: "Ak dat limit" },
  { key: "without",  fr: "Sans deadline",       ht: "San dat limit" },
];

const EXPIRED_FILTER_CHIPS: { key: string; fr: string; ht: string }[] = [
  { key: "hide",   fr: "Masquer expirés",    ht: "Kache ekspire" },
  { key: "show",   fr: "Afficher expirés",   ht: "Montre ekspire" },
];

// ── Component ────────────────────────────────────────────────────────────────

export interface OpportunitiesFeedProps {
  articles: FeedItem[];
  lang: ContentLanguage;
}

export function OpportunitiesFeed({ articles, lang }: OpportunitiesFeedProps) {
  const fr = lang === "fr";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── Local UI state ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Hydrate saved IDs from localStorage (client-only)
  useEffect(() => {
    setSavedIds(getSavedIds());
  }, []);

  const handleToggleSave = useCallback((id: string) => {
    const next = toggleSaved(id);
    setSavedIds(new Set(next));
  }, []);

  // ── URL-driven filter state ─────────────────────────────────────────────
  const subcategoryFilter = searchParams.get("subcategory") ?? "all";
  const deadlineFilter = searchParams.get("deadline") ?? "all";
  const expiredFilter = searchParams.get("expired") ?? "hide";
  const sortMode: SortMode = (["deadline", "latest", "relevance"].includes(searchParams.get("sort") ?? "")
    ? searchParams.get("sort") as SortMode
    : "relevance");

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      // Clear to default values
      if (
        (key === "subcategory" && value === "all") ||
        (key === "sort" && value === "relevance") ||
        (key === "deadline" && value === "all") ||
        (key === "expired" && value === "hide")
      ) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      if (lang !== "fr" && !params.has("lang")) params.set("lang", lang);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, pathname, router, lang],
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    OPPORTUNITY_FILTER_PARAM_KEYS.forEach((k) => params.delete(k));
    if (lang !== "fr") params.set("lang", lang);
    setSearchQuery("");
    setShowSavedOnly(false);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }, [lang, pathname, router, searchParams]);

  // ── Pre-compute enriched data ───────────────────────────────────────────
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
        const deadlineStatus = getDeadlineStatus(a.deadline ?? deadline.iso);
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

  // Available subcategories (with counts > 0)
  const subcategoryOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of enriched) {
      counts[e.subCat] = (counts[e.subCat] ?? 0) + 1;
    }
    return (
      ["bourses", "programmes", "stages", "concours", "ressources"] as OpportunitySubCat[]
    )
      .filter((s) => (counts[s] ?? 0) > 0)
      .map((s) => ({
        value: s,
        label: `${SUBCAT_LABELS[s][lang]} (${counts[s]})`,
      }));
  }, [enriched, lang]);

  // ── Filtering ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let items = enriched;

    // Subcategory filter
    if (subcategoryFilter !== "all") {
      items = items.filter((e) => e.subCat === subcategoryFilter);
    }

    // Deadline presence filter
    if (deadlineFilter === "with") {
      items = items.filter((e) => !e.deadline.missing);
    } else if (deadlineFilter === "without") {
      items = items.filter((e) => e.deadline.missing);
    }

    // Expired filter
    if (expiredFilter !== "show") {
      items = items.filter(
        (e) =>
          !e.deadlineStatus.isExpired ||
          (e.deadlineStatus.daysPast ?? 0) <= EXPIRED_HIDE_THRESHOLD_DAYS,
      );
    }

    // Client-side text search
    if (searchQuery.trim()) {
      items = items.filter((e) =>
        matchesSearch(e.article.title ?? "", e.article.summary, searchQuery),
      );
    }

    // Saved-only filter
    if (showSavedOnly) {
      items = items.filter((e) => savedIds.has(e.article.id));
    }

    // Sort
    items = [...items].sort((a, b) => {
      // Non-expired items always come before expired
      const aExpired = a.deadlineStatus.isExpired ? 1 : 0;
      const bExpired = b.deadlineStatus.isExpired ? 1 : 0;
      if (aExpired !== bExpired) return aExpired - bExpired;

      if (sortMode === "deadline") {
        if (!a.deadline.missing && b.deadline.missing) return -1;
        if (a.deadline.missing && !b.deadline.missing) return 1;
        if (a.deadline.iso && b.deadline.iso) {
          if (a.deadlineStatus.isExpired && b.deadlineStatus.isExpired) {
            return (
              new Date(b.deadline.iso).getTime() -
              new Date(a.deadline.iso).getTime()
            );
          }
          return (
            new Date(a.deadline.iso).getTime() -
            new Date(b.deadline.iso).getTime()
          );
        }
      }
      if (sortMode === "relevance") {
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

    return items;
  }, [enriched, subcategoryFilter, deadlineFilter, expiredFilter, sortMode, searchQuery, showSavedOnly, savedIds]);

  const savedCount = savedIds.size;

  // ── Drawer filter count (filters inside the drawer) ─────────────────────
  const drawerFilterCount = useMemo(
    () =>
      [deadlineFilter !== "all", expiredFilter !== "hide"].filter(Boolean).length,
    [deadlineFilter, expiredFilter],
  );

  // ── Active filter chips ─────────────────────────────────────────────────
  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const out: ActiveFilter[] = [];
    if (subcategoryFilter !== "all") {
      const sl = SUBCAT_LABELS[subcategoryFilter as OpportunitySubCat];
      out.push({
        key: "subcategory",
        label: `${fr ? "Type" : "Tip"}: ${sl ? (fr ? sl.fr : sl.ht) : subcategoryFilter}`,
      });
    }
    if (deadlineFilter !== "all") {
      const dl = DEADLINE_FILTER_CHIPS.find((c) => c.key === deadlineFilter);
      out.push({
        key: "deadline",
        label: `Deadline: ${dl ? (fr ? dl.fr : dl.ht) : deadlineFilter}`,
      });
    }
    if (expiredFilter !== "hide") {
      out.push({
        key: "expired",
        label: fr ? "Expirés visibles" : "Ekspire vizib",
      });
    }
    if (sortMode !== "relevance") {
      const sortLabels: Record<string, { fr: string; ht: string }> = {
        deadline: { fr: "Deadline proche", ht: "Dat limit pi pre" },
        latest: { fr: "Dernières", ht: "Dènye yo" },
      };
      const sl = sortLabels[sortMode];
      if (sl) {
        out.push({
          key: "sort",
          label: `${fr ? "Tri" : "Triye"}: ${fr ? sl.fr : sl.ht}`,
        });
      }
    }
    return out;
  }, [subcategoryFilter, deadlineFilter, expiredFilter, sortMode, fr]);

  // ── Drawer filter groups ────────────────────────────────────────────────
  const drawerGroups = useMemo<FilterGroup[]>(
    () => [
      {
        paramKey: "deadline",
        title: "Deadline",
        options: DEADLINE_FILTER_CHIPS.map((c) => ({
          key: c.key,
          label: fr ? c.fr : c.ht,
        })),
        activeValue: deadlineFilter,
      },
      {
        paramKey: "expired",
        title: fr ? "Expirés" : "Ekspire",
        options: EXPIRED_FILTER_CHIPS.map((c) => ({
          key: c.key,
          label: fr ? c.fr : c.ht,
        })),
        activeValue: expiredFilter,
      },
    ],
    [fr, deadlineFilter, expiredFilter],
  );

  return (
    <div className="space-y-3" id="catalogue">
      {/* ── Compact filter row (sticky) ── */}
      <CompactFiltersRow
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortMode={sortMode}
        onSortChange={setFilter}
        subcategoryFilter={subcategoryFilter}
        subcategoryOptions={subcategoryOptions}
        onFilterChange={setFilter}
        showSavedOnly={showSavedOnly}
        onToggleSaved={() => setShowSavedOnly((v) => !v)}
        savedCount={savedCount}
        onOpenDrawer={() => setFiltersOpen(true)}
        drawerFilterCount={drawerFilterCount}
        resultCount={filtered.length}
        totalCount={articles.length}
        fr={fr}
      />

      {/* ── Active filter chips ── */}
      <ActiveFilterChips
        filters={activeFilters}
        onRemove={(key) => {
          // Reset to default
          if (key === "expired") setFilter(key, "hide");
          else if (key === "sort") setFilter(key, "relevance");
          else setFilter(key, "all");
        }}
        onClearAll={clearAll}
        fr={fr}
      />

      {/* ── Filters drawer (Deadline, Expired) ── */}
      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        groups={drawerGroups}
        onFilterChange={setFilter}
        onReset={clearAll}
        fr={fr}
      />

      {/* ── Card grid (full-width, no sidebar) ── */}
      <div>
        {/* Saved-only empty state */}
        {showSavedOnly && filtered.length === 0 && savedCount === 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#c7c4d8]/30 bg-[#f9f2f0]/50 py-16 text-center dark:border-stone-700/40 dark:bg-stone-900/30">
            <Heart className="mx-auto h-10 w-10 text-[#c7c4d8] dark:text-stone-600" />
            <p className="mt-3 text-sm font-medium text-[#464555] dark:text-stone-400">
              {fr
                ? "Vous n'avez pas encore sauvegardé d'opportunités."
                : "Ou poko anrejistre okenn okazyon."}
            </p>
            <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
              {fr
                ? "Cliquez sur l\u2019icône \uD83D\uDD16 sur une opportunité pour la suivre."
                : "Klike sou ikòn \uD83D\uDD16 sou yon okazyon pou swiv li."}
            </p>
          </div>
        )}

        {/* No results for filters */}
        {!showSavedOnly && filtered.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#c7c4d8]/20 bg-white py-14 text-center text-[#474948] dark:border-stone-700 dark:bg-stone-900 dark:text-stone-500">
            <p className="text-base font-medium">
              {fr
                ? articles.length === 0
                  ? "Aucune opportunité disponible pour le moment…"
                  : "Aucun résultat pour ces filtres."
                : articles.length === 0
                  ? "Pa gen okazyon disponib pou kounye a…"
                  : "Pa gen rezilta pou filtè sa yo."}
            </p>
          </div>
        )}

        {showSavedOnly && filtered.length === 0 && savedCount > 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#c7c4d8]/20 bg-white py-14 text-center text-[#474948] dark:border-stone-700 dark:bg-stone-900 dark:text-stone-500">
            <p className="text-base font-medium">
              {fr
                ? "Aucune opportunité sauvegardée ne correspond aux filtres actifs."
                : "Pa gen okazyon anrejistre ki koresponn ak filtè aktif yo."}
            </p>
          </div>
        )}

        {/* Cards */}
        {filtered.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((entry) => (
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
        )}
      </div>
    </div>
  );
}
