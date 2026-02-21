import { Timestamp } from "firebase-admin/firestore";
import { rawItemsRepo, itemsRepo, sourcesRepo } from "@edlight-news/firebase";
import { extractArticleContent } from "@edlight-news/scraper";
import type { QualityFlags } from "@edlight-news/types";
import {
  computeScoring,
  computeDedupeGroupId,
  buildItemSource,
} from "./scoring.js";

/** Max raw_items to process per tick (article extraction can be slow) */
const BATCH_LIMIT = parseInt(process.env.PROCESS_BATCH_LIMIT ?? "10", 10);

export async function processRawItems(): Promise<{
  processed: number;
  skipped: number;
  errors: number;
}> {
  const rawItems = await rawItemsRepo.getNewRawItems(BATCH_LIMIT);
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const raw of rawItems) {
    try {
      // Look up source for citation info
      const source = await sourcesRepo.getSource(raw.sourceId);
      if (!source) {
        await rawItemsRepo.markSkipped(raw.id, "Source not found");
        skipped++;
        continue;
      }

      // Extract full article content from the URL
      let title = raw.title;
      let extractedText: string | null = null;
      let canonicalUrl = raw.url;
      let publisherImageUrl: string | null = null;
      let publisherImageConfidence = 0;

      // Titles that are clearly scraper noise, not real article titles
      const GENERIC_TITLES = new Set([
        "google news", "google", "news", "untitled", "page not found",
        "403 forbidden", "404 not found", "access denied", "just a moment...",
        "attention required!", "site en maintenance",
      ]);

      try {
        const article = await extractArticleContent(raw.url, source.selectors);
        const scrapedTitle = article.title?.trim() ?? "";
        const isGenericTitle = !scrapedTitle || GENERIC_TITLES.has(scrapedTitle.toLowerCase());
        title = isGenericTitle ? raw.title : scrapedTitle;
        extractedText = article.text || null;
        canonicalUrl = article.canonicalUrl || raw.url;
        // Capture publisher image if available (og:image / twitter:image)
        publisherImageUrl = article.publisherImageUrl || null;
        publisherImageConfidence = article.publisherImageConfidence ?? 0;
      } catch (err) {
        // Article extraction failed — continue with raw data only
        extractedText = null;
        console.warn(`[process] extraction failed for ${raw.url}:`, err);
      }

      // Build initial quality flags (generate step refines after Gemini call)
      const hasSourceUrl = !!raw.url && raw.url.startsWith("http");
      const reasons: string[] = [];
      if (!hasSourceUrl) reasons.push("No source URL");

      // Compute v2 scoring & classification
      const textForScoring = `${title} ${extractedText || raw.description || ""}`;
      const scoring = computeScoring(title, textForScoring);
      const dedupeGroupId = computeDedupeGroupId(title, canonicalUrl);
      const { source: itemSource, weakSource } = buildItemSource(source.name, raw.url);

      if (weakSource) reasons.push("Could not trace original publisher");
      if (scoring.offMission) reasons.push("Possibly off-mission content");

      const qualityFlags: QualityFlags = {
        hasSourceUrl,
        needsReview: false,
        lowConfidence: false,
        weakSource,
        offMission: scoring.offMission,
        reasons,
      };

      // Upsert item keyed by canonical URL (deduplicates across sources)
      const summary = raw.description?.trim() || title;

      const { item, created } = await itemsRepo.upsertItemByCanonicalUrl({
        rawItemId: raw.id,
        sourceId: raw.sourceId,
        title,
        summary,
        canonicalUrl,
        extractedText,
        category: "news", // default; the generate step classifies via Gemini
        deadline: null,
        evergreen: false,
        confidence: 0, // set by generate step
        qualityFlags,
        citations: [{ sourceName: source.name, sourceUrl: raw.url }],
        // v2 fields
        geoTag: scoring.geoTag,
        audienceFitScore: scoring.audienceFitScore,
        dedupeGroupId,
        source: itemSource,
        publishedAt: raw.publishedAt,
        // image fields — set when publisher provides og:image with sufficient confidence
        ...(publisherImageUrl && publisherImageConfidence >= 0.6
          ? {
              imageUrl: publisherImageUrl,
              imageSource: "publisher" as const,
              imageConfidence: publisherImageConfidence,
              imageMeta: {
                fetchedAt: new Date().toISOString(),
                originalImageUrl: publisherImageUrl,
              },
            }
          : {}),
      });

      await rawItemsRepo.markProcessed(raw.id);
      processed++;
      console.log(
        `[process] ${created ? "created" : "updated"} item ${item.id} from raw_item ${raw.id}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[process] error for raw_item ${raw.id}: ${msg}`);
      try {
        await rawItemsRepo.markSkipped(
          raw.id,
          err instanceof Error ? err.message : "Unknown error",
        );
      } catch {
        // If marking skipped also fails, just log
      }
      errors++;
    }
  }

  console.log(`[process] processed=${processed} skipped=${skipped} errors=${errors}`);
  return { processed, skipped, errors };
}
