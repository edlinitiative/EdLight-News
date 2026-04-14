/**
 * Worker job: buildIgQueue
 *
 * Runs every 30 minutes (or via /tick).
 * Fetches recent content items (last 72h), runs IG selection,
 * and inserts/merges into ig_queue.
 *
 * Firestore-quota-aware design:
 *  - Pre-loads existing sourceContentIds in ONE batch query (vs N individual reads)
 *  - Skips writing "skipped" status entries to Firestore (memory-only tracking)
 *  - Caps new items queued per run to MAX_NEW_ITEMS_PER_RUN
 */

import { itemsRepo, igQueueRepo, contentVersionsRepo, sourcesRepo } from "@edlight-news/firebase";
import { decideIG, applyDedupePenalty, formatForIG } from "@edlight-news/generator/ig/index.js";
import type { BilingualText, FormatIGOptions } from "@edlight-news/generator/ig/index.js";
import type { Item, IGQueueStatus, Source } from "@edlight-news/types";
import { findFreeImage } from "../services/commonsImageSearch.js";
import { findTieredImage } from "../services/tieredImagePipeline.js";
import { ensureOpportunityBackground } from "../services/geminiImageGen.js";

const HAITI_TZ = "America/Port-au-Prince";
const DAILY_UTILITY_SERIES = new Set(["HaitiHistory", "HaitiFactOfTheDay"]);

/**
 * Maximum number of NEW eligible items to queue per tick.
 * Prevents quota exhaustion on the Gemini / Firestore free tiers.
 */
const MAX_NEW_ITEMS_PER_RUN = 20;

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

function isHistoireItem(item: Item): boolean {
  return (
    item.canonicalUrl?.startsWith("edlight://histoire/") ||
    item.utilityMeta?.series === "HaitiHistory"
  );
}

function isDailyUtilityItem(item: Item): boolean {
  const series = item.utilityMeta?.series ?? "";
  return DAILY_UTILITY_SERIES.has(series);
}

/**
 * Extract the target post date for daily date-bound IG items.
 * Supports:
 * - histoire: `edlight://histoire/YYYY-MM-DD`
 * - daily utility: `edlight://utility/<series>/YYYY-MM-DD`
 * - fallback to the Haiti-local createdAt day for legacy daily items
 */
