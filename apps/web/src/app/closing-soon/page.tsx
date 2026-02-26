/**
 * /closing-soon — Aggregated upcoming deadlines page.
 *
 * Server component that merges:
 *   - Scholarships closing within 30 days
 *   - Haiti calendar events within 14 days
 * Passes unified list to client component for tab filtering.
 */

import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { getLangFromSearchParams } from "@/lib/content";
import {
  fetchScholarshipsClosingSoon,
  fetchUpcomingCalendarEvents,
  COUNTRY_LABELS,
} from "@/lib/datasets";
import {
  parseISODateSafe,
  daysUntil,
  getNextRelevantDate,
} from "@/lib/deadlines";
import { getCalendarGeo, type CalendarGeo } from "@/lib/calendarGeo";
import { ClosingSoonTabs } from "./tabs";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Échéances à venir · EdLight News" : "Dat limit k ap vini · EdLight News";
  const description = fr
    ? "Bourses qui ferment bientôt et événements du calendrier haïtien à ne pas manquer."
    : "Bous ki pral fèmen byento ak evènman kalandriye ayisyen pou pa rate.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/closing-soon", lang }),
  };
}

// ── Shared item type passed to client ────────────────────────────────────────

export interface ClosingItem {
  id: string;
  kind: "bourse" | "calendrier";
  title: string;
  dateISO: string;
  days: number;
  /** Geo classification for correct tab labels */
  geo?: CalendarGeo;
  /** Extra context: institution, country, etc. */
  subtitle?: string;
  /** Link to apply or view */
  actionUrl?: string;
  actionLabel?: { fr: string; ht: string };
}

export default async function ClosingSoonPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";

  let scholarships: Awaited<ReturnType<typeof fetchScholarshipsClosingSoon>>;
  let calEvents: Awaited<ReturnType<typeof fetchUpcomingCalendarEvents>>;
  try {
    [scholarships, calEvents] = await Promise.all([
      fetchScholarshipsClosingSoon(30),
      fetchUpcomingCalendarEvents(),
    ]);
  } catch (err) {
    console.error("[EdLight] /closing-soon fetch failed:", err);
    scholarships = [];
    calEvents = [];
  }

  // Build unified list
  const items: ClosingItem[] = [];

  for (const s of scholarships) {
    const d = parseISODateSafe(s.deadline?.dateISO);
    if (!d) continue;
    const days = daysUntil(d);
    if (days < 0 || days > 30) continue;
    const cl = COUNTRY_LABELS[s.country];
    items.push({
      id: s.id,
      kind: "bourse",
      title: s.name,
      dateISO: s.deadline!.dateISO!,
      days,
      subtitle: cl ? `${cl.flag} ${fr ? cl.fr : cl.ht}` : undefined,
      actionUrl: s.howToApplyUrl ?? s.officialUrl,
      actionLabel: { fr: "Postuler →", ht: "Aplike →" },
    });
  }

  for (const ev of calEvents) {
    const d = getNextRelevantDate(ev);
    if (!d) continue;
    const days = daysUntil(d);
    if (days < 0 || days > 14) continue;
    const iso = ev.dateISO ?? ev.startDateISO ?? "";
    items.push({
      id: ev.id,
      kind: "calendrier",
      title: ev.title,
      dateISO: iso,
      days,
      geo: getCalendarGeo(ev),
      subtitle: ev.institution ?? undefined,
      actionUrl: ev.officialUrl,
      actionLabel: { fr: "Voir →", ht: "Wè →" },
    });
  }

  // Sort soonest first
  items.sort((a, b) => a.days - b.days);

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="section-shell p-0">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-50 via-white to-orange-50 dark:from-red-950/30 dark:via-slate-900 dark:to-orange-950/20 p-8 md:p-12">
          <div className="absolute top-4 right-4 text-red-200 dark:text-red-800">
            <Sparkles className="h-16 w-16 opacity-30" />
          </div>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight dark:text-white">
            <Clock className="h-7 w-7 text-red-600" />
            {fr ? "Échéances à venir" : "Dat limit k ap vini"}
          </h1>
          <p className="mt-2 max-w-xl text-gray-500 dark:text-slate-400">
            {fr
              ? "Bourses qui ferment bientôt et événements du calendrier haïtien à ne pas manquer."
              : "Bous ki pral fèmen byento ak evènman kalandriye ayisyen pou pa rate."}
          </p>
        </div>
      </section>

      {/* Tabs + list (client component) */}
      <ClosingSoonTabs items={items} lang={lang} />

      {/* Back link */}
      <div className="pt-4">
        <Link
          href={lang === "ht" ? "/?lang=ht" : "/"}
          className="text-sm text-brand-600 hover:underline"
        >
          {fr ? "← Retour à l'accueil" : "← Retounen lakay"}
        </Link>
      </div>
    </div>
  );
}
