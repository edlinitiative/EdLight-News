/**
 * Accueil — multi-section curated homepage.
 *
 * Fetches one pool of enriched articles then applies different filters/ranking
 * per section, so there is only one Firestore read per page load.
 *
 * Cross-section uniqueness: a Set of used content-version IDs and
 * dedupeGroupIds is maintained across sections so the same article
 * never appears twice on the page. Priority: À la une → Opportunités →
 * Haïti → Ressources → Succès.
 *
 * Sections:
 *  A) À la une                      — top 6, threshold 0.80, cap 2
 *  B) Opportunités à deadline proche — deadline ASC, cap 2, limit 6
 *  C) Haïti — pour les étudiants    — geoTag=HT or local_news, threshold 0.75
 *  D) Ressources utiles             — category=resource, threshold 0.70
 *  E) Succès & Inspiration          — keyword inference, threshold 0.70, limit 4
 */

import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { fetchEnrichedFeed, isSuccessArticle } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { ArticleCard } from "@/components/ArticleCard";

export const dynamic = "force-dynamic";

// ── Cross-section dedup helper ────────────────────────────────────────────────

/**
 * Maintain a set of used IDs + dedupeGroupIds.
 * `claim(articles)` marks them used and returns the subset that was new.
 */
function createSectionClaimer() {
  const usedIds = new Set<string>();
  const usedGroups = new Set<string>();

  return {
    /** Filter out already-used items, then mark the rest as claimed. */
    claim(articles: FeedItem[]): FeedItem[] {
      const fresh: FeedItem[] = [];
      for (const a of articles) {
        const cvId = a.id;
        const group = a.dedupeGroupId;

        // Skip if this exact CV or its dedup group was already used
        if (usedIds.has(cvId)) continue;
        if (group && usedGroups.has(group)) continue;

        fresh.push(a);
        usedIds.add(cvId);
        if (a.itemId) usedIds.add(a.itemId);
        if (group) usedGroups.add(group);
      }
      return fresh;
    },

    /** Pre-filter a pool to only unclaimed articles (before ranking). */
    unclaimed(articles: FeedItem[]): FeedItem[] {
      return articles.filter((a) => {
        if (usedIds.has(a.id)) return false;
        if (a.dedupeGroupId && usedGroups.has(a.dedupeGroupId)) return false;
        return true;
      });
    },
  };
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  href,
  cta,
}: {
  title: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold">{title}</h2>
      <Link
        href={href}
        className="text-sm font-medium text-brand-700 hover:underline"
      >
        {cta}
      </Link>
    </div>
  );
}

// ── Section grid ──────────────────────────────────────────────────────────────

