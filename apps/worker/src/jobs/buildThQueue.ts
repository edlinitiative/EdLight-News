/**
 * Worker job: buildThQueue
 *
 * Runs every tick. Fetches recent published content items (last 48h),
 * selects the most valuable ones for Threads distribution, and composes
 * short conversational posts (max 500 chars) with inline article links.
 *
 * Modeled on buildWaQueue — text-first, no image rendering pipeline.
 * Threads has no link preview cards; links are embedded inline in text.
 */

import {
  itemsRepo,
  thQueueRepo,
  contentVersionsRepo,
} from "@edlight-news/firebase";
import type { Item, ThMessagePayload } from "@edlight-news/types";

const HAITI_TZ = "America/Port-au-Prince";

/** Maximum new items to queue per tick. */
const MAX_NEW_ITEMS_PER_RUN = 8;

/** Minimum score threshold for Threads distribution. */
const MIN_SCORE_THRESHOLD = 45;

/** Threads text limit. */
const MAX_TEXT_LENGTH = 500;

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

type SocialTopic =
  | "scholarship"
  | "opportunity"
  | "education"
  | "news"
  | "other";

function topicForSocial(item: Item): SocialTopic {
  const category = item.category?.toLowerCase() ?? "";
  const vertical = item.vertical?.toLowerCase() ?? "";

  if (
    category === "scholarship" ||
    category === "bourses" ||
    vertical === "bourses"
  ) {
    return "scholarship";
  }
  if (
    category === "opportunity" ||
    category === "concours" ||
    category === "stages" ||
    category === "programmes" ||
    vertical === "opportunites"
  ) {
    return "opportunity";
  }
  if (vertical === "education") {
    return "education";
  }
  if (
    category === "news" ||
    category === "local_news" ||
    vertical === "news" ||
    vertical === "haiti" ||
    vertical === "world" ||
    vertical === "business" ||
    vertical === "technology" ||
    vertical === "explainers"
  ) {
    return "news";
  }
  return "other";
}

/**
 * Scoring heuristic for Threads eligibility.
 */
function scoreForTh(item: Item): number {
  let score = 0;

  const topic = topicForSocial(item);
  if (topic === "scholarship" || topic === "opportunity") score += 60;
  else if (topic === "education" || topic === "news") score += 50;
  else score += 30;

  if (item.imageUrl) score += 10;
  if (item.citations && item.citations.length > 0) score += 10;
  if (item.viewCount && item.viewCount > 10) score += 10;

  return Math.min(score, 100);
}

/**
 * Compose a Threads post payload for a content item.
 * Conversational tone, max 500 chars, inline link.
 */
async function composeThMessage(item: Item): Promise<ThMessagePayload | null> {
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

  const topic = topicForSocial(item);
  const hashtags =
    topic === "scholarship"
      ? "#Haïti #Bourses"
      : topic === "opportunity"
        ? "#Haïti #Opportunités"
        : topic === "education"
          ? "#Haïti #Éducation"
          : "#Haïti #Actualités";

  // Build the post: punchy title, context, link, hashtags
  // Budget: 500 chars total
  const linkLine = articleUrl;
  const hashtagLine = hashtags;
  const fixedOverhead = 2 + linkLine.length + 2 + hashtagLine.length; // newlines + link + newlines + hashtags

  // Title gets priority, then summary fills remaining space
  const truncatedTitle = title.length > 150 ? title.slice(0, 147) + "…" : title;
  const titleLine = truncatedTitle;

  const remainingBudget =
    MAX_TEXT_LENGTH - titleLine.length - fixedOverhead - 2; // 2 for newline between title and summary

  const lines: string[] = [titleLine];

  if (summary && remainingBudget > 40) {
    const shortSummary =
      summary.length > remainingBudget
        ? summary.slice(0, remainingBudget - 1) + "…"
        : summary;
    lines.push("");
    lines.push(shortSummary);
  }

  lines.push("");
  lines.push(linkLine);
  lines.push("");
  lines.push(hashtagLine);

  const text = lines.join("\n");

  return {
    text: text.slice(0, MAX_TEXT_LENGTH),
    imageUrl: item.imageUrl || undefined,
  };
}

export interface BuildThQueueResult {
  evaluated: number;
  queued: number;
  skipped: number;
  alreadyExists: number;
  errors: number;
}

export async function buildThQueue(): Promise<BuildThQueueResult> {
  const result: BuildThQueueResult = {
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
      const createdAt =
        typeof item.createdAt === "object" && "seconds" in item.createdAt
          ? new Date((item.createdAt as any).seconds * 1000)
          : new Date();
      return createdAt >= cutoff;
    });

    const queueWindowCutoff = new Date();
    queueWindowCutoff.setDate(queueWindowCutoff.getDate() - 3);
    const existingSourceIds =
      await thQueueRepo.listSourceContentIdsSince(queueWindowCutoff);

    let newItemsQueued = 0;

    const scoredItems = items
      .map((item) => ({ item, score: scoreForTh(item) }))
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
        if (
          item.canonicalUrl?.startsWith("edlight://histoire/") ||
          item.canonicalUrl?.startsWith("edlight://utility/")
        ) {
          result.skipped++;
          continue;
        }

        const payload = await composeThMessage(item);
        if (!payload) {
          result.skipped++;
          continue;
        }

        await thQueueRepo.createThQueueItem({
          sourceContentId: item.id,
          score,
          status: "queued",
          queuedDate: haitiToday,
          reasons: [
            `Auto-queued: score=${score}, category=${item.category ?? "unknown"}`,
          ],
          payload,
        });

        newItemsQueued++;
        result.queued++;
        console.log(
          `[buildThQueue] Queued: ${item.id} (score=${score}, category=${item.category})`,
        );
      } catch (err) {
        console.error(
          `[buildThQueue] Error processing ${item.id}:`,
          err instanceof Error ? err.message : err,
        );
        result.errors++;
      }
    }

    console.log(`[buildThQueue] Done:`, result);
    return result;
  } catch (err) {
    console.error("[buildThQueue] Fatal error:", err);
    return result;
  }
}
