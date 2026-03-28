/**
 * Backfill ig_narrative field for published content_versions using Gemini Flash.
 *
 * Only processes French (FR) content_versions with status="published" and missing narrative.
 * Uses cost-effective Gemini Flash API with 4.5s rate-limiting (13 RPM).
 *
 * Usage:
 *   pnpm backfill:narrative                                    # LIVE: 50 items
 *   pnpm backfill:narrative --dry-run                          # DRY: log-only
 *   pnpm backfill:narrative --limit 10                         # LIVE: 10 items max
 *   pnpm backfill:narrative --dry-run --limit 20              # DRY: 20 items max
 *   pnpm backfill:narrative --offset 100 --limit 50           # LIVE: items 100-149
 *
 * The script:
 *  1. Paginates published FR content_versions missing narrative
 *  2. For each, sends title + summary + body to Gemini Flash with minimal prompt
 *  3. Extracts ig_narrative from response and persists to Firestore
 *  4. Respects 4.5s delay between API calls (rate limit: 13 RPM)
 *  5. Resumes from cursor in .cursor file for safe re-runs
 *
 * Safe to re-run — only adds narrative to missing fields, never overwrites.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { promises as fs } from "fs";
import { getDb } from "@edlight-news/firebase";
import { callGemini } from "@edlight-news/generator";
import type { ContentVersion } from "@edlight-news/types";

// ── Setup ───────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes("--dry-run");
const limitIdx = process.argv.indexOf("--limit");
const LIMIT = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1] ?? "50", 10) : 50;

const offsetIdx = process.argv.indexOf("--offset");
const OFFSET = offsetIdx !== -1 ? parseInt(process.argv[offsetIdx + 1] ?? "0", 10) : 0;

/** Firestore page size for pagination */
const FIRESTORE_PAGE_SIZE = 100;
/** Delay between LLM calls (ms) to respect rate limits — 4.5s = 13.3 RPM */
const LLM_DELAY_MS = 4500;
/** Cursor file to track progress */
const CURSOR_FILE = path.resolve(__dirname, ".backfill-narrative.cursor");

// ── Minimal narrative generation prompt ─────────────────────────────────────

function buildNarrativePrompt(title: string, summary: string, body: string): string {
  const textContext = [title, summary, body.slice(0, 1000)]
    .filter((t) => t && t.length > 0)
    .join("\n\n");

  return `Tu es un rédacteur pour EdLight News.

À partir de ce texte, écris ig_narrative: 4-6 phrases en français formant un arc continu et narratif pour un carrousel Instagram. 
- Les phrases doivent s'enchaîner logiquement (pas de citations isolées).
- PAS de parenthèses, PAS de crochets.
- Langage direct, impactant, mémorable.
- Évite de lister des détails — raconte une histoire.

TEXTE:
${textContext}

RÉPONDS UNIQUEMENT EN JSON VALIDE:
{ "ig_narrative": "4-6 phrases formant un arc continu..." }`;
}

interface NarrativeResult {
  ig_narrative?: string;
}

