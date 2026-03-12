/**
 * Worker job: buildIgQueue
 *
 * Runs every 30 minutes (or via /tick).
 * Fetches recent content items (last 72h), runs IG selection,
 * and inserts/merges into ig_queue.
 */

import { itemsRepo, igQueueRepo, contentVersionsRepo, sourcesRepo } from "@edlight-news/firebase";
import { decideIG, applyDedupePenalty, formatForIG } from "@edlight-news/generator/ig/index.js";
import type { BilingualText, FormatIGOptions } from "@edlight-news/generator/ig/index.js";
import type { Item, IGQueueStatus, Source } from "@edlight-news/types";
import { findFreeImage } from "../services/commonsImageSearch.js";

export interface BuildIgQueueResult {
  evaluated: number;
  queued: number;
  skipped: number;
  alreadyExists: number;
  errors: number;
}

export async function buildIgQueue(): Promise<BuildIgQueueResult> {
  const result: BuildIgQueueResult = {
    evaluated: 0,
    queued: 0,
    skipped: 0,
    alreadyExists: 0,
    errors: 0,
  };

  try {
    // Fetch recent items (last 72 hours)
    const recentItems = await itemsRepo.listRecentItems(500);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 72);

    const items: Item[] = recentItems.filter((item) => {
      if (!item.createdAt) return false;
      const createdAt = typeof item.createdAt === "object" && "seconds" in item.createdAt
        ? new Date((item.createdAt as any).seconds * 1000)
        : new Date();
      return createdAt >= cutoff;
    });

    // Build set of recently posted dedupe group IDs
    const recentPosted = await igQueueRepo.listRecentPosted(3, 50);
    const recentGroupIds = new Set<string>();
    // We'll track by sourceContentId → look up item to get dedupeGroupId
    for (const posted of recentPosted) {
      // We store sourceContentId = item.id, so we need to check the item
      // For simplicity, just track the sourceContentIds
      recentGroupIds.add(posted.sourceContentId);
    }

    // Pre-load source cache for igImageSafe lookup
    const sourceCache = new Map<string, Source | null>();

    for (const item of items) {
      result.evaluated++;
      try {
        // Check if already in queue
        const existing = await igQueueRepo.findBySourceContentId(item.id);
        if (existing) {
          result.alreadyExists++;
          continue;
        }

        // Run selection logic
        let decision = decideIG(item);

        // Apply dedupe penalty if item's group was recently posted
        if (item.dedupeGroupId) {
          decision = applyDedupePenalty(decision, recentGroupIds, item.dedupeGroupId);
        }

        if (!decision.igEligible || !decision.igType) {
          // Insert as skipped for transparency
          await igQueueRepo.createIGQueueItem({
            sourceContentId: item.id,
            igType: decision.igType ?? "news",
            score: decision.igPriorityScore,
            status: "skipped" as IGQueueStatus,
            reasons: decision.reasons,
          });
          result.skipped++;
          continue;
        }

        // Fetch bilingual content_versions (fr + ht) for proper captions
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
              frSections: fr.sections as { heading: string; content: string }[] | undefined,
              frBody: fr.body || undefined,
            };
          }
        } catch {
          // Versions unavailable — formatter will fall back to raw item fields
        }

        // Look up source to check igImageSafe
        let igImageSafe = true;
        if (!sourceCache.has(item.sourceId)) {
          sourceCache.set(item.sourceId, await sourcesRepo.getSource(item.sourceId));
        }
        const source = sourceCache.get(item.sourceId);
        if (source?.igImageSafe === false) {
          igImageSafe = false;
        }

        // For unsafe sources, try to find a free-licensed replacement image
        let overrideImageUrl: string | undefined;
        if (!igImageSafe && item.imageSource === "publisher") {
          try {
            const freeImage = await findFreeImage(item);
            if (freeImage) {
              overrideImageUrl = freeImage.imageUrl;
            }
          } catch (err) {
            console.warn(`[buildIgQueue] free image search failed for ${item.id}:`, err instanceof Error ? err.message : err);
          }
        }

        // Format the payload
        const opts: FormatIGOptions = { bi, igImageSafe, overrideImageUrl };
        const payload = formatForIG(decision.igType, item, opts);

        // Insert as queued
        await igQueueRepo.createIGQueueItem({
          sourceContentId: item.id,
          igType: decision.igType,
          score: decision.igPriorityScore,
          status: "queued" as IGQueueStatus,
          reasons: decision.reasons,
          payload,
        });
        result.queued++;
      } catch (err) {
        console.warn(`[buildIgQueue] error processing item ${item.id}:`, err instanceof Error ? err.message : err);
        result.errors++;
      }
    }

    console.log(`[buildIgQueue] evaluated=${result.evaluated} queued=${result.queued} skipped=${result.skipped} existing=${result.alreadyExists} errors=${result.errors}`);
  } catch (err) {
    console.error("[buildIgQueue] fatal error:", err);
    result.errors++;
  }

  return result;
}
