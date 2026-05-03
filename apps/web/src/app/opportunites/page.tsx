/**
 * /opportunites — Opportunities feed (v2 — premium redesign).
 *
 * Server component: fetches + filters scholarship/opportunity articles,
 * serialises them, and delegates filtering/rendering to client components.
 *
 * Layout (mirrors /bourses):
 *   1) Header — title, subtitle, count badge
 *   2) Catalogue — sticky filter bar + search + card grid
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Suspense } from "react";
import { PageHeroCompact } from "@/components/PageHeroCompact";
import { fetchEnrichedFeed, fetchEnrichedFeedByVertical, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { OpportunitiesFeed } from "@/components/OpportunitiesFeed";
import { contentLooksLikeOpportunity, isOpportunityStillOpen } from "@/lib/opportunityClassifier";
import { scoreOpportunity, OPPORTUNITY_SCORE_THRESHOLD } from "@edlight-news/generator";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 600;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Opportunités · EdLight News" : "Okazyon · EdLight News";
  const description = fr
    ? "Bourses, concours, stages et programmes pour étudiants haïtiens."
    : "Bous, konkou, estaj ak pwogram pou elèv ayisyen.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/opportunites", lang }),
  };
}

export default async function OpportunitesPage({
  searchParams,
}: {
  searchParams: { lang?: string; [key: string]: string | string[] | undefined };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;

  let allArticles: Awaited<ReturnType<typeof fetchEnrichedFeed>>;
  try {
    // Fast path: query items directly by vertical="opportunites" (uses the
    // composite index on items.vertical+publishedAt) instead of pulling 800
    // mixed-vertical content_versions just to throw 90 % away in memory.
    // We also pull a small slice of utility/ScholarshipRadar items via the
    // generic feed so editorial radars still appear in the catalogue.
    const [vertical, generic] = await Promise.all([
      fetchEnrichedFeedByVertical("opportunites", lang, 300),
      fetchEnrichedFeed(lang, 150),
    ]);
    const seen = new Set<string>();
    allArticles = [...vertical, ...generic].filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  } catch (err) {
    console.error("[EdLight] /opportunites fetch failed:", err);
    allArticles = [];
  }

  // Keep all opportunity-type items: by vertical, legacy categories, and new subcategories.
  // Items without deadlines are included — the client handles sort/filter logic.
  const OPPORTUNITY_CATEGORIES = new Set([
    "scholarship",
    "opportunity",
    "bourses",
    "concours",
    "stages",
    "programmes",
  ]);

  function looksLikeOpportunity(a: typeof allArticles[number]): boolean {
    // Utility items with the ScholarshipRadar series always pass
    if (a.itemType === "utility" && a.series === "ScholarshipRadar") return true;
    // Trust the worker: items the ingest pipeline already tagged as
    // vertical="opportunites" pass the deterministic gate in classify.ts.
    // Re-running contentLooksLikeOpportunity here was rejecting ~85 % of them
    // because Gemini rewrites titles/summaries into news-style French that no
    // longer contains "bourse", "concours", "fellowship", etc.
    if (a.vertical === "opportunites") return true;
    return contentLooksLikeOpportunity(a.title ?? "", a.summary);
  }

  // Items with no parsed deadline that were published a long time ago are
  // almost always expired in practice (annual cycles closed, programmes
  // archived). 60 days is generous enough to keep evergreen guides without
  // surfacing stale "Apply now!" articles from last spring.
  const NO_DEADLINE_FRESHNESS_DAYS = 60;
  const noDeadlineCutoffMs = Date.now() - NO_DEADLINE_FRESHNESS_DAYS * 24 * 60 * 60 * 1000;

  const opportunityPool = allArticles.filter((a) => {
    if (
      !(
        a.vertical === "opportunites" ||
        OPPORTUNITY_CATEGORIES.has(a.category ?? "") ||
        (a.itemType === "utility" && a.series === "ScholarshipRadar")
      )
    ) {
      return false;
    }
    if (!looksLikeOpportunity(a)) return false;
    if (!isOpportunityStillOpen(a.deadline)) return false;
    // Drop "no deadline" items that haven't been seen in 60+ days.
    if (!a.deadline) {
      const publishedAtMs = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      if (publishedAtMs && publishedAtMs < noDeadlineCutoffMs) return false;
    }

    // ── Confidence gate (last line of defence for legacy items) ──
    // The worker now stamps every opportunity item with `opportunityScore`
    // (0-100) computed by scoreOpportunity(). Items below the threshold
    // are demoted at ingest, but legacy items written before this gate
    // still carry vertical=opportunites without a score. Recompute here
    // so they get the same protection without a backfill.
    //
    // Utility/ScholarshipRadar items always pass — they're editorially
    // curated and the score model is tuned for source articles.
    if (a.itemType === "utility" && a.series === "ScholarshipRadar") return true;
    const score =
      typeof a.opportunityScore === "number"
        ? a.opportunityScore
        : scoreOpportunity({
            title: a.title ?? "",
            summary: a.summary,
            body: a.body,
            deadline: a.deadline,
            publisherName: a.sourceName,
          }).score;
    if (score < OPPORTUNITY_SCORE_THRESHOLD) return false;

    return true;
  });

  const articles = rankAndDeduplicate(opportunityPool, {
    // 0.50 (was 0.40) — drops borderline items where the deterministic scorer
    // gave only a small category bonus but no real Haiti/student signal.
    // Combined with the HT/Diaspora geo boost in ranking.ts, this surfaces
    // actually-Haitian-relevant opportunities first while still admitting
    // global scholarships (Fulbright, Erasmus+, DAAD, …) that are open to HT.
    audienceFitThreshold: 0.50,
    publisherCap: 3,
    topN: 40,
  });

  const fr = lang === "fr";
  const utilityCount = articles.filter((article) => article.itemType === "utility").length;
  const deadlineCount = opportunityPool.filter((article) => Boolean(article.deadline)).length;

  return (
    <div className="space-y-8">
      <PageHeroCompact
        tint="amber"
        eyebrow={fr ? "Opportunités" : "Okazyon"}
        title={fr ? "Les opportunités à saisir cette saison." : "Okazyon pou pwofite sezon sa a."}
        description={
          fr
            ? "Un catalogue plus large que les bourses : concours, stages, programmes et appels utiles à filtrer selon votre objectif."
            : "Yon katalòg ki pi laj pase bous yo: konkou, estaj, pwogram ak lòt apèl itil pou filtre selon objektif ou."
        }
        stats={[
          { value: String(articles.length), label: fr ? "opportunités" : "okazyon" },
          { value: String(deadlineCount), label: fr ? "deadlines" : "dat limit" },
        ]}
      />

      {/* ─── Section 2: Catalogue (filters + cards) ─── */}
      <section className="pb-8">
        <Suspense fallback={null}>
          <OpportunitiesFeed articles={articles} lang={lang} />
        </Suspense>
      </section>
    </div>
  );
}