async function extractNarrative(
  title: string,
  summary: string,
  body: string,
): Promise<string | null> {
  const prompt = buildNarrativePrompt(title, summary, body);

  try {
    // Use Gemini (cost-effective for backfill)
    const raw = await callGemini(prompt);

    const parsed = JSON.parse(raw) as NarrativeResult;
    const narrative = parsed.ig_narrative?.trim();

    if (!narrative || narrative.length < 30) {
      return null;
    }

    return narrative;
  } catch (err) {
    console.error(
      `  ⚠️  Failed to extract narrative:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadCursor(): Promise<string | null> {
  try {
    return await fs.readFile(CURSOR_FILE, "utf-8");
  } catch {
    return null;
  }
}

async function saveCursor(docId: string): Promise<void> {
  await fs.writeFile(CURSOR_FILE, docId, "utf-8");
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\n📖 Backfill ig_narrative — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE MODE"}\n`,
  );
  console.log(`   Limit:  ${LIMIT} items`);
  console.log(`   Offset: ${OFFSET} items`);
  console.log(`   Rate-limit: 4.5s between API calls (≈13 RPM)\n`);

  const db = getDb();
  const cvsCol = db.collection("content_versions");

  // Load resume cursor
  const savedCursor = await loadCursor();
  if (savedCursor && OFFSET === 0) {
    console.log(`📍 Resuming from cursor: ${savedCursor}\n`);
  }

  // Build query for FR published CVs — narrative==null check is done in-app
  // to avoid needing a composite index that doesn't exist yet.
  let query = cvsCol
    .where("language", "==", "fr")
    .where("channel", "==", "web")
    .where("status", "==", "published")
    .orderBy("createdAt", "desc")
    .limit(FIRESTORE_PAGE_SIZE);

  // Apply cursor if resuming (and not using explicit --offset)
  if (savedCursor && OFFSET === 0) {
    const cursorDoc = await cvsCol.doc(savedCursor).get();
    if (cursorDoc.exists) {
      query = cvsCol
        .where("language", "==", "fr")
        .where("channel", "==", "web")
        .where("status", "==", "published")
        .orderBy("createdAt", "desc")
        .startAfter(cursorDoc)
        .limit(FIRESTORE_PAGE_SIZE);
    }
  }

  let processed = 0;
  let generated = 0;
  let skipped = 0;
  let errors = 0;
  let hasMore = true;
  let offsetCount = 0;

  while (hasMore && processed < LIMIT) {
    const snap = await query.get();

    if (snap.empty) {
      hasMore = false;
      break;
    }

    for (const doc of snap.docs) {
      // Respect offset
      if (offsetCount < OFFSET) {
        offsetCount++;
        continue;
      }

      if (processed >= LIMIT) break;

      const cv = { id: doc.id, ...doc.data() } as ContentVersion & { id: string };

      // Skip if already has narrative
      if (cv.narrative && cv.narrative.trim().length > 0) {
        skipped++;
        continue;
      }

      console.log(`\n📝 Processing [${processed + 1}/${LIMIT}] ${cv.id}`);
      console.log(
        `   "${cv.title?.slice(0, 60)}${cv.title && cv.title.length > 60 ? "…" : ""}"`
      );

      const title = cv.title ?? "";
      const summary = cv.summary ?? "";
      const body = cv.body ?? "";

      if (!title || !summary) {
        console.log(`   ⏭️  Skipped — missing title or summary`);
        skipped++;
        processed++;
        continue;
      }

      // Extract narrative via Gemini Flash
      let narrative: string | null;
      try {
        narrative = await extractNarrative(title, summary, body);
      } catch (err) {
        console.error(`   ❌ API call failed:`, err instanceof Error ? err.message : err);
        errors++;
        processed++;
        continue;
      }

      if (!narrative) {
        console.log(`   ⏭️  Skipped — no narrative generated`);
        skipped++;
        processed++;
        // Still respect rate limit
        if (processed < LIMIT) await sleep(LLM_DELAY_MS);
        continue;
      }

      console.log(`   ✅ Generated narrative (${narrative.length} chars)`);

      if (DRY_RUN) {
        console.log(`   [DRY] Would save: "${narrative.slice(0, 80)}…"`);
      } else {
        try {
          await cvsCol.doc(cv.id).update({ narrative });
          console.log(`   💾 Saved to Firestore`);
          await saveCursor(cv.id);
        } catch (err) {
          console.error(`   ❌ Write failed:`, err instanceof Error ? err.message : err);
          errors++;
        }
      }

      generated++;
      processed++;

      // Rate limit between API calls
      if (processed < LIMIT) {
        await sleep(LLM_DELAY_MS);
      }
    }

    // Check if we can get next page
    if (snap.docs.length < FIRESTORE_PAGE_SIZE) {
      hasMore = false;
    } else {
      // Prepare query for next page
      const lastDoc = snap.docs[snap.docs.length - 1]!;
      query = cvsCol
        .where("language", "==", "fr")
        .where("channel", "==", "web")
        .where("status", "==", "published")
        .orderBy("createdAt", "desc")
        .startAfter(lastDoc)
        .limit(FIRESTORE_PAGE_SIZE);
    }
  }

  // Clean up cursor on completion
  if (!DRY_RUN && processed >= LIMIT) {
    try {
      await fs.unlink(CURSOR_FILE);
    } catch {
      // File might not exist — that's ok
    }
  }

  console.log(`\n🏆 Backfill ig_narrative complete`);
  console.log(`   Processed:  ${processed}`);
  console.log(`   Generated:  ${generated}`);
  console.log(`   Skipped:    ${skipped}`);
  console.log(`   Errors:     ${errors}`);
  console.log(`   Mode:       ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
