import { createHash } from "crypto";
import {
  itemsRepo,
  contentVersionsRepo,
  sourcesRepo,
} from "@edlight-news/firebase";
import {
  generateWebDraftFRHT,
  buildContentVersionPayloads,
  formatContentVersion,
} from "@edlight-news/generator";
import type { QualityFlags, ItemCategory, Opportunity } from "@edlight-news/types";
import { computeScoring } from "./scoring.js";
import { classifyItem } from "./classify.js";
import { classifyWithZeroShot, resolveCategory } from "./zeroShotClassifier.js";
import { PUBLISH_SCORE_THRESHOLD } from "@edlight-news/generator";
import { isBotProtectionPage } from "@edlight-news/scraper";

/** Hash a Gemini cluster_slug to a 16-hex-char dedupeGroupId. */
function slugToDedupeGroupId(slug: string): string {
  return createHash("sha256")
    .update(slug.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
}

/** Max items to generate per tick (Gemini calls are ~2-5s each) */
const BATCH_LIMIT = parseInt(process.env.GENERATE_BATCH_LIMIT ?? "5", 10);

/**
 * Items scoring below this at ingest are skipped entirely — no Gemini call.
 * This is deliberately much lower than PUBLISH_SCORE_THRESHOLD (0.40)
 * because the generate step re-scores with the refined category which can
 * push scores up. 0.40 × 0.35 ≈ 0.14 — captures items with even a faint
 * Haiti mention that Gemini can elevate once it reads the full text.
 */
const SKIP_GENERATION_THRESHOLD = PUBLISH_SCORE_THRESHOLD * 0.35; // ~0.14

/** Max Gemini generation attempts before permanently skipping an item */
const MAX_GENERATION_ATTEMPTS = 3;

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

      // Skip items that have permanently failed generation
      if ((item.generationAttempts ?? 0) >= MAX_GENERATION_ATTEMPTS) {
        console.warn(
          `[generate] SKIPPED item ${item.id} — exceeded max generation attempts (${item.generationAttempts}/${MAX_GENERATION_ATTEMPTS})`,
        );
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

      // Safety: reject items whose text looks like CAPTCHA / bot-protection
      // content — no point sending garbage to Gemini.
      if (isBotProtectionPage(textForGeneration)) {
        console.warn(
          `[generate] SKIPPED item ${item.id} — text looks like bot-protection/CAPTCHA content`,
        );
        skipped++;
        continue;
      }

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
        await itemsRepo.updateItem(item.id, {
          generationAttempts: (item.generationAttempts ?? 0) + 1,
        });
        errors++;
        continue;
      }

      const draft = result.draft;

      // Quality gate: reject placeholder / "À confirmer" content.
      // When Gemini has no real source text (e.g. an RSS index page),
      // it sometimes fabricates vague filler that adds no value.
      const bodyFr = draft.body_fr ?? "";
      const bodyHt = draft.body_ht ?? "";
      const confirmCount =
        (bodyFr.match(/[àa] confirmer/gi)?.length ?? 0) +
        (bodyHt.match(/pou konfime/gi)?.length ?? 0);
      if (confirmCount >= 3) {
        console.log(
          `[generate] SKIPPED item ${item.id} — body is mostly placeholder content (${confirmCount}× "à confirmer")`,
        );
        skipped++;
        continue;
      }

      // Quality gate: reject extremely short bodies that contain no real info
      const bodyMinLen = 150; // ~2 short sentences
      if (bodyFr.length < bodyMinLen && bodyHt.length < bodyMinLen) {
        console.log(
          `[generate] SKIPPED item ${item.id} — body too short (fr=${bodyFr.length}, ht=${bodyHt.length} chars)`,
        );
        skipped++;
        continue;
      }

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

      // ── Zero-shot ML classification (2nd opinion) ──────────────────────
      let mlCategory: ItemCategory = draft.extracted.category as ItemCategory;
      try {
        const zeroShotResult = await classifyWithZeroShot(
          draft.title_fr,
          draft.body_fr,
        );
        const resolved = resolveCategory(
          draft.extracted.category,
          zeroShotResult,
          classification.isOpportunity,
        );
        mlCategory = resolved.category as ItemCategory;
        console.log(
          `[generate] zero-shot: ${resolved.source} → ${resolved.category} (${resolved.reason}) [${zeroShotResult.latencyMs}ms]`,
        );
      } catch (err) {
        console.warn(`[generate] zero-shot classifier failed, falling back to Gemini:`, err);
      }
      // Apply ML-corrected category back onto the draft for downstream use
      if (mlCategory !== draft.extracted.category) {
        (draft.extracted as { category: string }).category = mlCategory;
      }

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
        finalDeadline = draft.extracted.deadline ?? null;
        finalOpportunity = undefined;

        // ── Infer vertical from content signals ───────────────────────────
        // The website uses `vertical` as the primary taxonomy for section
        // pages (world, education, business). Without this, articles only
        // appear via keyword fallback matching.
        const textForVertical = `${item.title} ${item.summary ?? ""} ${draft.title_fr}`.toLowerCase();

        if (
          scoring.geoTag === "Global" ||
          scoring.geoTag === "Diaspora" ||
          /\b(international|géopolitique|diplomatie|onu|nations unies|g7|g20|otan|nato|monde|world|global|entènasyonal|jewopolitik)\b/i.test(textForVertical)
        ) {
          finalVertical = "world";
        } else if (
          /\b(université|education|éducation|enseignement|étudiant|lycée|school|academic|inivèsite|edikasyon|recherche|research)\b/i.test(textForVertical)
        ) {
          finalVertical = "education";
        } else if (
          /\b(économie|economy|business|entreprise|startup|finance|investissement|marché|entrepreneurship|commerce|emploi|ekonomi|biznis)\b/i.test(textForVertical)
        ) {
          finalVertical = "business";
        } else {
          finalVertical = undefined;
        }
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

      // Compute semantic dedupeGroupId from Gemini's cluster_slug
      const semanticGroupId = draft.cluster_slug
        ? slugToDedupeGroupId(draft.cluster_slug)
        : undefined;

      // Update the item with refined classification + v2 fields
      // Success tag: deterministic keyword match OR Gemini detection (logical OR)
      const isSuccessStory =
        classification.isSuccessStory || draft.is_success_story === true;

      await itemsRepo.updateItem(item.id, {
        category: finalCategory,
        vertical: finalVertical,
        deadline: finalDeadline,
        confidence: draft.confidence,
        qualityFlags: updatedQualityFlags,
        audienceFitScore: scoring.audienceFitScore,
        geoTag: effectiveGeoTag,
        ...(finalOpportunity ? { opportunity: finalOpportunity } : {}),
        ...(semanticGroupId ? { dedupeGroupId: semanticGroupId } : {}),
        ...(isSuccessStory ? { successTag: true } : {}),
      });

      // Build FR + HT content_version payloads with quality gates
      const rawPayloads = buildContentVersionPayloads(
        draft,
        item.id,
        updatedQualityFlags,
        item.citations,
        finalCategory,
        scoring.audienceFitScore,
      );

      // Post-process for consistent house style
      const payloads = rawPayloads.map((p) => {
        const formatted = formatContentVersion({
          lang: p.language as "fr" | "ht",
          title: p.title,
          summary: p.summary,
          body: p.body,
          series: "News",
        });
        return { ...p, ...formatted };
      });

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
      try {
        await itemsRepo.updateItem(item.id, {
          generationAttempts: (item.generationAttempts ?? 0) + 1,
        });
      } catch (updateErr) {
        console.error(`[generate] failed to update generationAttempts for item ${item.id}:`, updateErr);
      }
      errors++;
    }
  }

  console.log(`[generate] generated=${generated} skipped=${skipped} errors=${errors}`);
  return { generated, skipped, errors };
}
