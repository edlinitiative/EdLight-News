/**
 * Re-queue a single IG item through the current formatters.
 * Ensures stale pre-built payloads are replaced with fresh output.
 *
 * Usage:
 *   cd apps/worker
 *   npx tsx src/scripts/requeueIgItem.ts --type=histoire
 *   npx tsx src/scripts/requeueIgItem.ts --type=news --id=abc123
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import {
  igQueueRepo,
  itemsRepo,
  contentVersionsRepo,
} from "@edlight-news/firebase";
import { formatForIG, decideIG } from "@edlight-news/generator/ig/index.js";
import type { BilingualText } from "@edlight-news/generator/ig/index.js";
import type { IGPostType, Item } from "@edlight-news/types";

// ── CLI args ───────────────────────────────────────────────────────────────

function parseArgs(): { type: IGPostType; id?: string; coverImage?: string } {
  const args = process.argv.slice(2);
  let type: IGPostType | undefined;
  let id: string | undefined;
  let coverImage: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--type=")) type = a.split("=")[1] as IGPostType;
    else if (a === "--type" && args[i + 1]) type = args[++i] as IGPostType;
    else if (a.startsWith("--id=")) id = a.split("=")[1];
    else if (a === "--id" && args[i + 1]) id = args[++i];
    else if (a.startsWith("--coverImage=")) coverImage = a.split("=").slice(1).join("=");
    else if (a === "--coverImage" && args[i + 1]) coverImage = args[++i];
  }

  if (!type) {
    console.error(
      "Usage: requeueIgItem --type=<histoire|news|opportunity|scholarship> [--id=<itemId>] [--coverImage=<url>]",
    );
    process.exit(1);
  }

  const valid: IGPostType[] = ["histoire", "news", "opportunity", "scholarship", "breaking", "stat"];
  if (!valid.includes(type)) {
    console.error(`Invalid type "${type}". Must be one of: ${valid.join(", ")}`);
    process.exit(1);
  }

  return { type, id, coverImage };
}

// ── Reverse-map igType → eligible items ────────────────────────────────────

const HISTOIRE_SERIES = new Set([
  "HaitiHistory",
  "HaitiFactOfTheDay",
  "HaitianOfTheWeek",
]);

const CATEGORY_MAP: Record<string, IGPostType> = {
  scholarship: "scholarship",
  bourses: "scholarship",
  opportunity: "opportunity",
  concours: "opportunity",
  stages: "opportunity",
  programmes: "opportunity",
  news: "news",
  local_news: "news",
  event: "news",
};

async function findLatestItem(type: IGPostType): Promise<Item | null> {
  if (type === "histoire") {
    const items = await itemsRepo.listRecentByItemType("utility", 30);
    return (
      items.find((i) => HISTOIRE_SERIES.has(i.utilityMeta?.series ?? "")) ??
      null
    );
  }

  if (type === "stat") {
    // Stat cards should always be triggered with --id explicitly
    console.warn("  ℹ️  No auto-selection for 'stat' — use --id=<itemId> to specify the item.");
    return null;
  }

  const items = await itemsRepo.listRecentItems(100);

  if (type === "breaking") {
    // Breaking items are thin news articles that decideIG demotes to 'breaking'
    const newsCandidates = items.filter((i) => ["news", "local_news", "event"].includes(i.category));
    for (const candidate of newsCandidates) {
      const decision = decideIG(candidate);
      if (decision.igEligible && decision.igType === "breaking") return candidate;
    }
    return null;
  }

  // For news/opportunity/scholarship: scan recent items — enforce quality gate
  const candidates = items.filter((i) => CATEGORY_MAP[i.category] === type);
  for (const candidate of candidates) {
    const decision = decideIG(candidate);
    if (decision.igEligible) return candidate;
    console.log(`  ⚠️  Skipping ${candidate.id} (quality gate: ${decision.reasons.join("; ")})`);
  }
  return null;
}

// ── Synthetic narrative ────────────────────────────────────────────────────

/**
 * Generate a synthetic frNarrative from frBody when no stored narrative exists.
 * Groups the first 6 well-formed sentences into 2-3 ||| -separated arc groups.
 * This approximates the 4-act carousel arc without requiring a Gemini API call.
 */
