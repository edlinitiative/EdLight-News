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

function TabPanelBanner({
  icon,
  title,
  subtitle,
  accent = "brand",
  meta,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accent?: "brand" | "emerald" | "violet";
  meta?: string[];
}) {
  const accentMap = {
    brand:
      "from-brand-100/90 to-cyan-50/80 text-brand-900 dark:from-brand-900/25 dark:to-cyan-900/10 dark:text-brand-100",
    emerald:
      "from-emerald-100/90 to-teal-50/80 text-emerald-900 dark:from-emerald-900/25 dark:to-teal-900/10 dark:text-emerald-100",
    violet:
      "from-violet-100/90 to-indigo-50/80 text-violet-900 dark:from-violet-900/25 dark:to-indigo-900/10 dark:text-violet-100",
  } as const;

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-gray-200/70 bg-gradient-to-br p-4 sm:p-5 ${accentMap[accent]}`}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/40 blur-2xl dark:bg-white/5" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-brand-700 shadow-sm dark:bg-slate-900/40 dark:text-brand-300">
            {icon}
          </div>
          <h3 className="mt-3 text-base font-bold tracking-tight">{title}</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{subtitle}</p>
        </div>
        {!!meta?.length && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {meta.map((m) => (
              <span
                key={m}
                className="rounded-full border border-white/60 bg-white/70 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-200"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
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
      <TabPanelBanner
        icon={<DollarSign className="h-5 w-5" />}
        title={fr ? "Bourses à surveiller" : "Bous pou swiv"}
        subtitle={
          fr
            ? "Priorité aux dates limites proches et opportunités directement actionnables."
            : "Priyorite pou dat limit ki pre ak okazyon ou ka pran aksyon sou yo touswit."
        }
        accent="brand"
        meta={[
          `${boursesClosing.length} ${fr ? "imminentes" : "pre"}`,
          `${closingScholarships45.length} ${fr ? "sur 45 jours" : "sou 45 jou"}`,
        ]}
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
      <TabPanelBanner
        icon={<CalendarDays className="h-5 w-5" />}
        title={fr ? "Calendrier des échéances" : "Kalandriye dat limit yo"}
        subtitle={
          fr
            ? "Vue mixte Haïti + international pour ne rien rater cette semaine et ce mois."
            : "Vi melanje Ayiti + entènasyonal pou pa rate anyen semèn sa ak mwa sa."
        }
        accent="emerald"
        meta={[
          `${haitiEvents.length} ${fr ? "Haïti" : "Ayiti"}`,
          `${intlScholarships.length} ${fr ? "international" : "entènasyonal"}`,
        ]}
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
      <TabPanelBanner
        icon={<Compass className="h-5 w-5" />}
        title={fr ? "Parcours guidés" : "Pakou gide"}
        subtitle={
          fr
            ? "Des étapes concrètes pour planifier tes études à l’étranger sans te perdre."
            : "Etap konkrè pou planifye etid ou aletranje san w pa pèdi direksyon."
        }
        accent="violet"
        meta={[
          `${pathways.length} ${fr ? "parcours" : "pakou"}`,
          `${pathways.reduce((sum, p) => sum + p.steps.length, 0)} ${fr ? "étapes" : "etap"}`,
        ]}
      />
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
      <TabPanelBanner
        icon={<BookOpen className="h-5 w-5" />}
        title={fr ? "Histoire & mémoire" : "Istwa & memwa"}
        subtitle={
          fr
            ? "Une lecture inspirante pour ancrer tes études dans le contexte haïtien."
            : "Yon lekti enspiran pou mare etid ou ak kontèks ayisyen an."
        }
        accent="brand"
        meta={[
          fr ? "Dernière publication" : "Dènye piblikasyon",
          latestHistoryPost.publishedAt ? (fr ? "Publié" : "Pibliye") : (fr ? "Archive" : "Achiv"),
        ]}
      />
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
      <TabPanelBanner
        icon={<Newspaper className="h-5 w-5" />}
        title={fr ? "Succès & inspirations" : "Siksè & enspirasyon"}
        subtitle={
          fr
            ? "Des profils et nouvelles positives pour garder le cap et l’ambition."
            : "Pwofil ak nouvèl pozitif pou kenbe direksyon ak anbisyon."
        }
        accent="emerald"
        meta={[
          `${succesArticles.length} ${fr ? "sélections" : "seleksyon"}`,
          fr ? "Mise à jour continue" : "Mizajou kontinyèl",
        ]}
      />
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
      <section className="section-shell space-y-6">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-slate-400">
              {fr ? "Actions prioritaires" : "Aksyon priyoritè"}
            </p>
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              {fr ? "Agir rapidement" : "Aji rapid"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 sm:text-base">
              {fr
                ? "Un seul espace pour tes bourses, échéances, parcours, histoire et nouvelles utiles."
                : "Yon sèl espas pou bous, dat limit, pakou, istwa ak nouvèl itil ou yo."}
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-100/80 px-3.5 py-1.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/25 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            {fr ? `${topUrgent.length} urgences cette semaine` : `${topUrgent.length} ijans semèn sa`}
          </div>
        </div>
        <div className="relative z-10 rounded-3xl bg-gradient-to-b from-white to-gray-50/80 p-4 ring-1 ring-gray-200/70 dark:from-slate-900/80 dark:to-slate-900/50 dark:ring-slate-700/60 sm:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-2xl bg-gradient-to-b from-white/70 to-transparent dark:from-slate-800/30" />
          <p className="relative mb-4 text-xs font-medium text-gray-500 dark:text-slate-400">
            {fr ? "Choisis un onglet pour afficher uniquement l’information utile maintenant." : "Chwazi yon onglet pou wè sèlman enfòmasyon ki itil pou ou kounye a."}
          </p>
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

      <section className="section-shell space-y-4">
        <SectionHeader
          icon={<ArrowRight className="h-5 w-5 text-brand-600 dark:text-brand-400" />}
          title={fr ? "Continuer la navigation" : "Kontinye navigasyon"}
          href={lq("/news")}
          cta={fr ? "Explorer le fil →" : "Eksplore fil la →"}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: lq("/closing-soon"), label: fr ? "Dates limites" : "Dat limit", Icon: AlertTriangle },
            { href: lq("/bourses"), label: fr ? "Bourses" : "Bous", Icon: DollarSign },
            { href: lq("/histoire"), label: fr ? "Histoire" : "Istwa", Icon: BookOpen },
            { href: lq("/news"), label: fr ? "Actualités" : "Nouvèl", Icon: Newspaper },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-brand-200 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/40 dark:hover:text-brand-300"
            >
              <span className="inline-flex items-center gap-2">
                <item.Icon className="h-4 w-4" />
                {item.label}
              </span>
              <ArrowRight className="h-4 w-4 opacity-60" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
