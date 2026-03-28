/**
 * Re-render and re-publish the BRH and Pétion-Ville posts with fixed formatting.
 * Uses the same approach as igPublishBatch but targets specific queue items.
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
import { generateContextualImage } from "../services/geminiImageGen.js";

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
    if (code === "FINISHED") { console.log(`    ${label} ${cid}: FINISHED`); return true; }
    if (code === "ERROR" || code === "EXPIRED") { console.log(`    ${label} ${cid}: ${code}`); return false; }
    console.log(`    ${label} ${cid}: ${code} (attempt ${attempt + 1})`);
  }
  return false;
}

async function republishOne(queueItemId: string): Promise<boolean> {
  const queueItem = await igQueueRepo.getIGQueueItem(queueItemId);
  if (!queueItem) { console.log(`  Queue item ${queueItemId} not found`); return false; }

  console.log(`\n--- ${queueItem.igType}: ${queueItem.id} ---`);

  const item = await itemsRepo.getItem(queueItem.sourceContentId);
  if (!item) { console.log("  Source not found"); return false; }
  console.log(`  Title: ${item.title.substring(0, 80)}`);

  // Get bilingual content
  let bi: BilingualText | undefined;
  try {
    const versions = await contentVersionsRepo.listByItemId(item.id);
    const fr = versions.find((v: any) => v.language === "fr");
    const ht = versions.find((v: any) => v.language === "ht");
    if (fr) bi = { frTitle: fr.title, frSummary: fr.summary, htTitle: ht?.title, htSummary: ht?.summary, frSections: fr.sections as { heading: string; content: string }[] | undefined, frBody: fr.body || undefined, frNarrative: fr.narrative ?? undefined };
  } catch { /* ignore */ }

  // Re-format with improved formatter
  const formatted = await formatForIG(queueItem.igType as any, item, bi ? { bi } : undefined);
  console.log(`  Slides: ${formatted.slides.length}`);
  for (let i = 0; i < formatted.slides.length; i++) {
    console.log(`    ${i + 1}: ${formatted.slides[i]!.heading.substring(0, 100)}`);
  }

  // Save updated payload
  await igQueueRepo.setPayload(queueItem.id, formatted);
  await igQueueRepo.updateStatus(queueItem.id, "rendering");

  // Generate image if needed
  const needsImage = formatted.slides.filter((s: any) => !s.backgroundImage);
  if (needsImage.length > 0) {
    try {
      const gen = await generateContextualImage(item);
      if (gen) {
        for (const s of needsImage) s.backgroundImage = gen.url;
        await igQueueRepo.setPayload(queueItem.id, formatted);
        console.log("  ✓ Image generated");
      }
    } catch (e: any) { console.warn("  ⚠ Image gen failed:", e.message ?? e); }
  }

  // Render
  console.log("  Rendering...");
  const assets = await generateCarouselAssets(queueItem, formatted);
  console.log(`  Rendered ${assets.slidePaths.length} slides`);

  // Upload
  const urls = await uploadCarouselSlides(assets.slidePaths, queueItem.id);
  console.log(`  Uploaded ${urls.length} slides`);

  // ── Manual IG API publish ──
  console.log("  Creating carousel items (5s gaps)...");
  const containerIds: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    if (i > 0) await sleep(5000);
    const data = await igPost(`${baseUrl}/media`, { image_url: urls[i]!, is_carousel_item: "true" });
    if (data.error) { console.log(`  ✗ Container error: ${data.error.message}`); return false; }
    containerIds.push(data.id);
    console.log(`    Item ${i + 1}/${urls.length}: ${data.id}`);
  }

  for (const cid of containerIds) {
    if (!(await waitForContainer(cid, "slide"))) return false;
  }

  await sleep(5000);
  console.log("  Creating carousel container...");
  const carousel = await igPost(`${baseUrl}/media`, {
    media_type: "CAROUSEL",
    children: containerIds.join(","),
    caption: formatted.caption,
  });
  if (carousel.error) { console.log(`  ✗ Carousel error: ${carousel.error.message}`); return false; }
  console.log(`    Carousel: ${carousel.id}`);

  if (!(await waitForContainer(carousel.id, "carousel"))) return false;

  await sleep(10000);
  console.log("  Publishing...");

  const pub = await igPost(`${baseUrl}/media_publish`, { creation_id: carousel.id });
  if (pub.id) {
    console.log(`  ✓ POSTED: ${pub.id}`);
    await igQueueRepo.markPosted(queueItem.id, pub.id);
    return true;
  }

  // Phantom rate limit check
  console.log(`  ⚠ API returned: ${pub.error?.message ?? "unknown error"}`);
  console.log("  Checking if post appeared (waiting 20s)...");
  await sleep(20000);

  const afterRes = await fetch(
    `https://${apiHost}/v21.0/${userId}/media?fields=id,caption,timestamp&limit=3&access_token=${token}`,
  );
  const afterData = (await afterRes.json()) as any;
  const newest = afterData.data?.[0];
  if (newest) {
    const postTime = new Date(newest.timestamp).getTime();
    if (Date.now() - postTime < 120_000) {
      console.log(`  ✓ Post DID appear: ${newest.id}`);
      await igQueueRepo.markPosted(queueItem.id, newest.id);
      return true;
    }
  }

  console.log("  ✗ Genuine rate limit.");
  return false;
}

async function main() {
  const ids = [
    "jScWAabiksI34jPpOaeY",  // BRH Global Money Week
    "VflPSHiZ7gSiMWlHurXV",  // Pétion-Ville Camions
  ];

  for (let i = 0; i < ids.length; i++) {
    const ok = await republishOne(ids[i]!);
    if (ok && i < ids.length - 1) {
      console.log("\n  ⏳ Waiting 30s...");
      await sleep(30000);
    }
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
