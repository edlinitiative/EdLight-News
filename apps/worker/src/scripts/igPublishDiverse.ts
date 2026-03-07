/**
 * Publish one post of each type from the queue.
 * Uses the same publishOneManual logic from igPublishBatch.
 *
 * Usage:  cd apps/worker && npx tsx src/scripts/igPublishDiverse.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import {
  igQueueRepo,
  itemsRepo,
  contentVersionsRepo,
  uploadCarouselSlides,
} from "@edlight-news/firebase";
import { formatForIG } from "@edlight-news/generator/ig/formatters/index.js";
import type { BilingualText } from "@edlight-news/generator/ig/index.js";
import { generateCarouselAssets } from "@edlight-news/renderer/ig-carousel.js";
import { generateContextualImage, ensureTauxBackground } from "../services/geminiImageGen.js";
import { findEditorialImage } from "../services/editorialImageSearch.js";

const token = process.env.IG_ACCESS_TOKEN!;
const userId = process.env.IG_USER_ID!;
const apiHost = process.env.IG_API_HOST ?? "graph.instagram.com";
const baseUrl = `https://${apiHost}/v21.0/${userId}`;
const auth = { Authorization: `Bearer ${token}` };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function igPost(url: string, params: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: auth,
    body: new URLSearchParams(params),
  });
  return (await res.json()) as any;
}

async function igGet(url: string) {
  const res = await fetch(url, { headers: auth });
  return (await res.json()) as any;
}

async function waitForContainer(cid: string, label: string): Promise<boolean> {
  for (let attempt = 0; attempt < 12; attempt++) {
    await sleep(5000);
    const s = await igGet(`https://${apiHost}/v21.0/${cid}?fields=status_code`);
    const code = s.status_code ?? "UNKNOWN";
    if (code === "FINISHED") {
      console.log(`    ${label} ${cid}: FINISHED`);
      return true;
    }
    if (code === "ERROR" || code === "EXPIRED") {
      console.log(`    ${label} ${cid}: ${code}`);
      return false;
    }
    console.log(`    ${label} ${cid}: ${code} (attempt ${attempt + 1})`);
  }
  return false;
}

async function publishOneManual(queueItem: any): Promise<boolean> {
  console.log(`\n--- ${queueItem.igType}: ${queueItem.id} (score=${queueItem.score}) ---`);

  // Taux posts already have payload — skip item lookup
  if (queueItem.igType === "taux") {
    return publishFromPayload(queueItem);
  }

  const item = await itemsRepo.getItem(queueItem.sourceContentId);
  if (!item) {
    console.log("  Source not found, skipping");
    return false;
  }
  console.log(`  Title: ${item.title.substring(0, 80)}`);

  // Get bilingual content
  let bi: BilingualText | undefined;
  try {
    const versions = await contentVersionsRepo.listByItemId(item.id);
    const fr = versions.find((v: any) => v.language === "fr");
    const ht = versions.find((v: any) => v.language === "ht");
    if (fr)
      bi = {
        frTitle: fr.title,
        frSummary: fr.summary,
        htTitle: ht?.title,
        htSummary: ht?.summary,
      };
  } catch {
    /* ignore */
  }

  // Format
  const formatted = formatForIG(queueItem.igType as any, item, bi ? { bi } : undefined);
  console.log(`  Slides: ${formatted.slides.length}`);
  for (let i = 0; i < formatted.slides.length; i++) {
    console.log(`    ${i + 1}: ${formatted.slides[i]!.heading.substring(0, 75)}`);
  }

  await igQueueRepo.setPayload(queueItem.id, formatted);
  await igQueueRepo.updateStatus(queueItem.id, "rendering");

  // Generate hero image if needed
  const needsImage = formatted.slides.filter((s: any) => !s.backgroundImage);
  if (needsImage.length > 0) {
    try {
      const gen = await generateContextualImage(item);
      if (gen) {
        for (const s of needsImage) s.backgroundImage = gen.url;
        await igQueueRepo.setPayload(queueItem.id, formatted);
        console.log("  ✓ AI image generated");

        // For histoire posts: find an alternative Unsplash image for inner slides
        if (queueItem.igType === "histoire" && formatted.slides.length > 1) {
          let altUrl: string | undefined;
          try {
            const alt = await findEditorialImage(item, 3);
            if (alt && alt.url !== gen.url) {
              altUrl = alt.url;
              console.log(`  ✓ Alt image for inner slides (${alt.source})`);
            }
          } catch { /* non-blocking */ }

          const innerUrl = altUrl ?? gen.url;
          for (let i = 1; i < formatted.slides.length; i++) {
            formatted.slides[i]!.backgroundImage = innerUrl;
          }
          await igQueueRepo.setPayload(queueItem.id, formatted);
        }
      }
    } catch (e: any) {
      console.warn("  ⚠ Image gen failed:", e.message ?? e);
    }
  }

  return renderAndPublish(queueItem, formatted);
}

