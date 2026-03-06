/**
 * Worker job: buildIgStory
 *
 * Runs once per day (self-gated) to build a "Daily Summary" Instagram Story.
 *
 * Logic:
 *  1. Check if today's story already exists in ig_story_queue → skip if so.
 *  2. Pull the top-scored queued/posted IG items from the last 24h.
 *  3. Fetch bilingual content_versions for each.
 *  4. Format via buildDailySummaryStory → insert into ig_story_queue.
 *
 * Time gate: only runs between 11:00–13:00 Haiti time (midday recap).
 */

import { igQueueRepo, igStoryQueueRepo, contentVersionsRepo } from "@edlight-news/firebase";
import { buildDailySummaryStory, type StoryItemInput } from "@edlight-news/generator/ig/index.js";
import type { BilingualText } from "@edlight-news/generator/ig/index.js";
import { itemsRepo } from "@edlight-news/firebase";
import type { IGStoryQueueStatus } from "@edlight-news/types";

// ── Haiti timezone ─────────────────────────────────────────────────────────
const HAITI_TZ = "America/Port-au-Prince";

function toHaitiDate(date: Date): Date {
  const haitiStr = date.toLocaleString("en-US", { timeZone: HAITI_TZ });
  return new Date(haitiStr);
}

function isInStoryWindow(): boolean {
  const haiti = toHaitiDate(new Date());
  const hour = haiti.getHours();
  return hour >= 11 && hour < 13; // 11:00–12:59 Haiti time
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
    // Gather today's best IG items (posted or scheduled — they have payloads)
    const postedItems = await igQueueRepo.listRecentPosted(1, 20);
    const scheduledItems = await igQueueRepo.listByStatus("scheduled", 20);
    const queuedItems = await igQueueRepo.listByStatus("queued", 20);

    // Merge, sort by score descending, dedupe
    const seen = new Set<string>();
    const candidates = [...postedItems, ...scheduledItems, ...queuedItems]
      .sort((a, b) => b.score - a.score)
      .filter((ig) => {
        if (seen.has(ig.sourceContentId)) return false;
        seen.add(ig.sourceContentId);
        return true;
      });

    if (candidates.length < 2) {
      return { queued: false, skipped: "not-enough-items" };
    }

    // Take top 5 and resolve full Item + bilingual text
    const top = candidates.slice(0, 5);
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

    if (storyItems.length < 2) {
      return { queued: false, skipped: "insufficient-resolved-items" };
    }

    // Build the story payload
    const payload = buildDailySummaryStory(storyItems);
    const sourceItemIds = storyItems.map((si) => si.item.id);

    // Insert into ig_story_queue
    await igStoryQueueRepo.createStoryQueueItem({
      dateKey,
      status: "queued" as IGStoryQueueStatus,
      sourceItemIds,
      payload,
    });

    console.log(`[buildIgStory] Queued daily summary story for ${dateKey} with ${storyItems.length} items`);
    return { queued: true, skipped: "", itemCount: storyItems.length };
  } catch (err) {
    console.error("[buildIgStory] Error:", err instanceof Error ? err.message : err);
    return { queued: false, skipped: `error: ${err instanceof Error ? err.message : String(err)}` };
  }
}
