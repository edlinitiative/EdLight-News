/**
 * Accueil — Student-first homepage.
 *
 * Layout: Dark hero → Urgency strip → News + sidebar → Dashboard tabs → Universities → Nav grid
 */

import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  CalendarDays,
  GraduationCap,
  Globe,
  Clock,
  Compass,
  Newspaper,
  DollarSign,
  BookOpen,
  ArrowRight,
  Briefcase,
  Award,
  ChevronRight,
} from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, isSuccessArticle, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { ArticleCard } from "@/components/ArticleCard";
import {
  parseISODateSafe,
  daysUntil,
  getNextRelevantDate,
} from "@/lib/deadlines";
import {
  getDeadlineStatus,
  formatDeadlineDateShort,
  badgeStyle,
} from "@/lib/ui/deadlines";
import {
  fetchAllUniversities,
  fetchScholarshipsClosingSoon,
  fetchUpcomingCalendarEvents,
  fetchAllPathways,
  COUNTRY_LABELS,
  TUITION_LABELS,
} from "@/lib/datasets";
import { getCalendarGeo } from "@/lib/calendarGeo";
import { CountryFlag } from "@/components/CountryFlag";
import { TauxDuJourWidget } from "@/components/TauxDuJourWidget";
import { fetchTauxBRH } from "@/lib/brh";
import { isTauxDuJourArticle } from "@/lib/tauxFilter";
import dynamic from "next/dynamic";
import { buildOgMetadata } from "@/lib/og";
import { withLangParam } from "@/lib/utils";

const DashboardTabs = dynamic(
  () => import("@/components/DashboardTabs").then((m) => m.DashboardTabs),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[28rem] animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" />
    ),
  },
);

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr
    ? "EdLight News — Actualités éducatives pour étudiants haïtiens"
    : "EdLight News — Nouvèl edikasyon pou elèv ayisyen yo";
  const description = fr
    ? "Bourses, calendrier, ressources et actualités pour les étudiants haïtiens."
    : "Bous, kalandriye, resous ak nouvèl pou elèv ayisyen yo.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/", lang }),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
      {icon}
      {text}
    </span>
  );
}

