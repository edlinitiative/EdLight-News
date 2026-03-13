/**
 * IG Delete Old Posts — removes all Instagram posts except today & yesterday.
 *
 * The IG Graph API exposes:
 *   GET  /{ig-user-id}/media?fields=id,caption,timestamp&limit=N
 *   DELETE /{ig-media-id}
 *
 * Usage:  cd apps/worker && npx tsx src/scripts/igDeleteOldPosts.ts
 *
 * Pass --dry-run to preview without actually deleting.
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

const token = process.env.IG_ACCESS_TOKEN!;
const userId = process.env.IG_USER_ID!;
const apiHost = process.env.IG_API_HOST ?? "graph.instagram.com";
const DRY_RUN = process.argv.includes("--dry-run");

interface IGMedia {
  id: string;
  caption?: string;
  timestamp: string; // ISO 8601
}

interface IGMediaPage {
  data: IGMedia[];
  paging?: { cursors?: { after?: string }; next?: string };
}

/** Fetch all IG media using cursor-based pagination. */
async function fetchAllMedia(): Promise<IGMedia[]> {
  const all: IGMedia[] = [];
  let url: string | null =
    `https://${apiHost}/v21.0/${userId}/media?fields=id,caption,timestamp&limit=50&access_token=${token}`;

  while (url) {
    const res = await fetch(url);
    const page = (await res.json()) as IGMediaPage;

    if (!page.data) {
      console.error("Unexpected API response:", JSON.stringify(page).slice(0, 300));
      break;
    }

    all.push(...page.data);
    url = page.paging?.next ?? null;
  }

  return all;
}

/** Delete a single IG media object. Returns true on success. */
async function deleteMedia(mediaId: string): Promise<boolean> {
  const res = await fetch(
    `https://${apiHost}/v21.0/${mediaId}?access_token=${token}`,
    { method: "DELETE" },
  );
  const body = (await res.json()) as { success?: boolean; error?: { message: string } };
  if (body.success) return true;
  console.error(`  ✗ Failed to delete ${mediaId}: ${body.error?.message ?? `HTTP ${res.status}`}`);
  return false;
}

/** Get the start of a day in UTC (midnight). */
function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function main() {
  if (!token || !userId) {
    console.error("Missing IG credentials. Set IG_ACCESS_TOKEN and IG_USER_ID in .env");
    process.exit(1);
  }

  console.log("=== IG Delete Old Posts ===");
  console.log(`Mode: ${DRY_RUN ? "🔍 DRY RUN (no deletions)" : "🔴 LIVE — will delete posts"}`);
  console.log(`API host: ${apiHost}\n`);

  // Calculate cutoff: start of yesterday (UTC)
  const now = new Date();
  const yesterdayStart = startOfDayUTC(now);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);

  console.log(`Keeping posts from: ${yesterdayStart.toISOString()} onward`);
  console.log(`Current time:       ${now.toISOString()}\n`);

  // Fetch all posts
  console.log("Fetching all IG posts...");
  const allMedia = await fetchAllMedia();
  console.log(`Total posts found: ${allMedia.length}\n`);

  if (allMedia.length === 0) {
    console.log("No posts found. Nothing to do.");
    return;
  }

  // Partition into keep vs delete
  const toKeep: IGMedia[] = [];
  const toDelete: IGMedia[] = [];

  for (const media of allMedia) {
    const postDate = new Date(media.timestamp);
    if (postDate >= yesterdayStart) {
      toKeep.push(media);
    } else {
      toDelete.push(media);
    }
  }

  console.log(`Posts to KEEP (today + yesterday): ${toKeep.length}`);
  for (const m of toKeep) {
    const snippet = m.caption?.substring(0, 60)?.replace(/\n/g, " ") ?? "(no caption)";
    console.log(`  ✓ ${m.timestamp}  ${snippet}`);
  }

  console.log(`\nPosts to DELETE: ${toDelete.length}`);
  for (const m of toDelete) {
    const snippet = m.caption?.substring(0, 60)?.replace(/\n/g, " ") ?? "(no caption)";
    console.log(`  ✗ ${m.timestamp}  ${m.id}  ${snippet}`);
  }

  if (toDelete.length === 0) {
    console.log("\nNothing to delete. All posts are from today or yesterday.");
    return;
  }

  if (DRY_RUN) {
    console.log(`\n🔍 DRY RUN complete. ${toDelete.length} posts would be deleted.`);
    console.log("Run without --dry-run to actually delete.");
    return;
  }

  // Confirm
  console.log(`\n⚠️  About to delete ${toDelete.length} posts. Starting in 5 seconds...`);
  await new Promise((r) => setTimeout(r, 5000));

  // Delete with a small delay between each to avoid rate-limiting
  let deleted = 0;
  let failed = 0;

  for (let i = 0; i < toDelete.length; i++) {
    const media = toDelete[i]!;
    const snippet = media.caption?.substring(0, 40)?.replace(/\n/g, " ") ?? "(no caption)";
    process.stdout.write(`  [${i + 1}/${toDelete.length}] Deleting ${media.id} (${snippet})... `);

    const ok = await deleteMedia(media.id);
    if (ok) {
      console.log("✓");
      deleted++;
    } else {
      failed++;
    }

    // Rate limit: wait 2 seconds between deletes
    if (i < toDelete.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Deleted: ${deleted}  |  Failed: ${failed}  |  Kept: ${toKeep.length}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
