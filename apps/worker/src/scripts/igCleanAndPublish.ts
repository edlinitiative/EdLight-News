/**
 * Clean old IG posts and publish fresh ones.
 *
 * 1. Fetch all media from IG account
 * 2. Delete each post via Graph API
 * 3. Reset posted queue items
 * 4. Re-format and publish fresh posts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { igQueueRepo, itemsRepo, contentVersionsRepo, uploadCarouselSlides } from "@edlight-news/firebase";
import { formatForIG } from "@edlight-news/generator/ig/formatters/index.js";
import type { BilingualText } from "@edlight-news/generator/ig/index.js";
import { generateCarouselAssets } from "@edlight-news/renderer/ig-carousel.js";
import { publishIgPost } from "@edlight-news/publisher";
import { generateContextualImage } from "../services/geminiImageGen.js";

const token = process.env.IG_ACCESS_TOKEN!;
const userId = process.env.IG_USER_ID!;
const baseUrl = token.startsWith("IGAA") ? "https://graph.instagram.com" : "https://graph.facebook.com";

async function fetchIgMedia(): Promise<{ id: string; caption?: string; timestamp: string }[]> {
  const url = `${baseUrl}/${userId}/media?fields=id,caption,timestamp,media_type&limit=50&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json() as any;
  return data.data ?? [];
}

async function deleteIgMedia(mediaId: string): Promise<boolean> {
  const url = `${baseUrl}/${mediaId}?access_token=${token}`;
  const res = await fetch(url, { method: "DELETE" });
  const data = await res.json() as any;
  return data.success === true;
}

async function main() {
  // ── Step 1: Delete all IG posts ──
  console.log("=== Step 1: Delete old IG posts ===\n");
  const media = await fetchIgMedia();
  console.log(`Found ${media.length} posts on IG`);

  for (const m of media) {
    const caption = m.caption?.substring(0, 60) ?? "(no caption)";
    const ok = await deleteIgMedia(m.id);
    console.log(`  ${ok ? "✓" : "✗"} Deleted ${m.id} — ${caption}`);
  }

  // ── Step 2: Reset queue items ──
  console.log("\n=== Step 2: Reset posted queue items ===\n");
  const posted = await igQueueRepo.listByStatus("posted", 50);
  console.log(`Found ${posted.length} posted items in queue`);

  for (const p of posted) {
    await igQueueRepo.updateStatus(p.id, "queued");
  }
  console.log(`Reset ${posted.length} items to queued status`);

  // ── Step 3: Publish fresh posts ──
  console.log("\n=== Step 3: Publish fresh posts ===\n");

  const queued = await igQueueRepo.listQueuedByScore(30);
  console.log(`${queued.length} items in queue`);

  // Build a diverse selection: top scholarship/opportunity + top news + maybe another
  const picks: typeof queued = [];
  const topItem = queued[0];
  if (topItem) picks.push(topItem);

  const topNews = queued.find((q) => q.igType === "news");
  if (topNews && topNews.id !== topItem?.id) picks.push(topNews);

  // Add one more of a different type if possible
  const types = new Set(picks.map((p) => p.igType));
  const third = queued.find((q) => !types.has(q.igType) && q.id !== topItem?.id && q.id !== topNews?.id);
  if (third) picks.push(third);

  // If we still have room, add another news
  if (picks.length < 4) {
    const secondNews = queued.find((q) => q.igType === "news" && !picks.some((p) => p.id === q.id));
    if (secondNews) picks.push(secondNews);
  }

  console.log(`Publishing ${picks.length} diverse posts (${picks.map((p) => p.igType).join(", ")})\n`);

  for (const queueItem of picks) {
    console.log(`--- ${queueItem.igType}: ${queueItem.id} (score=${queueItem.score}) ---`);

    const item = await itemsRepo.getItem(queueItem.sourceContentId);
    if (!item) {
      console.log("  Source not found, skipping");
      continue;
    }
    console.log(`  Title: ${item.title.substring(0, 70)}`);

    // Get bilingual content
    let bi: BilingualText | undefined;
    try {
      const versions = await contentVersionsRepo.listByItemId(item.id);
      const fr = versions.find((v) => v.language === "fr");
      const ht = versions.find((v) => v.language === "ht");
      if (fr) bi = { frTitle: fr.title, frSummary: fr.summary, htTitle: ht?.title, htSummary: ht?.summary, frSections: fr.sections as { heading: string; content: string }[] | undefined, frBody: fr.body || undefined };
    } catch { /* ignore */ }

    // Re-format with the fixed formatter
    const formatted = formatForIG(queueItem.igType as any, item, bi ? { bi } : undefined);
    console.log(`  Slides: ${formatted.slides.length}`);
    for (let i = 0; i < formatted.slides.length; i++) {
      console.log(`    ${i + 1}: ${formatted.slides[i]!.heading.substring(0, 70)}`);
    }

    await igQueueRepo.setPayload(queueItem.id, formatted);
    await igQueueRepo.updateStatus(queueItem.id, "rendering");

    // Generate images for slides missing backgroundImage
    const needsImage = formatted.slides.filter((s) => !s.backgroundImage);
    if (needsImage.length > 0) {
      console.log(`  Generating images for ${needsImage.length} slides...`);
      try {
        const gen = await generateContextualImage(item);
        if (gen) {
          for (const s of needsImage) s.backgroundImage = gen.url;
          await igQueueRepo.setPayload(queueItem.id, formatted);
          console.log("  ✓ Images applied");
        }
      } catch (e) {
        console.warn("  ⚠ Image gen failed:", e instanceof Error ? e.message : e);
      }
    }

    // Render
    console.log("  Rendering...");
    const assets = await generateCarouselAssets(queueItem, formatted);
    console.log(`  Rendered ${assets.slidePaths.length} slides`);

    // Upload
    const urls = await uploadCarouselSlides(assets.slidePaths, queueItem.id);
    console.log(`  Uploaded ${urls.length} slides`);

    // Publish
    console.log("  Publishing...");
    const result = await publishIgPost(queueItem, formatted, urls);

    if (result.posted) {
      await igQueueRepo.markPosted(queueItem.id, result.igPostId);
      console.log(`  ✓ POSTED: ${result.igPostId}\n`);
    } else {
      console.error(`  ✗ FAILED: ${result.error}\n`);
      await igQueueRepo.updateStatus(queueItem.id, "queued");
    }
  }

  console.log("=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
