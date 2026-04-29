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
import { decideIG, applyDedupePenalty, formatForIG, isItemImageUsableForIG } from "@edlight-news/generator/ig/index.js";
import type { BilingualText, FormatIGOptions } from "@edlight-news/generator/ig/index.js";
import type { Item, IGQueueStatus, Source } from "@edlight-news/types";
import { ensureOpportunityBackground } from "../services/geminiImageGen.js";
import { selectImageForIG } from "../services/igImagePipeline.js";

const HAITI_TZ = "America/Port-au-Prince";
const DAILY_UTILITY_SERIES = new Set(["HaitiHistory", "HaitiFactOfTheDay"]);

// French/English stopwords to ignore in heading similarity
const HEADING_STOPWORDS = new Set([
  "le","la","les","un","une","des","du","de","en","et","ou","au","aux",
  "sur","par","pour","dans","avec","sans","est","sont","être","avoir",
  "the","a","an","of","in","to","for","on","at","by","from","its",
  "as","is","was","are","be","has","have","had","not","with","and",
  "that","this","it","or","but","if","haiti","haïti","haïtien","haïtienne",
]);

/**
 * Returns true when two headings share ≥ THRESHOLD significant words.
 * Used to detect same-story items queued under different titles
 * (e.g., 3× articles about the same TPS Supreme Court hearing).
 */
function headingSimilar(a: string, b: string, threshold = 4): boolean {
  const words = (s: string) =>
    new Set(
      s.toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !HEADING_STOPWORDS.has(w)),
    );
  const wa = words(a);
  const wb = words(b);
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared >= threshold;
}
// Image-selection policy now lives entirely in services/igImagePipeline.ts.
// All env flags (IG_STRICT_IMAGE_ACCURACY, IG_ALLOW_EDITORIAL_IMAGE_SUBSTITUTION,
// IG_LLM_IMAGE_FINDER, IG_LLM_VALIDATE_PUBLISHER) are read there so every
// caller goes through the same gates.

/**
 * Maximum number of NEW eligible items to queue per tick.
 * Prevents quota exhaustion on the Gemini / Firestore free tiers.
 */
const MAX_NEW_ITEMS_PER_RUN = 40;

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

    const recentFiltered: Item[] = recentItems.filter((item) => {
      if (!item.createdAt) return false;
      const createdAt = typeof item.createdAt === "object" && "seconds" in item.createdAt
        ? new Date((item.createdAt as any).seconds * 1000)
        : new Date();
      return createdAt >= cutoff;
    });

    // ── Opportunity/scholarship backlog ───────────────────────────────
    // Scholarship and opportunity items are evergreen — they remain relevant
    // for weeks after ingest. They are often promoted by discoverScholarships
    // days after the original ingest, which puts them outside the 72h window.
    // Fetch them separately so they're always evaluated regardless of age.
    let oppBacklog: Item[] = [];
    try {
      oppBacklog = await itemsRepo.listOpportunitiesForIgBackfill(150);
    } catch (err) {
      console.warn("[buildIgQueue] opportunity backlog query failed:", err instanceof Error ? err.message : err);
    }

    // Merge: recent items first, then opp backlog (deduped by id)
    const seen = new Set<string>(recentFiltered.map((i) => i.id));
    const items: Item[] = [
      ...recentFiltered,
      ...oppBacklog.filter((i) => !seen.has(i.id)),
    ];

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
    //
    // Two complementary sets:
    //  A) pendingSourceIds / pendingGroupIds — ALL items currently queued or
    //     scheduled, regardless of age. Prevents re-queuing stale items that
    //     never got scheduled (no 30-day blind spot). Also carries dedupeGroupId
    //     so we can skip items whose group is already pending (e.g. 3× TPS).
    //  B) historicalSourceIds — items posted/expired/skipped in the last 30 days.
    //     Prevents re-queuing something that was already posted recently.
    const { sourceIds: pendingSourceIds, groupIds: pendingGroupIds, headings: pendingHeadings } =
      await igQueueRepo.listPendingSourceIds();
    const histWindowCutoff = new Date();
    histWindowCutoff.setDate(histWindowCutoff.getDate() - 30);
    const historicalSourceIds = await igQueueRepo.listSourceContentIdsSince(histWindowCutoff);
    // Merge into one set for the alreadyExists check
    const existingSourceIds = new Set([...pendingSourceIds, ...historicalSourceIds]);
    // Track dedupeGroupIds that already have a pending post — updated in-memory
    // as we queue new items so same-tick dupes are also caught.
    const queuedGroupIds = new Set(pendingGroupIds);
    // Pending cover headings for topic-similarity dedup (catches TPS ×3 etc.)
    const queuedHeadings: string[] = [...pendingHeadings];

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

        // Dedup by topic group: if another item with the same dedupeGroupId is
        // already pending (queued/scheduled), skip this one. This prevents
        // "TPS ×3" — multiple items about the same story all entering the queue.
        if (item.dedupeGroupId && queuedGroupIds.has(item.dedupeGroupId)) {
          result.skipped++;
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

        // ── Unified IG image pipeline ────────────────────────────────────
        // Single entry point that handles publisher validation, reverse
        // image search, LLM finder, tiered keyword pipeline, and Commons
        // fallback — with vision validation gating every substitution. See
        // services/igImagePipeline.ts for the full policy. Centralizing
        // this means the renderer pipeline is the one source of truth and
        // we never bypass the validators (the bug that caused MS-13 to
        // ship with a Library-of-Congress scanned book page).
        const selection = await selectImageForIG(item, { igImageSafe });
        const overrideImageUrl = selection.overrideImageUrl;
        igImageSafe = selection.igImageSafe;
        console.log(
          `[buildIgQueue] image selection for ${item.id}: ` +
            `source=${selection.source} igImageSafe=${igImageSafe} — ${selection.reason}`,
        );

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
        const coverHeading = (payload.slides[0]?.heading ?? "").trim();
        if (coverHeading.length < 5) {
          console.warn(`[buildIgQueue] QA gate: cover heading too short for ${item.id}`);
          result.skipped++;
          continue;
        }

        // ── Heading-similarity dedup ─────────────────────────────────────────
        // Catches same-story items that escaped dedupeGroupId matching because
        // they were published under slightly different headlines (TPS ×3, etc.).
        // Threshold of 4 significant shared words is conservative enough to
        // avoid blocking genuinely different stories.
        if (decision.igType === "news" || decision.igType === "breaking") {
          const similar = queuedHeadings.find((h) => headingSimilar(h, coverHeading));
          if (similar) {
            console.log(
              `[buildIgQueue] Heading-similarity dedup skipped ${item.id}:\n` +
              `  pending: "${similar.slice(0, 70)}"\n` +
              `  new:     "${coverHeading.slice(0, 70)}"`,
            );
            result.skipped++;
            continue;
          }
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
          // Stamp dedupeGroupId so the pending-queue dedup works on future ticks.
          ...(item.dedupeGroupId ? { dedupeGroupId: item.dedupeGroupId } : {}),
          // Stamp a targetPostDate on date-bound daily items so the scheduler
          // only uses them on the Haiti day they were generated for.
          ...(targetPostDate
            ? { targetPostDate }
            : {}),
          // Stamp the Haiti-local queue date on ALL items so the scheduler
          // can prefer same-day items over stale carry-overs from previous days.
          queuedDate: haitiToday,
        });
        // Update in-memory sets so same-tick dupes are caught without a
        // round-trip to Firestore.
        existingSourceIds.add(item.id);
        if (item.dedupeGroupId) queuedGroupIds.add(item.dedupeGroupId);
        queuedHeadings.push(coverHeading);
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
