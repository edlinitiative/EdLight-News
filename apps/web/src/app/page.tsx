/**
 * Homepage dispatcher.
 *
 * Routes to one of two homepage variants:
 *   - "bourses-led" (default) — leads with scholarships, news second.
 *   - "legacy"               — original text-first newspaper layout, kept
 *                              for safety so we can revert via env var or
 *                              port the design to other surfaces.
 *
 * Selection: `NEXT_PUBLIC_HOMEPAGE_VARIANT=legacy` switches back. Anything
 * else (including unset) renders the bourses-led variant.
 *
 * Data fetching is duplicated only for the news pool (the bourses-led
 * variant needs both scholarships *and* news). The legacy variant fetches
 * its own data inside the component, untouched, so behavior is identical
 * to the pre-redesign homepage.
 */

import type { Metadata } from "next";
import type { ContentLanguage, Scholarship } from "@edlight-news/types";
import {
  fetchEnrichedFeed,
  fetchTrending,
  getLangFromSearchParams,
} from "@/lib/content";
import {
  fetchScholarshipsForHaiti,
  fetchScholarshipsClosingSoon,
} from "@/lib/datasets";
import { rankFeed } from "@/lib/ranking";
import { isTauxDuJourArticle } from "@/lib/tauxFilter";
import {
  contentLooksLikeOpportunity,
  isOpportunityStillOpen,
} from "@/lib/opportunityClassifier";
import { tsToISO as sharedTsToISO } from "@/lib/dates";
import { buildOgMetadata } from "@/lib/og";
import type { FeedItem } from "@/components/news-feed";
import type { SerializedScholarship } from "@/components/BoursesFilters";

import { HomepageBoursesLed } from "@/components/homepage/HomepageBoursesLed";
import { HomepageLegacy } from "@/components/homepage/HomepageLegacy";

export const revalidate = 60;

// ── Variant flag ─────────────────────────────────────────────────────────────
function getVariant(): "bourses-led" | "legacy" {
  return process.env.NEXT_PUBLIC_HOMEPAGE_VARIANT === "legacy"
    ? "legacy"
    : "bourses-led";
}

// ── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const variant = getVariant();

  const title =
    variant === "bourses-led"
      ? fr
        ? "EdLight News — Bourses + actualités pour étudiants haïtiens"
        : "EdLight News — Bous + nouvèl pou etidyan ayisyen"
      : fr
        ? "EdLight News — Actualités éducatives pour étudiants haïtiens"
        : "EdLight News — Nouvèl edikasyon pou elèv ayisyen yo";

  const description =
    variant === "bourses-led"
      ? fr
        ? "Bourses, opportunités et actualités vérifiées pour les étudiants haïtiens et la diaspora. Mises à jour chaque jour."
        : "Bous, opòtinite ak nouvèl verifye pou etidyan ayisyen ak dyaspora a. Mizajou chak jou."
      : fr
        ? "Bourses, calendrier, ressources et actualités pour les étudiants haïtiens."
        : "Bous, kalandriye, resous ak nouvèl pou elèv ayisyen yo.";

  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/", lang }),
  };
}

// ── Helpers (mirror of legacy classifiers) ───────────────────────────────────
const OPPORTUNITY_CATS = new Set([
  "scholarship",
  "opportunity",
  "bourses",
  "concours",
  "stages",
  "programmes",
]);

function isOpportunity(a: FeedItem): boolean {
  const catIsOpp =
    a.vertical === "opportunites" || OPPORTUNITY_CATS.has(a.category ?? "");
  if (!catIsOpp) return false;
  if (!isOpportunityStillOpen(a.deadline)) return false;
  return contentLooksLikeOpportunity(a.title ?? "", a.summary);
}

const tsToISO = sharedTsToISO;

function serializeScholarship(s: Scholarship): SerializedScholarship {
  return {
    id: s.id,
    name: s.name,
    country: s.country,
    eligibleCountries: s.eligibleCountries,
    level: s.level,
    fundingType: s.fundingType,
    kind: s.kind,
    haitianEligibility: s.haitianEligibility,
    deadlineAccuracy: s.deadlineAccuracy,
    deadline: s.deadline
      ? {
          dateISO: s.deadline.dateISO,
          month: s.deadline.month,
          notes: s.deadline.notes,
          sourceUrl: s.deadline.sourceUrl,
        }
      : undefined,
    officialUrl: s.officialUrl,
    howToApplyUrl: s.howToApplyUrl,
    requirements: s.requirements,
    eligibilitySummary: s.eligibilitySummary,
    recurring: s.recurring,
    tags: s.tags,
    sources: s.sources.map((src) => ({ label: src.label, url: src.url })),
    verifiedAtISO: tsToISO(s.verifiedAt),
    updatedAtISO: tsToISO(s.updatedAt),
  };
}

