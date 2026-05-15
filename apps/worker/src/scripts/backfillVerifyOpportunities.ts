/**
 * backfillVerifyOpportunities — site-wide DeepSeek backfill that re-verifies
 * every item currently surfaced on /opportunites or /bourses and demotes the
 * ones that are actually news.
 *
 * Why this exists:
 *   The Iran/US "accord" example the team flagged is one of many — the
 *   keyword classifier has been mislabelling general-news articles as
 *   programmes/opportunites for months. The new DeepSeek verifier (PR #85)
 *   only fires on items being newly considered for the Threads/FB queues;
 *   it does NOT touch the existing items already polluting /opportunites
 *   and /bourses on the website. This script closes that gap.
 *
 * What it does:
 *   1. Pages through items where vertical ∈ {opportunites, bourses}.
 *   2. For each item, calls verifyOpportunityClassification (which caches
 *      its own results to classification_audits/{itemId} — re-runs are
 *      free after the first pass).
 *   3. With --apply: deletes the `vertical` field on demoted items so they
 *      fall back to their default news vertical and disappear from the
 *      public opportunity pages on the next /opportunites cache refresh.
 *      Stamps a small audit trail on the item (demotedBy, demotedAt,
 *      demotedReason).
 *
 * Usage:
 *   # dry run — print verdicts, no writes
 *   pnpm --filter @edlight-news/worker backfill:verify-opportunities
 *
 *   # live mode — demote items the model is confident about
 *   pnpm --filter @edlight-news/worker backfill:verify-opportunities -- --apply
 *
 *   # constrain to one vertical or a small slice
 *   pnpm --filter @edlight-news/worker backfill:verify-opportunities -- \
 *     --vertical=opportunites --limit=200 --apply
 *
 *   # tune cost (default 8 = ~8 concurrent DeepSeek calls)
 *   pnpm --filter @edlight-news/worker backfill:verify-opportunities -- \
 *     --concurrency=4 --apply
 *
 * Cost:
 *   DeepSeek chat is ~$0.0003 per verification. A full backfill of the
 *   current opportunites + bourses verticals (~2-3k items) is ~$1.
 *   After the first pass, classification_audits caches every verdict, so
 *   subsequent runs cost $0 unless new items have entered the vertical.
 *
 * Safety:
 *   - Default is DRY RUN. Nothing is written without --apply.
 *   - Confidence floor (0.7) is enforced inside the verifier — borderline
 *     calls are kept, not demoted.
 *   - The verifier passes through on any failure (no API key, timeout,
 *     bad JSON), so the script never corrupts items it couldn't verify.
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@edlight-news/firebase";
import {
  verifyOpportunityClassification,
  type VerifyOpportunityResult,
  type OriginalSocialTopic,
} from "../services/verifyOpportunityClassification.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

type VerticalFilter = "opportunites" | "bourses" | "both";

interface Args {
  apply: boolean;
  vertical: VerticalFilter;
  limit: number;
  concurrency: number;
  /** Re-run DeepSeek even for items already in classification_audits. */
  force: boolean;
}

function parseArgs(): Args {
  const args: Args = {
    apply: false,
    vertical: "both",
    limit: Infinity,
    concurrency: 8,
    force: false,
  };
  for (const a of process.argv.slice(2)) {
    if (a === "--apply") args.apply = true;
    else if (a === "--force") args.force = true;
    else if (a.startsWith("--vertical=")) {
      const v = a.split("=")[1] ?? "";
      if (v === "opportunites" || v === "bourses" || v === "both") {
        args.vertical = v;
      }
    } else if (a.startsWith("--limit=")) {
      args.limit = parseInt(a.split("=")[1] ?? "", 10) || Infinity;
    } else if (a.startsWith("--concurrency=")) {
      args.concurrency = Math.max(
        1,
        Math.min(16, parseInt(a.split("=")[1] ?? "", 10) || 8),
      );
    }
  }
  return args;
}

interface ItemRow {
  id: string;
  title: string;
  summary: string;
  vertical: string;
  originalTopic: OriginalSocialTopic;
}

/** Map vertical → original topic label that the verifier expects. */
function verticalToTopic(vertical: string): OriginalSocialTopic | null {
  if (vertical === "bourses") return "scholarship";
  if (vertical === "opportunites") return "opportunity";
  return null;
}

async function loadItems(args: Args): Promise<ItemRow[]> {
  const db = getDb();
  const verticals =
    args.vertical === "both" ? ["opportunites", "bourses"] : [args.vertical];

  const rows: ItemRow[] = [];
  for (const vertical of verticals) {
    const snap = await db
      .collection("items")
      .where("vertical", "==", vertical)
      .get();
    for (const doc of snap.docs) {
      if (rows.length >= args.limit) break;
      const data = doc.data() as Record<string, unknown>;
      const topic = verticalToTopic(vertical);
      if (!topic) continue;
      rows.push({
        id: doc.id,
        title: String(data.title ?? ""),
        summary: String(
          (data.summary as string | undefined) ??
            (data.extractedText as string | undefined)?.slice(0, 1500) ??
            "",
        ),
        vertical,
        originalTopic: topic,
      });
    }
    if (rows.length >= args.limit) break;
  }
  return rows;
}

interface Verdict {
  row: ItemRow;
  result: VerifyOpportunityResult;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, idx: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function next(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]!, i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => next()),
  );
  return results;
}

