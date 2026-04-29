#!/usr/bin/env npx tsx
/**
 * Backfill: Generate French (FR) content_versions for bourses/scholarship items
 * that are missing them, so they can enter the IG queue.
 *
 * This script targets items with category IN ("bourses","scholarship","opportunity","concours","stages","programmes")
 * and vertical="opportunites" that lack a published FR content_version.
 *
 * Usage:
 *   cd apps/worker
 *
 *   # Dry-run: show what WOULD be generated (no writes)
 *   npx tsx src/scripts/generateBoursesContentVersions.ts
 *
 *   # Live: generate FR content_versions for these items
 *   npx tsx src/scripts/generateBoursesContentVersions.ts --confirm
 *
 *   # Limit to first N items
 *   npx tsx src/scripts/generateBoursesContentVersions.ts --confirm --limit=20
 *
 *   # Target a specific category only
 *   npx tsx src/scripts/generateBoursesContentVersions.ts --confirm --category=bourses
 *
 *   # Use a specific LLM provider (default: groq to avoid Gemini costs)
 *   npx tsx src/scripts/generateBoursesContentVersions.ts --confirm --provider=gemini
 */

import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../..", ".env") });
dotenv.config({ path: path.resolve(__dirname, "../../../..", ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "../..", ".env") });

import { getDb, itemsRepo, contentVersionsRepo } from "@edlight-news/firebase";
import {
  generateWebDraftFRHT,
  buildContentVersionPayloads,
  formatContentVersion,
  validateAndFixCategory,
  type GeminiWebDraft,
} from "@edlight-news/generator";
import { computeScoring } from "../services/scoring.js";
import type { Item, ItemCategory, QualityFlags } from "@edlight-news/types";
import type { Firestore } from "firebase-admin/firestore";

// ── LLM Provider ─────────────────────────────────────────────────────────────
// Default to Groq (free) to avoid Gemini costs during bulk backfill.
// Override with --provider=gemini|openai|groq|anthropic|mistral|openrouter

const DEFAULT_LLM_PROVIDER = "mistral";

// ── Helpers ─────────────────────────────────────────────────────────────────

interface CliArgs {
  confirm: boolean;
  limit: number;
  category: string | null;
  skipExisting: boolean;
  provider: string;
}

function getArgValue(args: string[], flag: string): string | null {
  // Handle --key=value
  const eqIdx = args.findIndex((a) => a.startsWith(flag + "="));
  if (eqIdx >= 0) return args[eqIdx].split("=", 2)[1] || null;
  // Handle --key value
  const spaceIdx = args.indexOf(flag);
  if (spaceIdx >= 0 && spaceIdx + 1 < args.length && !args[spaceIdx + 1].startsWith("-")) {
    return args[spaceIdx + 1];
  }
  return null;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  return {
    confirm: args.some((a) => a === "--confirm"),
    limit: parseInt(getArgValue(args, "--limit") ?? "0") || Infinity,
    category: getArgValue(args, "--category"),
    skipExisting: !args.some((a) => a === "--force"),
    provider: getArgValue(args, "--provider") ?? DEFAULT_LLM_PROVIDER,
  };
}

/** Build a synthetic citations array for bourses items that may lack one */
function buildCitations(item: Item): { sourceName: string; sourceUrl: string }[] {
  if (item.citations?.length) return item.citations;
  return [
    {
      sourceName: item.source?.name ?? "EdLight",
      sourceUrl: item.canonicalUrl ?? item.source?.originalUrl ?? "",
    },
  ];
}

