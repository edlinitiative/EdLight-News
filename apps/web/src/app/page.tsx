/**
 * Accueil — Student-first homepage (redesigned).
 *
 * Bold layout: Hero → Urgent deadlines → Tabbed dashboard → Universities → Quick nav
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
import { PageHero } from "@/components/PageHero";
import { withLangParam } from "@/lib/utils";

const DashboardTabs = dynamic(
  () => import("@/components/DashboardTabs").then((m) => m.DashboardTabs),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[28rem] animate-pulse rounded-xl bg-stone-100 dark:bg-stone-800" />
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
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 pb-3">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-900 dark:text-white">
        {icon}{title}
      </h2>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400"
      >
        {cta}
        <ArrowRight className="h-3 w-3" />
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
        <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-white">{latestHistoryPost.title}</h3>
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
    <div className="space-y-10">
      <PageHero
        variant="home"
        eyebrow={fr ? "Accueil EdLight" : "Akey EdLight"}
        title={
          fr
            ? "Les repères utiles pour étudier, postuler et avancer."
            : "Repè itil yo pou etidye, aplike epi avanse."
        }
        description={
          fr
            ? "Une page d'accueil recentrée sur l'essentiel: échéances proches, opportunités concrètes et informations fiables pour les étudiants haïtiens."
            : "Yon paj dakèy ki konsantre sou sa ki pi enpòtan: dat limit ki pre, opòtinite konkrè ak enfòmasyon serye pou elèv ayisyen yo."
        }
        icon={<GraduationCap className="h-5 w-5" />}
        actions={[
          { href: lq("/bourses"), label: fr ? "Voir les bourses" : "Gade bous yo" },
          { href: lq("/calendrier"), label: fr ? "Ouvrir le calendrier" : "Louvri kalandriye a" },
          { href: lq("/news"), label: fr ? "Lire les actualités" : "Li nouvèl yo" },
        ]}
        stats={[
          { value: String(closingScholarships45.length), label: fr ? "bourses suivies" : "bous n ap swiv" },
          { value: String(upcomingEvents.length), label: fr ? "échéances à venir" : "dat limit k ap vini" },
          { value: String(allPathways.length), label: fr ? "parcours guidés" : "pakou gide" },
          { value: String(allUniversities.length), label: fr ? "universités repérées" : "inivèsite repere" },
        ]}
        aside={<TauxDuJourWidget lang={lang} data={taux} />}
      >
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
            {fr ? "À surveiller maintenant" : "Pou veye kounye a"}
          </p>
          <div className="flex flex-wrap gap-2">
            {topUrgent.length > 0 ? (
              topUrgent.slice(0, 3).map((item) => {
                const status = getDeadlineStatus(item.dateISO, lang);
                return (
                  <Link
                    key={`hero-urgent-${item.id}`}
                    href={item.href}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-2 text-sm font-medium text-stone-700 shadow-sm backdrop-blur transition-transform duration-200 hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/5 dark:text-stone-200"
                  >
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeStyle(status.badgeVariant)}`}>
                      {status.badgeLabel}
                    </span>
                    <span className="max-w-[16rem] truncate">{item.title}</span>
                  </Link>
                );
              })
            ) : (
              [
                fr ? "Le fil met en avant l'utilité étudiante" : "Fil la bay itilite etidyan yo priyorite",
                fr ? "Bourses et calendrier mis à jour" : "Bous ak kalandriye yo ajou",
                fr ? "Ressources classées par action" : "Resous yo klase pa aksyon",
              ].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/70 bg-white/75 px-3 py-2 text-sm font-medium text-stone-600 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-stone-300"
                >
                  {chip}
                </span>
              ))
            )}
          </div>
        </div>
      </PageHero>

      <section className="space-y-4">
        <div className="mb-4 section-rule" />
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-900 dark:text-white">
              <Newspaper className="h-3.5 w-3.5 text-blue-600" />
              {fr ? "À la une" : "Premye paj"}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {fr
                ? "Le sujet principal, les prochains délais et les articles à ouvrir ensuite."
                : "Sijè prensipal la, pwochen dat limit yo ak atik pou louvri apre sa."}
            </p>
          </div>
          <Link href={lq("/news")} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
            {fr ? "Tout voir →" : "Wè tout →"}
          </Link>
        </div>

        {allArticlesFiltered.length > 0 ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              {allArticlesFiltered[0] && (
                <ArticleCard article={allArticlesFiltered[0]} lang={lang} variant="featured" />
              )}
              {allArticlesFiltered.length > 1 && (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {allArticlesFiltered.slice(1, 3).map((a) => (
                    <ArticleCard key={a.id} article={a} lang={lang} />
                  ))}
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <div className="overflow-hidden rounded-[1.5rem] border border-orange-200/70 bg-[linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,255,255,0.96))] p-4 shadow-sm dark:border-orange-900/30 dark:bg-[linear-gradient(135deg,rgba(41,24,12,0.92),rgba(28,20,20,0.9))]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-800 dark:text-stone-100">
                      <Clock className="h-3 w-3 text-orange-500" />
                      {fr ? "Échéances proches" : "Dat limit ki pre"}
                    </h3>
                    <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                      {fr ? "Le plus urgent à traiter aujourd'hui." : "Sa ki pi ijan pou trete jodi a."}
                    </p>
                  </div>
                  <Link
                    href={lq("/closing-soon")}
                    className="text-xs font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-300"
                  >
                    {fr ? "Voir tout" : "Wè tout"}
                  </Link>
                </div>
                <div className="space-y-0">
                  {topUrgent.slice(0, 5).map((item) => {
                    const status = getDeadlineStatus(item.dateISO, lang);
                    return (
                      <Link
                        key={`side-${item.id}`}
                        href={item.href}
                        className="news-item-compact group"
                      >
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${badgeStyle(status.badgeVariant)}`}>
                          {status.badgeLabel}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium leading-snug text-stone-800 line-clamp-2 transition-colors dark:text-stone-200">
                            {item.title}
                          </h3>
                          <span className="text-xs text-stone-400">
                            {item.kind === "bourse" ? (fr ? "Bourse" : "Bous") : (fr ? "Événement" : "Evènman")}
                            {" · "}
                            {status.humanLine}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                  {topUrgent.length === 0 && (
                    <p className="py-6 text-center text-sm text-stone-400 dark:text-stone-500">
                      {fr ? "Aucune échéance urgente." : "Pa gen dat limit ijan."}
                    </p>
                  )}
                </div>
              </div>

              {allArticlesFiltered.length > 3 && (
                <div className="overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">
                        {fr ? "À ouvrir ensuite" : "Pou louvri apre sa"}
                      </h3>
                      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                        {fr ? "Un deuxième niveau de lecture rapide." : "Yon dezyèm nivo lekti rapid."}
                      </p>
                    </div>
                    <Link
                      href={lq("/succes")}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      {fr ? "Inspiration" : "Enspirasyon"}
                    </Link>
                  </div>
                  <div className="space-y-0">
                    {allArticlesFiltered.slice(3, 8).map((a, i) => (
                      <Link
                        key={a.id}
                        href={lq(`/news/${a.id}`)}
                        className="news-item-compact group"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded font-serif text-sm font-bold text-stone-300 dark:text-stone-600">
                          {i + 4}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-medium leading-snug text-stone-800 line-clamp-2 transition-colors dark:text-stone-200">
                            {a.title}
                          </h3>
                          <div className="source-line mt-0.5">
                            {a.sourceName && <span className="source-name">{a.sourceName}</span>}
                            {a.sourceName && a.publishedAt && <span className="source-dot">·</span>}
                            {a.publishedAt && <span>{new Date(a.publishedAt).toLocaleDateString(fr ? "fr-FR" : "fr-HT", { day: "numeric", month: "short" })}</span>}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        ) : (
          <div className="section-shell py-16 text-center">
            <Newspaper className="mx-auto mb-3 h-8 w-8 text-stone-300" />
            <p className="text-stone-400">{fr ? "Aucun article pour le moment." : "Pa gen atik pou kounye a."}</p>
          </div>
        )}
      </section>

      {/* ── DASHBOARD TABS ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="section-rule" />
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-900 dark:text-white">
              <Briefcase className="h-3.5 w-3.5 text-blue-600" />
              {fr ? "Tableau de bord" : "Tablo"}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {fr
                ? "Bourses, échéances, parcours, histoire et nouvelles — tout en un."
                : "Bous, dat limit, pakou, istwa ak nouvèl — tout nan youn."}
            </p>
          </div>
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
        <section className="space-y-4">
          <div className="section-rule" />
          <SectionHeader
            icon={<GraduationCap className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            title={fr ? "Étudier à l'étranger" : "Etidye aletranje"}
            href={lq("/universites")}
            cta={fr ? "Toutes les universités" : "Tout inivèsite yo"}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rotatedUnis.map((u) => (
              <div key={u.id} className="card p-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-stone-900 line-clamp-2 dark:text-white">{u.name}</h3>
                  <span className="ml-2 shrink-0 text-xs text-stone-400">{COUNTRY_LABELS[u.country]?.flag && <CountryFlag code={COUNTRY_LABELS[u.country].flag} />}</span>
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

      {/* ── SECTIONS NAVIGATION ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="section-rule" />
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-900 dark:text-white">
              <Compass className="h-3.5 w-3.5 text-blue-600" />
              {fr ? "Choisir une voie" : "Chwazi yon chemen"}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {fr
                ? "Entrez par besoin: trouver une date limite, comparer des universités ou suivre le fil."
                : "Antre pa bezwen: jwenn yon dat limit, konpare inivèsite oswa swiv fil la."}
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              href: lq("/closing-soon"),
              label: fr ? "Dates limites" : "Dat limit",
              Icon: Clock,
              desc: fr ? "Les prochains dossiers à traiter." : "Pwochen dosye pou trete.",
              stat: `${topUrgent.length}`,
              accent: "from-orange-500/15 to-red-500/10",
              iconWrap: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
            },
            {
              href: lq("/bourses"),
              label: fr ? "Bourses" : "Bous",
              Icon: DollarSign,
              desc: fr ? "Comparer les aides ouvertes." : "Konpare èd ki ouvè yo.",
              stat: `${closingScholarships45.length}`,
              accent: "from-emerald-500/15 to-teal-500/10",
              iconWrap: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
            },
            {
              href: lq("/parcours"),
              label: fr ? "Parcours" : "Pakou",
              Icon: Compass,
              desc: fr ? "Choisir un plan d'action." : "Chwazi yon plan aksyon.",
              stat: `${allPathways.length}`,
              accent: "from-violet-500/15 to-blue-500/10",
              iconWrap: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
            },
            {
              href: lq("/universites"),
              label: fr ? "Universités" : "Inivèsite",
              Icon: GraduationCap,
              desc: fr ? "Repérer les campus accueillants." : "Repere kanpis ki akeyan yo.",
              stat: `${allUniversities.length}`,
              accent: "from-sky-500/15 to-teal-500/10",
              iconWrap: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
            },
            {
              href: lq("/succes"),
              label: fr ? "Succès" : "Siksè",
              Icon: Award,
              desc: fr ? "Lire des parcours inspirants." : "Li pakou ki bay enspirasyon.",
              stat: `${succesArticles.length}`,
              accent: "from-amber-500/15 to-rose-500/10",
              iconWrap: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
            },
            {
              href: lq("/news"),
              label: fr ? "Actualités" : "Nouvèl",
              Icon: Newspaper,
              desc: fr ? "Revenir au fil complet." : "Retounen sou fil konplè a.",
              stat: `${allArticlesFiltered.length}`,
              accent: "from-blue-500/15 to-stone-400/10",
              iconWrap: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-start gap-3 overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift dark:border-stone-800 dark:bg-stone-900`}
            >
              <div className={`pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br ${item.accent}`} />
              <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.iconWrap}`}>
                <item.Icon className="h-5 w-5" />
              </div>
              <div className="relative ml-3 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-900 dark:text-white">{item.label}</p>
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
                    {item.stat}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{item.desc}</p>
              </div>
              <ArrowRight className="relative ml-3 h-4 w-4 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 dark:text-stone-600" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
