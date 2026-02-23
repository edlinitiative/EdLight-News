/**
 * LLM-powered backfill: use Gemini to detect genuine Haitian success stories.
 *
 * Instead of keyword matching (which is either too broad or too narrow),
 * this script sends each published item's title + summary to Gemini with a
 * focused yes/no prompt. Only items with published web content_versions are
 * evaluated (no point tagging items that can't appear on the page).
 *
 * Uses batch classification: sends items in groups of 20 to minimise API calls.
 *
 * Usage:
 *   pnpm backfill:success-tags-llm                          # live writes
 *   BACKFILL_DRY_RUN=true pnpm backfill:success-tags-llm    # log-only
 *
 * Safe to re-run — only sets successTag=true, never removes it.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";
import { callGemini } from "@edlight-news/generator";
import type { Item } from "@edlight-news/types";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.env.BACKFILL_DRY_RUN === "true";
/** How many items to send to Gemini in one prompt */
const LLM_BATCH_SIZE = 20;
/** Firestore page size */
const FIRESTORE_PAGE_SIZE = 300;
/** Delay between LLM calls (ms) to respect rate limits */
const LLM_DELAY_MS = 1500;

// ── Gemini classification prompt ────────────────────────────────────────────

function buildClassificationPrompt(
  items: { idx: number; title: string; summary: string }[],
): string {
  const listing = items
    .map((i) => `[${i.idx}] "${i.title}" — ${i.summary.slice(0, 200)}`)
    .join("\n");

  return `Tu es un classifieur pour EdLight News, une plateforme pour étudiants haïtiens.

Pour chaque article ci-dessous, réponds true ou false:
  Est-ce une HISTOIRE DE SUCCÈS ou d'INSPIRATION concernant un Haïtien, un groupe haïtien, la diaspora haïtienne, ou une institution haïtienne ?

Exemples de succès : prix reçu, victoire sportive, diplôme obtenu, reconnaissance internationale, exploit communautaire, parcours inspirant, nomination honorifique, réalisation artistique ou académique.

Exemples de NON-succès (répondre false) : annonces de bourses/concours (opportunités ouvertes), faits divers, violence, politique courante, rapports humanitaires, inflation, prix de marché, événements internationaux sans lien haïtien, calendriers scolaires.

ARTICLES:
${listing}

RÉPONDS UNIQUEMENT en JSON valide. Un tableau d'objets avec "idx" (le numéro) et "success" (true/false):
[{"idx": 0, "success": false}, {"idx": 1, "success": true}, ...]`;
}

interface ClassificationResult {
  idx: number;
  success: boolean;
}

async function classifyBatch(
  items: { idx: number; title: string; summary: string }[],
): Promise<ClassificationResult[]> {
  const prompt = buildClassificationPrompt(items);
  const raw = await callGemini(prompt);

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error("  ⚠ LLM returned non-array:", raw.slice(0, 200));
      return [];
    }
    return parsed.filter(
      (r: unknown) =>
        typeof r === "object" &&
        r !== null &&
        "idx" in r &&
        "success" in r,
    ) as ClassificationResult[];
  } catch {
    console.error("  ⚠ Failed to parse LLM response:", raw.slice(0, 300));
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\n🧠 Backfill successTag (LLM) — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE MODE"}\n`,
  );

  const db = getDb();
  const itemsCol = db.collection("items");
  const cvsCol = db.collection("content_versions");

  // Step 1: Find all item IDs that have at least one published web CV
  console.log("📋 Finding items with published web content_versions…");
  const publishedCvSnap = await cvsCol
    .where("channel", "==", "web")
    .where("status", "==", "published")
    .select("itemId")
    .get();

  const publishedItemIds = new Set<string>();
  for (const doc of publishedCvSnap.docs) {
    const itemId = doc.data().itemId;
    if (itemId) publishedItemIds.add(itemId);
  }
  console.log(`  Found ${publishedItemIds.size} items with published CVs\n`);

  // Step 2: Fetch those items, skip ones already tagged
  const candidateItems: (Item & { id: string })[] = [];
  let lastDocSnap: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let hasMore = true;

  while (hasMore) {
    let query = itemsCol.orderBy("createdAt", "asc").limit(FIRESTORE_PAGE_SIZE);
    if (lastDocSnap) query = query.startAfter(lastDocSnap);
    const snap = await query.get();

    if (snap.empty) { hasMore = false; break; }
    lastDocSnap = snap.docs[snap.docs.length - 1];

    for (const doc of snap.docs) {
      const item = { id: doc.id, ...doc.data() } as Item;
      // Only consider items with published CVs
      if (!publishedItemIds.has(item.id)) continue;
      // Skip already tagged
      if (item.successTag === true) continue;
      candidateItems.push(item);
    }

    if (snap.docs.length < FIRESTORE_PAGE_SIZE) hasMore = false;
  }

  console.log(`📊 ${candidateItems.length} candidates to evaluate\n`);

  if (candidateItems.length === 0) {
    console.log("✅ Nothing to do.\n");
    return;
  }

  // Step 3: Send batches to Gemini
  let totalTagged = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (let i = 0; i < candidateItems.length; i += LLM_BATCH_SIZE) {
    const batch = candidateItems.slice(i, i + LLM_BATCH_SIZE);
    const llmInput = batch.map((item, j) => ({
      idx: j,
      title: item.title ?? "",
      summary: item.summary ?? "",
    }));

    console.log(
      `🤖 Classifying batch ${Math.floor(i / LLM_BATCH_SIZE) + 1} (${batch.length} items)…`,
    );

    let results: ClassificationResult[];
    try {
      results = await classifyBatch(llmInput);
    } catch (err) {
      console.error("  ❌ LLM call failed:", err instanceof Error ? err.message : err);
      totalErrors += batch.length;
      continue;
    }

    // Build a map of idx → success
    const resultMap = new Map<number, boolean>();
    for (const r of results) {
      resultMap.set(r.idx, r.success);
    }

    const writer = DRY_RUN ? null : db.bulkWriter();
    if (writer) {
      writer.onWriteError((error) => {
        console.error(`  ❌ Write error: ${error.message}`);
        return false;
      });
    }

    for (let j = 0; j < batch.length; j++) {
      const item = batch[j]!;
      const isSuccess = resultMap.get(j);

      if (isSuccess === undefined) {
        // LLM didn't return a result for this index
        totalErrors++;
        continue;
      }

      if (!isSuccess) {
        totalSkipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `  ✅ [DRY] ${item.id} "${item.title?.slice(0, 70)}…" → successTag=true`,
        );
      } else {
        writer!.update(itemsCol.doc(item.id), { successTag: true });
        console.log(
          `  ✅ ${item.id} "${item.title?.slice(0, 70)}…" → successTag=true`,
        );
      }
      totalTagged++;
    }

    if (writer) await writer.close();

    // Rate limit between batches
    if (i + LLM_BATCH_SIZE < candidateItems.length) {
      await sleep(LLM_DELAY_MS);
    }
  }

  console.log(`\n🏆 Backfill successTag (LLM) complete`);
  console.log(`   Evaluated:  ${candidateItems.length}`);
  console.log(`   Tagged:     ${totalTagged}`);
  console.log(`   Not success: ${totalSkipped}`);
  console.log(`   Errors:     ${totalErrors}`);
  console.log(`   Mode:       ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
