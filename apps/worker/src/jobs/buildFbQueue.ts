/**
 * Worker job: buildFbQueue
 *
 * Runs every tick. Fetches recent published content items (last 48h),
 * selects the most valuable ones for Facebook distribution, and composes
 * text posts with article link previews.
 *
 * Modeled on buildWaQueue — text-first, no image rendering pipeline.
 * Facebook link posts auto-generate preview cards from the article URL.
 */

import { itemsRepo, fbQueueRepo, contentVersionsRepo } from "@edlight-news/firebase";
import type { Item, FbMessagePayload } from "@edlight-news/types";

const HAITI_TZ = "America/Port-au-Prince";

/** Maximum new items to queue per tick. */
const MAX_NEW_ITEMS_PER_RUN = 10;

/** Minimum score threshold for FB distribution. */
const MIN_SCORE_THRESHOLD = 35;

/** Base URL for article links on the website. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://news.edlight.org";

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

/**
 * Scoring heuristic for Facebook eligibility.
 */
function scoreForFb(item: Item): number {
  let score = 0;

  const cat = item.category?.toLowerCase() ?? "";
  if (cat === "scholarship" || cat === "opportunity") score += 60;
  else if (cat === "education" || cat === "news") score += 50;
  else score += 30;

  if (item.imageUrl) score += 10;
  if (item.citations && item.citations.length > 0) score += 10;
  if (item.viewCount && item.viewCount > 10) score += 10;

  return Math.min(score, 100);
}

/**
 * Compose a Facebook post payload for a content item.
 * Uses the French content version. FB link posts auto-generate
 * a preview card with the article's OpenGraph image and title.
 */
async function composeFbMessage(
  item: Item,
): Promise<FbMessagePayload | null> {
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

  const articleUrl = `${SITE_URL}/news/${item.id}`;

  const cat = item.category?.toLowerCase() ?? "";
  const emoji =
    cat === "scholarship" ? "🎓" :
    cat === "opportunity" ? "🚀" :
    cat === "education" ? "📚" :
    cat === "news" ? "📰" :
    "📢";

  const lines: string[] = [];
  lines.push(`${emoji} ${title}`);

  if (summary) {
    // FB supports longer posts — use up to 400 chars of summary
    const shortSummary = summary.length > 400
      ? summary.slice(0, 397) + "…"
      : summary;
    lines.push("");
    lines.push(shortSummary);
  }

  lines.push("");
  lines.push("📲 EdLight News — L'actu haïtienne, chaque jour.");

  return {
    text: lines.join("\n"),
    linkUrl: articleUrl,
    imageUrl: item.imageUrl || undefined,
  };
}

export interface BuildFbQueueResult {
  evaluated: number;
  queued: number;
  skipped: number;
  alreadyExists: number;
  errors: number;
}

export async function buildFbQueue(): Promise<BuildFbQueueResult> {
  const result: BuildFbQueueResult = {
    evaluated: 0,
    queued: 0,
    skipped: 0,
    alreadyExists: 0,
    errors: 0,
  };

  try {
    const haitiToday = getHaitiDateKey();

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

    const queueWindowCutoff = new Date();
    queueWindowCutoff.setDate(queueWindowCutoff.getDate() - 3);
    const existingSourceIds = await fbQueueRepo.listSourceContentIdsSince(queueWindowCutoff);

    let newItemsQueued = 0;

    const scoredItems = items
      .map((item) => ({ item, score: scoreForFb(item) }))
      .filter((si) => si.score >= MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score);

    for (const { item, score } of scoredItems) {
      if (newItemsQueued >= MAX_NEW_ITEMS_PER_RUN) break;

      result.evaluated++;

      try {
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

        const payload = await composeFbMessage(item);
        if (!payload) {
          result.skipped++;
          continue;
        }

        await fbQueueRepo.createFbQueueItem({
          sourceContentId: item.id,
          score,
          status: "queued",
          queuedDate: haitiToday,
          reasons: [`Auto-queued: score=${score}, category=${item.category ?? "unknown"}`],
          payload,
        });

        newItemsQueued++;
        result.queued++;
        console.log(`[buildFbQueue] Queued: ${item.id} (score=${score}, category=${item.category})`);
      } catch (err) {
        console.error(`[buildFbQueue] Error processing ${item.id}:`, err instanceof Error ? err.message : err);
        result.errors++;
      }
    }

    console.log(`[buildFbQueue] Done:`, result);
    return result;
  } catch (err) {
    console.error("[buildFbQueue] Fatal error:", err);
    return result;
  }
}
