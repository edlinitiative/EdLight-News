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
import { generateContextualImage } from "../services/geminiImageGen.js";

/**
 * Extract the target post date for a histoire item.
 * Histoire canonicalUrls follow `edlight://histoire/YYYY-MM-DD`.
 * Falls back to Haiti-time today if the pattern doesn't match.
 */
function extractHistoireDate(item: Item): string {
  const match = item.canonicalUrl?.match(/edlight:\/\/histoire\/(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  // Fallback: Haiti time (UTC-5) today
  const now = new Date();
  const haitiOffset = -5 * 60;
  const haitiMs = now.getTime() + (now.getTimezoneOffset() + haitiOffset) * 60_000;
  return new Date(haitiMs).toISOString().slice(0, 10);
}

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
    // Compute today's Haiti date for histoire freshness checks
    const nowMs = Date.now();
    const haitiNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Port-au-Prince" }));
    const haitiToday = haitiNow.toISOString().slice(0, 10);

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

    // ── Histoire date-freshness gate ───────────────────────────────────
    // Only allow histoire items whose target date matches today.
    // This prevents a March 10 histoire from posting on March 13.
    const isHistoireItem = (i: Item) =>
      i.canonicalUrl?.startsWith("edlight://histoire/") ||
      i.utilityMeta?.series === "HaitiHistory";

    const freshItems = items.filter((item) => {
      if (isHistoireItem(item)) {
        const targetDate = extractHistoireDate(item);
        if (targetDate !== haitiToday) {
          console.log(`[buildIgQueue] Skipping stale histoire item ${item.id} (target=${targetDate}, today=${haitiToday})`);
          return false;
        }
      }
      return true;
    });

    // ── Histoire dedup: pick richer item when both historyPublisher ────
    // and HaitiHistory utility produce histoire items for the same day.
    const histoireItems = freshItems.filter((i) => isHistoireItem(i));
    const histoireRejects = new Set<string>();
    if (histoireItems.length > 1) {
      // Pick the richest one (most sections/citations)
      const scored = histoireItems.map((i) => {
        const sectionCount = (i as any).sections?.length ?? 0;
        const citationCount = i.citations?.length ?? 0;
        const bodyLen = (i as any).body?.length ?? (i as any).extractedText?.length ?? 0;
        return { id: i.id, richness: sectionCount * 100 + citationCount * 50 + bodyLen };
      });
      scored.sort((a, b) => b.richness - a.richness);
      // Keep the richest, reject the rest
      for (let k = 1; k < scored.length; k++) {
        histoireRejects.add(scored[k]!.id);
      }
      if (histoireRejects.size > 0) {
        console.log(`[buildIgQueue] Histoire dedup: keeping ${scored[0]!.id}, rejecting ${[...histoireRejects].join(", ")}`);
      }
    }

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

    for (const item of freshItems) {
      // Skip items rejected by histoire dedup
      if (histoireRejects.has(item.id)) {
        result.skipped++;
        continue;
      }
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
        const payload = await formatForIG(decision.igType, item, opts);

        // ── Image consistency: every slide must use the same background ─
        // If any slide lacks a backgroundImage (low-confidence publisher image,
        // unsafe source, or utility/histoire type), first try to reuse the
        // cover's image (avoids cover ≠ inner mismatch); only call Gemini
        // when NO slide has an image yet.
        const slidesNeedingImage = payload.slides.filter((s) => !s.backgroundImage);
        if (slidesNeedingImage.length > 0) {
          const coverImage = payload.slides[0]?.backgroundImage;
          if (coverImage) {
            // Cover already has an image — propagate it to the rest
            for (const slide of slidesNeedingImage) {
              slide.backgroundImage = coverImage;
            }
            console.log(`[buildIgQueue] Propagated cover image to ${slidesNeedingImage.length} slide(s) for ${item.id}`);
          } else {
            // No slides have an image — generate one and apply to all
            try {
              const generated = await generateContextualImage(item);
              if (generated?.url) {
                for (const slide of slidesNeedingImage) {
                  slide.backgroundImage = generated.url;
                }
                console.log(`[buildIgQueue] Gemini image filled ${slidesNeedingImage.length} slides for ${item.id}`);
              }
            } catch (err) {
              console.warn(`[buildIgQueue] Gemini image fallback failed for ${item.id}:`, err instanceof Error ? err.message : err);
            }
          }
        }

        // Insert as queued
        await igQueueRepo.createIGQueueItem({
          sourceContentId: item.id,
          igType: decision.igType,
          score: decision.igPriorityScore,
          status: "queued" as IGQueueStatus,
          reasons: decision.reasons,
          payload,
          // For histoire items, stamp the target post date so the scheduler
          // ensures same-day posting (extracted from canonicalUrl or createdAt).
          ...(decision.igType === "histoire" ? {
            targetPostDate: extractHistoireDate(item),
          } : {}),
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
