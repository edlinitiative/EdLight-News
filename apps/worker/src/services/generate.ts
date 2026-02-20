import {
  itemsRepo,
  contentVersionsRepo,
  sourcesRepo,
} from "@edlight-news/firebase";
import {
  generateWebDraftFRHT,
  buildContentVersionPayloads,
} from "@edlight-news/generator";
import type { QualityFlags, ItemCategory } from "@edlight-news/types";

/** Max items to generate per tick (Gemini calls are ~2-5s each) */
const BATCH_LIMIT = parseInt(process.env.GENERATE_BATCH_LIMIT ?? "5", 10);

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

      const isLowConfidence = draft.confidence < 0.6;

      const updatedReasons = [...item.qualityFlags.reasons];
      if (isLowConfidence) updatedReasons.push(`Low confidence: ${draft.confidence}`);
      if (isOpportunityWithoutDeadline) updatedReasons.push("Opportunity without deadline");

      const updatedQualityFlags: QualityFlags = {
        hasSourceUrl: item.qualityFlags.hasSourceUrl,
        needsReview: isOpportunityWithoutDeadline,
        lowConfidence: isLowConfidence,
        reasons: updatedReasons,
      };

      // Update the item with Gemini's classification
      await itemsRepo.updateItem(item.id, {
        category: draft.extracted.category as ItemCategory,
        deadline: draft.extracted.deadline ?? null,
        confidence: draft.confidence,
        qualityFlags: updatedQualityFlags,
      });

      // Build FR + HT content_version payloads with quality gates
      const payloads = buildContentVersionPayloads(
        draft,
        item.id,
        updatedQualityFlags,
        item.citations,
        draft.extracted.category as "news" | "scholarship" | "opportunity" | "event" | "resource" | "local_news",
      );

      // Write content_versions to Firestore
      await contentVersionsRepo.createDraftVersionsForItem(item.id, payloads);

      generated++;
      console.log(
        `[generate] created ${payloads.length} versions for item ${item.id} (category=${draft.extracted.category}, confidence=${draft.confidence})`,
      );
    } catch (err) {
      console.error(`[generate] error for item ${item.id}:`, err);
      errors++;
    }
  }

  console.log(`[generate] generated=${generated} skipped=${skipped} errors=${errors}`);
  return { generated, skipped, errors };
}
