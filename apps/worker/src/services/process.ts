import { Timestamp } from "firebase-admin/firestore";
import { rawItemsRepo, itemsRepo, sourcesRepo } from "@edlight-news/firebase";
import { extractArticleContent, parseGoogleNewsTitle, isBotProtectionPage } from "@edlight-news/scraper";
import type { QualityFlags } from "@edlight-news/types";
import {
  computeScoring,
  computeDedupeGroupId,
  buildItemSource,
  isAggregatorUrl,
} from "./scoring.js";
import { classifyItem } from "./classify.js";

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

      // For Google News / aggregator URLs, skip article extraction entirely
      // (they serve JS interstitials that can't be scraped).
      // Instead, parse the publisher name from the title suffix.
      const isAggregator = isAggregatorUrl(raw.url);
      let effectiveSourceName = source.name;

      if (isAggregator) {
        // Google News titles: "Article Title - Publisher Name"
        const { cleanTitle, publisherName } = parseGoogleNewsTitle(raw.title);
        title = cleanTitle || raw.title;
        extractedText = null;
        // Keep the aggregator URL as canonical — will be overridden by
        // the publisher name-based source info below.
        if (publisherName) {
          // Override source name with the actual publisher
          effectiveSourceName = publisherName;
        }
      } else {
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
      }

      // Safety net: detect bot-protection / CAPTCHA text in extracted content.
      // The scraper should already filter this, but double-check here in case
      // the text was assembled from RSS description + partial extraction.
      if (extractedText && isBotProtectionPage(extractedText)) {
        console.warn(
          `[process] bot-protection text detected in extracted content for ${raw.url} — discarding`,
        );
        extractedText = null;
      }

      // Build initial quality flags (generate step refines after Gemini call)
      const hasSourceUrl = !!raw.url && raw.url.startsWith("http");
      const reasons: string[] = [];
      if (!hasSourceUrl) reasons.push("No source URL");

      // Compute v2 scoring & classification
      const textForScoring = `${title} ${extractedText || raw.description || ""}`;
      const scoring = computeScoring(title, textForScoring);
      const dedupeGroupId = computeDedupeGroupId(title, canonicalUrl);
      const { source: itemSource, weakSource } = buildItemSource(effectiveSourceName, raw.url);

      if (weakSource) reasons.push("Could not trace original publisher");
      if (scoring.offMission) reasons.push("Possibly off-mission content");

      // ── Deterministic opportunity classification ───────────────────────
      const classification = classifyItem(
        title,
        raw.description ?? "",
        extractedText ?? "",
      );

      if (classification.missingDeadline) {
        reasons.push("Opportunity without deadline (deterministic)");
      }

      const qualityFlags: QualityFlags = {
        hasSourceUrl,
        needsReview: false,
        lowConfidence: false,
        weakSource,
        missingDeadline: classification.missingDeadline ?? false,
        offMission: scoring.offMission,
        reasons,
      };

      // Use deterministic category if opportunity detected; else default "news"
      const initialCategory = classification.isOpportunity
        ? classification.category!
        : "news";

      // If classifier identified an opportunity, boost the audience-fit score
      const effectiveGeoTag = classification.isOpportunity
        ? (classification.geoTag ?? scoring.geoTag)
        : scoring.geoTag;

      // Upsert item keyed by canonical URL (deduplicates across sources)
      const summary = raw.description?.trim() || title;

      const { item, created } = await itemsRepo.upsertItemByCanonicalUrl({
        rawItemId: raw.id,
        sourceId: raw.sourceId,
        title,
        summary,
        canonicalUrl,
        extractedText,
        itemType: "source" as const,
        category: initialCategory,
        deadline: classification.deadline ?? null,
        evergreen: false,
        confidence: 0, // set by generate step
        qualityFlags,
        citations: [{ sourceName: source.name, sourceUrl: raw.url }],
        // v2 fields
        ...(classification.isOpportunity ? { vertical: "opportunites" } : {}),
        geoTag: effectiveGeoTag,
        audienceFitScore: scoring.audienceFitScore,
        dedupeGroupId,
        source: itemSource,
        ...(classification.opportunity ? { opportunity: classification.opportunity } : {}),
        publishedAt: raw.publishedAt,
        // success story tagging (deterministic keyword match)
        ...(classification.isSuccessStory ? { successTag: true } : {}),
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
