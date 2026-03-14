/**
 * Worker job: buildIgStory (v2 — Morning Briefing)
 *
 * Runs once per day (self-gated) to build the morning briefing IG Story.
 *
 * New story structure:
 *  Frame 1 — Taux du jour (pulled from today's taux ig_queue item)
 *  Frame 2 — Faits du jour (from today's utility items: facts + histoire)
 *  Frames 3-6 — Up to 4 highest-scored items not already scheduled as
 *               carousels, biased toward items with deadlines
 *  Frame 7 — CTA (@edlight.news) — auto-appended by the renderer
 *
 * Logic:
 *  1. Check if today's story already exists in ig_story_queue → skip.
 *  2. Pull taux data from today's ig_queue item (if posted).
 *  3. Pull today's utility items for facts frame.
 *  4. Pull highest-scored items NOT already scheduled for carousels.
 *  5. Format via buildDailySummaryStory → insert into ig_story_queue.
 *
 * Time gate: 05:30–06:29 Haiti time (morning briefing).
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

function isInStoryWindow(): boolean {
  const haiti = toHaitiDate(new Date());
  const hour = haiti.getHours();
  const minute = haiti.getMinutes();
  // 05:30–06:29 Haiti time — stories go out first thing so they
  // last the full day (IG stories expire after 24h).
  return (hour > 5 || (hour === 5 && minute >= 30)) && hour < 7;
}

function todayDateKey(): string {
  const haiti = toHaitiDate(new Date());
  const y = haiti.getFullYear();
  const m = String(haiti.getMonth() + 1).padStart(2, "0");
  const d = String(haiti.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Result type ────────────────────────────────────────────────────────────
export interface BuildIgStoryResult {
  queued: boolean;
  skipped: string;
  itemCount?: number;
}

// ── Main job ───────────────────────────────────────────────────────────────

export async function buildIgStory(): Promise<BuildIgStoryResult> {
  // Time-gate
  if (!isInStoryWindow()) {
    return { queued: false, skipped: "outside-story-window" };
  }

  const dateKey = todayDateKey();

  // Already created today?
  const existing = await igStoryQueueRepo.getByDateKey(dateKey);
  if (existing) {
    return { queued: false, skipped: "already-exists" };
  }

  try {
    // ── Gather all today's IG items ──────────────────────────────────────
    const postedItems = await igQueueRepo.listRecentPosted(1, 30);
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
    const tauxItem = deduped.find((ig) => ig.igType === "taux");
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
    const utilityIds = deduped
      .filter((ig) => ig.igType === "histoire" || ig.igType === "utility")
      .map((ig) => ig.sourceContentId);

    if (utilityIds.length > 0) {
      const factLines: string[] = [];
      let factsBackgroundImage: string | undefined;
      for (const uid of utilityIds.slice(0, 5)) {
        try {
          const utilItem = await itemsRepo.getItem(uid);
          if (!utilItem) continue;
          if (!factsBackgroundImage && utilItem.imageUrl) {
            factsBackgroundImage = utilItem.imageUrl;
          }

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
          backgroundImage: factsBackgroundImage,
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

        storyItems.push({ item, bi });
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

function buildFactLine(item: Item): string | null {
  const candidate = item.summary && item.summary.length >= 24
    ? item.summary
    : item.title;
  if (!candidate) return null;

  return candidate
    .replace(/\s+/g, " ")
    .replace(/[📚💡📌🎉⏰🇭🇹]/gu, "")
    .trim()
    .slice(0, 140);
}
