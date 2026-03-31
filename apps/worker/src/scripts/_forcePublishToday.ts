/**
 * One-off: force-publish today's histoire post, bypassing the hour gate.
 * Usage: npx tsx apps/worker/src/scripts/_forcePublishToday.ts
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

import {
  haitiHistoryAlmanacRepo,
  haitiHistoryAlmanacRawRepo,
  haitiHolidaysRepo,
  historyPublishLogRepo,
  itemsRepo,
  contentVersionsRepo,
} from "@edlight-news/firebase";
import { callGemini, formatContentVersion } from "@edlight-news/generator";
import type { ContentLanguage } from "@edlight-news/types";

// We directly invoke the exported publisher but override the date to "03-31" / "2026-03-31"
// If hour-gate blocks, we call the internal template path manually.

async function main() {
  const monthDay = "03-31";
  const dateISO = "2026-03-31";

  console.log(`Force-publishing histoire for ${dateISO} (${monthDay})…`);

  // Check if already published
  const existingLog = await historyPublishLogRepo.getByDate(dateISO);
  if (existingLog?.status === "done") {
    console.log(`Already published today! itemId=${existingLog.publishedItemId}`);
    process.exit(0);
  }

  // Fetch data
  const [entries, holidays] = await Promise.all([
    haitiHistoryAlmanacRepo.listByMonthDay(monthDay),
    haitiHolidaysRepo.listByMonthDay(monthDay),
  ]);

  console.log(`Almanac entries: ${entries.length}, Holidays: ${holidays.length}`);

  if (entries.length === 0 && holidays.length === 0) {
    console.log("No content for today, nothing to publish.");
    process.exit(1);
  }

  // Sort entries (high confidence first), take top 3
  const sorted = [...entries]
    .sort((a, b) => {
      if (a.confidence === "high" && b.confidence !== "high") return -1;
      if (a.confidence !== "high" && b.confidence === "high") return 1;
      return 0;
    })
    .slice(0, 3);

  for (const e of sorted) {
    console.log(`  • ${e.year} — ${e.title_fr} (${e.confidence})`);
  }

  // Build simple template content (mirrors buildFrenchBody / buildCreoleBody)
  const dateLabel = `31 Mars`;
  const frTitle = `${dateLabel} — Histoire d'Haïti du jour`;

  const frSections = sorted.map((e) => ({
    heading: `${e.year ? e.year + " — " : ""}${e.title_fr}`,
    content: e.summary_fr || e.title_fr,
  }));

  const frBody = frSections.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n");
  const frSummary = sorted[0]?.summary_fr?.slice(0, 200) || sorted[0]?.title_fr || "";

  const htTitle = `${dateLabel} — Istwa Ayiti jodi a`;
  const htSections = sorted.map((e) => ({
    heading: `${e.year ? e.year + " — " : ""}${e.title_ht || e.title_fr}`,
    content: e.summary_ht || e.summary_fr || e.title_fr,
  }));
  const htBody = htSections.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n");
  const htSummary = sorted[0]?.summary_ht?.slice(0, 200) || frSummary;

  // Collect citations
  const citations = sorted.flatMap((e) =>
    (e.sources || []).map((s: any) => ({ sourceName: s.label, sourceUrl: s.url })),
  );

  const canonicalUrl = `edlight://histoire/${dateISO}`;
  const { item } = await itemsRepo.upsertItemByCanonicalUrl({
    rawItemId: `history-daily-${dateISO}`,
    sourceId: "haiti-history-almanac",
    title: frTitle,
    summary: frSummary,
    canonicalUrl,
    category: "event",
    deadline: null,
    evergreen: true,
    confidence: 0.95,
    qualityFlags: {
      hasSourceUrl: true,
      needsReview: false,
      lowConfidence: false,
      reasons: ["force-published"],
    },
    citations,
    itemType: "utility" as const,
    utilityMeta: {
      series: "HaitiHistory",
      utilityType: "history",
      region: ["HT"],
      citations: citations.map((c) => ({ label: c.sourceName, url: c.sourceUrl })),
    },
    audienceFitScore: 0.95,
    geoTag: "HT" as const,
    imageSource: "branded" as const,
  });

  console.log(`✅ Created/updated item: ${item.id}`);

  // Create content versions (FR + HT)
  for (const lang of ["fr", "ht"] as ContentLanguage[]) {
    const content = lang === "fr"
      ? { title: frTitle, summary: frSummary, body: frBody, sections: frSections }
      : { title: htTitle, summary: htSummary, body: htBody, sections: htSections };

    const fmtHist = formatContentVersion({
      lang,
      title: content.title,
      summary: content.summary,
      body: content.body,
      sections: content.sections,
      sourceCitations: citations.map((c) => ({ name: c.sourceName, url: c.sourceUrl })),
      series: "HaitiHistory",
    });

    await contentVersionsRepo.createContentVersion({
      itemId: item.id,
      channel: "web",
      language: lang,
      title: fmtHist.title,
      summary: fmtHist.summary ?? content.summary,
      body: fmtHist.body ?? content.body,
      status: "published",
      category: "event",
      qualityFlags: { hasSourceUrl: true, needsReview: false, lowConfidence: false, reasons: [] },
      citations,
      sections: fmtHist.sections ?? content.sections,
      sourceCitations: fmtHist.sourceCitations ?? citations.map((c) => ({ name: c.sourceName, url: c.sourceUrl })),
    });
    console.log(`  ✅ Content version (${lang}) created`);
  }

  // Log success
  await historyPublishLogRepo.upsert({
    dateISO,
    publishedItemId: item.id,
    almanacEntryIds: sorted.map((e) => e.id),
    status: "done",
  });

  console.log(`\n🎉 Histoire for ${dateISO} published! Item ID: ${item.id}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
