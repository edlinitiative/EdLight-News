/**
 * Seed sources into Firestore from docs/sources.seed.json.
 *
 * Usage:  pnpm seed:sources        (from apps/worker)
 *         pnpm --filter @edlight-news/worker seed:sources
 *
 * Upserts by a stable doc ID derived from the source URL hash,
 * so reruns never create duplicates.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@edlight-news/firebase";

// ── Load .env from monorepo root ───────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Seed entry shape (matches docs/sources.seed.json) ──────────────────────
interface SeedSource {
  name: string;
  type: "rss" | "html";
  url: string;
  language: "fr" | "ht";
  pollCadenceSec: number;
  priority: "hot" | "normal";
  /** Set to false to disable a source without removing it from the seed file */
  active?: boolean;
  /** Whether publisher images are safe to embed in IG posts (default true) */
  igImageSafe?: boolean;
  selectors?: {
    listItem?: string;
    articleBody?: string;
    title?: string;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────
/** Derive a stable Firestore doc ID from a URL so reruns are idempotent. */
function urlToDocId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 20);
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const seedPath = path.resolve(monorepoRoot, "docs/sources.seed.json");
  const raw = readFileSync(seedPath, "utf-8");
  const seeds: SeedSource[] = JSON.parse(raw);

  console.log(`📄 Loaded ${seeds.length} source(s) from docs/sources.seed.json\n`);

  const db = getDb();
  const col = db.collection("sources");

  let inserted = 0;
  let updated = 0;

  for (const seed of seeds) {
    const docId = urlToDocId(seed.url);
    const ref = col.doc(docId);
    const snap = await ref.get();

    const data: Record<string, unknown> = {
      name: seed.name,
      url: seed.url,
      type: seed.type,
      language: seed.language,
      active: seed.active ?? true,
      pollCadenceSec: seed.pollCadenceSec,
      priority: seed.priority,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Only set optional fields when provided (avoids overwriting with undefined)
    if (seed.selectors) {
      data.selectors = seed.selectors;
    }
    if (seed.igImageSafe !== undefined) {
      data.igImageSafe = seed.igImageSafe;
    }

    if (snap.exists) {
      await ref.update(data);
      updated++;
      console.log(`  ♻️  updated  ${docId}  ${seed.name}`);
    } else {
      data.createdAt = FieldValue.serverTimestamp();
      await ref.set(data);
      inserted++;
      console.log(`  ✅  inserted ${docId}  ${seed.name}`);
    }
  }

  console.log(`\n🏁 Done — inserted: ${inserted}, updated: ${updated}, total: ${seeds.length}`);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
