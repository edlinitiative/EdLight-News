/**
 * Backfill historical illustrations on haiti_history_almanac entries.
 *
 * Usage:
 *   pnpm --filter @edlight-news/worker backfill:history-images
 *   pnpm --filter @edlight-news/worker backfill:history-images -- --force
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { haitiHistoryAlmanacRepo } from "@edlight-news/firebase";
import { resolveHistoryIllustration } from "../services/historyIllustrationResolver.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

const force = process.argv.includes("--force");

async function main() {
  console.log(`🖼️ Backfilling history illustrations (force=${force})…`);

  const entries = await haitiHistoryAlmanacRepo.listAll();
  let updated = 0;
  let skipped = 0;
  let unresolved = 0;

  for (const entry of entries) {
    if (entry.illustration?.imageUrl && !force) {
      skipped++;
      continue;
    }

    try {
      const illustration = await resolveHistoryIllustration(entry.title_fr, entry.year ?? undefined);
      if (!illustration) {
        unresolved++;
        console.log(`  • No match: ${entry.monthDay} — ${entry.title_fr}`);
        continue;
      }

      await haitiHistoryAlmanacRepo.update(entry.id, { illustration });
      updated++;
      console.log(`  ✅ Updated: ${entry.monthDay} — ${entry.title_fr}`);
    } catch (err) {
      unresolved++;
      console.error(
        `  ❌ Failed: ${entry.monthDay} — ${entry.title_fr}`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(`\n✅ Done. Updated=${updated}, Skipped=${skipped}, Unresolved=${unresolved}, Total=${entries.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ backfill:history-images crashed", err);
    process.exit(1);
  });
