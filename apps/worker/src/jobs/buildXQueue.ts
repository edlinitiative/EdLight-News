/**
 * Worker job: buildXQueue
 *
 * Runs every tick. Fetches recent published content items (last 48h),
 * selects the most valuable ones for X (Twitter) distribution, and
 * composes ultra-short tweets (max 280 chars) with article links.
 *
 * Modeled on buildWaQueue — text-first, no image rendering pipeline.
 * Text-only v1; media upload can be added later.
 */

import {
  itemsRepo,
  xQueueRepo,
  contentVersionsRepo,
} from "@edlight-news/firebase";
import type { Item, XMessagePayload } from "@edlight-news/types";
import {
  isStockMarketFalsePositive,
  lacksScholarshipEvidence,
} from "../services/classify.js";
import { pickHashtagsX } from "../services/hashtags.js";

const HAITI_TZ = "America/Port-au-Prince";

/** Maximum new items to queue per tick. */
const MAX_NEW_ITEMS_PER_RUN = 12;

/** Minimum score threshold for X distribution. */
const MIN_SCORE_THRESHOLD = 40;

/** X (Twitter) character limit. */
const MAX_TEXT_LENGTH = 280;

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
 * Scoring heuristic for X eligibility.
 */
function scoreForX(item: Item): number {
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
 * Compose an X (Twitter) post payload for a content item.
 * Ultra-short: headline + link + 2 hashtags, max 280 chars.
 * Returns the payload plus the A/B hookVariant identifier (P4 followup).
 */
async function composeXMessage(
  item: Item,
): Promise<{ payload: XMessagePayload; hookVariant: string } | null> {
  let frTitle: string | undefined;

  try {
    const versions = await contentVersionsRepo.listByItemId(item.id);
    const fr = versions.find((v) => v.language === "fr");
    if (fr) {
      frTitle = fr.title;
    }
  } catch {
    // Versions unavailable — use raw item fields
  }

  const title = frTitle ?? item.title;

  if (!title || title.length < 10) return null;

  const articleUrl = `${SITE_URL}/news/${item.id}`;

  let topic = topicForSocial(item);
  // ── Topic guard — downgrade mis-tagged scholarship items ──────────────
  if (topic === "scholarship") {
    const corpus = `${title} ${item.extractedText ?? ""}`;
    if (isStockMarketFalsePositive(corpus) || lacksScholarshipEvidence(corpus)) {
      console.warn(
        `[buildXQueue] Downgrading scholarship → news for item ${item.id} ` +
          `(no scholarship evidence). Title: "${title.slice(0, 80)}"`,
      );
      topic = "news";
    }
  }
  const hashtags = pickHashtagsX(topic, item.id);

  // Budget: 280 chars total.
  // X t.co always shortens URLs to ~23 chars regardless of source length;
  // we use a conservative 12-char wedge for the URL + ellipsis to give the
  // headline more room (P1.3 — the image now carries the visual hook).
  const URL_BUDGET = 12;

  // P3: optional Threads cross-platform CTA (X_THREADS_CTA=true)
  const threadsHandle =
    process.env.X_THREADS_CTA === "true"
      ? (process.env.THREADS_HANDLE ?? "@edlightnews")
      : null;
  const ctaLine = threadsHandle ? `\n\n🧵 Threads: ${threadsHandle}` : "";

  const fixedParts = `\n\n${" ".repeat(URL_BUDGET)}\n\n${hashtags}${ctaLine}`;
  const headlineBudget = MAX_TEXT_LENGTH - fixedParts.length;

  if (headlineBudget < 20) return null; // Can't fit a meaningful headline

  const truncatedTitle =
    title.length > headlineBudget
      ? title.slice(0, headlineBudget - 1) + "…"
      : title;

  // Real text uses the actual article URL; X auto-shortens via t.co.
  const text = `${truncatedTitle}\n\n${articleUrl}\n\n${hashtags}${ctaLine}`;

  const hookVariant = `x-${topic}-v1${threadsHandle ? "-cta" : ""}`;

  return {
    payload: {
      text: text.slice(0, MAX_TEXT_LENGTH),
      imageUrl: item.imageUrl || undefined,
    },
    hookVariant,
  };
}

export interface BuildXQueueResult {
  evaluated: number;
  queued: number;
  skipped: number;
  alreadyExists: number;
  errors: number;
}

export async function buildXQueue(): Promise<BuildXQueueResult> {
  const result: BuildXQueueResult = {
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
      await xQueueRepo.listSourceContentIdsSince(queueWindowCutoff);

    let newItemsQueued = 0;

    const scoredItems = items
      .map((item) => ({ item, score: scoreForX(item) }))
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

        const composed = await composeXMessage(item);
        if (!composed) {
          result.skipped++;
          continue;
        }
        const { payload, hookVariant } = composed;

        await xQueueRepo.createXQueueItem({
          sourceContentId: item.id,
          igType: (item.category === "scholarship" || item.category === "opportunity" || item.category === "news") ? item.category : undefined,
          score,
          status: "queued",
          queuedDate: haitiToday,
          reasons: [
            `Auto-queued: score=${score}, category=${item.category ?? "unknown"}`,
          ],
          payload,
          hookVariant,
        });

        newItemsQueued++;
        result.queued++;
        console.log(
          `[buildXQueue] Queued: ${item.id} (score=${score}, category=${item.category})`,
        );
      } catch (err) {
        console.error(
          `[buildXQueue] Error processing ${item.id}:`,
          err instanceof Error ? err.message : err,
        );
        result.errors++;
      }
    }

    console.log(`[buildXQueue] Done:`, result);
    return result;
  } catch (err) {
    console.error("[buildXQueue] Fatal error:", err);
    return result;
  }
}
