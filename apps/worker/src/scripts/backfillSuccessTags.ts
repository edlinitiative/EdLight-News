/**
 * One-time Firestore migration: backfill successTag for existing items.
 *
 * Scans ALL items and sets successTag = true when:
 *  1. itemType === "utility" AND utilityMeta.series === "HaitianOfTheWeek"
 *  2. The item title/summary/extractedText contain success keywords
 *     (same keyword list used by the deterministic classifier)
 *
 * Skips items that already have successTag === true.
 *
 * Usage:
 *   pnpm backfill:success-tags                          # live writes
 *   BACKFILL_DRY_RUN=true pnpm backfill:success-tags    # log-only, no writes
 *
 * Safe to re-run — idempotent (only sets successTag, never removes it).
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";
import type { Item } from "@edlight-news/types";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.env.BACKFILL_DRY_RUN === "true";
const BATCH_SIZE = 300;

// ── Success detection (mirrors classify.ts logic) ───────────────────────────

/**
 * Multi-word phrases that strongly indicate a success / inspiration story.
 * Checked via substring matching (safe — long enough to avoid false positives).
 */
const SUCCESS_PHRASES = [
  // French
  "parcours inspirant", "histoire inspirante", "modele de reussite",
  "parcours exemplaire", "haitien qui brille", "haitienne qui brille",
  "diplome obtenu", "histoire de reussite",
  // English
  "success story", "award-winning",
];

/**
 * Shorter keywords requiring word-boundary regex matching.
 * Accent-stripped forms for NFD-normalized text.
 */
const SUCCESS_WORDS = [
  // French (accent-stripped)
  "reussite", "accomplissement", "laureat",
  "medaille", "palmares", "remporte",
  // Kreyòl Ayisyen (accent-stripped)
  "sikse", "reyisit", "akonplisman", "chanpyon",
  // English
  "achievement",
];

const SUCCESS_WORDS_RE = new RegExp(
  SUCCESS_WORDS.map((w) => `\\b${w}\\b`).join("|"),
  "i",
);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesSuccessSignal(text: string): boolean {
  const normalized = normalizeText(text);
  // 1. Multi-word phrase substring match
  for (const phrase of SUCCESS_PHRASES) {
    if (normalized.includes(normalizeText(phrase))) return true;
  }
  // 2. Single-word boundary match
  return SUCCESS_WORDS_RE.test(normalized);
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\n🏆 Backfill successTag — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE MODE"}\n`,
  );

  const db = getDb();
  const col = db.collection("items");

  let totalScanned = 0;
  let totalTagged = 0;
  let totalAlreadyTagged = 0;
  let totalSkipped = 0;
  let lastDocSnap: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  const taggedByReason = {
    haitianOfTheWeek: 0,
    keyword: 0,
  };

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

    const writer = DRY_RUN ? null : db.bulkWriter();
    if (writer) {
      writer.onWriteError((error) => {
        console.error(
          `  ❌ Write error for ${error.documentRef.path}: ${error.message}`,
        );
        return false;
      });
    }

    let batchTagged = 0;

    for (const doc of snap.docs) {
      totalScanned++;
      const item = { id: doc.id, ...doc.data() } as Item;

      // Already tagged — skip
      if (item.successTag === true) {
        totalAlreadyTagged++;
        continue;
      }

      let shouldTag = false;
      let reason = "";

      // Rule 1: HaitianOfTheWeek utility items
      if (
        item.itemType === "utility" &&
        item.utilityMeta?.series === "HaitianOfTheWeek"
      ) {
        shouldTag = true;
        reason = "HaitianOfTheWeek";
        taggedByReason.haitianOfTheWeek++;
      }

      // Rule 2: Keyword match on title + summary + extractedText
      if (!shouldTag) {
        const combinedText = [
          item.title ?? "",
          item.summary ?? "",
          item.extractedText ?? "",
        ].join(" ");

        if (matchesSuccessSignal(combinedText)) {
          shouldTag = true;
          reason = "keyword";
          taggedByReason.keyword++;
        }
      }

      if (!shouldTag) {
        totalSkipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(
          `  [DRY] ${item.id} "${item.title?.slice(0, 60)}…" → successTag=true (${reason})`,
        );
      } else {
        writer!.update(doc.ref, { successTag: true });
      }

      batchTagged++;
      totalTagged++;
    }

    if (writer) {
      await writer.close();
    }

    console.log(
      `  📦 Batch: ${snap.docs.length} scanned, ${batchTagged} tagged`,
    );

    if (snap.docs.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log(`\n✅ Backfill successTag complete`);
  console.log(`   Scanned:         ${totalScanned}`);
  console.log(`   Newly tagged:    ${totalTagged}`);
  console.log(`     HaitianOfWeek: ${taggedByReason.haitianOfTheWeek}`);
  console.log(`     Keyword match: ${taggedByReason.keyword}`);
  console.log(`   Already tagged:  ${totalAlreadyTagged}`);
  console.log(`   No match:        ${totalSkipped}`);
  console.log(`   Mode:            ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
