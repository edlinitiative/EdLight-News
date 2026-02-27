/**
 * Accueil — Student-first homepage (redesigned).
 *
 * Bold layout: Hero → Urgent deadlines → Tabbed dashboard → Universities → Quick nav
 */

import Link from "next/link";
import type { Metadata } from "next";
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
  MapPin,
  Briefcase,
  Award,
} from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { fetchEnrichedFeed, isSuccessArticle, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { ArticleCard } from "@/components/ArticleCard";
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
import { buildOgMetadata } from "@/lib/og";

const DashboardTabs = dynamic(
  () => import("@/components/DashboardTabs").then((m) => m.DashboardTabs),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-xl bg-stone-100 dark:bg-stone-800" />
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
    <div className="flex items-end justify-between gap-3 border-b border-stone-200 pb-4 dark:border-stone-800">
      <h2 className="flex items-center gap-2.5 font-serif text-xl font-bold tracking-tight text-stone-900 dark:text-white sm:text-2xl">
        {icon}{title}
      </h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-white"
      >
        {cta}
        <ArrowRight className="h-3.5 w-3.5" />
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
    audienceFitThreshold: 0.5,
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
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {dl?.dateISO && (
                      <span className="badge bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                        <Clock className="h-3 w-3" />
                        {new Date(dl.dateISO + "T00:00:00").toLocaleDateString(fr ? "fr-FR" : "fr-HT", { day: "numeric", month: "short" })}
                      </span>
                    )}
                    <span className="text-stone-400 dark:text-stone-500">
                      {COUNTRY_LABELS[s.country]?.flag} {fr ? COUNTRY_LABELS[s.country]?.fr : COUNTRY_LABELS[s.country]?.ht}
                    </span>
                  </div>
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
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-blue-600 text-white">
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
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-blue-500 text-white">
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
                        {fr ? "Date limite: " : "Dat limit: "}
                        {dateObj?.toLocaleDateString(fr ? "fr-FR" : "fr-HT", { day: "numeric", month: "long" })}
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
        <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-white">{latestHistoryPost.title}</h3>
        <p className="mt-2 text-sm text-stone-500 line-clamp-3 dark:text-stone-400">
          {latestHistoryPost.summary || latestHistoryPost.body?.slice(0, 300) || ""}
        </p>
        <Link href={`/news/${latestHistoryPost.id}${langQ}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
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
    <div className="space-y-12">
      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl bg-stone-900 p-6 sm:p-8 lg:p-10 dark:bg-stone-900">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-orange-500/10" />
        <div className="absolute inset-0 bg-dots opacity-20" />
        <div className="relative grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
                {fr ? "Mis à jour quotidiennement" : "Mizajou chak jou"}
              </div>
              <h1 className="font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                {fr ? "Ton espace étudiant" : "Espas etidyan ou"}
              </h1>
              <p className="max-w-xl text-base text-stone-300 sm:text-lg">
                {fr
                  ? "Bourses, calendrier, parcours et guides — tout dans un seul endroit."
                  : "Bous, kalandriye, pakou ak gid — tout nan yon sèl kote."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={lq("/bourses")}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-stone-900 transition-all hover:-translate-y-0.5 hover:shadow-lift"
              >
                <GraduationCap className="h-4 w-4" />
                {fr ? "Explorer les bourses" : "Eksplore bous yo"}
              </Link>
              <Link
                href={lq("/news")}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/20"
              >
                <Newspaper className="h-4 w-4" />
                {fr ? "Actualités" : "Nouvèl"}
              </Link>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-8 border-t border-white/10 pt-6">
              {[
                { label: fr ? "Bourses ouvertes" : "Bous ouvè", value: String(boursesClosing.length), icon: DollarSign },
                { label: fr ? "Universités" : "Inivèsite", value: String(rotatedUnis.length), icon: GraduationCap },
                { label: fr ? "Parcours" : "Pakou", value: String(pathways.length), icon: Compass },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                    <stat.icon className="h-4 w-4 text-white/70" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-stone-400">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Urgency sidebar */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Clock className="h-4 w-4 text-orange-400" />
                {fr ? "À ne pas rater" : "Pa bliye"}
              </h3>
              {topUrgent.length > 0 && (
                <span className="rounded-md bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-300">
                  {topUrgent.length} {fr ? "urgents" : "ijan"}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {topUrgent.slice(0, 4).map((item) => (
                <Link
                  key={`hero-${item.id}`}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 transition-all hover:bg-white/10"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300">
                    {item.kind === "bourse" ? <DollarSign className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white line-clamp-1">{item.title}</p>
                    <p className="text-xs text-stone-400">
                      {item.days === 0 ? (fr ? "Aujourd'hui" : "Jodi a") : fr ? `Dans ${item.days} jours` : `Nan ${item.days} jou`}
                    </p>
                  </div>
                </Link>
              ))}
              {topUrgent.length === 0 && (
                <p className="rounded-lg border border-dashed border-white/10 p-4 text-center text-sm text-stone-500">
                  {fr ? "Aucune échéance urgente pour le moment." : "Pa gen dat limit ijan kounye a."}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── DASHBOARD TABS ──────────────────────────────────────────────── */}
      <section className="space-y-5">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            {fr ? "Agir rapidement" : "Aji rapid"}
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {fr
              ? "Bourses, échéances, parcours, histoire et nouvelles — tout en un."
              : "Bous, dat limit, pakou, istwa ak nouvèl — tout nan youn."}
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
        <section className="space-y-5">
          <SectionHeader
            icon={<GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
            title={fr ? "Étudier à l'étranger" : "Etidye aletranje"}
            href={lq("/universites")}
            cta={fr ? "Toutes les universités" : "Tout inivèsite yo"}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rotatedUnis.map((u) => (
              <div key={u.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-stone-900 line-clamp-2 dark:text-white">{u.name}</h3>
                  <span className="ml-2 shrink-0 text-xs text-stone-400">{COUNTRY_LABELS[u.country]?.flag}</span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {u.city && <span className="badge bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300">{u.city}</span>}
                  {u.haitianFriendly && (
                    <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                      ✓ {fr ? "Accueil HT" : "Akèy HT"}
                    </span>
                  )}
                  {u.tuitionBand && <span className="badge bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300">{fr ? TUITION_LABELS[u.tuitionBand]?.fr : TUITION_LABELS[u.tuitionBand]?.ht}</span>}
                </div>
                {u.admissionsUrl && (
                  <a href={u.admissionsUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400">
                    {fr ? "Admissions" : "Admisyon"} <ArrowRight className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── QUICK NAV ───────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="font-serif text-xl font-bold tracking-tight text-stone-900 dark:text-white">
          {fr ? "Explorer" : "Eksplore"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: lq("/closing-soon"), label: fr ? "Dates limites" : "Dat limit", Icon: Clock, desc: fr ? "Échéances proches" : "Dat limit ki pre", accent: "group-hover:bg-orange-50 dark:group-hover:bg-orange-950/30", iconAccent: "group-hover:text-orange-600 dark:group-hover:text-orange-400" },
            { href: lq("/bourses"), label: fr ? "Bourses" : "Bous", Icon: DollarSign, desc: fr ? "Base de données" : "Baz done", accent: "group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/30", iconAccent: "group-hover:text-emerald-600 dark:group-hover:text-emerald-400" },
            { href: lq("/histoire"), label: fr ? "Histoire" : "Istwa", Icon: BookOpen, desc: fr ? "Haïti au quotidien" : "Ayiti chak jou", accent: "group-hover:bg-violet-50 dark:group-hover:bg-violet-950/30", iconAccent: "group-hover:text-violet-600 dark:group-hover:text-violet-400" },
            { href: lq("/news"), label: fr ? "Actualités" : "Nouvèl", Icon: Newspaper, desc: fr ? "Fil complet" : "Fil konplè", accent: "group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30", iconAccent: "group-hover:text-blue-600 dark:group-hover:text-blue-400" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift dark:border-stone-800 dark:bg-stone-900"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 transition-colors dark:bg-stone-800 ${item.accent}`}>
                <item.Icon className={`h-5 w-5 text-stone-400 transition-colors dark:text-stone-500 ${item.iconAccent}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
