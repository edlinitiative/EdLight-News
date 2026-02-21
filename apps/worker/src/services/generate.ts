import {
  itemsRepo,
  contentVersionsRepo,
  sourcesRepo,
} from "@edlight-news/firebase";
import {
  generateWebDraftFRHT,
  buildContentVersionPayloads,
} from "@edlight-news/generator";
import type { QualityFlags, ItemCategory, Opportunity } from "@edlight-news/types";
import { computeScoring } from "./scoring.js";
import { PUBLISH_SCORE_THRESHOLD } from "@edlight-news/generator";

/** Max items to generate per tick (Gemini calls are ~2-5s each) */
const BATCH_LIMIT = parseInt(process.env.GENERATE_BATCH_LIMIT ?? "5", 10);

/**
 * Items scoring below this at ingest are skipped entirely — no Gemini call.
 * This is deliberately much lower than PUBLISH_SCORE_THRESHOLD (0.65)
 * because the generate step re-scores with the refined category which can
 * push scores up. But items this low are hopeless.
 */
const SKIP_GENERATION_THRESHOLD = PUBLISH_SCORE_THRESHOLD * 0.4; // 0.26

export async function generateForItems(): Promise<{
  generated: number;
  skipped: number;
  errors: number;
}> {
  const items = await itemsRepo.listRecentItems(BATCH_LIMIT * 3);

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of items) {
    // Stop once we've hit the batch limit
    if (generated >= BATCH_LIMIT) break;

    try {
      // Skip if already has web content versions
      const hasVersions = await contentVersionsRepo.hasWebVersions(item.id);
      if (hasVersions) {
        skipped++;
        continue;
      }

      // Skip Gemini call entirely if ingest score is hopelessly low
      if (
        item.audienceFitScore !== undefined &&
        item.audienceFitScore < SKIP_GENERATION_THRESHOLD
      ) {
        console.log(
          `[generate] SKIPPED item ${item.id} — pre-score too low (${item.audienceFitScore.toFixed(2)} < ${SKIP_GENERATION_THRESHOLD.toFixed(2)})`,
        );
        skipped++;
        continue;
      }

      // Use extracted text, or fall back to title + summary (e.g. Google News RSS)
      const textForGeneration =
        item.extractedText || `${item.title}\n\n${item.summary}`;
      const isShortContent = !item.extractedText;

      // Get source name for the prompt
      const source = await sourcesRepo.getSource(item.sourceId);
      const sourceName = source?.name ?? "Unknown";

      // Call Gemini
      const result = await generateWebDraftFRHT({
        title: item.title,
        text: textForGeneration,
        sourceUrl: item.canonicalUrl,
        sourceName,
      });

      if (!result.success) {
        console.error(`[generate] Gemini error for item ${item.id}:`, result.error);
        errors++;
        continue;
      }

      const draft = result.draft;

      // Relevance gate: skip content not relevant to Haiti
      if (!draft.haiti_relevant) {
        console.log(`[generate] SKIPPED item ${item.id} — not Haiti-relevant ("${draft.title_fr.slice(0, 60)}…")`);
        skipped++;
        continue;
      }

      // Build updated quality flags from Gemini's analysis
      const isOpportunityWithoutDeadline =
        draft.extracted.category === "opportunity" && !draft.extracted.deadline;

      const isScholarshipWithoutDeadline =
        draft.extracted.category === "scholarship" && !draft.extracted.deadline;

      const isLowConfidence = draft.confidence < 0.6;

      // Re-score with Gemini's category for better accuracy
      const textForScoring = `${item.title} ${item.extractedText || item.summary}`;
      const scoring = computeScoring(item.title, textForScoring, draft.extracted.category);

      const updatedReasons = [...(item.qualityFlags?.reasons ?? [])];
      if (isLowConfidence) updatedReasons.push(`Low confidence: ${draft.confidence}`);
      if (isOpportunityWithoutDeadline) updatedReasons.push("Opportunity without deadline");
      if (isScholarshipWithoutDeadline) updatedReasons.push("Scholarship without deadline");

      const updatedQualityFlags: QualityFlags = {
        hasSourceUrl: item.qualityFlags?.hasSourceUrl ?? true,
        needsReview: isOpportunityWithoutDeadline || isScholarshipWithoutDeadline,
        lowConfidence: isLowConfidence,
        weakSource: item.qualityFlags?.weakSource ?? false,
        missingDeadline: isOpportunityWithoutDeadline || isScholarshipWithoutDeadline,
        offMission: scoring.offMission || (item.qualityFlags?.offMission ?? false),
        reasons: updatedReasons,
      };

      // Build opportunity struct for scholarship/opportunity items
      let opportunity: Opportunity | undefined;
      if (draft.extracted.category === "scholarship" || draft.extracted.category === "opportunity") {
        opportunity = {
          ...(draft.extracted.deadline ? { deadline: draft.extracted.deadline } : {}),
          ...(draft.extracted.eligibility ? { eligibility: [draft.extracted.eligibility] } : {}),
          ...(item.source?.originalUrl ? { officialLink: item.source.originalUrl } : {}),
        };
      }

      // Update the item with Gemini's classification + refined v2 fields
      await itemsRepo.updateItem(item.id, {
        category: draft.extracted.category as ItemCategory,
        deadline: draft.extracted.deadline ?? null,
        confidence: draft.confidence,
        qualityFlags: updatedQualityFlags,
        audienceFitScore: scoring.audienceFitScore,
        geoTag: scoring.geoTag,
        ...(opportunity ? { opportunity } : {}),
      });

      // Build FR + HT content_version payloads with quality gates
      const payloads = buildContentVersionPayloads(
        draft,
        item.id,
        updatedQualityFlags,
        item.citations,
        draft.extracted.category as "news" | "scholarship" | "opportunity" | "event" | "resource" | "local_news",
        scoring.audienceFitScore,
      );

      // Write content_versions to Firestore
      await contentVersionsRepo.createDraftVersionsForItem(item.id, payloads);

      generated++;
      const scoreStr = scoring.audienceFitScore.toFixed(2);
      const statusStr = payloads[0]?.status ?? "unknown";
      console.log(
        `[generate] created ${payloads.length} versions for item ${item.id} (category=${draft.extracted.category}, confidence=${draft.confidence}, score=${scoreStr}, status=${statusStr})`,
      );
    } catch (err) {
      console.error(`[generate] error for item ${item.id}:`, err);
      errors++;
    }
  }

  console.log(`[generate] generated=${generated} skipped=${skipped} errors=${errors}`);
  return { generated, skipped, errors };
}
