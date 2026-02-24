/**
 * Almanac Expansion Job — runAlmanacExpansion
 *
 * Ingests curated seed candidates from history_seed_candidates.json
 * into the haiti_history_almanac_raw Firestore collection.
 *
 * Workflow:
 *   Step 1: Read seed candidates from JSON
 *   Step 2: Validate source_url domain against TRUSTED_HISTORY_DOMAINS
 *   Step 3: Store into haiti_history_almanac_raw with verificationStatus = "unverified"
 *
 * This job is idempotent — repeated runs skip existing entries.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { haitiHistoryAlmanacRawRepo } from "@edlight-news/firebase";
import type { AlmanacRawCategory, AlmanacRawSourceType } from "@edlight-news/types";
import {
  classifyDomain,
  isTrustedDomain,
} from "../historySources/historySourceRegistry.js";

// ── Seed candidate shape ─────────────────────────────────────────────────────

interface SeedCandidate {
  date: string;       // MM-DD
  year: number;
  title: string;
  shortSummary: string;
  source_url: string;
  source_name: string;
  source_type: string; // raw string from JSON
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function runAlmanacExpansion(): Promise<{
  ingested: number;
  skipped: number;
  rejected: number;
  errors: string[];
}> {
  const seedPath = path.resolve(
    import.meta.dirname ?? __dirname,
    "../data/history_seed_candidates.json",
  );

  let candidates: SeedCandidate[];
  try {
    const raw = fs.readFileSync(seedPath, "utf-8");
    candidates = JSON.parse(raw) as SeedCandidate[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[almanac-expansion] Failed to read seed file:", msg);
    return { ingested: 0, skipped: 0, rejected: 0, errors: [msg] };
  }

  let ingested = 0;
  let skipped = 0;
  let rejected = 0;
  const errors: string[] = [];

  for (const c of candidates) {
    // ── Step 2: Domain validation ─────────────────────────────────────────
    if (!isTrustedDomain(c.source_url)) {
      const msg = `Rejected: unknown domain for "${c.title}" (${c.source_url})`;
      console.warn(`[almanac-expansion] ${msg}`);
      errors.push(msg);
      rejected++;
      continue;
    }

    // Auto-classify source type from URL if possible
    const autoClassified = classifyDomain(c.source_url);
    const sourceType: AlmanacRawSourceType =
      autoClassified ?? (c.source_type as AlmanacRawSourceType);

    // Validate category
    const VALID_CATEGORIES: AlmanacRawCategory[] = [
      "political", "education", "culture", "international",
      "economy", "social", "science", "birth", "death",
    ];
    const category: AlmanacRawCategory = VALID_CATEGORIES.includes(
      c.source_type as AlmanacRawCategory,
    )
      ? (c.source_type as AlmanacRawCategory)
      : "political"; // Default to political for historical events

    // ── Step 3: Upsert into raw collection ────────────────────────────────
    try {
      const { created } = await haitiHistoryAlmanacRawRepo.upsertByKey({
        monthDay: c.date,
        year: c.year,
        title: c.title,
        shortSummary: c.shortSummary,
        category,
        sourcePrimary: {
          name: c.source_name,
          url: c.source_url,
        },
        sourceType,
        verificationStatus: "unverified",
      });

      if (created) {
        ingested++;
        console.log(`[almanac-expansion] Ingested: "${c.title}" (${c.date}, ${c.year})`);
      } else {
        skipped++;
        console.log(`[almanac-expansion] Skipped (exists): "${c.title}"`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Error storing "${c.title}": ${msg}`);
      console.error(`[almanac-expansion] ${msg}`);
    }
  }

  console.log(
    `[almanac-expansion] Done: ingested=${ingested}, skipped=${skipped}, rejected=${rejected}, errors=${errors.length}`,
  );

  return { ingested, skipped, rejected, errors };
}
