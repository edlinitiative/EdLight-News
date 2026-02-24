/**
 * Accueil — Student-first homepage.
 *
 * Section order (utility-first, news last):
 *
 *  S1) Calendrier — Prochaines échéances
 *      Combined: next 3 Haiti calendar events + next 3 scholarship deadlines
 *      Badges: HT / International
 *
 *  S2) Bourses — Date limite bientôt
 *      Scholarships closing within 30 days (limit 6)
 *
 *  S3) Parcours recommandés
 *      3 pathway cards
 *
 *  S4) Étudier à l'étranger
 *      6 universities (rotating by country)
 *
 *  S5) Fil — Actualité générale
 *      Existing news feed (limit 8), only below the fold
 *
 *  S_succes) Succès & Inspiration
 *      Strict gating: successTag==true OR HaitianOfTheWeek utility items
 *      No generic news leakage. Clean empty-state.
 *
 * Single Firestore read for articles, parallel reads for datasets.
 * Cross-section dedup ensures no article appears twice.
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarDays,
  GraduationCap,
  Globe,
  Award,
  School,
  Clock,
  Compass,
  Newspaper,
  DollarSign,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { fetchEnrichedFeed, isSuccessArticle, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { ArticleCard } from "@/components/ArticleCard";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import {
  parseISODateSafe,
  daysUntil,
  getNextRelevantDate,
} from "@/lib/deadlines";
import {
  fetchAllUniversities,
  fetchScholarshipsClosingSoon,
  fetchUpcomingCalendarEvents,
  fetchAllPathways,
  COUNTRY_LABELS,
  TUITION_LABELS,
} from "@/lib/datasets";
import { getCalendarGeo } from "@/lib/calendarGeo";
import { DashboardTabs } from "@/components/DashboardTabs";
import { GeminiHeroImage } from "@/components/GeminiHeroImage";

export const revalidate = 300; // ISR: regenerate every 5 minutes

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  return {
    title: fr
      ? "EdLight News — Actualités éducatives pour étudiants haïtiens"
      : "EdLight News — Nouvèl edikasyon pou elèv ayisyen yo",
    description: fr
      ? "Bourses, calendrier, ressources et actualités pour les étudiants haïtiens."
      : "Bous, kalandriye, resous ak nouvèl pou elèv ayisyen yo.",
  };
}

// ── Cross-section dedup helper ────────────────────────────────────────────────

function createSectionClaimer() {
  const usedIds = new Set<string>();
  const usedGroups = new Set<string>();

  return {
    claim(articles: FeedItem[]): FeedItem[] {
      const fresh: FeedItem[] = [];
      for (const a of articles) {
        const cvId = a.id;
        const group = a.dedupeGroupId;
        if (usedIds.has(cvId)) continue;
        if (group && usedGroups.has(group)) continue;
        fresh.push(a);
        usedIds.add(cvId);
        if (a.itemId) usedIds.add(a.itemId);
        if (group) usedGroups.add(group);
      }
      return fresh;
    },

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
      <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
        {icon}{title}
      </h2>
      <Link
        href={href}
        className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
      >
        {cta}
      </Link>
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

  // ── Fetch data in parallel (resilient — individual failures produce empty arrays) ──
  const safeFetch = async <T,>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      console.error(`[EdLight] ${label} fetch failed:`, err);
      return fallback;
    }
  };

  const [
    allArticles,
    upcomingEvents,
    closingScholarships30,
    closingScholarships45,
    allPathways,
    allUniversities,
  ] = await Promise.all([
    safeFetch(() => fetchEnrichedFeed(lang, 300), [], "enrichedFeed"),
    safeFetch(fetchUpcomingCalendarEvents, [], "upcomingEvents"),
    safeFetch(() => fetchScholarshipsClosingSoon(30), [], "scholarships30"),
    safeFetch(() => fetchScholarshipsClosingSoon(45), [], "scholarships45"),
    safeFetch(fetchAllPathways, [], "pathways"),
    safeFetch(fetchAllUniversities, [], "universities"),
  ]);

  // Pre-filter: drop off-mission articles
  const pool = allArticles.filter((a) => !a.offMission);
  const claimer = createSectionClaimer();

  // ── S1 data: Combined calendar (Haiti events + International scholarship deadlines)
  const haitiEvents = upcomingEvents.slice(0, 3);
  const intlScholarships = closingScholarships45.slice(0, 3);

  // ── S2 data: Scholarships closing within 30 days
  const boursesClosing = closingScholarships30.slice(0, 6);

  // ── S3 data: Pathways (first 3)
  const pathways = allPathways.slice(0, 3);

  // ── S4 data: Universities — round-robin by country, pick 6
  const unisByCountry = new Map<string, typeof allUniversities>();
  for (const u of allUniversities) {
    if (!unisByCountry.has(u.country)) unisByCountry.set(u.country, []);
    unisByCountry.get(u.country)!.push(u);
  }
  const rotatedUnis: typeof allUniversities = [];
  const countries = [...unisByCountry.keys()];
  let ci = 0;
  while (rotatedUnis.length < 6 && ci < countries.length * 10) {
    const country = countries[ci % countries.length]!;
    const list = unisByCountry.get(country)!;
    const picked = list.shift();
    if (picked) rotatedUnis.push(picked);
    ci++;
  }

  // ── S_succes data: Succès & Inspiration (strict gating, no fallback)
  const succesPool = allArticles.filter(isSuccessArticle);
  const succesArticles = rankAndDeduplicate(succesPool, {
    audienceFitThreshold: 0.5,
    publisherCap: 2,
    topN: 6,
  }).slice(0, 6);

  // ── S5 data: News feed (top 8, deduped)
  const newsRanked = rankAndDeduplicate(claimer.unclaimed(pool), {
    audienceFitThreshold: 0.65,
    publisherCap: 2,
    topN: 8,
  }).slice(0, 8);
  const newsArticles = claimer.claim(newsRanked);

  // ── Urgency data: "À ne pas rater cette semaine" ─────────────────────────
  type UrgencyItem = {
    id: string;
    kind: "bourse" | "calendrier";
    title: string;
    dateISO: string;
    days: number;
    href: string;
  };

  const urgencyItems: UrgencyItem[] = [];

  // Scholarships within 30 days
  for (const s of closingScholarships30.slice(0, 5)) {
    const d = parseISODateSafe(s.deadline?.dateISO);
    if (!d) continue;
    const days = daysUntil(d);
    if (days < 0 || days > 30) continue;
    urgencyItems.push({
      id: s.id,
      kind: "bourse",
      title: s.name,
      dateISO: s.deadline!.dateISO!,
      days,
      href: lq("/bourses"),
    });
  }

  // Calendar events within 14 days
  for (const ev of upcomingEvents.slice(0, 5)) {
    const d = getNextRelevantDate(ev);
    if (!d) continue;
    const days = daysUntil(d);
    if (days < 0 || days > 14) continue;
    const iso = ev.dateISO ?? ev.startDateISO ?? "";
    urgencyItems.push({
      id: ev.id,
      kind: "calendrier",
      title: ev.title,
      dateISO: iso,
      days,
      href: lq("/calendrier"),
    });
  }

  // Sort by soonest, take top 6
  urgencyItems.sort((a, b) => a.days - b.days);
  const topUrgent = urgencyItems.slice(0, 6);

  // ── S5 data: Latest HaitiHistory utility post ──────────────────────────────
  const latestHistoryPost = allArticles.find(
    (a) =>
      a.itemType === "utility" &&
      a.series === "HaitiHistory" &&
      a.status === "published",
  ) ?? null;

  // ── Dashboard tab panels (server-rendered, passed to client component) ───

  const boursesPanel = (
    <div className="space-y-5">
      <GeminiHeroImage
        prompt="Diverse students celebrating scholarship awards on a modern university campus"
        className="h-44 w-full"
      />
      {boursesClosing.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {boursesClosing.length} {fr ? "bourses avec date limite imminente" : "bous ak dat limit ki pre"}
            </p>
            <Link href={lq("/bourses")} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
              {fr ? "Toutes les bourses →" : "Tout bous yo →"}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boursesClosing.map((s) => {
              const dl = s.deadline;
              return (
                <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-card-dark dark:hover:border-brand-600/40 dark:hover:shadow-card-dark-hover">
                  <h3 className="font-semibold text-gray-900 line-clamp-1 dark:text-slate-100">{s.name}</h3>
                  {s.eligibilitySummary && (
                    <p className="mt-1.5 text-sm text-gray-500 line-clamp-2 dark:text-slate-400">{s.eligibilitySummary}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {dl?.dateISO && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                        <Clock className="h-3 w-3" /> {new Date(dl.dateISO + "T00:00:00").toLocaleDateString(fr ? "fr-FR" : "fr-HT", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                    <span className="text-gray-500 dark:text-slate-400">
                      {COUNTRY_LABELS[s.country]?.flag} {fr ? COUNTRY_LABELS[s.country]?.fr : COUNTRY_LABELS[s.country]?.ht}
                    </span>
                  </div>
                  {s.howToApplyUrl && (
                    <a href={s.howToApplyUrl} target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
                      {fr ? "Postuler →" : "Aplike →"}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="py-12 text-center text-gray-400 dark:text-slate-500">
          <DollarSign className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p>{fr ? "Aucune bourse avec date limite imminente." : "Pa gen bous ak dat limit ki pre."}</p>
        </div>
      )}
    </div>
  );

  const calendrierPanel = (
    <div className="space-y-5">
      <GeminiHeroImage
        prompt="Academic calendar planning workspace with laptop on organized desk at university"
        className="h-44 w-full"
      />
      {(haitiEvents.length > 0 || intlScholarships.length > 0) ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {fr ? "Prochaines échéances" : "Pwochen dat limit"}
            </p>
            <Link href={lq("/calendrier")} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
              {fr ? "Voir tout le calendrier →" : "Wè tout kalandriye a →"}
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {haitiEvents.map((ev) => {
              const dateObj = ev.dateISO ? new Date(ev.dateISO + "T00:00:00") : null;
              const evGeo = getCalendarGeo(ev);
              return (
                <div key={ev.id} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-600 text-white dark:bg-brand-500">
                    {dateObj ? (
                      <>
                        <span className="text-sm font-bold leading-tight">{dateObj.getDate()}</span>
                        <span className="text-[9px] uppercase leading-tight">
                          {dateObj.toLocaleDateString(fr ? "fr-FR" : "fr-HT", { month: "short" })}
                        </span>
                      </>
                    ) : (
                      <CalendarDays className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {evGeo === "Haiti" ? (
                        <span className="shrink-0 rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">Haïti</span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <Globe className="h-3 w-3" /> International
                        </span>
                      )}
                      <p className="font-medium text-gray-900 line-clamp-1 dark:text-slate-100">{ev.title}</p>
                    </div>
                    {ev.institution && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{ev.institution}</p>
                    )}
                  </div>
                </div>
              );
            })}
            {intlScholarships.map((s) => {
              const dl = s.deadline;
              const dateObj = dl?.dateISO ? new Date(dl.dateISO + "T00:00:00") : null;
              const sGeo = getCalendarGeo(s);
              return (
                <div key={s.id} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800/80">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-500 text-white dark:bg-brand-600">
                    {dateObj ? (
                      <>
                        <span className="text-sm font-bold leading-tight">{dateObj.getDate()}</span>
                        <span className="text-[9px] uppercase leading-tight">
                          {dateObj.toLocaleDateString(fr ? "fr-FR" : "fr-HT", { month: "short" })}
                        </span>
                      </>
                    ) : (
                      <Clock className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {sGeo === "Haiti" ? (
                        <span className="shrink-0 rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">Haïti</span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <Globe className="h-3 w-3" /> International
                        </span>
                      )}
                      <p className="font-medium text-gray-900 line-clamp-1 dark:text-slate-100">{s.name}</p>
                    </div>
                    {dl?.dateISO && (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                        {fr ? "Date limite: " : "Dat limit: "}
                        {dateObj?.toLocaleDateString(fr ? "fr-FR" : "fr-HT", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="py-12 text-center text-gray-400 dark:text-slate-500">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p>{fr ? "Aucun événement à venir." : "Pa gen evènman ki ap vini."}</p>
        </div>
      )}
    </div>
  );

  const parcoursPanel = pathways.length > 0 ? (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {pathways.length} {fr ? "parcours disponibles" : "pakou disponib"}
        </p>
        <Link href={lq("/parcours")} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
          {fr ? "Tous les parcours →" : "Tout pakou yo →"}
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {pathways.map((pw) => (
          <Link key={pw.id} href={lq("/parcours")}
            className="group rounded-xl border border-gray-200 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-card-dark dark:hover:border-brand-600/40 dark:hover:shadow-card-dark-hover">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
              <h3 className="font-semibold text-gray-900 text-sm group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
                {fr ? pw.title_fr : (pw.title_ht ?? pw.title_fr)}
              </h3>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              {pw.steps.length} {fr ? "étapes" : "etap"}
              {pw.country ? ` · ${fr ? COUNTRY_LABELS[pw.country]?.fr : COUNTRY_LABELS[pw.country]?.ht}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </div>
  ) : (
    <div className="py-12 text-center text-gray-400 dark:text-slate-500">
      <Compass className="mx-auto mb-3 h-8 w-8 opacity-30" />
      <p>{fr ? "Aucun parcours disponible." : "Pa gen pakou disponib."}</p>
    </div>
  );

  const histoirePanel = latestHistoryPost ? (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {fr ? "Dernière publication" : "Dènye piblikasyon"}
        </p>
        <Link href={lq("/histoire")} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
          {fr ? "Voir tout →" : "Wè tout →"}
        </Link>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-card dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-card-dark">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{latestHistoryPost.title}</h3>
        <p className="mt-2 text-sm text-gray-500 line-clamp-4 dark:text-slate-400">
          {latestHistoryPost.summary || latestHistoryPost.body?.slice(0, 300) || ""}
        </p>
        <Link href={`/news/${latestHistoryPost.id}${langQ}`}
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
          {fr ? "Lire l'article complet →" : "Li atik la an antye →"}
        </Link>
      </div>
    </div>
  ) : (
    <div className="py-12 text-center text-gray-400 dark:text-slate-500">
      <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-30" />
      <p>{fr ? "Aucune histoire publiée récemment." : "Pa gen istwa pibliye dènyèman."}</p>
    </div>
  );

  const nouvellesPanel = succesArticles.length > 0 ? (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {fr ? "Dernières nouvelles & inspirations" : "Dènye nouvèl & enspirasyon"}
        </p>
        <Link href={lq("/succes")} className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
          {fr ? "Voir tout →" : "Wè tout →"}
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {succesArticles.map((a) => (
          <ArticleCard key={a.id} article={a} lang={lang} compact />
        ))}
      </div>
    </div>
  ) : (
    <div className="py-12 text-center text-gray-400 dark:text-slate-500">
      <Newspaper className="mx-auto mb-3 h-8 w-8 opacity-30" />
      <p>{fr ? "Aucune nouvelle pour le moment." : "Pa gen nouvèl pou kounye a."}</p>
    </div>
  );

  return (
    <div className="space-y-14">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="space-y-5 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
          {fr
            ? "Ton tableau de bord étudiant"
            : "Tablo bò ou kòm elèv"}
        </h1>
        <p className="mx-auto max-w-xl text-lg text-gray-500 dark:text-slate-400">
          {fr
            ? "Calendrier, bourses, parcours et guides — tout ce dont tu as besoin pour réussir."
            : "Kalandriye, bous, pakou ak gid — tout sa ou bezwen pou reyisi."}
        </p>
      </section>

      {/* ── DASHBOARD TABS ──────────────────────────────────────────────── */}
      <DashboardTabs
        lang={lang}
        panels={{
          bourses: boursesPanel,
          calendrier: calendrierPanel,
          parcours: parcoursPanel,
          histoire: histoirePanel,
          nouvelles: nouvellesPanel,
        }}
      />

      {/* ═══════════════════════════════════════════════════════════════════
       *  URGENCY — À ne pas rater cette semaine
       * ═══════════════════════════════════════════════════════════════════ */}
      {topUrgent.length > 0 && (
        <section className="premium-section space-y-4 border-red-200 bg-red-50/30 dark:border-red-800/40 dark:bg-red-950/20">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold text-red-800 dark:text-red-300">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              {fr ? "À ne pas rater cette semaine" : "Sa pou pa rate semèn sa"}
            </h2>
            <Link
              href={lq("/closing-soon")}
              className="text-sm font-medium text-red-700 transition-colors hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              {fr ? "Voir tout →" : "Wè tout →"}
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {topUrgent.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center gap-3 rounded-xl border border-red-100 bg-white p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md dark:border-red-900/40 dark:bg-slate-800/80 dark:hover:border-red-600/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm dark:bg-brand-900/30">
                  {item.kind === "bourse" ? (
                    <DollarSign className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  ) : (
                    <CalendarDays className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1 dark:text-slate-100">
                    {item.title}
                  </p>
                </div>
                <DeadlineBadge
                  dateISO={item.dateISO}
                  windowDays={item.kind === "bourse" ? 30 : 14}
                  lang={lang}
                  prefix={
                    item.kind === "bourse"
                      ? undefined
                      : { fr: "Événement", ht: "Evènman" }
                  }
                  variant="compact"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       *  S4 — Étudier à l'étranger (universities)
       * ═══════════════════════════════════════════════════════════════════ */}
      {rotatedUnis.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            icon={<GraduationCap className="h-5 w-5 text-brand-600 dark:text-brand-400" />}
            title={fr ? "Étudier à l'étranger" : "Etidye aletranje"}
            href={lq("/universites")}
            cta={fr ? "Toutes les universités →" : "Tout inivèsite yo →"}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rotatedUnis.map((u) => (
              <div key={u.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-card-dark dark:hover:border-brand-600/40 dark:hover:shadow-card-dark-hover">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 dark:text-slate-100">{u.name}</h3>
                  <span className="ml-1 shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-slate-700 dark:text-slate-300">
                    {COUNTRY_LABELS[u.country]?.flag}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {u.city && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-slate-700 dark:text-slate-400">
                      {u.city}
                    </span>
                  )}
                  {u.haitianFriendly && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      ✅ {fr ? "Accueil haïtien" : "Akèy ayisyen"}
                    </span>
                  )}
                  {u.tuitionBand && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-slate-700 dark:text-slate-400">
                      {fr ? TUITION_LABELS[u.tuitionBand]?.fr : TUITION_LABELS[u.tuitionBand]?.ht}
                    </span>
                  )}
                </div>
                {u.admissionsUrl && (
                  <a href={u.admissionsUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-block text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
                    <School className="mr-1 inline h-3 w-3" />{fr ? "Voir le site →" : "Wè sit la →"}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       *  S_succes — Succès & Inspiration (strict gating)
       * ═══════════════════════════════════════════════════════════════════ */}
      {succesArticles.length > 0 ? (
        <section className="premium-section space-y-4 border-emerald-200/60 dark:border-emerald-800/30">
          <SectionHeader
            icon={<Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
            title={fr ? "Succès & Inspiration" : "Siksè & Enspirasyon"}
            href={lq("/succes")}
            cta={fr ? "Voir tout →" : "Wè tout →"}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {succesArticles.map((a) => (
              <ArticleCard key={a.id} article={a} lang={lang} compact />
            ))}
          </div>
        </section>
      ) : (
        <section className="premium-section space-y-4 border-dashed border-gray-200 dark:border-slate-700">
          <SectionHeader
            icon={<Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
            title={fr ? "Succès & Inspiration" : "Siksè & Enspirasyon"}
            href={lq("/succes")}
            cta={fr ? "Voir tout →" : "Wè tout →"}
          />
          <div className="py-8 text-center text-gray-400 dark:text-slate-500">
            <p className="text-base">
              {fr ? "Aucun profil publié récemment." : "Pa gen pwofil pibliye dènyèman."}
            </p>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       *  S6 — Fil: Actualité générale (news — below the fold)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-gray-200 pt-10 dark:border-slate-800">
        <SectionHeader
          icon={<Newspaper className="h-5 w-5 text-gray-500 dark:text-slate-400" />}
          title={fr ? "Fil — Actualité générale" : "Fil — Nouvèl jeneral"}
          href={lq("/news")}
          cta={fr ? "Voir tout →" : "Wè tout →"}
        />

        {newsArticles.length > 0 ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {newsArticles.map((a) => (
              <ArticleCard
                key={a.id}
                article={a}
                lang={lang}
                compact
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border-2 border-dashed border-gray-200 py-12 text-center text-gray-400 dark:border-slate-700 dark:text-slate-500">
            <p className="text-base">
              {fr ? "Les actualités arrivent bientôt." : "Nouvèl yo ap vini byento."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
