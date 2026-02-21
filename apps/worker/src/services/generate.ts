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
import { classifyItem } from "./classify.js";
import { PUBLISH_SCORE_THRESHOLD } from "@edlight-news/generator";

/** Max items to generate per tick (Gemini calls are ~2-5s each) */
const BATCH_LIMIT = parseInt(process.env.GENERATE_BATCH_LIMIT ?? "5", 10);

/**
 * Items scoring below this at ingest are skipped entirely — no Gemini call.
 * This is deliberately much lower than PUBLISH_SCORE_THRESHOLD (0.65)
 * because the generate step re-scores with the refined category which can
 * push scores up. 0.35 ≈ 0.23 — captures items with a single Haiti mention
 * (score=0.25) that Gemini can elevate once it reads the full text.
 */
const SKIP_GENERATION_THRESHOLD = PUBLISH_SCORE_THRESHOLD * 0.35; // ~0.23

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

      const isLowConfidence = draft.confidence < 0.6 || isShortContent;

      // Re-score with Gemini's category for better accuracy
      const textForScoring = `${item.title} ${item.extractedText || item.summary}`;
      const scoring = computeScoring(item.title, textForScoring, draft.extracted.category);

      // ── Deterministic opportunity classification on full text ──────────
      const classification = classifyItem(
        item.title,
        item.summary,
        item.extractedText ?? "",
      );

      // Determine final category: deterministic classifier wins for opportunities
      let finalCategory: ItemCategory;
      let finalVertical: string | undefined;
      let finalDeadline: string | null;
      let finalOpportunity: Opportunity | undefined;

      if (classification.isOpportunity) {
        // Deterministic classifier detected opportunity keywords → use its subcategory
        finalCategory = classification.category!;
        finalVertical = "opportunites";
        finalDeadline = classification.deadline ?? draft.extracted.deadline ?? null;
        finalOpportunity = {
          ...(classification.opportunity ?? {}),
          ...(draft.extracted.deadline && !classification.deadline
            ? { deadline: draft.extracted.deadline }
            : {}),
          ...(draft.extracted.eligibility
            ? { eligibility: [draft.extracted.eligibility] }
            : {}),
          ...(item.source?.originalUrl
            ? { officialLink: item.source.originalUrl }
            : {}),
        };
      } else if (
        draft.extracted.category === "scholarship" ||
        draft.extracted.category === "opportunity"
      ) {
        // Gemini detected opportunity but deterministic didn't → keep Gemini's
        finalCategory = draft.extracted.category as ItemCategory;
        finalVertical = "opportunites";
        finalDeadline = draft.extracted.deadline ?? null;
        finalOpportunity = {
          ...(draft.extracted.deadline
            ? { deadline: draft.extracted.deadline }
            : {}),
          ...(draft.extracted.eligibility
            ? { eligibility: [draft.extracted.eligibility] }
            : {}),
          ...(item.source?.originalUrl
            ? { officialLink: item.source.originalUrl }
            : {}),
        };
      } else {
        finalCategory = draft.extracted.category as ItemCategory;
        finalVertical = undefined;
        finalDeadline = draft.extracted.deadline ?? null;
        finalOpportunity = undefined;
      }

      const isOpportunityType =
        finalVertical === "opportunites" ||
        ["scholarship", "opportunity", "bourses", "concours", "stages", "programmes"].includes(
          finalCategory,
        );
      const isMissingDeadline = isOpportunityType && !finalDeadline;

      const updatedReasons = [...(item.qualityFlags?.reasons ?? [])];
      if (isShortContent)
        updatedReasons.push(
          "No extracted article text — generated from title/summary only",
        );
      if (isLowConfidence && !isShortContent)
        updatedReasons.push(`Low confidence: ${draft.confidence}`);
      if (isMissingDeadline)
        updatedReasons.push("Opportunity without deadline");

      const updatedQualityFlags: QualityFlags = {
        hasSourceUrl: item.qualityFlags?.hasSourceUrl ?? true,
        needsReview: isOpportunityType && isMissingDeadline,
        lowConfidence: isLowConfidence,
        weakSource: item.qualityFlags?.weakSource ?? false,
        missingDeadline: isMissingDeadline,
        offMission:
          scoring.offMission || (item.qualityFlags?.offMission ?? false),
        reasons: updatedReasons,
      };

      // Effective geoTag: use classifier's for opportunities, else scoring's
      const effectiveGeoTag = classification.isOpportunity
        ? (classification.geoTag ?? scoring.geoTag)
        : scoring.geoTag;

      // Update the item with refined classification + v2 fields
      await itemsRepo.updateItem(item.id, {
        category: finalCategory,
        vertical: finalVertical,
        deadline: finalDeadline,
        confidence: draft.confidence,
        qualityFlags: updatedQualityFlags,
        audienceFitScore: scoring.audienceFitScore,
        geoTag: effectiveGeoTag,
        ...(finalOpportunity ? { opportunity: finalOpportunity } : {}),
      });

      // Build FR + HT content_version payloads with quality gates
      const payloads = buildContentVersionPayloads(
        draft,
        item.id,
        updatedQualityFlags,
        item.citations,
        finalCategory,
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