function synthNarrative(body: string): string | undefined {
  if (!body || body.length < 80) return undefined;
  const sentences = body
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 30 &&
        !/^(Source|Voir|Lire|À lire|Sur le même|Publié|Modifié)/i.test(s),
    )
    .slice(0, 6);
  if (sentences.length < 2) return undefined;
  // Group 2 sentences per |||  arc group
  const groups: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    groups.push(sentences.slice(i, i + 2).join(" "));
  }
  return groups.join("|||");
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { type, id, coverImage } = parseArgs();
  console.log(
    `\n🔄 Re-queue IG item: type=${type}${id ? `, id=${id}` : " (latest)"}${coverImage ? ` (coverImage override)` : ""}`,
  );

  // 1. Resolve the item
  let item: Item | null = null;
  if (id) {
    item = await itemsRepo.getItem(id);
    if (!item) {
      console.error(`❌ Item "${id}" not found`);
      process.exit(1);
    }
  } else {
    item = await findLatestItem(type);
    if (!item) {
      console.error(`❌ No eligible "${type}" item found in recent items`);
      process.exit(1);
    }
  }
  console.log(`  Item: ${item.id} — ${item.title.substring(0, 80)}`);

  // 2. Fetch bilingual content
  let bi: BilingualText | undefined;
  try {
    const versions = await contentVersionsRepo.listByItemId(item.id);
    const fr = versions.find((v: any) => v.language === "fr");
    const ht = versions.find((v: any) => v.language === "ht");
    if (fr) {
      bi = {
        frTitle: fr.title,
        frSummary: fr.summary,
        htTitle: ht?.title,
        htSummary: ht?.summary,
        frSections: fr.sections as { heading: string; content: string }[] | undefined,
        frBody: fr.body || undefined,
        frNarrative: fr.narrative ?? undefined,
      };
      // Gap-fill: items processed before the ||| narrative prompt update
      // have no stored frNarrative. Synthesise a basic arc from frBody so
      // the formatter uses the carousel path instead of the section fallback.
      if (!bi.frNarrative && bi.frBody) {
        const synthetic = synthNarrative(bi.frBody);
        if (synthetic) {
          bi.frNarrative = synthetic;
          console.log(`  ℹ️  Synthesised frNarrative from frBody (no stored narrative)`);
        }
      }
    }
  } catch {
    /* ignore */
  }

  // 3. Format through current formatter
  const payload = await formatForIG(type, item, bi ? { bi } : undefined);

  // Apply cover image override to ALL slides if provided
  if (coverImage) {
    for (const slide of payload.slides) {
      slide.backgroundImage = coverImage;
    }
    console.log(`  ℹ️  Applied coverImage override to all ${payload.slides.length} slides`);
  }

  console.log(`  Slides: ${payload.slides.length}`);
  for (let i = 0; i < payload.slides.length; i++) {
    console.log(`    ${i + 1}: ${payload.slides[i]!.heading.substring(0, 75)}`);
  }

  // 4. Check for existing queue entry
  const existing = await igQueueRepo.findBySourceContentId(item.id);
  if (existing) {
    console.log(
      `  Existing queue entry found: ${existing.id} (status=${existing.status})`,
    );
    await igQueueRepo.updateStatus(existing.id, "queued");
    await igQueueRepo.setPayload(existing.id, payload);
    console.log(`  ✅ Reset to "queued" with fresh payload → ${existing.id}`);
  } else {
    const created = await igQueueRepo.createIGQueueItem({
      sourceContentId: item.id,
      igType: type,
      score: 99,
      status: "queued",
      reasons: [`Re-queued via requeueIgItem (${type})`],
      payload,
    });
    console.log(`  ✅ New queue entry created → ${created.id}`);
  }

  console.log("Done.\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
