/**
 * Batch web-image resolver for history illustrations.
 *
 * For every seed entry, this script:
 *  1. Searches the web for the event title (Brave API → Brave HTML → DDG → Google)
 *  2. Fetches the top result pages (preferring educational / archival sites)
 *  3. Extracts the primary image (og:image / twitter:image)
 *  4. Saves results to  web-image-cache.json
 *
 * The resolver (historyIllustrationResolver.ts) reads this cache at
 * runtime and uses it before falling back to Wikimedia Commons.
 *
 * Setup:
 *   Get a free Brave Search API key at https://brave.com/search/api/
 *   Then: export BRAVE_SEARCH_API_KEY="BSA..."
 *
 * Usage:
 *   BRAVE_SEARCH_API_KEY=BSA... pnpm --filter @edlight-news/worker batch:web-images
 *   pnpm --filter @edlight-news/worker batch:web-images -- --month 02-28
 *   pnpm --filter @edlight-news/worker batch:web-images -- --force
 */

import dotenv from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load env vars from monorepo root (.env then .env.local override)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });
dotenv.config({ path: path.resolve(monorepoRoot, ".env.local"), override: true });

import { resolveWebImage, cacheKey, type WebImageCacheEntry } from "../services/webImageSearch.js";

// ── Types ────────────────────────────────────────────────────────────────────

interface SeedEntry {
  id?: string;
  monthDay: string;
  year?: number | null;
  title_fr: string;
}

// ── Paths ────────────────────────────────────────────────────────────────────

const SEED_PATH = path.resolve(__dirname, "../data/haiti_history_seed.json");
const CACHE_PATH = path.resolve(__dirname, "../data/web-image-cache.json");

// ── Throttling ───────────────────────────────────────────────────────────────
// We need a gap between *all* outgoing requests (DDG search + page fetches)
// to avoid being rate-limited.

const MIN_FETCH_GAP_MS = process.env.BRAVE_SEARCH_API_KEY ? 500 : 2_500; // API: 500ms, scraping: 2.5s
const FETCH_JITTER_MS = process.env.BRAVE_SEARCH_API_KEY ? 200 : 1_000;
const MAX_RETRIES = 1;
const RETRY_BASE_MS = 3_000;

let lastFetchTime = 0;
const _originalFetch = globalThis.fetch;

/** Domains worth retrying (search engines). Other sites just fail fast. */
const RETRY_HOSTS = new Set(["api.search.brave.com", "search.brave.com", "html.duckduckgo.com", "www.google.com"]);