// Days remaining until a deadline ISO; null if no parseable date.
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function HomePage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = (
    searchParams.lang === "ht" ? "ht" : "fr"
  ) as ContentLanguage;

  if (getVariant() === "legacy") {
    return <HomepageLegacy lang={lang} />;
  }

  // ── bourses-led variant ──────────────────────────────────────────────────
  const safe = async <T,>(fn: () => Promise<T>, fallback: T, label: string) => {
    try {
      return await fn();
    } catch (err) {
      console.error(`[EdLight] homepage ${label} fetch failed:`, err);
      return fallback;
    }
  };

  const [closingSoon, allScholarships, rawFeed, trending] = await Promise.all([
    safe(() => fetchScholarshipsClosingSoon(60), [] as Scholarship[], "closingSoon"),
    safe(() => fetchScholarshipsForHaiti(), [] as Scholarship[], "scholarships"),
    safe(() => fetchEnrichedFeed(lang, 100), [] as FeedItem[], "enrichedFeed"),
    safe(() => fetchTrending(lang, 8), [] as FeedItem[], "trending"),
  ]);

  // Bourses segments ────────────────────────────────────────────────────────
  // Hero: 3 nearest deadlines (with a parseable dateISO) — fallback to first 3.
  const datedClosing = [...closingSoon].sort((a, b) => {
    const da = daysUntil(a.deadline?.dateISO) ?? 9999;
    const db = daysUntil(b.deadline?.dateISO) ?? 9999;
    return da - db;
  });
  const heroBourses = (datedClosing.slice(0, 3).length
    ? datedClosing.slice(0, 3)
    : closingSoon.slice(0, 3)
  ).map(serializeScholarship);

  const heroIds = new Set(heroBourses.map((s) => s.id));
  const urgentBourses = datedClosing
    .filter((s) => !heroIds.has(s.id))
    .slice(0, 6)
    .map(serializeScholarship);

  // Recent: most recently verified scholarships not already shown.
  const usedBourseIds = new Set([
    ...heroIds,
    ...urgentBourses.map((s) => s.id),
  ]);
  const recentBourses = [...allScholarships]
    .filter((s) => !usedBourseIds.has(s.id))
    .sort((a, b) => {
      const ta = a.verifiedAt ? Date.parse(tsToISO(a.verifiedAt) ?? "") : 0;
      const tb = b.verifiedAt ? Date.parse(tsToISO(b.verifiedAt) ?? "") : 0;
      return tb - ta;
    })
    .slice(0, 6)
    .map(serializeScholarship);

  // News segments ───────────────────────────────────────────────────────────
  const filteredFeed = rawFeed.filter((a) => !isTauxDuJourArticle(a));
  const ranked = rankFeed(filteredFeed, {
    audienceFitThreshold: 0.3,
    publisherCap: 3,
    topN: 30,
  });
  const newsPool = ranked.filter(
    (a) => !isOpportunity(a) && a.itemType !== "utility",
  );
  const featuredNews =
    newsPool.find((a) => !!a.imageUrl) ?? newsPool[0] ?? null;
  const usedNewsIds = new Set(featuredNews ? [featuredNews.id] : []);
  const newsGrid = newsPool
    .filter((a) => !usedNewsIds.has(a.id))
    .slice(0, 6);
  newsGrid.forEach((a) => usedNewsIds.add(a.id));

  const trendingStories = trending
    .filter((a) => !usedNewsIds.has(a.id))
    .slice(0, 6);

  const histoire =
    filteredFeed.find(
      (a) => a.itemType === "utility" && a.utilityType === "history",
    ) ?? null;

  return (
    <HomepageBoursesLed
      lang={lang}
      heroBourses={heroBourses}
      urgentBourses={urgentBourses}
      recentBourses={recentBourses}
      featuredNews={featuredNews}
      newsGrid={newsGrid}
      trending={trendingStories}
      histoire={histoire}
    />
  );
}
