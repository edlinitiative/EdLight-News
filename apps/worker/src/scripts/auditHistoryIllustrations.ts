/**
 * Audit history illustrations for ALL seed entries (no Firebase needed).
 *
 * Reads the local haiti_history_seed.json, runs resolveHistoryIllustration()
 * for each entry, and writes a detailed JSON report + console summary.
 *
 * The script installs a global fetch throttle (≤1 req/200ms) + automatic retry
 * on 429/5xx to stay within Wikipedia/Commons rate limits across all 732 entries.
 *
 * Usage:
 *   pnpm --filter @edlight-news/worker audit:history-images
 *   pnpm --filter @edlight-news/worker audit:history-images -- --month 02
 *   pnpm --filter @edlight-news/worker audit:history-images -- --month 02-28
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ── Types ────────────────────────────────────────────────────────────────────

interface SeedEntry {
  monthDay: string;
  year?: number | null;
  title_fr: string;
  tags?: string[];
  confidence?: string;
}

interface AuditResult {
  monthDay: string;
  year: number | null;
  title_fr: string;
  resolved: boolean;
  imageUrl: string | null;
  pageUrl: string | null;
  pageTitle: string | null;
  confidence: number | null;
  author: string | null;
  license: string | null;
  error: string | null;
  attempt: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.resolve(__dirname, "../data/haiti_history_seed.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseArgs() {
  const args = process.argv.slice(2);
  let month: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--month" && args[i + 1]) {
      month = args[++i];
    }
  }
  return { month };
}

// ── Global fetch throttle ────────────────────────────────────────────────────
// The resolver makes dozens of fetch() calls per entry internally.
// We monkey-patch globalThis.fetch to enforce a minimum gap between requests
// and to automatically retry on 429 / 5xx with exponential backoff.

const MIN_FETCH_GAP_MS = 400;   // ≤2.5 req/s — safe for Wikipedia/Commons
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2_000;

let lastFetchTime = 0;
const _originalFetch = globalThis.fetch;

globalThis.fetch = async function throttledFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  // Enforce minimum gap between requests.
  const now = Date.now();
  const wait = MIN_FETCH_GAP_MS - (now - lastFetchTime);
  if (wait > 0) await sleep(wait);
  lastFetchTime = Date.now();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await _originalFetch(input, init);

      if (res.status === 429 || (res.status >= 500 && attempt < MAX_RETRIES)) {
        const backoff = RETRY_BASE_MS * 2 ** attempt;
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
        const host = new URL(url).hostname;
        console.log(`    ⏳ ${res.status} from ${host}, retrying in ${(backoff / 1000).toFixed(1)}s…`);
        await sleep(backoff);
        lastFetchTime = Date.now();
        continue;
      }

      return res;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const backoff = RETRY_BASE_MS * 2 ** attempt;
        console.log(`    ⏳ Network error, retrying in ${(backoff / 1000).toFixed(1)}s…`);
        await sleep(backoff);
        lastFetchTime = Date.now();
        continue;
      }
      throw err;
    }
  }

  // Shouldn't reach here, but fallback to original.
  return _originalFetch(input, init);
};

// Import the resolver AFTER patching fetch so it uses the throttled version.
let resolveHistoryIllustration: typeof import("../services/historyIllustrationResolver.js").resolveHistoryIllustration;

async function loadResolver() {
  const mod = await import("../services/historyIllustrationResolver.js");
  resolveHistoryIllustration = mod.resolveHistoryIllustration;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await loadResolver();
  const { month } = parseArgs();

  console.log("📂 Loading seed data…");
  const raw = readFileSync(SEED_PATH, "utf-8");
  let entries: SeedEntry[] = JSON.parse(raw);

  if (month) {
    entries = entries.filter((e) => e.monthDay.startsWith(month));
    console.log(`🔎 Filtered to ${entries.length} entries matching monthDay="${month}*"`);
  }

  console.log(
    `🖼️  Auditing ${entries.length} entries (throttled: ${MIN_FETCH_GAP_MS}ms/req, ` +
    `retry on 429/5xx up to ${MAX_RETRIES}×)…\n`,
  );

  const results: AuditResult[] = [];
  let resolved = 0;
  let unresolved = 0;
  let errored = 0;
  const startTime = Date.now();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const idx = `${i + 1}/${entries.length}`;

    // Retry the entire entry resolution up to 2 times if it returns null
    // (could be transient rate-limiting that slipped through).
    let result: AuditResult | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const illustration = await resolveHistoryIllustration(
          entry.title_fr,
          entry.year ?? undefined,
        );

        if (illustration) {
          result = {
            monthDay: entry.monthDay,
            year: entry.year ?? null,
            title_fr: entry.title_fr,
            resolved: true,
            imageUrl: illustration.imageUrl,
            pageUrl: illustration.pageUrl,
            pageTitle: illustration.pageTitle ?? null,
            confidence: illustration.confidence,
            author: illustration.author ?? null,
            license: illustration.license ?? null,
            error: null,
            attempt,
          };
          break;
        }

        // If first attempt returned null and entry SHOULD match a hint,
        // it might be rate-limiting. Wait and retry once.
        if (attempt === 1) {
          result = {
            monthDay: entry.monthDay,
            year: entry.year ?? null,
            title_fr: entry.title_fr,
            resolved: false,
            imageUrl: null,
            pageUrl: null,
            pageTitle: null,
            confidence: null,
            author: null,
            license: null,
            error: null,
            attempt,
          };
          // Only retry if we've been seeing failures (possible rate limit).
          if (unresolved > 0 && i > 0 && !results[results.length - 1]?.resolved) {
            console.log(`    🔄 Retrying after cooldown…`);
            await sleep(3_000);
            continue;
          }
          break;
        }
      } catch (err) {
        result = {
          monthDay: entry.monthDay,
          year: entry.year ?? null,
          title_fr: entry.title_fr,
          resolved: false,
          imageUrl: null,
          pageUrl: null,
          pageTitle: null,
          confidence: null,
          author: null,
          license: null,
          error: err instanceof Error ? err.message : String(err),
          attempt,
        };
        if (attempt === 1) {
          console.log(`    🔄 Error, retrying after cooldown…`);
          await sleep(5_000);
          continue;
        }
        break;
      }
    }

    results.push(result!);

    // Progress + ETA.
    const elapsed = (Date.now() - startTime) / 1000;
    const perEntry = elapsed / (i + 1);
    const eta = Math.ceil(perEntry * (entries.length - i - 1));
    const etaStr = eta > 60 ? `${Math.floor(eta / 60)}m${eta % 60}s` : `${eta}s`;

    if (result!.error) {
      errored++;
      console.log(`  ❌ ${idx} [${result!.monthDay}] ${result!.title_fr}  —  ERROR: ${result!.error}`);
    } else if (result!.resolved) {
      resolved++;
      const conf = result!.confidence?.toFixed(2) ?? "?";
      console.log(`  ✅ ${idx} [${result!.monthDay}] ${result!.title_fr}  —  conf=${conf}  (ETA ${etaStr})`);
    } else {
      unresolved++;
      console.log(`  ⚠️  ${idx} [${result!.monthDay}] ${result!.title_fr}  —  NO IMAGE  (ETA ${etaStr})`);
    }

    // Save incremental progress every 50 entries.
    if ((i + 1) % 50 === 0) {
      writeIncrementalReport(results, entries.length, month, resolved, unresolved, errored);
      console.log(`\n  💾 Checkpoint saved (${i + 1}/${entries.length})\n`);
    }

    // Brief pause between entries so the per-fetch throttle doesn't pile up.
    if (i < entries.length - 1) {
      await sleep(1_000);
    }
  }

  // ── Write final report ─────────────────────────────────────────────────────

  writeIncrementalReport(results, entries.length, month, resolved, unresolved, errored);
  const reportPath = path.resolve(__dirname, "../data/history-illustrations-audit.json");

  // ── Console summary ────────────────────────────────────────────────────────

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log("\n" + "═".repeat(70));
  console.log("📊 AUDIT SUMMARY");
  console.log("═".repeat(70));
  console.log(`  Total entries:       ${entries.length}`);
  console.log(`  ✅ Resolved:         ${resolved}  (${((resolved / entries.length) * 100).toFixed(1)}%)`);
  console.log(`  ⚠️  Unresolved:      ${unresolved}`);
  console.log(`  ❌ Errored:          ${errored}`);
  const lowConf = results.filter((r) => r.resolved && r.confidence !== null && r.confidence < 0.55);
  console.log(`  🔻 Low confidence:   ${lowConf.length}  (<0.55)`);
  console.log(`  ⏱️  Duration:         ${totalSec}s`);
  console.log("─".repeat(70));
  console.log(`  📄 Full report:      ${reportPath}`);
  console.log("═".repeat(70));

  if (lowConf.length > 0) {
    console.log("\n🔻 LOW-CONFIDENCE entries (will use fallback images on the site):");
    for (const lc of lowConf) {
      console.log(`   • [${lc.monthDay}] ${lc.title_fr}  (conf=${lc.confidence})`);
    }
  }

  const unresolvedEntries = results.filter((r) => !r.resolved);
  if (unresolvedEntries.length > 0 && unresolvedEntries.length <= 30) {
    console.log("\n⚠️  UNRESOLVED entries (no image found):");
    for (const u of unresolvedEntries) {
      console.log(`   • [${u.monthDay}] ${u.title_fr}${u.error ? `  — ${u.error}` : ""}`);
    }
  }
}

function writeIncrementalReport(
  results: AuditResult[],
  total: number,
  month: string | null,
  resolved: number,
  unresolved: number,
  errored: number,
) {
  const reportPath = path.resolve(__dirname, "../data/history-illustrations-audit.json");
  const report = {
    generatedAt: new Date().toISOString(),
    filter: month ?? "all",
    entriesProcessed: results.length,
    stats: {
      total,
      resolved,
      unresolved,
      errored,
      resolvedPercent: results.length > 0
        ? ((resolved / results.length) * 100).toFixed(1) + "%"
        : "0%",
    },
    lowConfidence: results
      .filter((r) => r.resolved && r.confidence !== null && r.confidence < 0.55)
      .map((r) => ({
        monthDay: r.monthDay,
        year: r.year,
        title_fr: r.title_fr,
        confidence: r.confidence,
        imageUrl: r.imageUrl,
      })),
    unresolved: results
      .filter((r) => !r.resolved)
      .map((r) => ({
        monthDay: r.monthDay,
        year: r.year,
        title_fr: r.title_fr,
        error: r.error,
      })),
    entries: results,
  };

  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ audit:history-images crashed", err);
    process.exit(1);
  });
