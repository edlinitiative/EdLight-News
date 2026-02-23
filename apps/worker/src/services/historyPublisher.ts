/**
 * Haiti History Daily Publisher
 *
 * Runs once per tick, at ~07:10 Haiti time (UTC-5).
 * Picks today's MM-DD, fetches almanac entries + holiday, produces a single
 * published item with FR + HT content versions.
 *
 * Content is TEMPLATE-BASED from curated structured fields — no LLM invention.
 * HT translations use existing seed data (name_ht / description_ht).
 *
 * All facts must originate from the haiti_history_almanac & haiti_holidays
 * collections, which are seeded from verified sources.
 */

import {
  haitiHistoryAlmanacRepo,
  haitiHolidaysRepo,
  historyPublishLogRepo,
  itemsRepo,
  contentVersionsRepo,
} from "@edlight-news/firebase";
import type {
  HaitiHistoryAlmanacEntry,
  HaitiHoliday,
  ContentLanguage,
  QualityFlags,
} from "@edlight-news/types";

// ── Config ──────────────────────────────────────────────────────────────────

/** Haiti UTC offset (EST, no DST). */
const HAITI_UTC_OFFSET_HOURS = -5;

/** Only publish once per day — skip if log already says "published". */
const PUBLISH_HOUR_MIN = 6;
const PUBLISH_HOUR_MAX = 22;

/** Maximum almanac entries to include in one daily post. */
const MAX_ENTRIES_PER_POST = 3;

// ── Helpers ─────────────────────────────────────────────────────────────────

function getHaitiNow(): Date {
  const utc = new Date();
  return new Date(utc.getTime() + HAITI_UTC_OFFSET_HOURS * 60 * 60 * 1000);
}

