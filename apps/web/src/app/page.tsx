/**
 * Accueil — Student Control Panel homepage.
 *
 * Layout hierarchy (student tools first, news lower):
 *
 * TIER 1 — Student Tools (structured Firestore data):
 *  DS-C) Calendrier Haïti             — upcoming calendar events (exams/admissions)
 *  DS-A) Bourses — Deadlines proches   — scholarships closing soon
 *  DS-D) Parcours d'études             — study-abroad pathway teasers
 *
 * TIER 2 — Guides & Exploration (curated utility articles):
 *  U2)   Guides & Carrière            — series=Career
 *  U3)   Étudier à l'étranger         — series=StudyAbroad
 *  DS-B) Universités recommandées      — Haitian-friendly universities
 *  U4)   Histoire & Fèt du jour       — series=HaitiHistory | HaitiFactOfTheDay
 *
 * TIER 3 — Actualités (news articles, below the fold):
 *  U1)   Opportunités & Deadlines     — series=ScholarshipRadar or has deadlines
 *  A)    Fil — Actualités             — top non-utility articles
 *  B)    Opportunités à deadline proche — deadline ASC, cap 2, limit 6
 *  C)    Haïti — pour les étudiants   — geoTag=HT or local_news, threshold 0.75
 *  D)    Ressources utiles            — category=resource, threshold 0.70
 *  E)    Succès & Inspiration         — keyword inference, threshold 0.70, limit 4
 *
 * Fetches one pool of enriched articles then applies different filters/ranking
 * per section, so there is only one Firestore read per page load.
 * Also fetches structured datasets (universities, scholarships, calendar, pathways).
 *
 * Cross-section uniqueness: a Set of used content-version IDs and
 * dedupeGroupIds is maintained across sections so the same article
 * never appears twice on the page.
 */

