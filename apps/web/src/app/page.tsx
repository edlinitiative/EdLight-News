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
  ArrowRight,
  Sparkles,
  TrendingUp,
  MapPin,
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
import dynamic from "next/dynamic";
import { Suspense } from "react";

const DashboardTabs = dynamic(
  () => import("@/components/DashboardTabs").then((m) => m.DashboardTabs),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-slate-800" />
    ),
  },
);

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
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
        {icon}{title}
      </h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
      >
        {cta}
      </Link>
    </div>
  );
}

function MetricChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const toneClasses =
    tone === "success"
      ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-300"
      : tone === "warning"
        ? "border-amber-200/80 bg-amber-50/80 text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300"
        : "border-gray-200/80 bg-white/80 text-gray-800 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200";

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClasses}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-base font-bold tracking-tight">{value}</p>
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
    safeFetch(() => fetchEnrichedFeed(lang, 100), [], "enrichedFeed"),
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
      <div className="relative overflow-hidden rounded-2xl h-44 w-full">
        <img
          src="/images/hero/bourses.png"
          alt=""
          loading="eager"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
      </div>
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
      <div className="relative overflow-hidden rounded-2xl h-44 w-full">
        <img
          src="/images/hero/calendrier.png"
          alt=""
          loading="eager"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
      </div>
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

  const heroMetrics: Array<{
    label: string;
    value: string;
    tone: "default" | "success" | "warning";
  }> = [
    {
      label: fr ? "Échéances urgentes" : "Dat limit ijan",
      value: String(topUrgent.length),
      tone: topUrgent.length > 0 ? "warning" : "default",
    },
    {
      label: fr ? "Bourses (30 jours)" : "Bous (30 jou)",
      value: String(boursesClosing.length),
      tone: "success",
    },
    {
      label: fr ? "Universités" : "Inivèsite",
      value: String(rotatedUnis.length),
      tone: "default",
    },
    {
      label: fr ? "Parcours" : "Pakou",
      value: String(pathways.length),
      tone: "default",
    },
  ];

  const quickLinks = [
    {
      href: lq("/closing-soon"),
      label: fr ? "Dates limites" : "Dat limit",
      icon: AlertTriangle,
    },
    {
      href: lq("/bourses"),
      label: fr ? "Bourses" : "Bous",
      icon: DollarSign,
    },
    {
      href: lq("/calendrier"),
      label: fr ? "Calendrier" : "Kalandriye",
      icon: CalendarDays,
    },
    {
      href: lq("/parcours"),
      label: fr ? "Parcours" : "Pakou",
      icon: Compass,
    },
  ];

  return (
    <div className="space-y-12">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-white p-6 shadow-card dark:border-slate-700/60 dark:bg-slate-900/70 dark:shadow-card-dark sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-60" />
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-500/20" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-cyan-200/40 blur-3xl dark:bg-cyan-500/10" />

        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
              <Sparkles className="h-3.5 w-3.5" />
              {fr ? "Dashboard étudiant premium" : "Dashboard elèv premium"}
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                {fr ? "Ton tableau de bord étudiant" : "Tablo bò ou kòm elèv"}
              </h1>
              <p className="max-w-2xl text-base text-gray-600 dark:text-slate-300 sm:text-lg">
                {fr
                  ? "Calendrier, bourses, parcours et guides dans une interface plus claire, rapide et orientée action."
                  : "Kalandriye, bous, pakou ak gid nan yon koòdone ki pi klè, rapid, epi ki pouse w aji."}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {heroMetrics.map((metric) => (
                <MetricChip
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  tone={metric.tone}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/90 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:text-brand-700 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-brand-500/30 dark:hover:text-brand-300"
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <aside className="premium-glass relative overflow-hidden p-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-brand-100/70 to-transparent dark:from-brand-500/10" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-slate-100">
                  <TrendingUp className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  {fr ? "Vue rapide" : "Gade rapid"}
                </p>
                <Link
                  href={lq("/closing-soon")}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                >
                  {fr ? "Priorités" : "Priyorite"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="space-y-2">
                {topUrgent.slice(0, 3).map((item) => (
                  <Link
                    key={`hero-${item.id}`}
                    href={item.href}
                    className="flex items-center gap-3 rounded-xl border border-gray-200/80 bg-white/80 p-3 transition-colors hover:border-brand-200 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/60 dark:hover:border-brand-500/30"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                      {item.kind === "bourse" ? <DollarSign className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-slate-100">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {item.days === 0
                          ? (fr ? "Aujourd'hui" : "Jodi a")
                          : fr
                            ? `Dans ${item.days} jours`
                            : `Nan ${item.days} jou`}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 dark:text-slate-500" />
                  </Link>
                ))}

                {topUrgent.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200/90 bg-white/60 p-4 text-sm text-gray-500 dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-400">
                    {fr ? "Aucune échéance urgente détectée pour le moment." : "Pa gen dat limit ijan pou kounye a."}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200/80 bg-white/70 p-3 text-xs text-gray-600 dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-300">
                <p className="inline-flex items-center gap-1 font-semibold text-gray-800 dark:text-slate-100">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  {fr ? "Couverture Haïti + international" : "Kouvèti Ayiti + entènasyonal"}
                </p>
                <p className="mt-1">
                  {fr
                    ? "Les sections sont triées pour mettre les actions utiles avant le fil d’actualité."
                    : "Seksyon yo òdone pou mete aksyon itil yo anvan fil nouvèl la."}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* ── DASHBOARD TABS ──────────────────────────────────────────────── */}
      <section className="section-shell space-y-4">
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-slate-400">
              {fr ? "Actions prioritaires" : "Aksyon priyoritè"}
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {fr ? "Tableau de bord interactif" : "Tablo entèaktif"}
            </h2>
          </div>
          <span className="hidden rounded-full border border-gray-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-gray-500 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-400 sm:inline-flex">
            {fr ? "Auto-rotation + swipe" : "Wotasyon + glise"}
          </span>
        </div>
        <div className="relative z-10">
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
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
       *  URGENCY — À ne pas rater cette semaine (streamed below fold)
       * ═══════════════════════════════════════════════════════════════════ */}
      {topUrgent.length > 0 && (
        <section className="section-shell space-y-4 border-red-200/80 bg-red-50/30 dark:border-red-800/40 dark:bg-red-950/15">
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
        <section className="section-shell space-y-4">
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
        <section className="section-shell space-y-4 border-emerald-200/70 dark:border-emerald-800/30">
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
        <section className="section-shell space-y-4 border-dashed border-gray-200 dark:border-slate-700">
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
      <section className="section-shell space-y-4 border-t-0">
        <SectionHeader
          icon={<Newspaper className="h-5 w-5 text-gray-500 dark:text-slate-400" />}
          title={fr ? "Fil — Actualité générale" : "Fil — Nouvèl jeneral"}
          href={lq("/news")}
          cta={fr ? "Voir tout →" : "Wè tout →"}
        />

        {newsArticles.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center text-gray-400 dark:border-slate-700 dark:text-slate-500">
            <p className="text-base">
              {fr ? "Les actualités arrivent bientôt." : "Nouvèl yo ap vini byento."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