function getTodayMonthDay(): string {
  const d = getHaitiNow();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

function getTodayISO(): string {
  const d = getHaitiNow();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ── Content templates ───────────────────────────────────────────────────────

function buildFrenchBody(
  entries: HaitiHistoryAlmanacEntry[],
  holidays: HaitiHoliday[],
  monthDay: string,
): { title: string; summary: string; body: string; sections: { heading: string; content: string }[] } {
  const [mm, dd] = monthDay.split("-");
  const dateLabel = `${dd}/${mm}`;

  const sections: { heading: string; content: string }[] = [];

  // Holiday section
  if (holidays.length > 0) {
    const holidayTexts = holidays.map((h) => {
      let text = `**${h.name_fr}**`;
      if (h.description_fr) text += ` — ${h.description_fr}`;
      if (h.isNationalHoliday) text += " 🇭🇹 *(Fête nationale)*";
      return text;
    });
    sections.push({
      heading: "🎉 Fèt du jour",
      content: holidayTexts.join("\n\n"),
    });
  }

  // History entries
  for (const entry of entries) {
    const yearLabel = entry.year ? ` (${entry.year})` : "";
    let content = entry.summary_fr;
    if (entry.student_takeaway_fr) {
      content += `\n\n💡 **Pour les étudiants :** ${entry.student_takeaway_fr}`;
    }
    if (entry.sources && entry.sources.length > 0) {
      const sourceLinks = entry.sources.map((s) => `[${s.label}](${s.url})`).join(" · ");
      content += `\n\n📚 Sources : ${sourceLinks}`;
    }
    sections.push({
      heading: `${entry.title_fr}${yearLabel}`,
      content,
    });
  }

  const title = holidays.length > 0
    ? `${dateLabel} — ${holidays[0]!.name_fr} & Histoire du jour`
    : `${dateLabel} — Histoire d'Haïti du jour`;

  const summary = entries.length > 0
    ? entries[0]!.summary_fr.slice(0, 200)
    : holidays.length > 0
      ? (holidays[0]!.description_fr ?? holidays[0]!.name_fr)
      : `Découvrez ce qui s'est passé un ${dateLabel} dans l'histoire d'Haïti.`;

  const body = sections.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n");

  return { title, summary, body, sections };
}

function buildCreoleBody(
  entries: HaitiHistoryAlmanacEntry[],
  holidays: HaitiHoliday[],
  monthDay: string,
): { title: string; summary: string; body: string; sections: { heading: string; content: string }[] } {
  const [mm, dd] = monthDay.split("-");
  const dateLabel = `${dd}/${mm}`;

  const sections: { heading: string; content: string }[] = [];

  // Holiday section in Creole
  if (holidays.length > 0) {
    const holidayTexts = holidays.map((h) => {
      let text = `**${h.name_ht}**`;
      if (h.description_ht) text += ` — ${h.description_ht}`;
      if (h.isNationalHoliday) text += " 🇭🇹 *(Fèt nasyonal)*";
      return text;
    });
    sections.push({
      heading: "🎉 Fèt jou a",
      content: holidayTexts.join("\n\n"),
    });
  }

  // History entries — use French text with Creole heading (we don't have full HT translations for history)
  for (const entry of entries) {
    const yearLabel = entry.year ? ` (${entry.year})` : "";
    let content = entry.summary_fr; // Fallback to French for almanac content
    if (entry.student_takeaway_fr) {
      content += `\n\n💡 **Pou etidyan yo :** ${entry.student_takeaway_fr}`;
    }
    if (entry.sources && entry.sources.length > 0) {
      const sourceLinks = entry.sources.map((s) => `[${s.label}](${s.url})`).join(" · ");
      content += `\n\n📚 Sous : ${sourceLinks}`;
    }
    sections.push({
      heading: `${entry.title_fr}${yearLabel}`,
      content,
    });
  }

  const title = holidays.length > 0
    ? `${dateLabel} — ${holidays[0]!.name_ht} & Istwa jou a`
    : `${dateLabel} — Istwa Ayiti jou a`;

  const summary = holidays.length > 0
    ? (holidays[0]!.description_ht ?? holidays[0]!.name_ht)
    : `Dekouvri sa ki te pase yon ${dateLabel} nan istwa Ayiti.`;

  const body = sections.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n");

  return { title, summary, body, sections };
}

// ── Main publisher ──────────────────────────────────────────────────────────

export async function runHistoryDailyPublisher(): Promise<{
  published: boolean;
  skipped: boolean;
  reason: string;
  itemId?: string;
}> {
  const haitiNow = getHaitiNow();
  const haitiHour = haitiNow.getUTCHours();
  const monthDay = getTodayMonthDay();
  const dateISO = getTodayISO();

  // Gate: only publish during daytime Haiti hours
  if (haitiHour < PUBLISH_HOUR_MIN || haitiHour > PUBLISH_HOUR_MAX) {
    return { published: false, skipped: true, reason: `Outside publish hours (${haitiHour}h Haiti)` };
  }

  // Gate: check if already published today
  const existingLog = await historyPublishLogRepo.getByDate(dateISO);
  if (existingLog?.status === "done") {
    return { published: false, skipped: true, reason: "Already published today", itemId: existingLog.publishedItemId };
  }

  // Fetch today's entries + holidays
  const [entries, holidays] = await Promise.all([
    haitiHistoryAlmanacRepo.listByMonthDay(monthDay),
    haitiHolidaysRepo.listByMonthDay(monthDay),
  ]);

  if (entries.length === 0 && holidays.length === 0) {
    await historyPublishLogRepo.upsert({
      dateISO,
      almanacEntryIds: [],
      status: "skipped",
      error: `No almanac entries or holidays for ${monthDay}`,
    });
    return { published: false, skipped: true, reason: `No content for ${monthDay}` };
  }

  // Select up to MAX entries (prefer high confidence first)
  const sortedEntries = [...entries]
    .sort((a, b) => {
      if (a.confidence === "high" && b.confidence !== "high") return -1;
      if (a.confidence !== "high" && b.confidence === "high") return 1;
      return 0;
    })
    .slice(0, MAX_ENTRIES_PER_POST);

  try {
    // Build content for both languages
    const frContent = buildFrenchBody(sortedEntries, holidays, monthDay);
    const htContent = buildCreoleBody(sortedEntries, holidays, monthDay);

    // Collect all citations
    const allCitations = sortedEntries.flatMap((e) =>
      e.sources.map((s) => ({ sourceName: s.label, sourceUrl: s.url })),
    );
    if (holidays.length > 0) {
      for (const h of holidays) {
        for (const s of h.sources) {
          allCitations.push({ sourceName: s.label, sourceUrl: s.url });
        }
      }
    }

    const qualityFlags: QualityFlags = {
      hasSourceUrl: true,
      needsReview: false,
      lowConfidence: false,
      reasons: [],
    };

    // Create item
    const canonicalUrl = `edlight://histoire/${dateISO}`;
    const { item } = await itemsRepo.upsertItemByCanonicalUrl({
      rawItemId: `history-daily-${dateISO}`,
      sourceId: "haiti-history-almanac",
      title: frContent.title,
      summary: frContent.summary,
      canonicalUrl,
      category: "Haiti" as any,
      deadline: null,
      evergreen: true,
      confidence: 0.95,
      qualityFlags,
      citations: allCitations,
      itemType: "utility" as const,
      utilityMeta: {
        series: "HaitiHistory",
        utilityType: "history",
        region: ["HT"],
        citations: allCitations.map((c) => ({ label: c.sourceName, url: c.sourceUrl })),
      },
      audienceFitScore: 0.95,
      geoTag: "HT" as const,
      imageSource: "branded" as const,
    });

    // Create content versions
    for (const lang of ["fr", "ht"] as ContentLanguage[]) {
      const content = lang === "fr" ? frContent : htContent;
      await contentVersionsRepo.createContentVersion({
        itemId: item.id,
        channel: "web",
        language: lang,
        title: content.title,
        summary: content.summary,
        body: content.body,
        status: "published",
        category: "Haiti" as any,
        qualityFlags,
        citations: allCitations,
        sections: content.sections,
        sourceCitations: allCitations.map((c) => ({
          name: c.sourceName,
          url: c.sourceUrl,
        })),
      });
    }

    // Log success
    await historyPublishLogRepo.upsert({
      dateISO,
      publishedItemId: item.id,
      almanacEntryIds: sortedEntries.map((e) => e.id),
      holidayId: holidays[0]?.id,
      status: "done",
    });

    console.log(
      `[history-publisher] Published daily history for ${monthDay}: item=${item.id}, entries=${sortedEntries.length}, holidays=${holidays.length}`,
    );

    return { published: true, skipped: false, reason: "Published", itemId: item.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[history-publisher] Error publishing for ${monthDay}:`, errorMsg);

    await historyPublishLogRepo.upsert({
      dateISO,
      almanacEntryIds: sortedEntries.map((e) => e.id),
      holidayId: holidays[0]?.id,
      status: "failed",
      error: errorMsg,
    });

    return { published: false, skipped: false, reason: errorMsg };
  }
}
