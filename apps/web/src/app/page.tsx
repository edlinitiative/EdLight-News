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
import { Suspense } from "react";
import { buildOgMetadata } from "@/lib/og";

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
  icon?: React.ReactNode;
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
    <div className="space-y-10">
      {/* ── BREAKING / URGENCY TICKER ──────────────────────────────────── */}
      {topUrgent.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200/60 bg-red-50/50 px-4 py-2.5 dark:border-red-900/30 dark:bg-red-950/20">
          <span className="badge-breaking shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-soft" />
            {fr ? "Urgent" : "Ijan"}
          </span>
          <div className="overflow-x-auto tab-scroll">
            <div className="flex items-center gap-6 text-sm">
              {topUrgent.slice(0, 3).map((item, i) => (
                <Link
                  key={`ticker-${item.id}`}
                  href={item.href}
                  className="flex shrink-0 items-center gap-2 text-stone-700 transition-colors hover:text-red-700 dark:text-stone-300 dark:hover:text-red-400"
                >
                  <span className="font-medium line-clamp-1">{item.title}</span>
                  {(() => { const st = getDeadlineStatus(item.dateISO, lang); return (
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${badgeStyle(st.badgeVariant)}`}>
                      {st.badgeLabel}
                    </span>
                  ); })()}
                  {i < Math.min(topUrgent.length, 3) - 1 && (
                    <span className="text-stone-300 dark:text-stone-600">|</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* ── TAUX BRH DU JOUR WIDGET ─────────────────────────────────── */}
      <TauxDuJourWidget lang={lang} data={taux} />
      {/* ── LEAD STORY + SIDEBAR (Newspaper Layout) ────────────────────── */}
      <section>
        <div className="mb-4 section-rule" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-900 dark:text-white">
            <Newspaper className="h-3.5 w-3.5 text-blue-600" />
            {fr ? "À la une" : "Premye paj"}
          </h2>
          <Link href={lq("/news")} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400">
            {fr ? "Tout voir →" : "Wè tout →"}
          </Link>
        </div>

        {allArticlesFiltered.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Lead article */}
            <div>
              {allArticlesFiltered[0] && (
                <ArticleCard article={allArticlesFiltered[0]} lang={lang} variant="featured" />
              )}
              {/* Secondary stories row */}
              {allArticlesFiltered.length > 1 && (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {allArticlesFiltered.slice(1, 3).map((a) => (
                    <ArticleCard key={a.id} article={a} lang={lang} />
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar: deadlines + latest */}
            <aside className="space-y-5 lg:border-l lg:border-stone-200 lg:pl-6 dark:lg:border-stone-800">
              {/* Urgency sidebar */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">
                  <Clock className="h-3 w-3 text-orange-500" />
                  {fr ? "Échéances proches" : "Dat limit ki pre"}
                </h3>
                <div className="space-y-0">
                  {topUrgent.slice(0, 5).map((item) => (
                    <Link
                      key={`side-${item.id}`}
                      href={item.href}
                      className="news-item-compact group"
                    >
                      {(() => { const st = getDeadlineStatus(item.dateISO, lang); return (
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${badgeStyle(st.badgeVariant)}`}>
                          {st.badgeLabel}
                        </div>
                      ); })()}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-medium leading-snug text-stone-800 line-clamp-2 transition-colors dark:text-stone-200">
                          {item.title}
                        </h3>
                        <span className="text-xs text-stone-400">
                          {item.kind === "bourse" ? (fr ? "Bourse" : "Bous") : (fr ? "Événement" : "Evènman")}
                          {" · "}
                          {getDeadlineStatus(item.dateISO, lang).humanLine}
                        </span>
                      </div>
                    </Link>
                  ))}
                  {topUrgent.length === 0 && (
                    <p className="py-6 text-center text-sm text-stone-400 dark:text-stone-500">
                      {fr ? "Aucune échéance urgente." : "Pa gen dat limit ijan."}
                    </p>
                  )}
                </div>
              </div>

              {/* More articles */}
              {allArticlesFiltered.length > 3 && (
                <div>
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">
                    {fr ? "Aussi dans l'actu" : "Tou nan aktyalite"}
                  </h3>
                  <div className="space-y-0">
                    {allArticlesFiltered.slice(3, 8).map((a, i) => (
                      <Link
                        key={a.id}
                        href={`/news/${a.id}?lang=${lang}`}
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

      {/* ── QUICK STATS BAR ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: fr ? "Bourses ouvertes" : "Bous ouvè", value: String(boursesClosing.length), Icon: DollarSign, href: lq("/bourses"), color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
          { label: fr ? "Universités" : "Inivèsite", value: String(rotatedUnis.length), Icon: GraduationCap, href: lq("/universites"), color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
          { label: fr ? "Parcours" : "Pakou", value: String(pathways.length), Icon: Compass, href: lq("/parcours"), color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/30" },
          { label: fr ? "Événements" : "Evènman", value: String(upcomingEvents.length), Icon: CalendarDays, href: lq("/calendrier"), color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30" },
        ].map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-lift dark:border-stone-800 dark:bg-stone-900"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
              <stat.Icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-stone-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

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
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-900 dark:text-white">
          <Compass className="h-3.5 w-3.5 text-blue-600" />
          {fr ? "Rubriques" : "Ribrik"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: lq("/closing-soon"), label: fr ? "Dates limites" : "Dat limit", Icon: Clock, desc: fr ? "Échéances proches" : "Dat limit ki pre", stripe: "border-t-2 border-t-orange-500" },
            { href: lq("/bourses"), label: fr ? "Bourses" : "Bous", Icon: DollarSign, desc: fr ? "Base de données" : "Baz done", stripe: "border-t-2 border-t-emerald-500" },
            { href: lq("/histoire"), label: fr ? "Histoire" : "Istwa", Icon: BookOpen, desc: fr ? "Haïti au quotidien" : "Ayiti chak jou", stripe: "border-t-2 border-t-violet-500" },
            { href: lq("/news"), label: fr ? "Actualités" : "Nouvèl", Icon: Newspaper, desc: fr ? "Fil complet" : "Fil konplè", stripe: "border-t-2 border-t-blue-500" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift dark:border-stone-800 dark:bg-stone-900 ${item.stripe}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 transition-colors group-hover:bg-stone-200 dark:bg-stone-800 dark:group-hover:bg-stone-700">
                <item.Icon className="h-5 w-5 text-stone-500 dark:text-stone-400" />
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
