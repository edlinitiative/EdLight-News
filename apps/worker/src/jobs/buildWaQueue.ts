/**
 * Worker job: buildWaQueue
 *
 * Runs every tick (via /tick).
 * Fetches recent published content items (last 48h), selects the most
 * valuable ones for WhatsApp distribution, and composes concise text
 * messages with article links.
 *
 * Much simpler than buildIgQueue — no image pipeline, no rendering,
 * no slide formatting. Just text + link + optional image URL.
 *
 * Firestore-quota-aware design:
 *  - Pre-loads existing sourceContentIds in ONE batch query
 *  - Caps new items queued per run to MAX_NEW_ITEMS_PER_RUN
 */

import { itemsRepo, waQueueRepo, contentVersionsRepo } from "@edlight-news/firebase";
import type { Item, WaMessagePayload } from "@edlight-news/types";

const HAITI_TZ = "America/Port-au-Prince";

/** Maximum new items to queue per tick. */
const MAX_NEW_ITEMS_PER_RUN = 10;

/** Minimum score threshold for WA distribution. */
const MIN_SCORE_THRESHOLD = 40;

/** Base URL for article links on the website. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://edlight.news";

function getHaitiDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HAITI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dateFromTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Simple scoring heuristic for WhatsApp eligibility.
 * Items with published content and higher editorial quality score higher.
 */
function scoreForWa(item: Item): number {
  let score = 0;

  // Base score from category
  const cat = item.category?.toLowerCase() ?? "";
  if (cat === "scholarship" || cat === "opportunity") score += 60;
  else if (cat === "education" || cat === "news") score += 50;
  else score += 30;

  // Boost for items with images
  if (item.imageUrl) score += 10;

  // Boost for items with citations (higher editorial quality)
  if (item.citations && item.citations.length > 0) score += 10;

  // Boost for high view count (trending)
  if (item.viewCount && item.viewCount > 10) score += 10;

  // Cap at 100
  return Math.min(score, 100);
}

/**
 * Compose a WhatsApp message payload for a content item.
 * Uses the French content version for the bilingual audience.
 */
async function composeWaMessage(
  item: Item,
): Promise<WaMessagePayload | null> {
  // Fetch bilingual content versions
  let frTitle: string | undefined;
  let frSummary: string | undefined;

  try {
    const versions = await contentVersionsRepo.listByItemId(item.id);
    const fr = versions.find((v) => v.language === "fr");
    if (fr) {
      frTitle = fr.title;
      frSummary = fr.summary;
    }
  } catch {
    // Versions unavailable — use raw item fields
  }

  const title = frTitle ?? item.title;
  const summary = frSummary ?? (item as any).summary ?? "";

  if (!title || title.length < 10) return null;

  // Build article URL
  const articleUrl = `${SITE_URL}/news/${item.id}`;

  // Compose message text with WhatsApp formatting
  const lines: string[] = [];

  // Category emoji prefix
  const cat = item.category?.toLowerCase() ?? "";
  const emoji =
    cat === "scholarship" ? "🎓" :
    cat === "opportunity" ? "🚀" :
    cat === "education" ? "📚" :
    cat === "news" ? "📰" :
    "📢";

  lines.push(`${emoji} *${title}*`);

  if (summary) {
    // Truncate summary to ~200 chars for WhatsApp readability
    const shortSummary = summary.length > 200
      ? summary.slice(0, 197) + "…"
      : summary;
    lines.push("");
    lines.push(shortSummary);
  }

  lines.push("");
  lines.push(`🔗 ${articleUrl}`);
  lines.push("");
  lines.push("_EdLight News — Nouvèl ak opòtinite pou jèn Ayisyen_");

  return {
    text: lines.join("\n"),
    imageUrl: item.imageUrl || undefined,
    linkUrl: articleUrl,
  };
}

export interface BuildWaQueueResult {
  evaluated: number;
  queued: number;
  skipped: number;
  alreadyExists: number;
  errors: number;
}

export async function buildWaQueue(): Promise<BuildWaQueueResult> {
  const result: BuildWaQueueResult = {
    evaluated: 0,
    queued: 0,
    skipped: 0,
    alreadyExists: 0,
    errors: 0,
  };

  try {
    const haitiToday = getHaitiDateKey();

    // Fetch recent items (last 48 hours)
    const recentItems = await itemsRepo.listRecentItems(100);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 48);

    const items: Item[] = recentItems.filter((item) => {
      if (!item.createdAt) return false;
      const createdAt = typeof item.createdAt === "object" && "seconds" in item.createdAt
        ? new Date((item.createdAt as any).seconds * 1000)
        : new Date();
      return createdAt >= cutoff;
    });

    // Pre-load existing wa_queue entries (batch — saves Firestore quota)
    const queueWindowCutoff = new Date();
    queueWindowCutoff.setDate(queueWindowCutoff.getDate() - 3);
    const existingSourceIds = await waQueueRepo.listSourceContentIdsSince(queueWindowCutoff);

    let newItemsQueued = 0;

    // Score and sort items
    const scoredItems = items
      .map((item) => ({ item, score: scoreForWa(item) }))
      .filter((si) => si.score >= MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    for (const { item, score } of scoredItems) {
      if (newItemsQueued >= MAX_NEW_ITEMS_PER_RUN) break;

      result.evaluated++;

      try {
        // Skip if already in queue
        if (existingSourceIds.has(item.id)) {
          result.alreadyExists++;
          continue;
        }

        // Skip internal / utility items (histoire, taux) — those are IG-only
        if (item.canonicalUrl?.startsWith("edlight://histoire/") ||
            item.canonicalUrl?.startsWith("edlight://utility/")) {
          result.skipped++;
          continue;
        }

        // Compose the message
        const payload = await composeWaMessage(item);
        if (!payload) {
          result.skipped++;
          continue;
        }

        // Create queue entry
        await waQueueRepo.createWaQueueItem({
          sourceContentId: item.id,
          score,
          status: "queued",
          queuedDate: haitiToday,
          reasons: [`Auto-queued: score=${score}, category=${item.category ?? "unknown"}`],
          payload,
        });

        newItemsQueued++;
        result.queued++;
        console.log(`[buildWaQueue] Queued: ${item.id} (score=${score}, category=${item.category})`);
      } catch (err) {
        console.error(`[buildWaQueue] Error processing ${item.id}:`, err instanceof Error ? err.message : err);
        result.errors++;
      }
    }

    console.log(`[buildWaQueue] Done:`, result);
    return result;
  } catch (err) {
    console.error("[buildWaQueue] Fatal error:", err);
    return result;
  }
}
