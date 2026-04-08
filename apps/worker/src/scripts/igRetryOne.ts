/**
 * Retry publishing a single post to test if rate limit has lifted.
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
import { renderWithIgEngine } from "@edlight-news/renderer/ig-engine-render.js";
import { publishIgPost } from "@edlight-news/publisher";
import { generateContextualImage } from "../services/geminiImageGen.js";

async function main() {
  const queued = await igQueueRepo.listQueuedByScore(10);
  
  // Pick first scholarship
  const pick = queued.find((q) => q.igType === "scholarship");
  if (!pick) { console.log("No scholarship in queue"); process.exit(0); }

  console.log(`Publishing: ${pick.igType} — ${pick.id} (score=${pick.score})`);

  const item = await itemsRepo.getItem(pick.sourceContentId);
  if (!item) { console.log("Source not found"); process.exit(1); }
  console.log(`Title: ${item.title.substring(0, 80)}`);

  let bi: BilingualText | undefined;
  try {
    const versions = await contentVersionsRepo.listByItemId(item.id);
    const fr = versions.find((v: any) => v.language === "fr");
    const ht = versions.find((v: any) => v.language === "ht");
    if (fr) bi = { frTitle: fr.title, frSummary: fr.summary, htTitle: ht?.title, htSummary: ht?.summary, frSections: fr.sections as { heading: string; content: string }[] | undefined, frBody: fr.body || undefined, frNarrative: fr.narrative ?? undefined };
  } catch { /* ignore */ }

  const formatted = await formatForIG(pick.igType as any, item, bi ? { bi } : undefined);
  console.log(`Slides: ${formatted.slides.length}`);

  await igQueueRepo.setPayload(pick.id, formatted);
  await igQueueRepo.updateStatus(pick.id, "rendering");

  // Image
  const needsImage = formatted.slides.filter((s: any) => !s.backgroundImage);
  if (needsImage.length > 0) {
    try {
      const gen = await generateContextualImage(item);
      if (gen) {
        for (const s of needsImage) s.backgroundImage = gen.url;
        await igQueueRepo.setPayload(pick.id, formatted);
        console.log("✓ AI image generated");
      }
    } catch (e: any) {
      console.warn("⚠ Image gen failed:", e.message ?? e);
    }
  }

  // Render
  console.log("Rendering...");
  const assets = await renderWithIgEngine(pick, formatted);
  console.log(`Rendered ${assets.slidePaths.length} slides`);

  const urls = await uploadCarouselSlides(assets.slidePaths, pick.id);
  console.log(`Uploaded ${urls.length} slides`);

  // Publish
  console.log("Publishing...");
  const result = await publishIgPost(pick, formatted, urls);

  if (result.posted) {
    await igQueueRepo.markPosted(pick.id, result.igPostId);
    console.log(`✓ POSTED: ${result.igPostId}`);
  } else {
    console.error(`✗ FAILED: ${result.error}`);
    await igQueueRepo.updateStatus(pick.id, "queued");
  }

  process.exit(0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
