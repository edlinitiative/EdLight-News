/**
 * Worker job: buildIgStory (v3 — Optional Daily Summary)
 *
 * Builds an optional daily summary IG Story once enough content exists.
 * This is a SUPPLEMENT to per-post stories (which are published immediately
 * when each carousel post succeeds in processIgScheduled).
 *
 * The summary combines taux + facts + top headlines into a recap story.
 * It runs at most once per day (self-gated by dateKey).
 *
 * No time window restriction — the summary can be built at any time of day.
 * Per-post stories handle the main IG Story presence throughout the day.
 */

import { igQueueRepo, igStoryQueueRepo, contentVersionsRepo } from "@edlight-news/firebase";
import {
  buildDailySummaryStory,
  type StoryItemInput,
  type StoryTauxInput,
  type StoryFactsInput,
} from "@edlight-news/generator/ig/index.js";
import type { BilingualText } from "@edlight-news/generator/ig/index.js";
import { itemsRepo } from "@edlight-news/firebase";
import type { IGStoryQueueStatus, Item } from "@edlight-news/types";

// ── Haiti timezone ─────────────────────────────────────────────────────────
const HAITI_TZ = "America/Port-au-Prince";

function toHaitiDate(date: Date): Date {
  const haitiStr = date.toLocaleString("en-US", { timeZone: HAITI_TZ });
  return new Date(haitiStr);
}