function SectionGrid({
  articles,
  lang,
  showDeadline = false,
  cols = 3,
}: {
  articles: FeedItem[];
  lang: ContentLanguage;
  showDeadline?: boolean;
  cols?: 3 | 4;
}) {
  const colsClass =
    cols === 4
      ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
      : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div className={colsClass}>
      {articles.map((a) => (
        <ArticleCard
          key={a.id}
          article={a}
          lang={lang}
          showDeadline={showDeadline}
        />
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AccueilPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";
  const langQ = lang === "ht" ? "?lang=ht" : "";
  const lq = (path: string) => path + langQ;
  const fr = lang === "fr";

  // ── Fetch one large pool (server-side, one Firestore read) ────────────────
  const allArticles = await fetchEnrichedFeed(lang, 300);

  // Global pre-filter: drop off-mission
  const pool = allArticles.filter((a) => !a.offMission);

  // Cross-section uniqueness tracker
  const claimer = createSectionClaimer();

  // ── A) À la une — top 6, threshold 0.80, publisher cap 2 ─────────────────
  const alauneRanked = rankAndDeduplicate(pool, {
    audienceFitThreshold: 0.80,
    publisherCap: 2,
    topN: 6,
  }).slice(0, 6);
  const alaune = claimer.claim(alauneRanked);

  // ── B) Opportunités à deadline proche ─────────────────────────────────────
  //   scholarship/opportunity with valid deadline → sort soonest first → cap 2
  const oppsPool = claimer
    .unclaimed(pool)
    .filter(
      (a) =>
        (a.category === "scholarship" || a.category === "opportunity") &&
        Boolean(a.deadline),
    );

  // Dedupe within section, then sort by deadline ASC, publisher-cap 2
  const oppsDeduped = rankAndDeduplicate(oppsPool, {
    audienceFitThreshold: 0,
    publisherCap: 2,
    topN: 20,
  });

  // Re-sort by deadline ascending (rankAndDeduplicate sorts by score)
  oppsDeduped.sort((a, b) => {
    const dA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const dB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    if (dA !== dB) return dA - dB;
    return (b.audienceFitScore ?? 0) - (a.audienceFitScore ?? 0);
  });
  const opps = claimer.claim(oppsDeduped.slice(0, 6));

  // ── C) Haïti — geoTag=HT or category=local_news, threshold 0.75 ──────────
  const haitiPool = claimer
    .unclaimed(pool)
    .filter((a) => a.geoTag === "HT" || a.category === "local_news");
  const haitiRanked = rankAndDeduplicate(haitiPool, {
    audienceFitThreshold: 0.75,
    publisherCap: 2,
    topN: 6,
  }).slice(0, 6);
  const haiti = claimer.claim(haitiRanked);

  // ── D) Ressources utiles — category=resource, threshold 0.70 ──────────────
  const resPool = claimer
    .unclaimed(pool)
    .filter((a) => a.category === "resource");
  const resRanked = rankAndDeduplicate(resPool, {
    audienceFitThreshold: 0.70,
    publisherCap: 2,
    topN: 6,
  }).slice(0, 6);
  const ressources = claimer.claim(resRanked);

  // ── E) Succès & Inspiration — keyword inference, threshold 0.70, limit 4 ──
  const succesPool = claimer.unclaimed(pool).filter(isSuccessArticle);
  const succesRanked = rankAndDeduplicate(succesPool, {
    audienceFitThreshold: 0.70,
    publisherCap: 2,
    topN: 4,
  }).slice(0, 4);
  const succes = claimer.claim(succesRanked);

  return (
    <div className="space-y-14">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">
          {fr
            ? "Actualités éducatives pour les étudiants haïtiens"
            : "Nouvèl edikasyon pou elèv ayisyen yo"}
        </h1>
        <p className="mx-auto max-w-xl text-lg text-gray-600">
          {fr
            ? "Bourses, opportunités, et nouvelles d'Haïti — en français et en créole."
            : "Bous, opòtinite, ak nouvèl Ayiti — an fransè ak kreyòl."}
        </p>
        <Link
          href={lq("/news")}
          className="inline-block rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition hover:bg-brand-700"
        >
          {fr ? "Voir toutes les nouvelles →" : "Wè tout nouvèl yo →"}
        </Link>
      </section>

      {/* A) À la une */}
      {alaune.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title={fr ? "À la une" : "Aktyalite"}
            href={lq("/news")}
            cta={fr ? "Voir tout →" : "Wè tout →"}
          />
          <SectionGrid articles={alaune} lang={lang} />
        </section>
      )}

      {/* B) Opportunités à deadline proche */}
      {opps.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title={
              fr ? "Opportunités à deadline proche" : "Okazyon ak dat limit"
            }
            href={lq("/opportunites")}
            cta={fr ? "Voir tout →" : "Wè tout →"}
          />
          <SectionGrid articles={opps} lang={lang} showDeadline />
        </section>
      )}

      {/* C) Haïti */}
      {haiti.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title={fr ? "Haïti — pour les étudiants" : "Ayiti — pou elèv"}
            href={lq("/haiti")}
            cta={fr ? "Voir tout →" : "Wè tout →"}
          />
          <SectionGrid articles={haiti} lang={lang} />
        </section>
      )}

      {/* D) Ressources utiles */}
      {ressources.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title={fr ? "Ressources utiles" : "Resous itil"}
            href={lq("/ressources")}
            cta={fr ? "Voir tout →" : "Wè tout →"}
          />
          <SectionGrid articles={ressources} lang={lang} />
        </section>
      )}

      {/* E) Succès & Inspiration — placeholder if empty */}
      <section className="space-y-4">
        <SectionHeader
          title={fr ? "Succès & Inspiration" : "Siksè & Enspirasyon"}
          href={lq("/succes")}
          cta={fr ? "Voir tout →" : "Wè tout →"}
        />
        {succes.length > 0 ? (
          <SectionGrid articles={succes} lang={lang} cols={4} />
        ) : (
          <div className="rounded-lg border-2 border-dashed border-gray-200 py-12 text-center text-gray-400">
            <p className="text-base">
              {fr ? "Bientôt — revenez vite !" : "Byento — tounen vit !"}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}