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
 * Single Firestore read for articles, parallel reads for datasets.
 * Cross-section dedup ensures no article appears twice.
 */

import Link from "next/link";
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
  Star,
  AlertTriangle,
} from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { fetchEnrichedFeed } from "@/lib/content";
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
  fetchAlmanacByMonthDay,
  fetchHolidaysByMonthDay,
  getHaitiMonthDay,
  COUNTRY_LABELS,
  TUITION_LABELS,
} from "@/lib/datasets";

export const dynamic = "force-dynamic";

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

  // ── Fetch data in parallel ────────────────────────────────────────────────
  const todayMD = getHaitiMonthDay();
  const [
    allArticles,
    upcomingEvents,
    closingScholarships30,
    closingScholarships45,
    allPathways,
    allUniversities,
    todayAlmanac,
    todayHolidays,
  ] = await Promise.all([
    fetchEnrichedFeed(lang, 300),
    fetchUpcomingCalendarEvents(),
    fetchScholarshipsClosingSoon(30),
    fetchScholarshipsClosingSoon(45),
    fetchAllPathways(),
    fetchAllUniversities(),
    fetchAlmanacByMonthDay(todayMD),
    fetchHolidaysByMonthDay(todayMD),
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

  return (
    <div className="space-y-12">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
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
            <DollarSign className="mr-1.5 inline h-4 w-4" />{fr ? "Bourses ouvertes" : "Bous ouvè"}
          </Link>
          <Link
            href={lq("/calendrier")}
            className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <CalendarDays className="mr-1.5 inline h-4 w-4" />{fr ? "Calendrier" : "Kalandriye"}
          </Link>
          <Link
            href={lq("/parcours")}
            className="inline-flex items-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Compass className="mr-1.5 inline h-4 w-4" />{fr ? "Parcours" : "Pakou"}
          </Link>
          <Link
            href={lq("/histoire")}
            className="inline-flex items-center rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700"
          >
            <BookOpen className="mr-1.5 inline h-4 w-4" />{fr ? "Histoire" : "Istwa"}
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
       *  URGENCY — À ne pas rater cette semaine
       * ═══════════════════════════════════════════════════════════════════ */}
      {topUrgent.length > 0 && (
        <section className="space-y-4 rounded-xl border-2 border-red-200 bg-red-50/30 p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-bold text-red-800">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              {fr ? "À ne pas rater cette semaine" : "Sa pou pa rate semèn sa"}
            </h2>
            <Link
              href={lq("/closing-soon")}
              className="text-sm font-medium text-red-700 hover:underline"
            >
              {fr ? "Voir tout →" : "Wè tout →"}
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {topUrgent.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center gap-3 rounded-lg border border-red-100 bg-white p-3 transition hover:shadow-sm hover:border-red-300"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm">
                  {item.kind === "bourse" ? (
                    <DollarSign className="h-4 w-4 text-amber-600" />
                  ) : (
                    <CalendarDays className="h-4 w-4 text-blue-600" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 line-clamp-1">
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
       *  S1 — Calendrier: Prochaines échéances (above the fold)
       * ═══════════════════════════════════════════════════════════════════ */}
      {(haitiEvents.length > 0 || intlScholarships.length > 0) && (
        <section className="space-y-4 rounded-xl border-2 border-blue-200 bg-blue-50/40 p-6">
          <SectionHeader
            icon={<CalendarDays className="h-5 w-5 text-blue-600" />}
            title={fr ? "Calendrier — Prochaines échéances" : "Kalandriye — Pwochen dat limit"}
            href={lq("/calendrier")}
            cta={fr ? "Voir tout le calendrier →" : "Wè tout kalandriye a →"}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Haiti events */}
            {haitiEvents.map((ev) => {
              const dateObj = ev.dateISO ? new Date(ev.dateISO + "T00:00:00") : null;
              return (
                <div key={ev.id} className="flex items-start gap-3 rounded-lg border border-blue-100 bg-white p-4">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-600 text-white">
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
                      <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                        HT
                      </span>
                      <p className="font-medium text-gray-900 line-clamp-1">{ev.title}</p>
                    </div>
                    {ev.institution && (
                      <p className="mt-0.5 text-xs text-gray-500">{ev.institution}</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* International scholarship deadlines */}
            {intlScholarships.map((s) => {
              const dl = s.deadline;
              const dateObj = dl?.dateISO ? new Date(dl.dateISO + "T00:00:00") : null;
              return (
                <div key={s.id} className="flex items-start gap-3 rounded-lg border border-amber-100 bg-white p-4">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-amber-500 text-white">
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
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <Globe className="h-3 w-3" /> Intl
                      </span>
                      <p className="font-medium text-gray-900 line-clamp-1">{s.name}</p>
                    </div>
                    {dl?.dateISO && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {fr ? "Date limite: " : "Dat limit: "}
                        {dateObj?.toLocaleDateString(fr ? "fr-FR" : "fr-HT", {
                          day: "numeric", month: "long", year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       *  S2 — Bourses: Date limite bientôt
       * ═══════════════════════════════════════════════════════════════════ */}
      {boursesClosing.length > 0 && (
        <section className="space-y-4 rounded-xl border-2 border-amber-200 bg-amber-50/40 p-6">
          <SectionHeader
            icon={<DollarSign className="h-5 w-5 text-amber-600" />}
            title={fr ? "Bourses — Date limite bientôt" : "Bous — Dat limit ki pre"}
            href={lq("/bourses")}
            cta={fr ? "Toutes les bourses →" : "Tout bous yo →"}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boursesClosing.map((s) => {
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

      {/* ═══════════════════════════════════════════════════════════════════
       *  S3 — Parcours recommandés
       * ═══════════════════════════════════════════════════════════════════ */}
      {pathways.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            icon={<Compass className="h-5 w-5 text-brand-600" />}
            title={fr ? "Parcours recommandés" : "Pakou rekòmande"}
            href={lq("/parcours")}
            cta={fr ? "Tous les parcours →" : "Tout pakou yo →"}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {pathways.map((pw) => (
              <Link
                key={pw.id}
                href={lq("/parcours")}
                className="group rounded-lg border bg-white p-5 shadow-sm transition hover:shadow-md hover:border-brand-300"
              >
                <div className="flex items-center gap-2">
                  <Compass className="h-5 w-5 shrink-0 text-brand-600" />
                  <h3 className="font-semibold text-gray-900 text-sm group-hover:text-brand-700">
                    {fr ? pw.title_fr : (pw.title_ht ?? pw.title_fr)}
                  </h3>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {pw.steps.length} {fr ? "étapes" : "etap"}
                  {pw.country ? ` · ${fr ? COUNTRY_LABELS[pw.country]?.fr : COUNTRY_LABELS[pw.country]?.ht}` : ""}
                </p>
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
            icon={<GraduationCap className="h-5 w-5 text-brand-600" />}
            title={fr ? "Étudier à l'étranger" : "Etidye aletranje"}
            href={lq("/universites")}
            cta={fr ? "Toutes les universités →" : "Tout inivèsite yo →"}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rotatedUnis.map((u) => (
              <div key={u.id} className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{u.name}</h3>
                  <span className="ml-1 shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                    {COUNTRY_LABELS[u.country]?.flag}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {u.city && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                      {u.city}
                    </span>
                  )}
                  {u.haitianFriendly && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800">
                      {fr ? "Accueil haïtien" : "Akèy ayisyen"}
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
                    <School className="mr-1 inline h-3 w-3" />{fr ? "Voir le site →" : "Wè sit la →"}
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       *  S5 — Histoire & Fèt du jour
       * ═══════════════════════════════════════════════════════════════════ */}
      {(todayAlmanac.length > 0 || todayHolidays.length > 0) && (
        <section className="space-y-4 rounded-xl border-2 border-amber-200 bg-amber-50/40 p-6">
          <SectionHeader
            icon={<BookOpen className="h-5 w-5 text-amber-600" />}
            title={fr ? "Histoire & Fèt du jour" : "Istwa & Fèt jou a"}
            href={lq("/histoire")}
            cta={fr ? "Voir tout →" : "Wè tout →"}
          />

          {/* Holidays */}
          {todayHolidays.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {todayHolidays.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-4 py-2.5"
                >
                  <Star className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="font-semibold text-sm text-gray-900">
                    {fr ? h.name_fr : h.name_ht}
                  </span>
                  {h.isNationalHoliday && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                      🇭🇹
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Almanac entries (max 2 on homepage) */}
          <div className="grid gap-3 sm:grid-cols-2">
            {todayAlmanac
              .sort((a, b) => {
                if (a.confidence === "high" && b.confidence !== "high") return -1;
                if (a.confidence !== "high" && b.confidence === "high") return 1;
                return 0;
              })
              .slice(0, 2)
              .map((entry) => (
                <div key={entry.id} className="rounded-lg border border-amber-100 bg-white p-4 shadow-sm">
                  <h3 className="font-semibold text-sm text-gray-900">
                    {entry.title_fr}
                    {entry.year && (
                      <span className="ml-1 text-xs text-gray-400">({entry.year})</span>
                    )}
                  </h3>
                  <p className="mt-1.5 text-xs text-gray-600 line-clamp-3">
                    {entry.summary_fr}
                  </p>
                  {entry.student_takeaway_fr && (
                    <p className="mt-2 text-xs text-amber-700 line-clamp-2">
                      💡 {entry.student_takeaway_fr}
                    </p>
                  )}
                </div>
              ))}
          </div>

          {todayAlmanac.length > 2 && (
            <Link
              href={lq("/histoire")}
              className="inline-block text-sm font-medium text-amber-700 hover:underline"
            >
              +{todayAlmanac.length - 2} {fr ? "autres événements →" : "lòt evènman →"}
            </Link>
          )}
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       *  S6 — Fil: Actualité générale (news — below the fold)
       * ═══════════════════════════════════════════════════════════════════ */}
      <div className="border-t border-gray-200 pt-10">
        <SectionHeader
          icon={<Newspaper className="h-5 w-5 text-gray-500" />}
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
          <div className="mt-5 rounded-lg border-2 border-dashed border-gray-200 py-12 text-center text-gray-400">
            <p className="text-base">
              {fr ? "Les actualités arrivent bientôt." : "Nouvèl yo ap vini byento."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
