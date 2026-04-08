/**
 * Accueil — Student-first homepage.
 *
 * Layout: Dark hero → Urgency strip → News + sidebar → Dashboard tabs → Universities → Nav grid
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarDays,
  GraduationCap,
  Clock,
  Compass,
  Newspaper,
  DollarSign,
  ArrowRight,
  Award,
  ChevronRight,
} from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
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
import { CountryFlag } from "@/components/CountryFlag";
import { TauxDuJourWidget } from "@/components/TauxDuJourWidget";
import { fetchTauxBRH } from "@/lib/brh";
import { isTauxDuJourArticle } from "@/lib/tauxFilter";
import { buildOgMetadata } from "@/lib/og";
import { withLangParam } from "@/lib/utils";

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
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <h2 className="shrink-0 text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white">
        {title}
      </h2>
      <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
      {href && linkLabel && (
        <Link href={href} className="shrink-0 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400">
          {linkLabel}
        </Link>
      )}
    </div>
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

              {/* ── Right column — live widgets ── */}
              <div className="hidden lg:flex lg:flex-col lg:gap-4">
                {/* Taux widget */}
                <TauxDuJourWidget lang={lang} data={taux} />

                {/* Upcoming deadlines */}
                {topUrgent.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04]">
                    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {fr ? "Dates urgentes" : "Dat ijan"}
                      </span>
                      <Link href={lq("/closing-soon")} className="text-[10px] font-semibold text-blue-400 hover:text-blue-300">
                        {fr ? "Voir tout" : "Wè tout"} →
                      </Link>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {topUrgent.slice(0, 4).map((item) => {
                        const status = getDeadlineStatus(item.dateISO, lang);
                        return (
                          <Link
                            key={`hero-urgent-${item.id}`}
                            href={item.href}
                            className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.04]"
                          >
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${badgeStyle(status.badgeVariant)}`}>
                              {status.badgeLabel}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-400">
                              {item.title}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Upcoming events */}
                {upcomingEvents.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04]">
                    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {fr ? "Prochains événements" : "Pwochen evènman"}
                      </span>
                      <Link href={lq("/calendrier")} className="text-[10px] font-semibold text-blue-400 hover:text-blue-300">
                        {fr ? "Calendrier" : "Kalandriye"} →
                      </Link>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                      {upcomingEvents.slice(0, 3).map((ev) => {
                        const dateObj = ev.dateISO ? new Date(ev.dateISO + "T00:00:00") : null;
                        return (
                          <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-600/20 text-blue-300">
                              {dateObj ? (
                                <>
                                  <span className="text-[10px] font-black leading-none">{dateObj.getDate()}</span>
                                  <span className="text-[8px] uppercase leading-none">{dateObj.toLocaleDateString(fr ? "fr-FR" : "fr-HT", { month: "short" })}</span>
                                </>
                              ) : (
                                <CalendarDays className="h-4 w-4" />
                              )}
                            </div>
                            <p className="min-w-0 flex-1 truncate text-xs text-slate-400">{ev.title}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

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
          <SectionHeader
            title={fr ? "À la une" : "Premye paj"}
            href={lq("/news")}
            linkLabel={fr ? "Tout voir →" : "Wè tout →"}
          />

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

        {/* ── TABLEAU DE BORD ─────────────────────────────────────────────── */}
        <section>
          <SectionHeader
            title={fr ? "Tableau de Bord" : "Tablo"}
            href={lq("/bourses")}
            linkLabel={fr ? "Consulter tout →" : "Wè tout →"}
          />
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                href: lq("/bourses"),
                Icon: DollarSign,
                iconColor: "text-blue-600 dark:text-blue-400",
                iconBg: "bg-blue-50 dark:bg-blue-950/30",
                title: fr ? "Bourses" : "Bous",
                desc: fr
                  ? `Explorez ${closingScholarships45.length} bourses actives pour l'année académique.`
                  : `Eksplore ${closingScholarships45.length} bous aktif pou ane akademik la.`,
                cta: fr ? "Voir les opportunités" : "Wè okazyon yo",
              },
              {
                href: lq("/calendrier"),
                Icon: CalendarDays,
                iconColor: "text-orange-600 dark:text-orange-400",
                iconBg: "bg-orange-50 dark:bg-orange-950/30",
                title: fr ? "Calendrier" : "Kalandriye",
                desc: fr
                  ? "Ne manquez jamais une date limite grâce à notre planning académique."
                  : "Pa janm manke yon dat limit gras a planin akademik nou.",
                cta: fr ? "Accéder à l'agenda" : "Antre nan ajanda",
              },
              {
                href: lq("/parcours"),
                Icon: Compass,
                iconColor: "text-violet-600 dark:text-violet-400",
                iconBg: "bg-violet-50 dark:bg-violet-950/30",
                title: fr ? "Parcours" : "Pakou",
                desc: fr
                  ? "Tracez votre chemin avec nos guides d'orientation personnalisés."
                  : "Trase chemen ou ak gid oryantasyon pèsonalize nou yo.",
                cta: fr ? "Découvrir les voies" : "Dekouvri wout yo",
              },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lift dark:border-stone-800 dark:bg-stone-900"
              >
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${card.iconBg}`}>
                  <card.Icon className={`h-6 w-6 ${card.iconColor}`} />
                </div>
                <h3 className="mb-2 text-lg font-bold text-stone-900 dark:text-white">{card.title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-stone-500 dark:text-stone-400">{card.desc}</p>
                <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400">
                  {card.cta}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── UNIVERSITIES ────────────────────────────────────────────────── */}
        {rotatedUnis.length > 0 && (
          <section>
            <SectionHeader
              title={fr ? "Étudier à l'étranger" : "Etidye aletranje"}
              href={lq("/universites")}
              linkLabel={fr ? "Toutes les universités →" : "Tout inivèsite yo →"}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:[&>*:first-child]:col-span-2 lg:[&>*:first-child]:row-span-2">
              {rotatedUnis.slice(0, 3).map((u, i) => (
                <div
                  key={u.id}
                  className={[
                    "group relative flex flex-col justify-end overflow-hidden rounded-3xl p-6",
                    i === 0
                      ? "min-h-[320px] bg-gradient-to-br from-stone-900 via-blue-950 to-stone-900"
                      : "min-h-[160px] bg-gradient-to-br from-stone-800 to-stone-900",
                  ].join(" ")}
                >
                  {/* Decorative glow */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="relative">
                    <div className="mb-2 flex items-center gap-2">
                      {COUNTRY_LABELS[u.country]?.flag && (
                        <CountryFlag code={COUNTRY_LABELS[u.country].flag} />
                      )}
                      {u.haitianFriendly && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          ✓ {fr ? "Accueil HT" : "Akèy HT"}
                        </span>
                      )}
                    </div>
                    <h3 className={[
                      "font-extrabold leading-tight text-white",
                      i === 0 ? "text-xl" : "text-base",
                    ].join(" ")}>
                      {u.name}
                    </h3>
                    {u.city && (
                      <p className="mt-1 text-xs text-white/60">
                        {u.city}{u.country ? `, ${fr ? COUNTRY_LABELS[u.country]?.fr : COUNTRY_LABELS[u.country]?.ht}` : ""}
                      </p>
                    )}
                    {u.admissionsUrl && (
                      <a
                        href={u.admissionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-300 hover:text-blue-200"
                      >
                        {fr ? "Admissions" : "Admisyon"} <ArrowRight className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {/* CTA card — col-span-2 */}
              <div className="relative overflow-hidden rounded-3xl bg-blue-600 p-8 sm:col-span-2">
                <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
                <div className="relative">
                  <h3 className="text-xl font-extrabold text-white">
                    {fr ? "Trouvez votre destination." : "Jwenn destinasyon ou."}
                  </h3>
                  <p className="mt-2 text-sm text-blue-100">
                    {fr
                      ? "Comparez les universités qui correspondent à votre projet."
                      : "Konpare inivèsite ki koresponn ak pwojè ou."}
                  </p>
                  <Link
                    href={lq("/universites")}
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-blue-700 shadow-lg transition hover:-translate-y-0.5"
                  >
                    {fr ? `Explorer ${allUniversities.length}+ Profils` : `Eksplore ${allUniversities.length}+ Pwofil`}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── QUICK NAV ────────────────────────────────────────────────────── */}
        <section>
          <SectionHeader
            title={fr ? "Explorer" : "Eksplore"}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                href: lq("/closing-soon"),
                Icon: Clock,
                label: fr ? "Dates limites" : "Dat limit",
                desc: fr ? "Ne manquez plus aucun appel à candidature." : "Pa janm manke yon apèl kandida.",
                bg: "bg-orange-50 dark:bg-orange-950/20",
                iconColor: "text-orange-500",
              },
              {
                href: lq("/bourses"),
                Icon: DollarSign,
                label: fr ? "Bourses" : "Bous",
                desc: fr ? "Aides financières et bourses d'excellence." : "Èd finansyè ak bous ekselans.",
                bg: "bg-blue-50 dark:bg-blue-950/20",
                iconColor: "text-blue-500",
              },
              {
                href: lq("/succes"),
                Icon: Award,
                label: fr ? "Succès" : "Siksè",
                desc: fr ? "Histoires inspirantes de nos lauréats." : "Istwa enspirantan de laurea nou yo.",
                bg: "bg-violet-50 dark:bg-violet-950/20",
                iconColor: "text-violet-500",
              },
              {
                href: lq("/news"),
                Icon: Newspaper,
                label: fr ? "Conseils" : "Konsèy",
                desc: fr ? "Astuces pour optimiser vos dossiers." : "Astwis pou optimize dosye ou yo.",
                bg: "bg-stone-100 dark:bg-stone-800",
                iconColor: "text-stone-600 dark:text-stone-400",
              },
            ].map((tile) => (
              <Link
                key={tile.href}
                href={tile.href}
                className={`group flex flex-col rounded-3xl p-8 transition-all hover:-translate-y-1 ${tile.bg}`}
              >
                <tile.Icon className={`mb-4 h-8 w-8 ${tile.iconColor}`} />
                <h4 className="text-base font-bold text-stone-900 dark:text-white">{tile.label}</h4>
                <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-stone-400">{tile.desc}</p>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
