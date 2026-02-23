/**
 * generateScholarshipRadarWeekly.ts
 *
 * Generates a weekly "Bourses à ne pas rater" digest post.
 * Series: ScholarshipRadarWeekly
 *
 * Logic:
 * - Queries scholarships with deadline within the next 30 days
 * - Takes top 10 by soonest deadline
 * - Renders a clean markdown digest with name, country, funding badge,
 *   deadline label, and official link
 * - Each entry's sources come from the scholarship's officialUrl
 * - No extra claims; no AI generation needed
 *
 * Usage:
 *   pnpm --filter @edlight-news/worker generate:scholarship-radar-weekly
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { FieldValue } from "firebase-admin/firestore";
import { scholarshipsRepo, itemsRepo, contentVersionsRepo } from "@edlight-news/firebase";
import type { Scholarship, ContentLanguage } from "@edlight-news/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Helpers ────────────────────────────────────────────────────────────────

const FUNDING_BADGE: Record<string, string> = {
  full: "🟢 Complet",
  partial: "🟡 Partiel",
  stipend: "🟡 Allocation",
  "tuition-only": "🟣 Scolarité",
  unknown: "⚪ Variable",
};

const COUNTRY_FLAG: Record<string, string> = {
  US: "🇺🇸", CA: "🇨🇦", FR: "🇫🇷", UK: "🇬🇧", DO: "🇩🇴",
  MX: "🇲🇽", CN: "🇨🇳", RU: "🇷🇺", HT: "🇭🇹", Global: "🌐",
};

function formatDeadline(s: Scholarship): string {
  if (!s.deadline?.dateISO) {
    if (s.deadlineAccuracy === "varies") return "Délais variables";
    return "À confirmer";
  }
  try {
    return new Date(s.deadline.dateISO).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return s.deadline.dateISO;
  }
}

function weekId(): string {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const diff = now.getTime() - start.getTime();
  const week = Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// ── Generate ───────────────────────────────────────────────────────────────

async function main() {
  const wk = weekId();
  console.log(`📡 Generating ScholarshipRadarWeekly for ${wk}…\n`);

  // 1. Get scholarships closing in next 30 days
  const closing = await scholarshipsRepo.listClosingSoon(30);
  // Filter to programs only (skip directories)
  const programs = closing.filter((s) => (s.kind ?? "program") === "program");
  const top10 = programs.slice(0, 10);

  if (top10.length === 0) {
    console.log("ℹ️  No scholarships closing in the next 30 days. Skipping.");
    return;
  }

  console.log(`  Found ${top10.length} scholarships with upcoming deadlines.\n`);

  // 2. Build digest content
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const title_fr = `Bourses à ne pas rater — Semaine ${wk}`;
  const title_ht = `Bous pou pa rate — Semèn ${wk}`;

  const summary_fr = `${top10.length} bourses avec des dates limites dans les 30 prochains jours.`;
  const summary_ht = `${top10.length} bous ki gen dat limit nan 30 jou kap vini yo.`;

  const lines_fr: string[] = [];
  const lines_ht: string[] = [];

  for (const s of top10) {
    const flag = COUNTRY_FLAG[s.country] ?? "🌐";
    const badge = FUNDING_BADGE[s.fundingType] ?? "⚪";
    const dl = formatDeadline(s);
    const link = s.officialUrl;

    lines_fr.push(`### ${flag} ${s.name}\n- **Financement:** ${badge}\n- **Date limite:** ${dl}\n- **Lien officiel:** [${s.name}](${link})\n`);
    lines_ht.push(`### ${flag} ${s.name}\n- **Finansman:** ${badge}\n- **Dat limit:** ${dl}\n- **Lyen ofisyèl:** [${s.name}](${link})\n`);
  }

  const body_fr = `# ${title_fr}\n\n*Publié le ${dateStr}*\n\n${lines_fr.join("\n---\n\n")}`;
  const body_ht = `# ${title_ht}\n\n*Pibliye ${dateStr}*\n\n${lines_ht.join("\n---\n\n")}`;

  // 3. Build citations from each scholarship's official URL
  const citations = top10.map((s) => ({
    sourceName: s.name,
    sourceUrl: s.officialUrl,
  }));

  const sourceCitations = top10.map((s) => ({
    name: s.name,
    url: s.officialUrl,
  }));

  const extractedDeadlines = top10
    .filter((s) => s.deadline?.dateISO && s.deadline?.sourceUrl)
    .map((s) => ({
      label: s.name,
      dateISO: s.deadline!.dateISO!,
      sourceUrl: s.deadline!.sourceUrl,
    }));

  // 4. Upsert item
  const rotationKey = wk;
  const itemData = {
    rawItemId: `scholarship-radar-weekly-${rotationKey}`,
    sourceId: "edlight-internal",
    title: title_fr,
    summary: summary_fr,
    canonicalUrl: `https://edlightnews.com/bourses`,
    category: "bourses" as const,
    deadline: null,
    evergreen: false,
    confidence: 1,
    qualityFlags: {
      hasSourceUrl: true,
      needsReview: false,
      lowConfidence: false,
      reasons: [],
    },
    citations,
    itemType: "utility" as const,
    utilityMeta: {
      series: "ScholarshipRadarWeekly" as const,
      utilityType: "scholarship" as const,
      region: ["Global" as const],
      audience: ["universite" as const, "international" as const],
      tags: ["weekly-digest", "scholarships", "deadlines"],
      citations: top10.map((s) => ({ label: s.name, url: s.officialUrl })),
      extractedFacts: {
        deadlines: extractedDeadlines,
      },
      rotationKey,
    },
  };

  // Check if already exists for this week
  const existingItems = await itemsRepo.listItemsByCategory("bourses");
  const existing = existingItems.find(
    (i) =>
      i.itemType === "utility" &&
      i.utilityMeta?.series === "ScholarshipRadarWeekly" &&
      i.utilityMeta?.rotationKey === rotationKey,
  );

  let itemId: string;
  if (existing) {
    await itemsRepo.updateItem(existing.id, itemData);
    itemId = existing.id;
    console.log(`  ♻️  Updated item ${itemId}`);
  } else {
    const item = await itemsRepo.createItem(itemData);
    itemId = item.id;
    console.log(`  ✅  Created item ${itemId}`);
  }

  // 5. Upsert content versions (fr + ht)
  for (const lang of ["fr", "ht"] as ContentLanguage[]) {
    const cvData = {
      itemId,
      channel: "web" as const,
      language: lang,
      title: lang === "fr" ? title_fr : title_ht,
      summary: lang === "fr" ? summary_fr : summary_ht,
      body: lang === "fr" ? body_fr : body_ht,
      status: "published" as const,
      category: "bourses" as const,
      citations,
      sourceCitations,
    };

    // Find existing CV
    const allCvs = await contentVersionsRepo.listByItemId(itemId);
    const existingCv = allCvs.find(
      (cv) => cv.language === lang && cv.channel === "web",
    );

    if (existingCv) {
      await contentVersionsRepo.updateContentVersion(existingCv.id, cvData);
      console.log(`  ♻️  Updated CV ${existingCv.id} (${lang})`);
    } else {
      const cv = await contentVersionsRepo.createContentVersion(cvData);
      console.log(`  ✅  Created CV ${cv.id} (${lang})`);
    }
  }

  console.log(`\n🏁 ScholarshipRadarWeekly ${wk} — done.`);
}

main().catch((err) => {
  console.error("❌ Generation failed:", err);
  process.exit(1);
});