import Link from "next/link";
import { Calendar, BookOpen, GraduationCap, Globe, Landmark, CalendarDays, MapPin, Award, School, Newspaper, Clock } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { fetchEnrichedFeed, isSuccessArticle } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { ArticleCard } from "@/components/ArticleCard";
import {
  fetchHaitianFriendlyUniversities,
  fetchScholarshipsClosingSoon,
  fetchUpcomingCalendarEvents,
  fetchAllPathways,
  COUNTRY_LABELS,
  TUITION_LABELS,
} from "@/lib/datasets";
import type { University, Scholarship, HaitiCalendarEvent, Pathway } from "@edlight-news/types";

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
  icon,
}: {
  title: string;
  href: string;
  cta: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        {icon}{title}
      </h2>
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
  const [allArticles, htFriendlyUnis, closingScholarships, upcomingEvents, allPathways] =
    await Promise.all([
      fetchEnrichedFeed(lang, 300),
      fetchHaitianFriendlyUniversities(),
      fetchScholarshipsClosingSoon(60),
      fetchUpcomingCalendarEvents(),
      fetchAllPathways(),
    ]);

  // Global pre-filter: drop off-mission
  const pool = allArticles.filter((a) => !a.offMission);

  // Cross-section uniqueness tracker
  const claimer = createSectionClaimer();

  // ── U1) Opportunités & Deadlines — ScholarshipRadar or has deadlines ────
  const utilityOppsPool = claimer
    .unclaimed(pool)
    .filter(
      (a) =>
        (a.itemType === "utility" && a.series === "ScholarshipRadar") ||
        (a.itemType === "utility" &&
          a.utilityType === "scholarship") ||
        (a.deadline && (a.category === "scholarship" || a.category === "bourses")),
    );
  const utilityOppsDeduped = rankAndDeduplicate(utilityOppsPool, {
    audienceFitThreshold: 0,
    publisherCap: 6,
    topN: 6,
  });
  utilityOppsDeduped.sort((a, b) => {
    const dA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const dB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    if (dA !== dB) return dA - dB;
    return (b.audienceFitScore ?? 0) - (a.audienceFitScore ?? 0);
  });
  const utilityOpps = claimer.claim(utilityOppsDeduped.slice(0, 6));

  // ── U2) Guides & Carrière — series=Career ────────────────────────────────
  const utilityCareerPool = claimer
    .unclaimed(pool)
    .filter(
      (a) =>
        a.itemType === "utility" && a.series === "Career",
    );
  const utilityCareerRanked = rankAndDeduplicate(utilityCareerPool, {
    audienceFitThreshold: 0,
    publisherCap: 6,
    topN: 6,
  }).slice(0, 6);
  const utilityCareer = claimer.claim(utilityCareerRanked);

  // ── U3) Étudier à l'étranger — series=StudyAbroad ────────────────────────
  const utilityStudyPool = claimer
    .unclaimed(pool)
    .filter(
      (a) =>
        a.itemType === "utility" && a.series === "StudyAbroad",
    );
  const utilityStudyRanked = rankAndDeduplicate(utilityStudyPool, {
    audienceFitThreshold: 0,
    publisherCap: 6,
    topN: 6,
  }).slice(0, 6);
  const utilityStudy = claimer.claim(utilityStudyRanked);

  // ── U4) Histoire & Fèt du jour — HaitiHistory | HaitiFactOfTheDay ────────
  const utilityHistPool = claimer
    .unclaimed(pool)
    .filter(
      (a) =>
        a.itemType === "utility" &&
        (a.series === "HaitiHistory" ||
          a.series === "HaitiFactOfTheDay" ||
          a.series === "HaitianOfTheWeek"),
    );
  const utilityHistRanked = rankAndDeduplicate(utilityHistPool, {
    audienceFitThreshold: 0,
    publisherCap: 6,
    topN: 6,
  }).slice(0, 6);
  const utilityHist = claimer.claim(utilityHistRanked);

  // ── A) À la une — top 6, threshold 0.80, publisher cap 2 ─────────────────
  const alauneRanked = rankAndDeduplicate(claimer.unclaimed(pool), {
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
      {/* ── HERO — Student Control Panel ─────────────────────────────────── */}
      <section className="space-y-3 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">
          {fr
            ? "Ton tableau de bord étudiant"
            : "Tablo bò ou kòm elèv"}
        </h1>
        <p className="mx-auto max-w-xl text-lg text-gray-600">
          {fr
            ? "Calendrier, bourses, parcours et guides — tout ce dont tu as besoin pour réussir."
            : "Kalandriye, bous, pakou ak gid — tout sa ou bezwen pou reyisi."}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={lq("/bourses")}
            className="inline-flex items-center rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700"
          >
            <GraduationCap className="mr-1.5 inline h-4 w-4" />{fr ? "Bourses ouvertes" : "Bous ouvè"}
          </Link>
          <Link
            href={lq("/calendrier-haiti")}
            className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <CalendarDays className="mr-1.5 inline h-4 w-4" />{fr ? "Calendrier" : "Kalandriye"}
          </Link>
          <Link
            href={lq("/parcours")}
            className="inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <MapPin className="mr-1.5 inline h-4 w-4" />{fr ? "Parcours" : "Pakou"}
          </Link>
          <Link
            href={lq("/news")}
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            <Newspaper className="mr-1.5 inline h-4 w-4" />{fr ? "Nouvelles" : "Nouvèl"}
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
       *  TIER 1 — Student Tools (structured data from Firestore)
       * ═══════════════════════════════════════════════════════════════════ */}

      {/* 1) DS-C — Calendrier Haïti — Examens & Admissions */}
      {upcomingEvents.length > 0 && (
        <section className="space-y-4 rounded-xl border-2 border-blue-200 bg-blue-50/30 p-5">
          <SectionHeader
            icon={<CalendarDays className="h-5 w-5 text-blue-600" />}
            title={fr ? "Calendrier Haïti — Examens & Admissions" : "Kalandriye Ayiti — Egzamen & Admisyon"}
            href={lq("/calendrier-haiti")}
            cta={fr ? "Calendrier complet →" : "Kalandriye konplè →"}
          />
          <div className="divide-y divide-blue-100">
            {upcomingEvents.slice(0, 5).map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                  {new Date(ev.dateISO + "T00:00:00").toLocaleDateString(
                    fr ? "fr-FR" : "fr-HT",
                    { day: "numeric", month: "short" },
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{ev.title}</p>
                  {ev.notes && (
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">
                      {ev.notes}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                  {ev.eventType}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2) DS-A — Bourses — Deadlines proches */}
      {closingScholarships.length > 0 && (
        <section className="space-y-4 rounded-xl border-2 border-amber-200 bg-amber-50/40 p-5">
          <SectionHeader
            icon={<Award className="h-5 w-5 text-amber-600" />}
            title={fr ? "Bourses — Deadlines proches" : "Bous — Dat limit ki pre"}
            href={lq("/bourses")}
            cta={fr ? "Toutes les bourses →" : "Tout bous yo →"}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {closingScholarships.slice(0, 6).map((s) => {
              const dl = s.deadline;
              return (
                <div key={s.id} className="rounded-lg border bg-white p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-900 line-clamp-1">{s.name}</h3>
                  {s.eligibilitySummary && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                      {s.eligibilitySummary}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {dl?.dateISO && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                        <Clock className="h-3 w-3" /> {new Date(dl.dateISO + "T00:00:00").toLocaleDateString(
                          fr ? "fr-FR" : "fr-HT",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                      </span>
                    )}
                    <span className="text-gray-500">
                      {COUNTRY_LABELS[s.country]?.flag} {fr ? COUNTRY_LABELS[s.country]?.fr : COUNTRY_LABELS[s.country]?.ht}
                    </span>
                  </div>
                  {s.howToApplyUrl && (
                    <a href={s.howToApplyUrl} target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline">
                      {fr ? "Postuler →" : "Aplike →"}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3) DS-D — Parcours d'études */}
      {allPathways.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            icon={<MapPin className="h-5 w-5 text-brand-600" />}
            title={fr ? "Parcours d'études" : "Pakou etid"}
            href={lq("/parcours")}
            cta={fr ? "Tous les parcours →" : "Tout pakou yo →"}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {allPathways.slice(0, 4).map((pw) => (
              <Link
                key={pw.id}
                href={lq("/parcours")}
                className="group rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md hover:border-brand-300"
              >
                <div className="flex items-center gap-2">
                  {pw.country && COUNTRY_LABELS[pw.country]?.flag
                    ? <span className="text-2xl">{COUNTRY_LABELS[pw.country].flag}</span>
                    : <Globe className="h-6 w-6 text-brand-600" />}
                  <h3 className="font-semibold text-gray-900 text-sm group-hover:text-brand-700">
                    {fr ? pw.title_fr : (pw.title_ht ?? pw.title_fr)}
                  </h3>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {pw.steps.length} {fr ? "étapes" : "etap"}{pw.country ? ` · ${fr ? COUNTRY_LABELS[pw.country]?.fr : COUNTRY_LABELS[pw.country]?.ht}` : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       *  TIER 2 — Guides & Exploration (curated utility articles)
       * ═══════════════════════════════════════════════════════════════════ */}

      {/* 4) U2 — Guides & Carrière */}
      {utilityCareer.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            icon={<BookOpen className="h-5 w-5 text-brand-600" />}
            title={fr ? "Guides & Carrière" : "Gid & Karyè"}
            href={lq("/ressources")}
            cta={fr ? "Voir tout →" : "Wè tout →"}
          />
          <SectionGrid articles={utilityCareer} lang={lang} />
        </section>
      )}

      {/* 5) U3 — Étudier à l'étranger */}
      {utilityStudy.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            icon={<Globe className="h-5 w-5 text-brand-600" />}
            title={fr ? "Étudier à l'étranger" : "Etidye aletranje"}
            href={lq("/ressources")}
            cta={fr ? "Voir tout →" : "Wè tout →"}
          />
          <SectionGrid articles={utilityStudy} lang={lang} />
        </section>
      )}

      {/* 6) DS-B — Universités recommandées */}
      {htFriendlyUnis.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            icon={<School className="h-5 w-5 text-brand-600" />}
            title={fr ? "Universités recommandées" : "Inivèsite rekòmande"}
            href={lq("/universites")}
            cta={fr ? "Toutes les universités →" : "Tout inivèsite yo →"}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {htFriendlyUnis.slice(0, 8).map((u) => (
              <div key={u.id} className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{u.name}</h3>
                  <span className="shrink-0 ml-1 text-lg">{COUNTRY_LABELS[u.country]?.flag}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {u.haitianFriendly && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800">
                      HT · {fr ? "Accueil haïtien" : "Akèy ayisyen"}
                    </span>
                  )}
                  {u.tuitionBand && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                      {fr ? TUITION_LABELS[u.tuitionBand]?.fr : TUITION_LABELS[u.tuitionBand]?.ht}
                    </span>
                  )}
                </div>
                {u.admissionsUrl && (
                  <a href={u.admissionsUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline">
                    {fr ? "Voir le site →" : "Wè sit la →"}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7) U4 — Histoire & Fèt du jour */}
      {utilityHist.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            icon={<Landmark className="h-5 w-5 text-brand-600" />}
            title={fr ? "Histoire & Fèt du jour" : "Istwa & Fèt du jou"}
            href={lq("/haiti")}
            cta={fr ? "Voir tout →" : "Wè tout →"}
          />
          <SectionGrid articles={utilityHist} lang={lang} />
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       *  TIER 3 — Actualités (news articles — below the fold)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-gray-200 pt-10">
        <h2 className="mb-8 flex items-center gap-2 text-center text-2xl font-bold text-gray-700">
          <span className="mx-auto flex items-center gap-2">
            <Newspaper className="h-5 w-5" /> {fr ? "Actualités" : "Nouvèl"}
          </span>
        </h2>

        <div className="space-y-14">
          {/* U1 — Opportunités & Deadlines articles */}
          {utilityOpps.length > 0 && (
            <section className="space-y-4">
              <SectionHeader
                icon={<Calendar className="h-5 w-5 text-brand-600" />}
                title={fr ? "Opportunités & Deadlines" : "Okazyon & Dat Limit"}
                href={lq("/opportunites")}
                cta={fr ? "Voir tout →" : "Wè tout →"}
              />
              <SectionGrid articles={utilityOpps} lang={lang} showDeadline />
            </section>
          )}

          {/* A — À la une */}
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

          {/* B — Opportunités à deadline proche */}
          {opps.length > 0 && (
            <section className="space-y-4">
              <SectionHeader
                title={fr ? "Opportunités à deadline proche" : "Okazyon ak dat limit"}
                href={lq("/opportunites")}
                cta={fr ? "Voir tout →" : "Wè tout →"}
              />
              <SectionGrid articles={opps} lang={lang} showDeadline />
            </section>
          )}

          {/* C — Haïti */}
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

          {/* D — Ressources utiles */}
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

          {/* E — Succès & Inspiration */}
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
      </div>
    </div>
  );
}