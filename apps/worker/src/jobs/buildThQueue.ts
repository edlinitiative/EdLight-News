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
import type { Item, ContentVersion, ThMessagePayload } from "@edlight-news/types";
import {
  generateSocialPosts,
  socialToThPayload,
} from "@edlight-news/generator";
import { toSocialInput } from "../services/socialInput.js";
import {
  isStockMarketFalsePositive,
  lacksScholarshipEvidence,
} from "../services/classify.js";
import { pickHashtags } from "../services/hashtags.js";

/** Feature flag — when "true", try the social v2 generator before legacy composer. */
const SOCIAL_V2_ENABLED = process.env.SOCIAL_GENERATOR_V2 === "true";

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
  | "story_only"
  | "other";

function topicForSocial(item: Item): SocialTopic {
  const category = item.category?.toLowerCase() ?? "";
  const vertical = item.vertical?.toLowerCase() ?? "";

  // Story-only categories never belong on the Threads feed — they are
  // for the IG story rail. Detected here so the loop filters them out.
  if (
    category === "taux" ||
    category === "histoire" ||
    category === "utility" ||
    vertical === "histoire" ||
    vertical === "taux" ||
    vertical === "utility" ||
    item.canonicalUrl?.startsWith("edlight://histoire/") ||
    item.canonicalUrl?.startsWith("edlight://utility/") ||
    item.canonicalUrl?.startsWith("edlight://taux/")
  ) {
    return "story_only";
  }

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
  // Lead the feed with opportunities. Threads has higher organic reach
  // for short link posts, so a strong opportunity bias here pays off.
  if (topic === "scholarship") score += 70;
  else if (topic === "opportunity") score += 65;
  else if (topic === "education") score += 42;
  else if (topic === "news") score += 35;
  else if (topic === "story_only") score += 0;
  else score += 25;

  if (item.imageUrl) score += 10;
  if (item.citations && item.citations.length > 0) score += 10;
  if (item.viewCount && item.viewCount > 10) score += 10;

  return Math.min(score, 100);
}

/**
 * Compose a Threads post payload using the social v2 generator.
 * Returns null on any error so the caller can fall back to the legacy composer.
 */
async function composeThMessageV2(
  item: Item,
  cv: ContentVersion | undefined,
  articleUrl: string,
): Promise<ThMessagePayload | null> {
  try {
    const input = toSocialInput(item, cv, articleUrl);
    if (!input) return null;
    const result = await generateSocialPosts(input);
    if (!result.ok) {
      console.warn(
        `[buildThQueue] social v2 generator failed for ${item.id}: ${result.error}`,
      );
      return null;
    }
    return socialToThPayload(result.output, {
      articleUrl,
      imageUrl: item.imageUrl ?? undefined,
    });
  } catch (err) {
    console.warn(
      `[buildThQueue] social v2 generator threw for ${item.id}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Compose a Threads post payload for a content item.
 * Conversational tone, max 500 chars, inline link.
 * Returns the payload plus the A/B hookVariant identifier (P4 followup).
 */
async function composeThMessage(
  item: Item,
): Promise<{ payload: ThMessagePayload; hookVariant: string } | null> {
  let frTitle: string | undefined;
  let frSummary: string | undefined;
  let frCv: ContentVersion | undefined;

  try {
    const versions = await contentVersionsRepo.listByItemId(item.id);
    const fr = versions.find((v) => v.language === "fr");
    if (fr) {
      frCv = fr;
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

  const hashtagRotationActive = process.env.HASHTAG_ROTATION === "true";

  // ── Social v2 (feature-flagged) ───────────────────────────────────────
  if (SOCIAL_V2_ENABLED) {
    const v2 = await composeThMessageV2(item, frCv, articleUrl);
    if (v2) {
      const v2Topic = topicForSocial(item);
      const v2Variant = `th-${v2Topic === "story_only" ? "news" : v2Topic}-v2${hashtagRotationActive ? "-rot" : ""}`;
      return { payload: v2, hookVariant: v2Variant };
    }
    // fall through to legacy composer
  }

  let topic = topicForSocial(item);
  // ── Topic guard — mirror the FB scholarship false-positive check ────────
  if (topic === "scholarship") {
    const corpus = `${title} ${summary} ${item.extractedText ?? ""}`;
    if (isStockMarketFalsePositive(corpus) || lacksScholarshipEvidence(corpus)) {
      console.warn(
        `[buildThQueue] Downgrading scholarship → news for item ${item.id} ` +
          `(no scholarship evidence). Title: "${title.slice(0, 80)}"`,
      );
      topic = "news";
    }
  }
  const hashtagTopic = topic === "story_only" ? "other" : topic;
  const hashtags = pickHashtags(hashtagTopic, item.id);

  // Feature flag — when ON (default), the article URL is stripped from the
  // parent post body and posted as a self-reply by the publisher (P1.2).
  // Threads suppresses outbound links in the parent body. To revert to the
  // legacy inline-link behavior set TH_LINK_REPLY=false.
  const linkAsReply = process.env.TH_LINK_REPLY !== "false";

  // Build the post: punchy title, context, link?, hashtags
  // Budget: 500 chars total
  const linkLine = articleUrl;
  const hashtagLine = hashtags;
  // When link goes in the reply we save those bytes for the body.
  const fixedOverhead = linkAsReply
    ? 2 + hashtagLine.length // \n\n + hashtags
    : 2 + linkLine.length + 2 + hashtagLine.length;

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

  if (!linkAsReply) {
    lines.push("");
    lines.push(linkLine);
  }
  lines.push("");
  lines.push(hashtagLine);

  const text = lines.join("\n");

  const variantTopic = topic === "story_only" ? "news" : topic;
  const hookVariant = `th-${variantTopic}-v1${hashtagRotationActive ? "-rot" : ""}`;

  return {
    payload: {
      text: text.slice(0, MAX_TEXT_LENGTH),
      imageUrl: item.imageUrl || undefined,
      replyLinkUrl: linkAsReply ? articleUrl : undefined,
    },
    hookVariant,
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

    // Backpressure: scheduler only sends DAILY_CAP=6/day. Cap the queued
    // backlog at ~3 days of capacity to avoid a permanent stale pile.
    const BACKPRESSURE_LIMIT = 18;
    const existingQueued = await thQueueRepo.listQueuedByScore(BACKPRESSURE_LIMIT + 1);
    if (existingQueued.length >= BACKPRESSURE_LIMIT) {
      console.log(`[buildThQueue] backpressure: ${existingQueued.length} already queued — skipping run`);
      return result;
    }

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

        // Skip story-only categories (histoire, taux, utility) — those
        // are IG story rail content and never belong on the Threads feed.
        if (
          topicForSocial(item) === "story_only" ||
          item.canonicalUrl?.startsWith("edlight://histoire/") ||
          item.canonicalUrl?.startsWith("edlight://utility/") ||
          item.canonicalUrl?.startsWith("edlight://taux/")
        ) {
          result.skipped++;
          continue;
        }

        const composed = await composeThMessage(item);
        if (!composed) {
          result.skipped++;
          continue;
        }
        const { payload, hookVariant } = composed;

        await thQueueRepo.createThQueueItem({
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
