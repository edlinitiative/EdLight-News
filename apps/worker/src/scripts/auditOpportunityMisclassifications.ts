/**
 * Audit & backfill script: re-scores all items currently tagged
 * `vertical=opportunites` against the new `scoreOpportunity()` model
 * and reports / fixes misclassifications.
 *
 * Usage:
 *   pnpm --filter worker exec tsx src/scripts/auditOpportunityMisclassifications.ts
 *   pnpm --filter worker exec tsx src/scripts/auditOpportunityMisclassifications.ts --fix
 *   pnpm --filter worker exec tsx src/scripts/auditOpportunityMisclassifications.ts --fix --threshold=60
 *
 * What it does:
 *  1. Reads all items where vertical == "opportunites"
 *  2. Re-runs scoreOpportunity() on (title + summary + extractedText)
 *  3. Persists `opportunityScore` on every item (always — useful diagnostic)
 *  4. With --fix: items below the threshold have `vertical` field DELETED
 *     so they fall back to their news vertical and disappear from
 *     /opportunites on the next cache refresh.
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@edlight-news/firebase";
import {
  scoreOpportunity,
  OPPORTUNITY_SCORE_THRESHOLD,
} from "@edlight-news/generator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

interface Args {
  fix: boolean;
  threshold: number;
  limit: number;
}

function parseArgs(): Args {
  const args: Args = {
    fix: false,
    threshold: OPPORTUNITY_SCORE_THRESHOLD,
    limit: Infinity,
  };
  for (const a of process.argv.slice(2)) {
    if (a === "--fix") args.fix = true;
    else if (a.startsWith("--threshold=")) {
      args.threshold = parseInt(a.split("=")[1] ?? "", 10) || OPPORTUNITY_SCORE_THRESHOLD;
    } else if (a.startsWith("--limit=")) {
      args.limit = parseInt(a.split("=")[1] ?? "", 10) || Infinity;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  console.log(
    `🔍  Auditing opportunites items — threshold=${args.threshold}, fix=${args.fix}, limit=${args.limit === Infinity ? "all" : args.limit}\n`,
  );

  const db = getDb();
  const snap = await db
    .collection("items")
    .where("vertical", "==", "opportunites")
    .get();

  console.log(`📊  Total items with vertical=opportunites: ${snap.size}\n`);

  let scanned = 0;
  let kept = 0;
  let demoted = 0;
  let scoreUpdated = 0;
  const buckets = { "0-29": 0, "30-49": 0, "50-69": 0, "70-100": 0 };
  const toDemote: { id: string; title: string; score: number; reasons: string[] }[] = [];

  for (const doc of snap.docs) {
    if (scanned >= args.limit) break;
    scanned++;
    const data = doc.data() as Record<string, unknown>;
    const title = String(data.title ?? "");
    const summary = String(data.summary ?? "");
    const body = String(data.extractedText ?? "");
    const deadline = (data.deadline as string | null) ?? null;
    const publisherName = (data.source as { name?: string } | undefined)?.name ?? null;

    const r = scoreOpportunity({ title, summary, body, deadline, publisherName });

    if (r.score < 30) buckets["0-29"]++;
    else if (r.score < 50) buckets["30-49"]++;
    else if (r.score < 70) buckets["50-69"]++;
    else buckets["70-100"]++;

    // Always persist the score (useful diagnostic, harmless write)
    if (data.opportunityScore !== r.score) {
      if (args.fix) {
        await doc.ref.update({ opportunityScore: r.score });
      }
      scoreUpdated++;
    }

    if (r.score < args.threshold) {
      toDemote.push({ id: doc.id, title: title.slice(0, 90), score: r.score, reasons: r.reasons });
      if (args.fix) {
        await doc.ref.update({ vertical: FieldValue.delete() });
        demoted++;
      }
    } else {
      kept++;
    }
  }

  console.log(`📈  Score distribution:`);
  console.log(`    0-29   : ${buckets["0-29"].toString().padStart(4)}  (definitely wrong)`);
  console.log(`    30-49  : ${buckets["30-49"].toString().padStart(4)}  (likely wrong, will demote)`);
  console.log(`    50-69  : ${buckets["50-69"].toString().padStart(4)}  (borderline, kept)`);
  console.log(`    70-100 : ${buckets["70-100"].toString().padStart(4)}  (high confidence)\n`);

  console.log(`🗑️   Items to demote (score < ${args.threshold}): ${toDemote.length}`);
  if (toDemote.length > 0) {
    console.log(`\n    Sample (first 25):`);
    for (const r of toDemote.slice(0, 25)) {
      console.log(`    [${r.score.toString().padStart(3)}] ${r.title}`);
      // Show top 3 reasons
      for (const reason of r.reasons.slice(0, 3)) {
        console.log(`          · ${reason}`);
      }
    }
  }

  console.log(`\n✅  Summary:`);
  console.log(`    scanned        : ${scanned}`);
  console.log(`    kept (≥${args.threshold})   : ${kept}`);
  console.log(`    demoted (<${args.threshold}): ${args.fix ? demoted : `${toDemote.length} (dry-run)`}`);
  console.log(`    score writes   : ${args.fix ? scoreUpdated : `${scoreUpdated} (dry-run)`}`);

  if (!args.fix) {
    console.log(`\n💡  Re-run with --fix to apply changes.`);
  } else {
    console.log(`\n🎉  Done. /opportunites will refresh within ~5 minutes (unstable_cache TTL).`);
  }
}

main().catch((err) => {
  console.error("❌  Audit failed:", err);
  process.exit(1);
});
