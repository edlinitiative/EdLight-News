/**
 * Backfill: apply the editorial normalization engine to existing content_versions.
 *
 * Reads published web content_versions, sends each to Gemini for editorial
 * normalization (tone + structure), validates grounding against the parent
 * item's extracted text, and writes the normalized body + sections back.
 *
 * This is an LLM backfill — it calls Gemini for every article, so it
 * includes rate-limiting, concurrency control, and resume support.
 *
 * Usage:
 *   pnpm backfill:normalize                          # live (default limit 200)
 *   pnpm backfill:normalize --limit=1000             # higher limit
 *   pnpm backfill:normalize --dry-run                # log diffs, no writes
 *   pnpm backfill:normalize --dry-run --limit=10     # preview a small sample
 *   pnpm backfill:normalize --force                  # re-normalize already normalized articles
 *   pnpm backfill:normalize --lang=ht                # only Kreyòl versions
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, itemsRepo } from "@edlight-news/firebase";
import {
  normalizeArticle,
  validateNormalizationGrounding,
  formatNormalizedArticle,
} from "@edlight-news/generator";
import type {
  GeminiNormalizedArticle,
  NormalizeArticleInput,
} from "@edlight-news/generator";
import type { ContentVersion, ContentLanguage, Item } from "@edlight-news/types";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── CLI args ────────────────────────────────────────────────────────────────
interface CliArgs {
  limit: number;
  dryRun: boolean;
  force: boolean;
  lang?: ContentLanguage;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let limit = 200;
  let dryRun = false;
  let force = false;
  let lang: ContentLanguage | undefined;

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      const v = parseInt(arg.split("=")[1]!, 10);
      if (!isNaN(v) && v > 0) limit = v;
    }
    if (arg === "--dry-run") dryRun = true;
    if (arg === "--force") force = true;
    if (arg === "--lang=fr") lang = "fr";
    if (arg === "--lang=ht") lang = "ht";
  }

  return { limit, dryRun, force, lang };
}

// ── Rate limiter (Gemini free tier: ~15 RPM) ────────────────────────────────
const GEMINI_DELAY_MS = 4_500; // ~13 RPM — safe margin

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Marker field ────────────────────────────────────────────────────────────
// We store a marker on content_versions that have been normalized so we can
// skip them on re-runs (unless --force is passed).
const NORMALIZED_MARKER = "editorialNormalized";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build the input for the normalization engine from a content_version + parent item. */
function buildNormalizeInput(
  cv: ContentVersion,
  parentItem: Item | null,
): NormalizeArticleInput | null {
  // Need body text to normalize
  const bodyText = cv.body ?? cv.sections?.map((s) => `${s.heading}\n${s.content}`).join("\n\n");
  if (!bodyText || bodyText.trim().length < 50) return null;

  const sourceName =
    cv.citations?.[0]?.sourceName ??
    parentItem?.source?.name ??
    parentItem?.citations?.[0]?.sourceName ??
    "Source inconnue";

  const sourceUrl =
    cv.citations?.[0]?.sourceUrl ??
    parentItem?.canonicalUrl ??
    parentItem?.source?.originalUrl ??
    "";

  return {
    title: cv.title,
    body: bodyText,
    sourceName,
    sourceUrl,
    lang: cv.language === "ht" ? "ht" : "fr",
  };
}

/**
 * Convert a GeminiNormalizedArticle to content_version update fields.
 * Maps the 7-section structure to sections[] + body.
 */
