/**
 * Accueil — multi-section curated homepage.
 *
 * Fetches one pool of enriched articles then applies different filters/ranking
 * per section, so there is only one Firestore read per page load.
 *
 * Sections:
 *  A) À la une                — top 6 scored + publisher-balanced
 *  B) Opportunités à ne pas manquer — scholarship/opportunity with deadline, sorted soonest first
 *  C) Haïti (pour étudiants)  — geoTag=HT or category=local_news
 *  D) Ressources utiles       — category=resource
 *  E) Succès / Inspiration    — category=succes OR keyword inference (placeholder if empty)
 */

import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { fetchEnrichedFeed, isSuccessArticle } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { ArticleCard } from "@/components/ArticleCard";

export const dynamic = "force-dynamic";

// ── Section header helper ─────────────────────────────────────────────────────

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

// ── Reusable section grid ─────────────────────────────────────────────────────

function SectionGrid({
  articles,
  lang,
  showDeadline = false,
}: {
  articles: FeedItem[];
  lang: ContentLanguage;
  showDeadline?: boolean;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

  // ── Fetch one large pool (server-side, one Firestore read) ────────────────
  const allArticles = await fetchEnrichedFeed(lang, 200);

  // ── A) À la une — top 6 high-confidence, publisher-balanced ──────────────
  const alaune = rankAndDeduplicate(allArticles, {
    audienceFitThreshold: 0.80,
    publisherCap: 2,
    topN: 6,
  }).slice(0, 6);

  // ── B) Opportunités — scholarship/opportunity with deadline, soonest first ─
  const opps = allArticles
    .filter(
      (a) =>
        (a.category === "scholarship" || a.category === "opportunity") &&
        Boolean(a.deadline),
    )
    .sort(
      (a, b) =>
        new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime(),
    )
    .slice(0, 6);

  // ── C) Haïti — geoTag=HT or category=local_news ──────────────────────────
  const haitiPool = allArticles.filter(
    (a) => a.geoTag === "HT" || a.category === "local_news",
  );
  const haiti = rankAndDeduplicate(haitiPool, {
    audienceFitThreshold: 0.75,
    publisherCap: 3,
    topN: 6,
  }).slice(0, 6);

  // ── D) Ressources utiles — category=resource ──────────────────────────────
  const resPool = allArticles.filter((a) => a.category === "resource");
  const ressources = rankAndDeduplicate(resPool, {
    audienceFitThreshold: 0.65,
    publisherCap: 3,
    topN: 6,
  }).slice(0, 6);

  // ── E) Succès / Inspiration — category=succes OR keyword inference ─────────
  const succesPool = allArticles.filter(isSuccessArticle);
  const succes = rankAndDeduplicate(succesPool, {
    audienceFitThreshold: 0.65,
    publisherCap: 2,
    topN: 4,
  }).slice(0, 4);

  // ── i18n ─────────────────────────────────────────────────────────────────
  const fr = lang === "fr";
  const lq = (path: string) => path + langQ;

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

      {/* B) Opportunités */}
      {opps.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title={
              fr ? "Opportunités à ne pas manquer" : "Okazyon pou sezi"
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

      {/* D) Ressources */}
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

      {/* E) Succès — placeholder when no keyword-matching articles */}
      <section className="space-y-4">
        <SectionHeader
          title={fr ? "Succès & Inspiration" : "Siksè & Enspirasyon"}
          href={lq("/succes")}
          cta={fr ? "Voir tout →" : "Wè tout →"}
        />
        {succes.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {succes.map((a) => (
              <ArticleCard key={a.id} article={a} lang={lang} />
            ))}
          </div>
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