async function main() {
  const args = parseArgs();
  const db = getDb();

  console.log(
    `\n🤖  DeepSeek opportunity backfill — ${args.apply ? "LIVE (will write)" : "DRY RUN (no writes)"}`,
  );
  console.log(
    `    vertical=${args.vertical}  limit=${args.limit === Infinity ? "all" : args.limit}  ` +
      `concurrency=${args.concurrency}  force=${args.force}\n`,
  );

  if (!process.env.DEEPSEEK_API_KEY) {
    console.error(
      "❌  DEEPSEEK_API_KEY is not set. Verifier would no-op — aborting.\n" +
        "    Set it in your .env or export it before running.",
    );
    process.exit(1);
  }

  console.log("📥  Loading items…");
  const items = await loadItems(args);
  console.log(`    found ${items.length} items\n`);

  if (items.length === 0) {
    console.log("Nothing to verify.");
    return;
  }

  // Optional --force: clear cache rows so DeepSeek is re-asked.
  if (args.force) {
    console.log("🧹  --force: clearing classification_audits cache for these items…");
    let cleared = 0;
    for (const item of items) {
      try {
        await db.collection("classification_audits").doc(item.id).delete();
        cleared++;
      } catch {
        /* ignore */
      }
    }
    console.log(`    cleared ${cleared}\n`);
  }

  // Verify with bounded concurrency. The verifier caches to Firestore on
  // its own, so cached items return immediately on second runs.
  console.log("🔎  Verifying with DeepSeek…");
  let done = 0;
  const verdicts: Verdict[] = await runWithConcurrency(
    items,
    args.concurrency,
    async (row) => {
      const result = await verifyOpportunityClassification(
        {
          itemId: row.id,
          title: row.title,
          summary: row.summary,
          originalTopic: row.originalTopic,
        },
        db,
      );
      done++;
      if (done % 25 === 0 || done === items.length) {
        process.stdout.write(`\r    ${done}/${items.length}…`);
      }
      return { row, result };
    },
  );
  process.stdout.write("\n");

  // Tally results.
  const buckets = {
    real_opportunity: 0,
    news_about_opportunity: 0,
    news: 0,
    cached: 0,
    demoted: 0,
    kept: 0,
    lowConfKept: 0,
  };
  const demotions: Verdict[] = [];
  for (const v of verdicts) {
    if (!v) continue;
    buckets[v.result.verifiedLabel]++;
    if (v.result.cached) buckets.cached++;
    if (v.result.demoted) {
      buckets.demoted++;
      demotions.push(v);
    } else {
      buckets.kept++;
      if (v.result.confidence < 0.7 && v.result.verifiedLabel !== "real_opportunity") {
        buckets.lowConfKept++;
      }
    }
  }

  console.log(`\n📊  DeepSeek verdicts:`);
  console.log(`    real_opportunity         : ${String(buckets.real_opportunity).padStart(5)}`);
  console.log(`    news_about_opportunity   : ${String(buckets.news_about_opportunity).padStart(5)}`);
  console.log(`    news                     : ${String(buckets.news).padStart(5)}`);
  console.log(`    (cached, no API call)    : ${String(buckets.cached).padStart(5)}`);
  console.log(`    kept on opportunity page : ${String(buckets.kept).padStart(5)}`);
  console.log(`        of which low-conf    : ${String(buckets.lowConfKept).padStart(5)}`);
  console.log(`    ⚠ to demote (conf≥0.7)   : ${String(buckets.demoted).padStart(5)}\n`);

  if (demotions.length > 0) {
    console.log(`📝  Sample of items to demote (first 25):`);
    for (const v of demotions.slice(0, 25)) {
      console.log(
        `    [${v.result.verifiedLabel.padEnd(22)} conf=${v.result.confidence.toFixed(2)}] ` +
          `${v.row.title.slice(0, 90)}`,
      );
      console.log(`        · ${v.result.reason}`);
    }
    if (demotions.length > 25) {
      console.log(`    … and ${demotions.length - 25} more.`);
    }
    console.log();
  }

  // Apply phase.
  if (!args.apply) {
    console.log("💡  Dry run complete. Re-run with --apply to demote.");
    return;
  }

  if (demotions.length === 0) {
    console.log("✅  Nothing to demote. Done.");
    return;
  }

  console.log(`✍  Writing demotions to Firestore…`);
  let written = 0;
  let failed = 0;
  for (const v of demotions) {
    try {
      await db
        .collection("items")
        .doc(v.row.id)
        .update({
          vertical: FieldValue.delete(),
          category: "news",
          opportunityDemotedAt: FieldValue.serverTimestamp(),
          opportunityDemotedReason: v.result.reason.slice(0, 280),
          opportunityDemotedLabel: v.result.verifiedLabel,
          opportunityDemotedConfidence: v.result.confidence,
          opportunityDemotedBy: "deepseek-backfill",
        });
      written++;
    } catch (err) {
      failed++;
      console.warn(
        `    ⚠ failed to update ${v.row.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  console.log(`\n✅  Backfill complete.`);
  console.log(`    demoted : ${written}`);
  console.log(`    failed  : ${failed}`);
  console.log(
    `\n    /opportunites and /bourses caches refresh within ~5 minutes (unstable_cache TTL).`,
  );
}

main().catch((err) => {
  console.error("❌  Backfill failed:", err);
  process.exit(1);
});