async function publishFromPayload(queueItem: any): Promise<boolean> {
  let formatted = queueItem.payload;
  if (!formatted?.slides?.length) {
    console.log("  No payload on taux item, skipping");
    return false;
  }

  console.log(`  Slides: ${formatted.slides.length}`);
  for (let i = 0; i < formatted.slides.length; i++) {
    console.log(`    ${i + 1}: ${formatted.slides[i]!.heading.substring(0, 75)}`);
  }

  // Ensure taux background image on cover
  if (!formatted.slides[0]?.backgroundImage) {
    try {
      const bgUrl = await ensureTauxBackground();
      if (bgUrl) {
        formatted.slides[0].backgroundImage = bgUrl;
        await igQueueRepo.setPayload(queueItem.id, formatted);
        console.log("  ✓ Taux background image applied");
      }
    } catch (e: any) {
      console.warn("  ⚠ Taux bg failed:", e.message ?? e);
    }
  }

  await igQueueRepo.updateStatus(queueItem.id, "rendering");
  return renderAndPublish(queueItem, formatted);
}

async function renderAndPublish(queueItem: any, formatted: any): Promise<boolean> {
  // Render
  console.log("  Rendering...");
  const assets = await generateCarouselAssets(queueItem, formatted);
  console.log(`  Rendered ${assets.slidePaths.length} slides`);

  // Upload to storage
  const urls = await uploadCarouselSlides(assets.slidePaths, queueItem.id);
  console.log(`  Uploaded ${urls.length} slides`);

  // ── Manual IG API publish with deliberate delays ──
  console.log("  Creating carousel items (5s gaps)...");
  const containerIds: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    if (i > 0) await sleep(5000);
    const data = await igPost(`${baseUrl}/media`, {
      image_url: urls[i]!,
      is_carousel_item: "true",
    });
    if (data.error) {
      console.log(`  ✗ Container error: ${data.error.message}`);
      await igQueueRepo.updateStatus(queueItem.id, "queued");
      return false;
    }
    containerIds.push(data.id);
    console.log(`    Item ${i + 1}/${urls.length}: ${data.id}`);
  }

  // Wait for all child containers
  for (const cid of containerIds) {
    const ok = await waitForContainer(cid, "slide");
    if (!ok) {
      await igQueueRepo.updateStatus(queueItem.id, "queued");
      return false;
    }
  }

  // Create carousel container
  await sleep(5000);
  console.log("  Creating carousel container...");
  const carousel = await igPost(`${baseUrl}/media`, {
    media_type: "CAROUSEL",
    children: containerIds.join(","),
    caption: formatted.caption,
  });
  if (carousel.error) {
    console.log(`  ✗ Carousel error: ${carousel.error.message}`);
    await igQueueRepo.updateStatus(queueItem.id, "queued");
    return false;
  }
  console.log(`    Carousel: ${carousel.id}`);

  // Wait for carousel
  const carouselOk = await waitForContainer(carousel.id, "carousel");
  if (!carouselOk) {
    await igQueueRepo.updateStatus(queueItem.id, "queued");
    return false;
  }

  // PUBLISH
  await sleep(10000);
  console.log("  Publishing...");

  const pub = await igPost(`${baseUrl}/media_publish`, {
    creation_id: carousel.id,
  });

  if (pub.id) {
    console.log(`  ✓ POSTED: ${pub.id}`);
    await igQueueRepo.markPosted(queueItem.id, pub.id);
    return true;
  }

  // Phantom rate-limit check
  console.log(`  ⚠ API returned: ${pub.error?.message ?? "unknown error"}`);
  console.log("  Checking if post appeared on IG (waiting 20s)...");
  await sleep(20000);

  const afterRes = await fetch(
    `https://${apiHost}/v21.0/${userId}/media?fields=id,caption,timestamp&limit=3&access_token=${token}`,
  );
  const afterData = (await afterRes.json()) as any;
  const newest = afterData.data?.[0];

  if (newest) {
    const postTime = new Date(newest.timestamp).getTime();
    const now = Date.now();
    if (now - postTime < 120_000) {
      console.log(`  ✓ Post DID appear on IG despite error: ${newest.id}`);
      await igQueueRepo.markPosted(queueItem.id, newest.id);
      return true;
    }
  }

  console.log("  ✗ Post did not appear. Genuine rate limit.");
  await igQueueRepo.updateStatus(queueItem.id, "queued");
  return false;
}

// ── Main ───────────────────────────────────────────────────────────────────

const DESIRED_TYPES = ["scholarship", "news", "opportunity", "histoire", "taux"];

async function main() {
  const queued = await igQueueRepo.listQueuedByScore(100);
  console.log(`${queued.length} queued items\n`);

  // Pick one of each desired type
  const picks: typeof queued = [];
  for (const type of DESIRED_TYPES) {
    const match = queued.find(
      (q) => q.igType === type && !picks.some((p) => p.id === q.id),
    );
    if (match) {
      picks.push(match);
      console.log(`✓ ${type}: ${match.id} (score=${match.score})`);
    } else {
      console.log(`✗ ${type}: none in queue`);
    }
  }

  console.log(`\nPublishing ${picks.length} posts: ${picks.map((p) => p.igType).join(", ")}\n`);

  let published = 0;
  for (const pick of picks) {
    const ok = await publishOneManual(pick);
    if (ok) {
      published++;
      if (published < picks.length) {
        console.log("\n  ⏳ Waiting 30s before next publish...");
        await sleep(30000);
      }
    } else {
      console.log("  Stopping after failure.");
      break;
    }
  }

  console.log(`\n=== Done: ${published}/${picks.length} published ===`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