function todayDateKey(): string {
  const haiti = toHaitiDate(new Date());
  const y = haiti.getFullYear();
  const m = String(haiti.getMonth() + 1).padStart(2, "0");
  const d = String(haiti.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isNonEmptyUrl(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const STORY_IMAGE_MIN_SHORT_SIDE = 1080;
const STORY_IMAGE_MAX_ASPECT_RATIO = 2.1;

function isItemImageUsableForStory(item: Item): boolean {
  if (!item.imageUrl) return false;

  const width = item.imageMeta?.width;
  const height = item.imageMeta?.height;

  if (item.imageSource === "branded" && (!width || !height)) {
    return false;
  }

  if (!width || !height) {
    return true;
  }

  if (Math.min(width, height) < STORY_IMAGE_MIN_SHORT_SIDE) {
    return false;
  }

  if (width / Math.max(height, 1) > STORY_IMAGE_MAX_ASPECT_RATIO) {
    return false;
  }

  return true;
}

function pickPayloadBackgroundImage(queueItem: any): string | undefined {
  const slides = Array.isArray(queueItem?.payload?.slides)
    ? queueItem.payload.slides
    : [];

  for (const slide of slides) {
    if (isNonEmptyUrl(slide?.backgroundImage)) {
      return slide.backgroundImage;
    }
  }

  return undefined;
}

function pickStoryBackgroundImage(
  queueItem: any,
  item?: Item,
): string | undefined {
  const payloadImage = pickPayloadBackgroundImage(queueItem);
  if (payloadImage) return payloadImage;

  if (item?.imageUrl && isItemImageUsableForStory(item)) {
    return item.imageUrl;
  }

  return undefined;
}

// ── Result type ────────────────────────────────────────────────────────────
export interface BuildIgStoryResult {
  queued: boolean;
  skipped: string;
  itemCount?: number;
}

// ── Main job ───────────────────────────────────────────────────────────────

export async function buildIgStory(): Promise<BuildIgStoryResult> {
  const dateKey = todayDateKey();

  // Already created today?
  const existing = await igStoryQueueRepo.getByDateKey(dateKey);
  if (existing) {
    return { queued: false, skipped: "already-exists" };
  }

  try {
    // ── Gather all today's IG items ──────────────────────────────────────
    // listRecentPosted fetches by updatedAt >= now-24h which can include
    // yesterday's items early in the day — filter to today's dateKey only.
    const allPostedItems = await igQueueRepo.listRecentPosted(1, 30);
    const postedItems = allPostedItems.filter(
      (ig) =>
        !ig.queuedDate ||
        ig.queuedDate === dateKey ||
        ig.targetPostDate === dateKey,
    );
    const scheduledItems = await igQueueRepo.listByStatus("scheduled", 30);
    const queuedItems = await igQueueRepo.listByStatus("queued", 30);

    const allIgItems = [...postedItems, ...scheduledItems, ...queuedItems];

    // Dedupe
    const seen = new Set<string>();
    const deduped = allIgItems.filter((ig) => {
      if (seen.has(ig.sourceContentId)) return false;
      seen.add(ig.sourceContentId);
      return true;
    });

    // ── Frame 1: Taux du jour ────────────────────────────────────────────
    let tauxInput: StoryTauxInput | undefined;
    const tauxItem = deduped.find(
      (ig) => ig.igType === "taux" && ig.sourceContentId === `taux-${dateKey}`,
    );
    if (tauxItem?.payload?.slides?.[0]) {
      const coverSlide = tauxItem.payload.slides[0];
      tauxInput = {
        rate: coverSlide.heading,
        dateLabel: coverSlide.footer ?? dateKey,
        bullets: coverSlide.bullets.slice(0, 2),
        backgroundImage: coverSlide.backgroundImage,
      } as StoryTauxInput;
    }

    // ── Frame 2: Faits du jour ───────────────────────────────────────────
    // Collect today's utility items (facts, histoire, etc.)
    let factsInput: StoryFactsInput | undefined;
    const utilityItems = deduped.filter(
      (ig) => ig.igType === "histoire" || ig.igType === "utility",
    );
    const utilityIds = utilityItems.map((ig) => ig.sourceContentId);

    if (utilityIds.length > 0) {
      const factLines: string[] = [];
      let factsBackgroundImage =
        utilityItems
          .map((ig) => pickPayloadBackgroundImage(ig))
          .find(isNonEmptyUrl) ??
        topCandidatesImage(deduped);

      for (const uid of utilityIds.slice(0, 5)) {
        try {
          const utilItem = await itemsRepo.getItem(uid);
          if (!utilItem) continue;
          if (!factsBackgroundImage) {
            const sourceQueueItem = utilityItems.find(
              (ig) => ig.sourceContentId === uid,
            );
            factsBackgroundImage =
              pickStoryBackgroundImage(sourceQueueItem, utilItem) ??
              factsBackgroundImage;
          }
          // Prefer queue-carried imagery first; only fall back to the source item's
          // own image when it is already sharp enough for IG use.

          const factLine = buildFactLine(utilItem);
          if (factLine) {
            factLines.push(factLine);
          }
        } catch {
          // skip
        }
      }
      if (factLines.length > 0) {
        factsInput = {
          facts: factLines,
          ...(factsBackgroundImage
            ? { backgroundImage: factsBackgroundImage }
            : {}),
        } as StoryFactsInput;
      }
    }

    // ── Frames 3-6: Bonus headline items ─────────────────────────────────
    // Exclude taux, histoire, utility — those are already in dedicated frames.
    // Bias toward items with deadlines (scholarships/opportunities).
    const scheduledContentIds = new Set(
      deduped
        .filter((ig) => ig.status === "scheduled" || ig.status === "posted")
        .map((ig) => ig.sourceContentId),
    );

    const bonusCandidates = deduped
      .filter((ig) =>
        ig.igType !== "taux" &&
        ig.igType !== "histoire" &&
        ig.igType !== "utility" &&
        !scheduledContentIds.has(ig.sourceContentId),
      )
      .sort((a, b) => b.score - a.score);

    // If not enough un-scheduled bonus items, include scheduled ones too
    if (bonusCandidates.length < 2) {
      const extraCandidates = deduped
        .filter((ig) => ig.igType !== "taux" && ig.igType !== "histoire" && ig.igType !== "utility")
        .sort((a, b) => b.score - a.score);

      for (const ec of extraCandidates) {
        if (!bonusCandidates.find((c) => c.sourceContentId === ec.sourceContentId)) {
          bonusCandidates.push(ec);
        }
        if (bonusCandidates.length >= 4) break;
      }
    }

    const top = bonusCandidates.slice(0, 4);
    const storyItems: StoryItemInput[] = [];

    for (const igItem of top) {
      try {
        const item = await itemsRepo.getItem(igItem.sourceContentId);
        if (!item) continue;

        let bi: BilingualText | undefined;
        try {
          const versions = await contentVersionsRepo.listByItemId(item.id);
          const fr = versions.find((v) => v.language === "fr");
          const ht = versions.find((v) => v.language === "ht");
          if (fr) {
            bi = {
              frTitle: fr.title,
              frSummary: fr.summary,
              htTitle: ht?.title,
              htSummary: ht?.summary,
            };
          }
        } catch {
          // Content versions unavailable — use raw item
        }

        const storyBackgroundImage = pickStoryBackgroundImage(igItem, item);
        const storyItem =
          storyBackgroundImage && storyBackgroundImage !== item.imageUrl
            ? { ...item, imageUrl: storyBackgroundImage }
            : item;

        storyItems.push({
          item: storyItem,
          bi,
          igType: igItem.igType,
        });
      } catch {
        // Skip items that can't be fetched
      }
    }

    // Need at least taux or facts or 1 item to build a story
    if (!tauxInput && !factsInput && storyItems.length === 0) {
      return { queued: false, skipped: "insufficient-content" };
    }

    // Build the story payload
    const payload = buildDailySummaryStory(storyItems, undefined, tauxInput, factsInput);
    const sourceItemIds = storyItems.map((si) => si.item.id);

    // Insert into ig_story_queue
    await igStoryQueueRepo.createStoryQueueItem({
      dateKey,
      status: "queued" as IGStoryQueueStatus,
      sourceItemIds,
      payload,
    });

    const frameCount = payload.slides.length;
    console.log(
      `[buildIgStory] Queued morning briefing for ${dateKey}: ` +
      `${frameCount} frames (taux=${!!tauxInput}, facts=${!!factsInput}, headlines=${storyItems.length})`,
    );
    return { queued: true, skipped: "", itemCount: frameCount };
  } catch (err) {
    console.error("[buildIgStory] Error:", err instanceof Error ? err.message : err);
    return { queued: false, skipped: `error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

function topCandidatesImage(items: any[]): string | undefined {
  for (const item of items) {
    const image = pickPayloadBackgroundImage(item);
    if (image) return image;
  }
  return undefined;
}

// Stories are viewed for ~5 seconds — keep each fact tight and punchy.
const STORY_FACT_SOFT_LIMIT = 200;

export function buildFactLine(item: Item): string | null {
  // Prefer title for story facts — it's shorter and designed to be scanned quickly.
  // Fall back to summary only when no title is available.
  const candidate = item.title && item.title.length >= 10
    ? item.title
    : item.summary;
  if (!candidate) return null;

  const cleaned = candidate
    .replace(/\s+/g, " ")
    .replace(/[📚💡📌🎉⏰🇭🇹]/gu, "")
    .trim();

  if (cleaned.length <= STORY_FACT_SOFT_LIMIT) return cleaned;

  // Prefer ending at a sentence boundary so the fact feels complete
  const slice = cleaned.slice(0, STORY_FACT_SOFT_LIMIT);
  const sentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
  );
  if (sentenceEnd > 80) {
    return cleaned.slice(0, sentenceEnd + 1).trim();
  }

  // Fall back to word boundary
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 80 ? slice.slice(0, lastSpace) : slice).trim();
}
