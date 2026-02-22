/**
 * Backfill semantic dedupeGroupId for existing items using Gemini.
 *
 * For each item that has a title, sends a lightweight prompt to Gemini
 * asking just for a cluster_slug (no full article generation). Then hashes
 * the slug to produce the new dedupeGroupId.
 *
 * Usage:
 *   pnpm backfill:clusters                          # live writes
 *   BACKFILL_DRY_RUN=true pnpm backfill:clusters    # log-only, no writes
 *
 * Safe to re-run — will update all non-synthesis items.
 */

import { createHash } from "crypto";
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
const BATCH_SIZE = 50;
const GEMINI_CONCURRENCY = 3; // conservative — avoid rate limits
const DELAY_MS = 500; // pause between Gemini batches

// ── Helpers ─────────────────────────────────────────────────────────────────

function slugToDedupeGroupId(slug: string): string {
  return createHash("sha256")
    .update(slug.toLowerCase().trim())
    .digest("hex")
    .slice(0, 16);
}

function buildClusterSlugPrompt(title: string, summary: string): string {
  return `Tu dois créer un identifiant sémantique (cluster_slug) pour grouper les articles sur le MÊME sujet.

RÈGLES:
- Le slug doit identifier le SUJET/ÉVÉNEMENT sous-jacent, PAS l'article spécifique
- Format: kebab-case, anglais, 3-6 mots
- Deux articles de sources différentes sur le même événement doivent produire le MÊME slug
- Inclure l'année si pertinent
- Exemples: "haiti-child-recruitment-un-2026", "richardson-viano-winter-olympics-2026", "taiwan-scholarships-haiti-2026"

ARTICLE:
Titre: ${title}
Résumé: ${summary.slice(0, 500)}

RÉPONDS UNIQUEMENT en JSON:
{"cluster_slug": "your-slug-here"}`;
}

async function getClusterSlug(
  title: string,
  summary: string,
): Promise<string | null> {
  try {
    const raw = await callGemini(buildClusterSlugPrompt(title, summary));
    const parsed = JSON.parse(raw);
    const slug = parsed?.cluster_slug;
    if (typeof slug === "string" && slug.length >= 5) {
      return slug;
    }
    return null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\n🔄 Backfill semantic clusters — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE MODE"}\n`,
  );

  const db = getDb();
  const col = db.collection("items");

  let totalScanned = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let lastDocSnap: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  let hasMore = true;

  while (hasMore) {
    let query = col.orderBy("createdAt", "asc").limit(BATCH_SIZE);
    if (lastDocSnap) {
      query = query.startAfter(lastDocSnap);
    }

    const snap = await query.get();
    if (snap.empty) {
      hasMore = false;
      break;
    }

    lastDocSnap = snap.docs[snap.docs.length - 1];

    // Filter to non-synthesis items
    const items = snap.docs
      .map((d) => ({ id: d.id, ref: d.ref, ...d.data() }) as Item & { ref: FirebaseFirestore.DocumentReference })
      .filter((item) => item.itemType !== "synthesis");

    // Process in small concurrent batches to respect rate limits
    for (let i = 0; i < items.length; i += GEMINI_CONCURRENCY) {
      const batch = items.slice(i, i + GEMINI_CONCURRENCY);

      const results = await Promise.all(
        batch.map(async (item) => {
          totalScanned++;
          const slug = await getClusterSlug(item.title, item.summary || "");
          return { item, slug };
        }),
      );

      const writer = DRY_RUN ? null : db.bulkWriter();

      for (const { item, slug } of results) {
        if (!slug) {
          totalSkipped++;
          console.warn(`  ⚠ No slug for ${item.id} "${item.title.slice(0, 50)}…"`);
          continue;
        }

        const newGroupId = slugToDedupeGroupId(slug);
        const oldGroupId = item.dedupeGroupId;

        if (DRY_RUN) {
          console.log(
            `  [DRY] ${item.id} "${item.title.slice(0, 50)}…"\n` +
            `         slug="${slug}" old=${oldGroupId?.slice(0, 8) ?? "none"}… → new=${newGroupId.slice(0, 8)}…`,
          );
        } else {
          writer!.update(item.ref, { dedupeGroupId: newGroupId });
        }

        totalUpdated++;
      }

      if (writer) {
        await writer.close();
      }

      // Rate limit pause between Gemini batches
      if (i + GEMINI_CONCURRENCY < items.length) {
        await sleep(DELAY_MS);
      }
    }

    console.log(
      `  📦 Page: ${snap.docs.length} scanned, ${items.length} non-synthesis`,
    );

    if (snap.docs.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log(`\n✅ Semantic cluster backfill complete`);
  console.log(`   Scanned:  ${totalScanned}`);
  console.log(`   Updated:  ${totalUpdated}`);
  console.log(`   Skipped:  ${totalSkipped}`);
  console.log(`   Errors:   ${totalErrors}`);
  console.log(`   Mode:     ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