function Divider() {
  return <div className="section-rule" />;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AccueilPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";
  const lq = (path: string) => withLangParam(path, lang);
  const fr = lang === "fr";

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
    taux,
  ] = await Promise.all([
    safeFetch(() => fetchEnrichedFeed(lang, 100), [], "enrichedFeed"),
    safeFetch(fetchUpcomingCalendarEvents, [], "upcomingEvents"),
    safeFetch(() => fetchScholarshipsClosingSoon(30), [], "scholarships30"),
    safeFetch(() => fetchScholarshipsClosingSoon(45), [], "scholarships45"),
    safeFetch(fetchAllPathways, [], "pathways"),
    safeFetch(fetchAllUniversities, [], "universities"),
    safeFetch(fetchTauxBRH, null, "tauxBRH"),
  ]);

  // Suppress "taux du jour" articles (the widget handles exchange rates)
  const allArticlesFiltered = allArticles.filter((a) => !isTauxDuJourArticle(a));

  // Data prep (same logic as before)
  const haitiEvents = upcomingEvents.slice(0, 3);
  const intlScholarships = closingScholarships45.slice(0, 3);
  const boursesClosing = closingScholarships30.slice(0, 6);
  const pathways = allPathways.slice(0, 3);

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

  const succesPool = allArticles.filter(isSuccessArticle);
  const succesArticles = rankAndDeduplicate(succesPool, {
    audienceFitThreshold: 0.40,
    publisherCap: 2,
    topN: 6,
  }).slice(0, 6);

  // Urgency items
  type UrgencyItem = {
    id: string;
    kind: "bourse" | "calendrier";
    title: string;
    dateISO: string;
    days: number;
    href: string;
  };
  const urgencyItems: UrgencyItem[] = [];
  for (const s of closingScholarships30.slice(0, 5)) {
    const d = parseISODateSafe(s.deadline?.dateISO);
    if (!d) continue;
    const days = daysUntil(d);
    if (days < 0 || days > 30) continue;
    urgencyItems.push({ id: s.id, kind: "bourse", title: s.name, dateISO: s.deadline!.dateISO!, days, href: lq("/bourses") });
  }
  for (const ev of upcomingEvents.slice(0, 5)) {
    const d = getNextRelevantDate(ev);
    if (!d) continue;
    const days = daysUntil(d);
    if (days < 0 || days > 14) continue;
    urgencyItems.push({ id: ev.id, kind: "calendrier", title: ev.title, dateISO: ev.dateISO ?? ev.startDateISO ?? "", days, href: lq("/calendrier") });
  }
  urgencyItems.sort((a, b) => a.days - b.days);
  const topUrgent = urgencyItems.slice(0, 6);

  const latestHistoryPost = allArticles.find(
    (a) => a.itemType === "utility" && a.series === "HaitiHistory" && a.status === "published",
  ) ?? null;

  // ── Dashboard tab panels ──────────────────────────────────────────────────

  const boursesPanel = (
    <div className="space-y-4">
      {boursesClosing.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {boursesClosing.length} {fr ? "bourses avec date limite imminente" : "bous ak dat limit ki pre"}
            </p>
            <Link href={lq("/bourses")} className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
              {fr ? "Toutes →" : "Tout →"}
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boursesClosing.map((s) => {
              const dl = s.deadline;
              return (
                <div key={s.id} className="card p-4">
                  <h3 className="font-semibold text-stone-900 line-clamp-1 dark:text-white text-sm">{s.name}</h3>
                  {s.eligibilitySummary && (
                    <p className="mt-1.5 text-xs text-stone-500 line-clamp-2 dark:text-stone-400">{s.eligibilitySummary}</p>
                  )}
                  {(() => { const st = getDeadlineStatus(dl?.dateISO, lang); return (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`badge ${badgeStyle(st.badgeVariant)}`}>
                        <Clock className="h-3 w-3" />
                        {formatDeadlineDateShort(dl?.dateISO, lang) ?? st.badgeLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 text-stone-400 dark:text-stone-500">
                        {COUNTRY_LABELS[s.country]?.flag && <CountryFlag code={COUNTRY_LABELS[s.country].flag} />} {fr ? COUNTRY_LABELS[s.country]?.fr : COUNTRY_LABELS[s.country]?.ht}
                      </span>
                      <span className="text-xs text-stone-400 dark:text-stone-500">{st.humanLine}</span>
                    </div>
                  ); })()}
                  {s.howToApplyUrl && (
                    <a href={s.howToApplyUrl} target="_blank" rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
                      {fr ? "Postuler" : "Aplike"} <ArrowRight className="h-3 w-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="py-12 text-center text-stone-400 dark:text-stone-500">
          <DollarSign className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="text-sm">{fr ? "Aucune bourse avec date limite imminente." : "Pa gen bous ak dat limit ki pre."}</p>
        </div>
      )}
    </div>
  );

  const calendrierPanel = (
    <div className="space-y-4">
      {(haitiEvents.length > 0 || intlScholarships.length > 0) ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-stone-500 dark:text-stone-400">{fr ? "Prochaines échéances" : "Pwochen dat limit"}</p>
            <Link href={lq("/calendrier")} className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
              {fr ? "Calendrier complet →" : "Kalandriye konplè →"}
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {haitiEvents.map((ev) => {
              const dateObj = ev.dateISO ? new Date(ev.dateISO + "T00:00:00") : null;
              const evGeo = getCalendarGeo(ev);
              return (
                <div key={ev.id} className="flex items-start gap-3 card p-3.5">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-600 text-white">
                    {dateObj ? (
                      <>
                        <span className="text-xs font-bold leading-tight">{dateObj.getDate()}</span>
                        <span className="text-[9px] uppercase leading-tight">{dateObj.toLocaleDateString(fr ? "fr-FR" : "fr-HT", { month: "short" })}</span>
                      </>
                    ) : (
                      <CalendarDays className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`badge text-[10px] ${evGeo === "Haiti" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"}`}>
                        {evGeo === "Haiti" ? (fr ? "Haïti" : "Ayiti") : "International"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-stone-900 line-clamp-1 dark:text-white">{ev.title}</p>
                    {ev.institution && <p className="text-xs text-stone-500 dark:text-stone-400">{ev.institution}</p>}
                  </div>
                </div>
              );
            })}
            {intlScholarships.map((s) => {
              const dl = s.deadline;
              const dateObj = dl?.dateISO ? new Date(dl.dateISO + "T00:00:00") : null;
              return (
                <div key={s.id} className="flex items-start gap-3 card p-3.5">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-500 text-white">
                    {dateObj ? (
                      <>
                        <span className="text-xs font-bold leading-tight">{dateObj.getDate()}</span>
                        <span className="text-[9px] uppercase leading-tight">{dateObj.toLocaleDateString(fr ? "fr-FR" : "fr-HT", { month: "short" })}</span>
                      </>
                    ) : (
                      <Clock className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="badge text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                      <Globe className="h-3 w-3" /> International
                    </span>
                    <p className="mt-1 text-sm font-medium text-stone-900 line-clamp-1 dark:text-white">{s.name}</p>
                    {dl?.dateISO && (
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {getDeadlineStatus(dl.dateISO, lang).humanLine}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="py-12 text-center text-stone-400 dark:text-stone-500">
          <CalendarDays className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="text-sm">{fr ? "Aucun événement à venir." : "Pa gen evènman ki ap vini."}</p>
        </div>
      )}
    </div>
  );

  const parcoursPanel = pathways.length > 0 ? (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500 dark:text-stone-400">{pathways.length} {fr ? "parcours disponibles" : "pakou disponib"}</p>
        <Link href={lq("/parcours")} className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">{fr ? "Tous →" : "Tout →"}</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {pathways.map((pw) => (
          <Link key={pw.id} href={lq("/parcours")} className="group card p-4">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-semibold text-stone-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                {fr ? pw.title_fr : (pw.title_ht ?? pw.title_fr)}
              </h3>
            </div>
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
              {pw.steps.length} {fr ? "étapes" : "etap"}
              {pw.country ? ` · ${fr ? COUNTRY_LABELS[pw.country]?.fr : COUNTRY_LABELS[pw.country]?.ht}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </div>
  ) : (
    <div className="py-12 text-center text-stone-400 dark:text-stone-500">
      <Compass className="mx-auto mb-3 h-8 w-8 opacity-30" />
      <p className="text-sm">{fr ? "Aucun parcours disponible." : "Pa gen pakou disponib."}</p>
    </div>
  );

  const histoirePanel = latestHistoryPost ? (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500 dark:text-stone-400">{fr ? "Dernière publication" : "Dènye piblikasyon"}</p>
        <Link href={lq("/histoire")} className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">{fr ? "Explorer →" : "Eksplore →"}</Link>
      </div>
      <div className="card p-5">
        <h3 className="text-lg font-semibold text-stone-900 dark:text-white">{latestHistoryPost.title}</h3>
        <p className="mt-2 text-sm text-stone-500 line-clamp-3 dark:text-stone-400">
          {latestHistoryPost.summary || latestHistoryPost.body?.slice(0, 300) || ""}
        </p>
        <Link href={lq(`/news/${latestHistoryPost.id}`)} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
          {fr ? "Lire" : "Li"} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  ) : (
    <div className="py-12 text-center text-stone-400 dark:text-stone-500">
      <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-30" />
      <p className="text-sm">{fr ? "Aucune histoire publiée récemment." : "Pa gen istwa pibliye dènyèman."}</p>
    </div>
  );

  const nouvellesPanel = succesArticles.length > 0 ? (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500 dark:text-stone-400">{fr ? "Inspirations récentes" : "Enspirasyon resan"}</p>
        <Link href={lq("/succes")} className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">{fr ? "Voir tout →" : "Wè tout →"}</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {succesArticles.map((a) => (
          <ArticleCard key={a.id} article={a} lang={lang} compact />
        ))}
      </div>
    </div>
  ) : (
    <div className="py-12 text-center text-stone-400 dark:text-stone-500">
      <Newspaper className="mx-auto mb-3 h-8 w-8 opacity-30" />
      <p className="text-sm">{fr ? "Aucune nouvelle pour le moment." : "Pa gen nouvèl pou kounye a."}</p>
    </div>
  );

  return (
    <div className="space-y-0">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="-mx-4 sm:-mx-6 lg:-mx-8 relative overflow-hidden">
        {/* Background layers */}
        <div className="absolute inset-0 bg-[#080d1a]" />
        <div className="absolute inset-0 bg-dots-white" />
        {/* Glows */}
        <div className="pointer-events-none absolute -left-40 -top-20 h-[520px] w-[520px] rounded-full bg-blue-700/25 blur-[130px]" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-violet-700/20 blur-[110px]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-800/15 blur-[80px]" />

        <div className="relative px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_360px]">

              {/* ── Left column ── */}
              <div className="space-y-8">

                {/* Eyebrow */}
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 ring-1 ring-inset ring-blue-500/30">
                    <GraduationCap className="h-4 w-4 text-blue-400" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-400/70">
                    EdLight News
                  </span>
                  <span className="h-px w-8 bg-blue-500/25" />
                </div>

                {/* Headline */}
                <div>
                  <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl">
                    {fr ? (
                      <>
                        Les repères pour{" "}
                        <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                          étudier
                        </span>
                        ,{" "}
                        <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                          postuler
                        </span>{" "}
                        et avancer.
                      </>
                    ) : (
                      <>
                        Repè pou{" "}
                        <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                          etidye
                        </span>
                        ,{" "}
                        <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                          aplike
                        </span>{" "}
                        epi avanse.
                      </>
                    )}
                  </h1>
                  <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-slate-400">
                    {fr
                      ? "Bourses, calendrier, parcours et actualités — centralisés pour les étudiants haïtiens."
                      : "Bous, kalandriye, pakou ak nouvèl — santralize pou elèv ayisyen yo."}
                  </p>
                </div>

                {/* CTA buttons */}
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={lq("/bourses")}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500"
                  >
                    <DollarSign className="h-4 w-4" />
                    {fr ? "Voir les bourses" : "Gade bous yo"}
                  </Link>
                  <Link
                    href={lq("/calendrier")}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                  >
                    <CalendarDays className="h-4 w-4" />
                    {fr ? "Calendrier" : "Kalandriye"}
                  </Link>
                  <Link
                    href={lq("/news")}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                  >
                    {fr ? "Actualités" : "Nouvèl"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-x-8 gap-y-5 border-t border-white/[0.07] pt-6">
                  {[
                    { value: closingScholarships45.length, label: fr ? "bourses suivies" : "bous swivi", color: "text-blue-400" },
                    { value: upcomingEvents.length, label: fr ? "échéances à venir" : "dat limit k ap vini", color: "text-violet-400" },
                    { value: allPathways.length, label: fr ? "parcours guidés" : "pakou gide", color: "text-emerald-400" },
                    { value: allUniversities.length, label: fr ? "universités" : "inivèsite", color: "text-amber-400" },
                  ].map((s) => (
                    <div key={s.label} className="flex flex-col">
                      <span className={`text-2xl font-extrabold tabular-nums leading-none ${s.color}`}>{s.value}</span>
                      <span className="mt-1.5 text-[10px] font-medium uppercase tracking-widest text-slate-500">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Right column — featured article card ── */}
              {allArticlesFiltered[0] && (
                <div className="hidden lg:flex lg:flex-col lg:gap-3">
                  <Link
                    href={lq(`/news/${allArticlesFiltered[0].id}`)}
                    className="group block overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] transition hover:border-white/[0.15] hover:bg-white/[0.07]"
                  >
                    <div className="h-0.5 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-transparent" />
                    <div className="space-y-4 p-6">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-300">
                          {allArticlesFiltered[0].itemType === "synthesis" ? (fr ? "Dossier" : "Dosye") :
                           allArticlesFiltered[0].itemType === "utility" ? (fr ? "Ressource" : "Resous") :
                           fr ? "Actualité" : "Nouvèl"}
                        </span>
                        {allArticlesFiltered[0].publishedAt && (
                          <span className="text-[11px] text-slate-500">
                            {new Date(allArticlesFiltered[0].publishedAt).toLocaleDateString(
                              fr ? "fr-FR" : "fr-HT",
                              { day: "numeric", month: "short" },
                            )}
                          </span>
                        )}
                      </div>
                      <h2 className="line-clamp-4 text-[15px] font-bold leading-snug text-white/90 group-hover:text-white">
                        {allArticlesFiltered[0].title}
                      </h2>
                      {allArticlesFiltered[0].summary && (
                        <p className="line-clamp-2 text-sm leading-relaxed text-slate-500">
                          {allArticlesFiltered[0].summary}
                        </p>
                      )}
                      <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
                        <span className="truncate text-xs text-slate-600">
                          {allArticlesFiltered[0].sourceName ?? ""}
                        </span>
                        <span className="ml-3 flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-400 group-hover:text-blue-300">
                          {fr ? "Lire" : "Li"}{" "}
                          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </Link>

                  {allArticlesFiltered[1] && (
                    <Link
                      href={lq(`/news/${allArticlesFiltered[1].id}`)}
                      className="group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 transition hover:bg-white/[0.07]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-white/60 group-hover:text-white/90">
                          {allArticlesFiltered[1].title}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">{allArticlesFiltered[1].sourceName}</p>
                      </div>
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:text-blue-400" />
                    </Link>
                  )}

                  {allArticlesFiltered[2] && (
                    <Link
                      href={lq(`/news/${allArticlesFiltered[2].id}`)}
                      className="group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 transition hover:bg-white/[0.07]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-white/60 group-hover:text-white/90">
                          {allArticlesFiltered[2].title}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">{allArticlesFiltered[2].sourceName}</p>
                      </div>
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600 transition group-hover:text-blue-400" />
                    </Link>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
        {/* Bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.06]" />
      </section>

      {/* ── URGENCY STRIP ────────────────────────────────────────────────── */}
      {topUrgent.length > 0 && (
        <div className="border-y border-orange-100 bg-orange-50/80 dark:border-orange-900/20 dark:bg-orange-950/10">
          <div className="flex items-stretch">
            {/* Label pill */}
            <div className="flex shrink-0 items-center gap-2 border-r border-orange-200 bg-orange-100 px-4 py-3 dark:border-orange-900/30 dark:bg-orange-950/30">
              <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <span className="hidden text-[11px] font-bold uppercase tracking-widest text-orange-700 dark:text-orange-400 sm:block">
                {fr ? "Urgent" : "Ijan"}
              </span>
            </div>
            {/* Scrollable pills */}
            <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {topUrgent.map((item) => {
                const status = getDeadlineStatus(item.dateISO, lang);
                return (
                  <Link
                    key={`strip-${item.id}`}
                    href={item.href}
                    className="flex shrink-0 items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:border-orange-300 hover:bg-orange-50 dark:border-orange-900/30 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
                  >
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeStyle(status.badgeVariant)}`}>
                      {status.badgeLabel}
                    </span>
                    <span className="max-w-[180px] truncate text-xs">{item.title}</span>
                    <ChevronRight className="h-3 w-3 shrink-0 text-stone-400" />
                  </Link>
                );
              })}
              <Link
                href={lq("/closing-soon")}
                className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-orange-300 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/30"
              >
                {fr ? "Voir tout" : "Wè tout"} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-12 pt-8">

        {/* ── NEWS + SIDEBAR ───────────────────────────────────────────────── */}
        <section>
          <div className="mb-5 flex items-end justify-between gap-3">
            <div className="space-y-1">
              <SectionLabel
                icon={<Newspaper className="h-3.5 w-3.5 text-blue-600" />}
                text={fr ? "À la une" : "Premye paj"}
              />
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {fr
                  ? "Le sujet principal et les articles à ne pas manquer."
                  : "Sijè prensipal la ak atik pou pa manke."}
              </p>
            </div>
            <Link
              href={lq("/news")}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              {fr ? "Tout voir →" : "Wè tout →"}
            </Link>
          </div>

          {allArticlesFiltered.length > 0 ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              {/* Main column */}
              <div className="space-y-5">
                {allArticlesFiltered[0] && (
                  <ArticleCard article={allArticlesFiltered[0]} lang={lang} variant="featured" />
                )}
                {allArticlesFiltered.length > 1 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {allArticlesFiltered.slice(1, 3).map((a) => (
                      <ArticleCard key={a.id} article={a} lang={lang} />
                    ))}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <aside className="space-y-4">
                <TauxDuJourWidget lang={lang} data={taux} />

                {allArticlesFiltered.length > 3 && (
                  <div className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
                    <div className="border-b border-stone-100 px-4 py-3 dark:border-stone-800">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">
                        {fr ? "À ouvrir ensuite" : "Pou louvri apre sa"}
                      </h3>
                    </div>
                    <div className="divide-y divide-stone-100 dark:divide-stone-800">
                      {allArticlesFiltered.slice(3, 8).map((a, i) => (
                        <Link
                          key={a.id}
                          href={lq(`/news/${a.id}`)}
                          className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/50"
                        >
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-sm font-bold text-stone-300 dark:text-stone-600">
                            {i + 4}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug text-stone-800 line-clamp-2 dark:text-stone-200">
                              {a.title}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-stone-400">
                              {a.sourceName && <span>{a.sourceName}</span>}
                              {a.sourceName && a.publishedAt && <span>·</span>}
                              {a.publishedAt && (
                                <span>
                                  {new Date(a.publishedAt).toLocaleDateString(
                                    fr ? "fr-FR" : "fr-HT",
                                    { day: "numeric", month: "short" },
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="border-t border-stone-100 px-4 py-2.5 dark:border-stone-800">
                      <Link
                        href={lq("/news")}
                        className="flex items-center justify-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        {fr ? "Toutes les actualités" : "Tout nouvèl yo"}{" "}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          ) : (
            <div className="section-shell py-16 text-center">
              <Newspaper className="mx-auto mb-3 h-8 w-8 text-stone-300" />
              <p className="text-stone-400">
                {fr ? "Aucun article pour le moment." : "Pa gen atik pou kounye a."}
              </p>
            </div>
          )}
        </section>

        {/* ── DASHBOARD TABS ──────────────────────────────────────────────── */}
        <section>
          <Divider />
          <div className="mb-5 mt-6 space-y-1">
            <SectionLabel
              icon={<Briefcase className="h-3.5 w-3.5 text-blue-600" />}
              text={fr ? "Tableau de bord" : "Tablo"}
            />
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {fr
                ? "Bourses, échéances, parcours et histoire — tout en un."
                : "Bous, dat limit, pakou ak istwa — tout nan youn."}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900 sm:p-5">
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

        {/* ── UNIVERSITIES ────────────────────────────────────────────────── */}
        {rotatedUnis.length > 0 && (
          <section>
            <Divider />
            <div className="mb-5 mt-6 flex items-end justify-between gap-3">
              <div className="space-y-1">
                <SectionLabel
                  icon={<GraduationCap className="h-3.5 w-3.5 text-blue-600" />}
                  text={fr ? "Étudier à l'étranger" : "Etidye aletranje"}
                />
              </div>
              <Link
                href={lq("/universites")}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                {fr ? "Toutes les universités →" : "Tout inivèsite yo →"}
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rotatedUnis.map((u) => (
                <div key={u.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-stone-900 line-clamp-2 dark:text-white">
                      {u.name}
                    </h3>
                    {COUNTRY_LABELS[u.country]?.flag && (
                      <span className="shrink-0">
                        <CountryFlag code={COUNTRY_LABELS[u.country].flag} />
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {u.city && (
                      <span className="badge bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                        {u.city}
                      </span>
                    )}
                    {u.haitianFriendly && (
                      <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        ✓ {fr ? "Accueil HT" : "Akèy HT"}
                      </span>
                    )}
                    {u.tuitionBand && (
                      <span className="badge bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                        {fr ? TUITION_LABELS[u.tuitionBand]?.fr : TUITION_LABELS[u.tuitionBand]?.ht}
                      </span>
                    )}
                  </div>
                  {u.admissionsUrl && (
                    <a
                      href={u.admissionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {fr ? "Admissions" : "Admisyon"} <ArrowRight className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── QUICK NAV ────────────────────────────────────────────────────── */}
        <section>
          <Divider />
          <div className="mb-5 mt-6 space-y-1">
            <SectionLabel
              icon={<Compass className="h-3.5 w-3.5 text-blue-600" />}
              text={fr ? "Explorer" : "Eksplore"}
            />
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {fr
                ? "Entrez par besoin : bourses, universités, parcours ou actualités."
                : "Antre pa bezwen: bous, inivèsite, pakou oswa nouvèl."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                href: lq("/closing-soon"),
                label: fr ? "Dates limites" : "Dat limit",
                Icon: Clock,
                desc: fr ? "Les prochains dossiers à traiter." : "Pwochen dosye pou trete.",
                count: topUrgent.length,
                color: "text-orange-600 dark:text-orange-400",
                bg: "bg-orange-50 dark:bg-orange-950/20",
                border: "border-orange-100 dark:border-orange-900/30",
              },
              {
                href: lq("/bourses"),
                label: fr ? "Bourses" : "Bous",
                Icon: DollarSign,
                desc: fr ? "Comparer les aides ouvertes." : "Konpare èd ki ouvè yo.",
                count: closingScholarships45.length,
                color: "text-emerald-600 dark:text-emerald-400",
                bg: "bg-emerald-50 dark:bg-emerald-950/20",
                border: "border-emerald-100 dark:border-emerald-900/30",
              },
              {
                href: lq("/parcours"),
                label: fr ? "Parcours" : "Pakou",
                Icon: Compass,
                desc: fr ? "Choisir un plan d'action." : "Chwazi yon plan aksyon.",
                count: allPathways.length,
                color: "text-violet-600 dark:text-violet-400",
                bg: "bg-violet-50 dark:bg-violet-950/20",
                border: "border-violet-100 dark:border-violet-900/30",
              },
              {
                href: lq("/universites"),
                label: fr ? "Universités" : "Inivèsite",
                Icon: GraduationCap,
                desc: fr ? "Repérer les campus accueillants." : "Repere kanpis ki akeyan yo.",
                count: allUniversities.length,
                color: "text-sky-600 dark:text-sky-400",
                bg: "bg-sky-50 dark:bg-sky-950/20",
                border: "border-sky-100 dark:border-sky-900/30",
              },
              {
                href: lq("/succes"),
                label: fr ? "Succès" : "Siksè",
                Icon: Award,
                desc: fr ? "Lire des parcours inspirants." : "Li pakou ki bay enspirasyon.",
                count: succesArticles.length,
                color: "text-amber-600 dark:text-amber-400",
                bg: "bg-amber-50 dark:bg-amber-950/20",
                border: "border-amber-100 dark:border-amber-900/30",
              },
              {
                href: lq("/news"),
                label: fr ? "Actualités" : "Nouvèl",
                Icon: Newspaper,
                desc: fr ? "Revenir au fil complet." : "Retounen sou fil konplè a.",
                count: allArticlesFiltered.length,
                color: "text-blue-600 dark:text-blue-400",
                bg: "bg-blue-50 dark:bg-blue-950/20",
                border: "border-blue-100 dark:border-blue-900/30",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-4 rounded-xl border ${item.border} ${item.bg} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-stone-900 ${item.color}`}
                >
                  <item.Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-stone-900 dark:text-white">
                      {item.label}
                    </p>
                    <span className="text-xs font-bold tabular-nums text-stone-400 dark:text-stone-500">
                      {item.count}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-stone-500 dark:text-stone-400">
                    {item.desc}
                  </p>
                </div>
                <ArrowRight
                  className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${item.color}`}
                />
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