globalThis.fetch = async function throttledFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const now = Date.now();
  const jitter = Math.random() * FETCH_JITTER_MS;
  const wait = MIN_FETCH_GAP_MS + jitter - (now - lastFetchTime);
  if (wait > 0) await sleep(wait);
  lastFetchTime = Date.now();

  const reqUrl = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  const hostname = new URL(reqUrl).hostname;
  const maxRetries = RETRY_HOSTS.has(hostname) ? MAX_RETRIES : 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await _originalFetch(input, init);
      if (res.status === 429 || (res.status >= 500 && attempt < maxRetries)) {
        const delay = RETRY_BASE_MS * 2 ** attempt;
        process.stderr.write(`  ⏳ ${res.status} from ${hostname} — retrying in ${delay}ms\n`);
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err: unknown) {
      if (attempt < maxRetries) {
        const delay = RETRY_BASE_MS * 2 ** attempt;
        process.stderr.write(
          `  ⏳ fetch error from ${hostname} — retrying in ${delay}ms (${(err as Error).message})\n`,
        );
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  // Should never reach here, but TypeScript needs it.
  return _originalFetch(input, init);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Args ─────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let month: string | null = null;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--month" && args[i + 1]) month = args[++i];
    if (args[i] === "--force") force = true;
  }
  return { month, force };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { month, force } = parseArgs();

  // Check for API key
  if (process.env.BRAVE_SEARCH_API_KEY) {
    console.log("🔑 Brave Search API key detected — using official API (fast, reliable)");
  } else {
    console.log("⚠️  No BRAVE_SEARCH_API_KEY — falling back to HTML scraping (slow, rate-limited)");
    console.log("   Get a free key at https://brave.com/search/api/\n");
  }

  // Load seed entries
  console.log("📂 Loading seed data…");
  const raw = readFileSync(SEED_PATH, "utf-8");
  const seedsByMonth: Record<string, SeedEntry[]> = JSON.parse(raw);
  let entries: SeedEntry[] = Object.values(seedsByMonth).flat();

  if (month) {
    entries = entries.filter((e) => e.monthDay.startsWith(month));
    console.log(`🔎 Filtered to ${entries.length} entries matching monthDay="${month}*"`);
  }

  // Load existing cache
  let cache: Record<string, WebImageCacheEntry> = {};
  if (existsSync(CACHE_PATH)) {
    try {
      cache = JSON.parse(readFileSync(CACHE_PATH, "utf-8"));
      console.log(`📦 Loaded existing cache: ${Object.keys(cache).length} entries`);
    } catch {
      console.log("⚠️  Could not parse existing cache, starting fresh");
    }
  }

  // Filter out already-cached entries (unless --force)
  const toProcess = force
    ? entries
    : entries.filter((e) => !cache[cacheKey(e.title_fr)]);

  console.log(
    `🖼️  Processing ${toProcess.length} entries` +
      (force ? " (--force: re-resolving all)" : ` (${entries.length - toProcess.length} already cached)`) +
      "\n",
  );

  if (toProcess.length === 0) {
    console.log("✅ Nothing to do — all entries are already cached.");
    return;
  }

  const startTime = Date.now();
  let resolved = 0;
  let failed = 0;
  let errored = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const entry = toProcess[i];
    const key = cacheKey(entry.title_fr);

    // Each entry involves ~1 DDG search + 1-3 page fetches → ~3-8s per entry
    const avgSecsPerEntry = 5;
    const remaining = (toProcess.length - i) * avgSecsPerEntry;
    const eta =
      remaining > 60
        ? `${Math.ceil(remaining / 60)}m`
        : `${remaining}s`;

    process.stdout.write(
      `  ⏳ ${i + 1}/${toProcess.length} [${entry.monthDay}] ${entry.title_fr.slice(0, 55).padEnd(55)}  (ETA ${eta})\r`,
    );

    try {
      const result = await Promise.race([
        resolveWebImage(entry.title_fr, entry.year),
        sleep(30_000).then(() => null as Awaited<ReturnType<typeof resolveWebImage>>),  // 30s hard cap per entry
      ]);
      if (result) {
        cache[key] = {
          imageUrl: result.imageUrl,
          pageUrl: result.pageUrl,
          pageTitle: result.pageTitle,
          sourceDomain: result.sourceDomain,
          resolvedAt: new Date().toISOString(),
        };
        resolved++;
        console.log(
          `  ✅ ${i + 1}/${toProcess.length} [${entry.monthDay}] ${entry.title_fr.slice(0, 50)}  —  ${result.sourceDomain}`,
        );
      } else {
        // Remove stale cache entry when --force re-resolves and fails
        if (force) delete cache[key];
        failed++;
        console.log(
          `  ❌ ${i + 1}/${toProcess.length} [${entry.monthDay}] ${entry.title_fr.slice(0, 50)}  —  no image found`,
        );
      }
    } catch (err: unknown) {
      errored++;
      console.log(
        `  💥 ${i + 1}/${toProcess.length} [${entry.monthDay}] ${entry.title_fr.slice(0, 50)}  —  ${(err as Error).message}`,
      );
    }

    // Save cache after every 10 entries (in case of crash)
    if ((i + 1) % 10 === 0 || i === toProcess.length - 1) {
      writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    }
  }

  // Final save
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const total = Object.keys(cache).length;
  console.log(`
══════════════════════════════════════════════════════════════════════
📊 BATCH WEB IMAGE RESOLVE SUMMARY
══════════════════════════════════════════════════════════════════════
  Processed:         ${toProcess.length}
  ✅ Resolved:       ${resolved}
  ❌ No image found: ${failed}
  💥 Errors:         ${errored}
  📦 Total in cache: ${total}
  ⏱️  Duration:       ${elapsed}s
  📄 Cache file:     ${CACHE_PATH}
══════════════════════════════════════════════════════════════════════
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
