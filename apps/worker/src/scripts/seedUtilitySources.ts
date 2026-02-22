/**
 * Seed utility_sources collection from the JSON seed file.
 *
 * Usage:
 *   pnpm --filter worker seed:utility-sources
 *   # or directly:
 *   npx tsx src/scripts/seedUtilitySources.ts
 *
 * Reads docs/utility-sources.seed.json and upserts each entry
 * into the utility_sources Firestore collection.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../../..", ".env");
dotenv.config({ path: envPath });

import { utilitySourcesRepo } from "@edlight-news/firebase";
import type {
  UtilityType,
  UtilityRegion,
  UtilitySourceType,
  UtilitySeries,
} from "@edlight-news/types";

interface SeedEntry {
  label: string;
  url: string;
  type: UtilitySourceType;
  series: UtilitySeries;
  rotationKey?: string;
  allowlistDomain: string;
  priority: number;
  region: UtilityRegion[];
  utilityTypes: UtilityType[];
  parsingHints?: { selectorMain?: string; selectorDate?: string };
  active: boolean;
}

async function main() {
  const seedPath = path.resolve(__dirname, "../../../../docs/utility-sources.seed.json");
  const raw = readFileSync(seedPath, "utf-8");
  const entries: SeedEntry[] = JSON.parse(raw);

  console.log(`[seed] Loading ${entries.length} utility sources from ${seedPath}`);

  let created = 0;
  let updated = 0;

  for (const entry of entries) {
    try {
      const result = await utilitySourcesRepo.upsertByUrl({
        label: entry.label,
        url: entry.url,
        type: entry.type,
        series: entry.series,
        ...(entry.rotationKey ? { rotationKey: entry.rotationKey } : {}),
        allowlistDomain: entry.allowlistDomain,
        priority: entry.priority,
        region: entry.region,
        utilityTypes: entry.utilityTypes,
        ...(entry.parsingHints && Object.keys(entry.parsingHints).length > 0
          ? { parsingHints: entry.parsingHints }
          : {}),
        active: entry.active,
      });

      if (result.created) {
        created++;
        console.log(`  ✅ Created: ${entry.label} [${entry.series}] (${entry.url})`);
      } else {
        updated++;
        console.log(`  🔄 Updated: ${entry.label} [${entry.series}] (${entry.url})`);
      }
    } catch (err) {
      console.error(`  ❌ Failed: ${entry.label} — ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n[seed] Done: ${created} created, ${updated} updated`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
