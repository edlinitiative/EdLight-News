/**
 * Reusable source-seeding logic.
 *
 * Reads docs/sources.seed.json (bundled with the worker image at deploy
 * time) and upserts every entry into the `sources` Firestore collection.
 * Used by:
 *   - apps/worker/src/scripts/seedSources.ts   (one-off CLI run)
 *   - apps/worker/src/routes/seedSources.ts    (HTTP endpoint, scheduler-safe)
 *
 * Idempotent: doc IDs are derived from a SHA-256 of the URL so reruns
 * never create duplicates.
 */

import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@edlight-news/firebase";

// ── Seed entry shape (matches docs/sources.seed.json) ──────────────────────
export interface SeedSource {
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
  /** Optional group tag (e.g. "opportunities_radar") — passed through. */
  _group?: string;
  selectors?: {
    listItem?: string;
    articleBody?: string;
    title?: string;
  };
}

export interface SeedSourcesResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: { url: string; error: string }[];
  durationMs: number;
}

/** Derive a stable Firestore doc ID from a URL so reruns are idempotent. */
function urlToDocId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 20);
}

/** Resolve the seed file path. */
function defaultSeedPath(): string {
  // __dirname is .../apps/worker/dist/services at runtime, .../src/services
  // in tests. Walk up four levels to reach the monorepo root.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../../..", "docs/sources.seed.json");
}

/**
 * Run the seeder. Returns a structured result suitable for HTTP responses.
 *
 * @param opts.seedPath  Override path for testing.
 * @param opts.dryRun    Do not write to Firestore — used by `?dryRun=1`.
 */
export async function runSeedSources(
  opts: { seedPath?: string; dryRun?: boolean } = {},
): Promise<SeedSourcesResult> {
  const startMs = Date.now();
  const seedPath = opts.seedPath ?? defaultSeedPath();
  const raw = readFileSync(seedPath, "utf-8");
  const seeds: SeedSource[] = JSON.parse(raw);

  const result: SeedSourcesResult = {
    total: seeds.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    durationMs: 0,
  };

  if (opts.dryRun) {
    result.durationMs = Date.now() - startMs;
    return result;
  }

  const db = getDb();
  const col = db.collection("sources");

  for (const seed of seeds) {
    try {
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
      if (seed.selectors) data.selectors = seed.selectors;
      if (seed.igImageSafe !== undefined) data.igImageSafe = seed.igImageSafe;
      if (seed._group) data.group = seed._group;

      if (snap.exists) {
        await ref.update(data);
        result.updated++;
      } else {
        data.createdAt = FieldValue.serverTimestamp();
        await ref.set(data);
        result.inserted++;
      }
    } catch (err) {
      result.errors.push({
        url: seed.url,
        error: err instanceof Error ? err.message : String(err),
      });
      result.skipped++;
    }
  }

  result.durationMs = Date.now() - startMs;
  return result;
}
