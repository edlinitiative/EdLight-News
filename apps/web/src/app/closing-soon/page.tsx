/**
 * /closing-soon — Aggregated upcoming deadlines page.
 *
 * Server component that merges:
 *   - Scholarships closing within 30 days
 *   - Haiti calendar events within 14 days
 * Passes unified list to client component for tab filtering.
 */

import Link from "next/link";
import { Clock } from "lucide-react";
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
import { ClosingSoonTabs } from "./tabs";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Échéances à venir | EdLight News",
  description: "Bourses et événements avec des dates limites bientôt.",
};

// ── Shared item type passed to client ────────────────────────────────────────

export interface ClosingItem {
  id: string;
  kind: "bourse" | "calendrier";
  title: string;
  dateISO: string;
  days: number;
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
      <div className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <Clock className="h-7 w-7 text-red-600" />
          {fr ? "Échéances à venir" : "Dat limit k ap vini"}
        </h1>
        <p className="text-gray-500">
          {fr
            ? "Bourses qui ferment bientôt et événements du calendrier haïtien à ne pas manquer."
            : "Bous ki pral fèmen byento ak evènman kalandriye ayisyen pou pa rate."}
        </p>
      </div>

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
