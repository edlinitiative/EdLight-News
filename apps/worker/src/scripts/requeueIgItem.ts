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
import { formatForIG } from "@edlight-news/generator/ig/formatters/index.js";
import type { BilingualText } from "@edlight-news/generator/ig/index.js";
import type { IGPostType, Item } from "@edlight-news/types";

// ── CLI args ───────────────────────────────────────────────────────────────

function parseArgs(): { type: IGPostType; id?: string } {
  const args = process.argv.slice(2);
  let type: IGPostType | undefined;
  let id: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--type=")) type = a.split("=")[1] as IGPostType;
    else if (a === "--type" && args[i + 1]) type = args[++i] as IGPostType;
    else if (a.startsWith("--id=")) id = a.split("=")[1];
    else if (a === "--id" && args[i + 1]) id = args[++i];
  }

  if (!type) {
    console.error(
      "Usage: requeueIgItem --type=<histoire|news|opportunity|scholarship> [--id=<itemId>]",
    );
    process.exit(1);
  }

  const valid: IGPostType[] = ["histoire", "news", "opportunity", "scholarship"];
  if (!valid.includes(type)) {
    console.error(`Invalid type "${type}". Must be one of: ${valid.join(", ")}`);
    process.exit(1);
  }

  return { type, id };
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

  // For news/opportunity/scholarship, scan recent items and match by category
  const items = await itemsRepo.listRecentItems(100);
  return items.find((i) => CATEGORY_MAP[i.category] === type) ?? null;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { type, id } = parseArgs();
  console.log(
    `\n🔄 Re-queue IG item: type=${type}${id ? `, id=${id}` : " (latest)"}`,
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
      };
    }
  } catch {
    /* ignore */
  }

  // 3. Format through current formatter
  const payload = formatForIG(type, item, bi ? { bi } : undefined);
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