export function extractTargetPostDate(item: Item): string | undefined {
  const histoireMatch = item.canonicalUrl?.match(/edlight:\/\/histoire\/(\d{4}-\d{2}-\d{2})/);
  if (histoireMatch) return histoireMatch[1];

  const utilityMatch = item.canonicalUrl?.match(
    /edlight:\/\/utility\/(?:HaitiHistory|HaitiFactOfTheDay)\/(\d{4}-\d{2}-\d{2})/,
  );
  if (utilityMatch) return utilityMatch[1];

  if (isHistoireItem(item) || isDailyUtilityItem(item)) {
    const createdAt = dateFromTimestamp(item.createdAt);
    if (createdAt) return getHaitiDateKey(createdAt);
  }

  return undefined;
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
    const haitiToday = getHaitiDateKey();

    // Fetch recent items (last 72 hours) — capped at 150 to save Firestore quota
    const recentItems = await itemsRepo.listRecentItems(150);
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
    const freshItems = items.filter((item) => {
      if (isHistoireItem(item) || isDailyUtilityItem(item)) {
        const targetDate = extractTargetPostDate(item);
        if (targetDate !== haitiToday) {
          const label = isHistoireItem(item) ? "histoire" : "daily utility";
          console.log(`[buildIgQueue] Skipping stale ${label} item ${item.id} (target=${targetDate}, today=${haitiToday})`);
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

    // ── Batch pre-load existing ig_queue entries (saves ~500 reads/tick) ──
    // One query for all queue entries created in the last 4 days instead of
    // one findBySourceContentId call per item. Prevents Firestore quota exhaustion.
    const queueWindowCutoff = new Date();
    queueWindowCutoff.setDate(queueWindowCutoff.getDate() - 4);
    const existingSourceIds = await igQueueRepo.listSourceContentIdsSince(queueWindowCutoff);

    // Pre-load source cache for igImageSafe lookup
    const sourceCache = new Map<string, Source | null>();

    let newItemsQueuedThisRun = 0;

    for (const item of freshItems) {
      // Daily staple types (histoire, taux, utility/daily-fact) are exempt
      // from the per-run cap — they MUST enter the queue to be scheduled
      // at their pinned morning slots. Without this exemption, a burst of
      // 20+ news items can block histoire from ever being queued.
      const isStapleItem = isHistoireItem(item) || isDailyUtilityItem(item);

      // Stop after queuing MAX_NEW_ITEMS_PER_RUN new eligible items per tick
      // to prevent runaway Gemini / Firestore quota consumption.
      // Staple items bypass this cap.
      if (!isStapleItem && newItemsQueuedThisRun >= MAX_NEW_ITEMS_PER_RUN) {
        break;
      }

      // Skip items rejected by histoire dedup
      if (histoireRejects.has(item.id)) {
        result.skipped++;
        continue;
      }
      result.evaluated++;
      try {
        // Check if already in queue (uses batch pre-loaded set — no extra Firestore read)
        if (existingSourceIds.has(item.id)) {
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
          // Do NOT write a "skipped" Firestore entry — that burns quota on every tick.
          // The item will be re-evaluated next tick (still fast via the batch Set check).
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
              frNarrative: fr.narrative ?? undefined,
            };
          }
        } catch {
          // Versions unavailable — formatter will fall back to raw item fields
        }

        // Language gate: skip items without a French content_version.
        // Without bi.frTitle the formatter falls back to item.title which may
        // be in Haitian Creole, producing Creole slides on a French-language account.
        if (!bi) {
          console.log(`[buildIgQueue] Skipping ${item.id}: no FR content_version — would produce non-French slides`);
          result.skipped++;
          continue;
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

        // ── Always run the tiered image pipeline ─────────────────────────
        // Finds the best contextual image from Brave → Unsplash → LoC → Wikimedia.
        // This runs for EVERY item, not just unsafe sources, because even
        // "safe" publisher images are often low-resolution or poorly cropped.
        let overrideImageUrl: string | undefined;
        try {
          const tieredResult = await findTieredImage(item);
          if (tieredResult && tieredResult.width >= 1080) {
            overrideImageUrl = tieredResult.url;
            console.log(
              `[buildIgQueue] tiered image found for ${item.id}: ${tieredResult.source} ` +
              `(${tieredResult.width}×${tieredResult.height}, score=${tieredResult.score.toFixed(1)})`,
            );
          }
        } catch (err) {
          console.warn(`[buildIgQueue] tiered image pipeline failed for ${item.id}:`, err instanceof Error ? err.message : err);
        }

        // Fallback: commons-only search if tiered pipeline found nothing
        if (!overrideImageUrl) {
          try {
            const freeImage = await findFreeImage(item);
            if (freeImage) {
              overrideImageUrl = freeImage.imageUrl;
            }
          } catch (err) {
            console.warn(`[buildIgQueue] free image search failed for ${item.id}:`, err instanceof Error ? err.message : err);
          }
        }

        // When we have a pipeline-sourced image, mark igImageSafe as false
        // so the formatter replaces slides' backgroundImage with our override.
        if (overrideImageUrl) {
          igImageSafe = false;
        }

        // Format the payload
        const opts: FormatIGOptions = { bi, igImageSafe, overrideImageUrl };
        const payload = await formatForIG(decision.igType, item, opts);

        // ── QA gate: reject formatter-flagged or malformed payloads ──────────
        // Prevents English-rejected posts and empty/missing-headline items
        // from consuming Gemini image quota and Firestore writes.
        if ((payload as any)._rejected || payload.slides.length === 0) {
          console.warn(`[buildIgQueue] Formatter rejected ${item.id}: ${(payload as any)._rejected ?? "empty payload"}`);
          result.skipped++;
          continue;
        }
        if ((payload.slides[0]?.heading ?? "").trim().length < 5) {
          console.warn(`[buildIgQueue] QA gate: cover heading too short for ${item.id}`);
          result.skipped++;
          continue;
        }

        // ── Histoire: per-event image resolution ──────────────────────────
        // Each content slide represents a distinct historical event. Resolve a
        // matching Wikimedia illustration per slide heading so, for example, the
        // "Paix d'Amiens" slide gets a Paix d'Amiens image and the "Toussaint
        // Louverture" slide gets a Toussaint portrait — not both the same image.
        if (decision.igType === "histoire") {
          try {
            const { resolveHistoryIllustration } = await import(
              "../services/historyIllustrationResolver.js"
            );
            // Skip the cover (index 0) and CTA slides — only content slides.
            const contentSlides = payload.slides.filter(
              (s, idx) => idx > 0 && s.layout !== "cta" && !!s.heading,
            );
            let resolvedCount = 0;
            for (const slide of contentSlides) {
              try {
                const resolved = await resolveHistoryIllustration(slide.heading);
                if (resolved?.imageUrl) {
                  slide.backgroundImage = resolved.imageUrl;
                  resolvedCount++;
                }
              } catch {
                // Keep any existing backgroundImage on this slide
              }
            }
            if (resolvedCount > 0) {
              console.log(
                `[buildIgQueue] Resolved ${resolvedCount} per-event image(s) for histoire item ${item.id}`,
              );
            }
          } catch (err) {
            console.warn(
              `[buildIgQueue] histoire per-event image resolution failed for ${item.id}:`,
              err instanceof Error ? err.message : err,
            );
          }
        }

        // ── Opportunity, utility & scholarship: apply branded dark background ──
        // Content slides get one consistent Gemini-generated gradient; CTA slides
        // keep their curated landmark images (MUPANAH, Port-au-Prince, etc.).
        if (decision.igType === "opportunity" || decision.igType === "utility" || decision.igType === "scholarship") {
          try {
            const oppBg = await ensureOpportunityBackground();
            if (oppBg) {
              for (const slide of payload.slides.filter((s) => s.layout !== "cta")) {
                slide.backgroundImage = oppBg;
              }
              console.log(`[buildIgQueue] Applied branded background for ${decision.igType} ${item.id}`);
            }
          } catch (err) {
            console.warn(`[buildIgQueue] branded background fetch failed for ${item.id}:`, err instanceof Error ? err.message : err);
          }
        }

        // Image fill consolidated: processIgScheduled owns the canonical
        // image propagation + Gemini fallback pass at render time.
        // buildIgQueue only applies intentional per-type backgrounds above.

        // Insert as queued
        const targetPostDate = extractTargetPostDate(item);

        await igQueueRepo.createIGQueueItem({
          sourceContentId: item.id,
          igType: decision.igType,
          score: decision.igPriorityScore,
          status: "queued" as IGQueueStatus,
          reasons: decision.reasons,
          payload,
          // Stamp a targetPostDate on date-bound daily items so the scheduler
          // only uses them on the Haiti day they were generated for.
          ...(targetPostDate
            ? { targetPostDate }
            : {}),
          // Stamp the Haiti-local queue date on ALL items so the scheduler
          // can prefer same-day items over stale carry-overs from previous days.
          queuedDate: haitiToday,
        });
        result.queued++;
        newItemsQueuedThisRun++;
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
