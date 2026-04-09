/**
 * Quick dump of slide-level payload details for one item per igType.
 * Shows heading, bullets, layout, footer — helps verify French content.
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { igQueueRepo } from "@edlight-news/firebase";
import type { IGQueueItem } from "@edlight-news/types";

async function main() {
  const allQueued = await igQueueRepo.listQueuedByScore(50);
  const byType = new Map<string, IGQueueItem>();
  for (const item of allQueued) {
    if (!byType.has(item.igType)) byType.set(item.igType, item);
  }

  for (const [igType, item] of byType) {
    console.log(`\n${"═".repeat(70)}`);
    console.log(`  ${igType.toUpperCase()}  —  ${item.id}`);
    console.log(`${"═".repeat(70)}`);

    if (!item.payload) {
      console.log("  (no payload)");
      continue;
    }

    for (let i = 0; i < item.payload.slides.length; i++) {
      const s = item.payload.slides[i]!;
      console.log(`\n  Slide ${i + 1} [${s.layout}]`);
      console.log(`    heading: ${s.heading ?? "(none)"}`);
      if (s.bullets?.length) {
        for (const b of s.bullets) {
          console.log(`    • ${b.slice(0, 120)}${b.length > 120 ? "…" : ""}`);
        }
      }
      if (s.footer) console.log(`    footer:  ${s.footer}`);
    }

    console.log(`\n  Caption (first 200 chars):`);
    console.log(`    ${item.payload.caption.slice(0, 200).replace(/\n/g, "\n    ")}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