function buildUpdatePayload(article: GeminiNormalizedArticle): Record<string, unknown> {
  const sections: { heading: string; content: string }[] = [];

  sections.push({ heading: "Résumé exécutif", content: article.executive_summary });
  sections.push({ heading: "Faits confirmés", content: article.confirmed_facts });

  if (article.official_statements) {
    sections.push({ heading: "Déclarations officielles", content: article.official_statements });
  }
  if (article.unclear_points) {
    sections.push({ heading: "Points non clarifiés", content: article.unclear_points });
  }

  sections.push({ heading: "Pourquoi c'est important", content: article.why_it_matters });
  sections.push({ heading: "Source", content: article.source_citation });

  if (article.information_to_verify) {
    sections.push({ heading: "Informations à vérifier", content: article.information_to_verify });
  }

  // Also produce a flat body (Markdown) for renderers that don't support sections
  const body = formatNormalizedArticle(article);

  return {
    title: article.title,
    summary: article.executive_summary,
    sections,
    body,
    [NORMALIZED_MARKER]: true,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

// ── Stats ───────────────────────────────────────────────────────────────────
interface Stats {
  scanned: number;
  skipped: number;
  normalized: number;
  validationFailed: number;
  errors: number;
}

function printStats(stats: Stats, dryRun: boolean) {
  console.log(`\n✅ Done!`);
  console.log(`   Scanned:              ${stats.scanned}`);
  console.log(`   Skipped (no body/already done): ${stats.skipped}`);
  console.log(`   Normalized:           ${stats.normalized}`);
  console.log(`   Validation failed:    ${stats.validationFailed}`);
  console.log(`   Errors:               ${stats.errors}`);
  if (dryRun) console.log(`   (dry run — no writes performed)`);
  console.log();
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const { limit, dryRun, force, lang } = parseArgs();

  console.log(
    `\n📰 Backfill editorial normalization — ${dryRun ? "DRY RUN" : "LIVE MODE"} (limit=${limit}${force ? ", force" : ""}${lang ? `, lang=${lang}` : ""})\n`,
  );

  const db = getDb();
  const col = db.collection("content_versions");

  const BATCH_SIZE = 50; // smaller than format backfill — each doc costs an LLM call
  const stats: Stats = { scanned: 0, skipped: 0, normalized: 0, validationFailed: 0, errors: 0 };
  let lastDocSnap: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let hasMore = true;

  // Cache parent items to avoid repeated lookups
  const itemCache = new Map<string, Item | null>();

  async function getItem(itemId: string): Promise<Item | null> {
    if (itemCache.has(itemId)) return itemCache.get(itemId)!;
    try {
      const item = await itemsRepo.getItem(itemId);
      itemCache.set(itemId, item);
      return item;
    } catch {
      itemCache.set(itemId, null);
      return null;
    }
  }

  while (hasMore && stats.scanned < limit) {
    const remaining = limit - stats.scanned;
    // Over-fetch since we filter in-memory
    const pageSize = Math.min(BATCH_SIZE * 3, remaining * 3);

    // Query: order by createdAt only (no composite index required).
    // Filter channel/status/lang in-memory to avoid needing a composite index.
    let query = col
      .orderBy("createdAt", "desc")
      .limit(pageSize);

    if (lastDocSnap) {
      query = query.startAfter(lastDocSnap);
    }

    const snap = await query.get();
    if (snap.empty) {
      hasMore = false;
      break;
    }
    lastDocSnap = snap.docs[snap.docs.length - 1];

    // In-memory filter: published web content only
    const eligible = snap.docs.filter((doc) => {
      const data = doc.data();
      if (data.channel !== "web") return false;
      if (data.status !== "published") return false;
      if (lang && data.language !== lang) return false;
      return true;
    });

    for (const doc of eligible) {
      if (stats.scanned >= limit) break;
      stats.scanned++;

      try {
        const cv = { id: doc.id, ...doc.data() } as ContentVersion;

        // Skip if already normalized (unless --force)
        if (!force && (cv as unknown as Record<string, unknown>)[NORMALIZED_MARKER]) {
          stats.skipped++;
          continue;
        }

        // Skip utility content (history, scholarships, etc.) — only normalize news/synthesis
        const parentItem = await getItem(cv.itemId);
        if (
          parentItem?.itemType === "utility"
        ) {
          stats.skipped++;
          continue;
        }

        // Build normalization input
        const input = buildNormalizeInput(cv, parentItem);
        if (!input) {
          stats.skipped++;
          continue;
        }

        // Rate limit before Gemini call
        await sleep(GEMINI_DELAY_MS);

        console.log(
          `  🔄 [${stats.scanned}/${limit}] Normalizing: "${cv.title?.slice(0, 60)}…" (${cv.language})`,
        );

        // Call Gemini
        const result = await normalizeArticle(input);

        if (!result.success) {
          console.error(`  ❌ LLM error for ${doc.id}: ${result.error}`);
          stats.errors++;
          continue;
        }

        // Validate grounding against original body
        const originalBody =
          parentItem?.extractedText ??
          cv.body ??
          cv.sections?.map((s) => s.content).join("\n") ??
          "";
        const validation = validateNormalizationGrounding(result.article, originalBody);

        if (!validation.passed) {
          console.warn(
            `  ⚠️  Grounding validation failed for ${doc.id}: ${validation.issues.join("; ")}`,
          );
          stats.validationFailed++;
          continue; // Don't write ungrounded content
        }

        // Build update payload
        const payload = buildUpdatePayload(result.article);

        if (dryRun) {
          console.log(`  📝 [would update] ${doc.id} — "${result.article.title.slice(0, 60)}…"`);
          console.log(`     Confidence: ${result.article.confidence}`);
          console.log(`     Sections: ${(payload.sections as unknown[]).length}`);
        } else {
          await doc.ref.update(payload);
          console.log(`  ✅ Updated ${doc.id}`);
        }

        stats.normalized++;
      } catch (err) {
        stats.errors++;
        console.error(`  ❌ Error processing ${doc.id}:`, err);
      }
    }

    console.log(`  … scanned ${stats.scanned}/${limit} | normalized ${stats.normalized}`);
  }

  printStats(stats, dryRun);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
