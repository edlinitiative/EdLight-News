#!/usr/bin/env npx tsx
/**
 * Bulk-delete ALL posts from the connected Instagram account.
 *
 * Usage:
 *   cd apps/worker
 *   npx tsx src/scripts/igBulkDelete.ts            # dry-run (list only)
 *   npx tsx src/scripts/igBulkDelete.ts --confirm   # actually delete
 *
 * Requires env vars: IG_ACCESS_TOKEN, IG_USER_ID, IG_API_HOST (optional).
 * Reads from ../../.env automatically.
 */

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../..", ".env") });

// ── Config ──────────────────────────────────────────────────────────────────
const ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const USER_ID = process.env.IG_USER_ID;
const API_HOST = process.env.IG_API_HOST ?? "graph.instagram.com";
const BASE_URL = `https://${API_HOST}/v21.0`;

// Rate-limit: Meta allows ~200 calls/hour. 500ms gap ≈ 120/min, well within.
const DELAY_MS = 500;

const CONFIRM = process.argv.includes("--confirm");

if (!ACCESS_TOKEN || !USER_ID) {
  console.error("❌  Missing IG_ACCESS_TOKEN or IG_USER_ID in environment.");
  process.exit(1);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function apiFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, ...init?.headers },
  });
  return (await res.json()) as T;
}

interface MediaEdge {
  id: string;
  timestamp?: string;
  caption?: string;
  media_type?: string;
}

interface MediaPage {
  data: MediaEdge[];
  paging?: { next?: string; cursors?: { after?: string } };
}

// ── 1. Fetch all media IDs (paginated) ──────────────────────────────────────
async function fetchAllMedia(): Promise<MediaEdge[]> {
  const all: MediaEdge[] = [];
  let url = `${BASE_URL}/${USER_ID}/media?fields=id,timestamp,caption,media_type&limit=50`;

  while (url) {
    const page = await apiFetch<MediaPage>(url);
    if (!page.data?.length) break;
    all.push(...page.data);
    process.stdout.write(`\r  Fetched ${all.length} posts…`);
    url = page.paging?.next ?? "";
    if (url) await sleep(200); // light throttle on reads
  }
  console.log(); // newline after progress
  return all;
}

// ── 2. Delete a single media item ───────────────────────────────────────────
async function deleteMedia(mediaId: string): Promise<boolean> {
  const res = await apiFetch<{ success?: boolean; error?: { message: string } }>(
    `${BASE_URL}/${mediaId}`,
    { method: "DELETE" },
  );
  if (res.success) return true;
  console.warn(`  ⚠  Failed to delete ${mediaId}: ${res.error?.message ?? "unknown error"}`);
  return false;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("📸  Fetching all posts from IG account…\n");
  const media = await fetchAllMedia();

  if (media.length === 0) {
    console.log("✅  No posts found — account is already clean.");
    return;
  }

  console.log(`\n  Found ${media.length} posts.\n`);

  // Show a preview of the first 10
  for (const m of media.slice(0, 10)) {
    const cap = m.caption?.replace(/\n/g, " ").slice(0, 60) ?? "(no caption)";
    console.log(`  ${m.id}  ${m.timestamp ?? ""}  ${m.media_type ?? ""}  ${cap}`);
  }
  if (media.length > 10) {
    console.log(`  … and ${media.length - 10} more\n`);
  }

  if (!CONFIRM) {
    console.log("🔒  DRY RUN — pass --confirm to actually delete all posts.");
    console.log(`    npx tsx src/scripts/igBulkDelete.ts --confirm\n`);
    return;
  }

  // ── Delete loop ─────────────────────────────────────────────────────────
  console.log(`\n🗑️   Deleting ${media.length} posts…\n`);
  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < media.length; i++) {
    const m = media[i];
    const ok = await deleteMedia(m.id);
    if (ok) {
      deleted++;
    } else {
      failed++;
    }
    process.stdout.write(`\r  Progress: ${i + 1}/${media.length}  (deleted=${deleted}, failed=${failed})`);
    await sleep(DELAY_MS);
  }

  console.log(`\n\n✅  Done. Deleted: ${deleted}, Failed: ${failed}, Total: ${media.length}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