/** Build synthetic quality flags based on item data */
function buildQualityFlags(item: Item): QualityFlags {
  const hasUrl = !!(item.canonicalUrl || item.source?.originalUrl);
  return {
    hasSourceUrl: hasUrl,
    needsReview: false,
    lowConfidence: false,
    reasons: [],
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();
  const mode = args.confirm ? "LIVE" : "DRY-RUN";

  // Set LLM_PROVIDER before calling generateWebDraftFRHT (which reads it via callLLM).
  // This overrides whatever is in .env and defaults to "groq" (free).
  process.env.LLM_PROVIDER = args.provider;

  console.log(`\n🔧  Generate Bourses FR content_versions — ${mode} mode`);
  console.log(`🤖  LLM Provider: ${process.env.LLM_PROVIDER}`);
  if (args.category) console.log(`📂  Category filter: "${args.category}"`);
  if (args.limit < Infinity) console.log(`📏  Limit: ${args.limit} items`);
  console.log();

  const db = getDb() as Firestore;

  // 1. Query candidate items — vertical=opportunites
  const allDocs = await db
    .collection("items")
    .where("vertical", "==", "opportunites")
    .get();
  console.log(`📊  items with vertical=opportunites: ${allDocs.size}`);

  // Filter to relevant categories
  const targetCategories = args.category
    ? new Set([args.category])
    : new Set([
        "bourses",
        "scholarship",
        "opportunity",
        "concours",
        "stages",
        "programmes",
      ]);

  const candidates: Item[] = [];
  for (const doc of allDocs.docs) {
    const data = doc.data();
    if (targetCategories.has(data.category)) {
      candidates.push({ id: doc.id, ...data } as Item);
    }
  }
  console.log(
    `📊  Filtered to ${[...targetCategories].join("/")}: ${candidates.length}`,
  );

  // 2. Check which ones need FR content_versions
  const needingGeneration: Item[] = [];
  const alreadyHaveFr: Item[] = [];
  const BATCH = 30;

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const ids = batch.map((it) => it.id);

    const cvSnap = await db
      .collection("content_versions")
      .where("itemId", "in", ids)
      .where("language", "==", "fr")
      .where("status", "==", "published")
      .get();

    const publishedIds = new Set(cvSnap.docs.map((d) => d.data().itemId));

    for (const item of batch) {
      if (publishedIds.has(item.id)) {
        alreadyHaveFr.push(item);
      } else {
        needingGeneration.push(item);
      }
    }
  }

  console.log(
    `✅  Already have published FR content_version: ${alreadyHaveFr.length}`,
  );
  console.log(`❌  NEED FR content_version: ${needingGeneration.length}`);
  console.log();

  if (needingGeneration.length === 0) {
    console.log("🎉  All items have FR content_versions. Nothing to do.");
    process.exit(0);
  }

  // Apply limit
  const toProcess = needingGeneration.slice(0, args.limit);
  console.log(`🎯  Will process ${toProcess.length} items…\n`);

  if (!args.confirm) {
    console.log("── DRY-RUN: items that WOULD be generated ──");
    for (const item of toProcess.slice(0, 20)) {
      const title = (item.title ?? "").slice(0, 70);
      console.log(
        `  📝 ${item.id.slice(0, 14)} | ${(item.category ?? "").padEnd(12)} | ${title}`,
      );
    }
    if (toProcess.length > 20) {
      console.log(`  … and ${toProcess.length - 20} more`);
    }
    console.log("\n💡  Run with --confirm to generate.");
    process.exit(0);
  }

  // 3. Generate FR content_versions via LLM
  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (let idx = 0; idx < toProcess.length; idx++) {
    const item = toProcess[idx];
    const title = (item.title ?? "").slice(0, 60);
    const progress = `[${idx + 1}/${toProcess.length}]`;

    try {
      // Re-check if already generated (from a previous run)
      if (args.skipExisting) {
        const existingSnap = await db
          .collection("content_versions")
          .where("itemId", "==", item.id)
          .where("language", "==", "fr")
          .where("status", "==", "published")
          .get();

        if (!existingSnap.empty) {
          skipped++;
          console.log(`${progress} ⏭️  SKIP (already generated): ${title}`);
          continue;
        }
      }

      const text = item.extractedText ?? item.summary ?? item.title ?? "";
      if (text.length < 50) {
        console.log(
          `${progress} ⚠️  SKIP (too short: ${text.length} chars): ${title}`,
        );
        skipped++;
        continue;
      }

      const input = {
        title: item.title ?? "",
        text,
        sourceUrl: item.canonicalUrl ?? item.source?.originalUrl ?? "",
        sourceName:
          item.citations?.[0]?.sourceName ??
          item.source?.name ??
          "Source inconnue",
      };

      // Call LLM to generate FR+HT draft
      console.log(`${progress} 🤖  Generating for: ${title}`);
      const result = await generateWebDraftFRHT(input);

      if (!result || !result.success) {
        const errMsg = result && 'error' in result ? result.error : 'empty result';
        console.warn(`${progress} ⚠️  LLM failed: ${errMsg.slice(0, 100)}`);
        skipped++;
        continue;
      }

      const draft = result.draft;

      if (!draft.extracted) {
        console.warn(`${progress} ⚠️  LLM draft missing 'extracted' field — skipping item.`);
        skipped++;
        continue;
      }

      // Validate and fix category
      const correctedCategory = validateAndFixCategory({
        titleFr: draft.title_fr ?? item.title ?? "",
        bodyFr: draft.body_fr ?? "",
        category: draft.extracted.category ?? item.category ?? "news",
        deadline: draft.extracted.deadline ?? null,
      }) as ItemCategory;

      // Score (uses local worker scoring, matching generate.ts pattern)
      const textForScoring = draft.body_fr ?? item.extractedText ?? text;
      const scoring = computeScoring(
        draft.title_fr ?? item.title,
        textForScoring,
        draft.extracted.category ?? item.category ?? "news",
      );

      const confidence = draft.confidence ?? 0.5;
      const qualityFlags = buildQualityFlags(item);
      if (confidence < 0.6) {
        qualityFlags.lowConfidence = true;
      }

      // Build content_version payloads (same pattern as generate.ts)
      const rawPayloads = buildContentVersionPayloads(
        draft as unknown as GeminiWebDraft,
        item.id,
        qualityFlags,
        buildCitations(item),
        correctedCategory,
        scoring.audienceFitScore,
      );

      // Post-process for consistent house style (same as generate.ts)
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

      // Write content_versions via the repo (matching generate.ts pattern)
      await contentVersionsRepo.createDraftVersionsForItem(item.id, payloads);

      // Update item metadata
      const semanticGroupId =
        (draft as any).cluster_slug ?? undefined;
      await itemsRepo.updateItem(item.id, {
        category: correctedCategory,
        confidence,
        qualityFlags,
        audienceFitScore: scoring.audienceFitScore,
        geoTag: scoring.geoTag,
        ...(semanticGroupId ? { dedupeGroupId: semanticGroupId } : {}),
      });

      generated++;
      console.log(
        `${progress} ✅  Generated & saved: ${title} (score=${scoring.audienceFitScore.toFixed(2)})`,
      );

      // Rate limit: ~10 RPM for Gemini; Groq/other providers can be faster
      const delay = parseInt(process.env.GEMINI_DELAY_MS ?? "6000", 10);
      if (idx < toProcess.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `${progress} ❌  ERROR for ${title}: ${msg.slice(0, 200)}`,
      );
    }
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  COMPLETE");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Generated:  ${generated}`);
  console.log(`  Skipped:    ${skipped}`);
  console.log(`  Errors:     ${errors}`);
  console.log(`  Total:      ${toProcess.length}`);
  console.log(
    "\n💡  Next: run runTick to build the IG queue with these items.",
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});