import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { igQueueRepo, itemsRepo } from "@edlight-news/firebase";

async function main() {
  // BRH Global Money Week
  const brh = await igQueueRepo.getIGQueueItem("jScWAabiksI34jPpOaeY");
  if (brh?.payload) {
    console.log("=== BRH Global Money Week ===");
    console.log("sourceContentId:", brh.sourceContentId);
    for (let i = 0; i < brh.payload.slides.length; i++) {
      const s = brh.payload.slides[i]!;
      console.log(`\n--- Slide ${i+1} (layout: ${s.layout}) ---`);
      console.log("Heading:", s.heading);
      console.log("Bullets:", JSON.stringify(s.bullets));
      console.log("Footer:", s.footer);
    }
  }

  // Also fetch the raw item to see full extractedText
  if (brh) {
    const item = await itemsRepo.getItem(brh.sourceContentId);
    if (item) {
      console.log("\n\n--- BRH Raw Item ---");
      console.log("Title:", item.title);
      console.log("Summary:", item.summary);
      console.log("extractedText length:", item.extractedText?.length ?? 0);
      console.log("extractedText (first 1500):", item.extractedText?.substring(0, 1500));
    }
  }

  console.log("\n\n========================================\n");

  // Pétion-Ville
  const pv = await igQueueRepo.getIGQueueItem("VflPSHiZ7gSiMWlHurXV");
  if (pv?.payload) {
    console.log("=== Pétion-Ville Camions ===");
    console.log("sourceContentId:", pv.sourceContentId);
    for (let i = 0; i < pv.payload.slides.length; i++) {
      const s = pv.payload.slides[i]!;
      console.log(`\n--- Slide ${i+1} (layout: ${s.layout}) ---`);
      console.log("Heading:", s.heading);
      console.log("Bullets:", JSON.stringify(s.bullets));
      console.log("Footer:", s.footer);
    }
  }

  if (pv) {
    const item = await itemsRepo.getItem(pv.sourceContentId);
    if (item) {
      console.log("\n\n--- PV Raw Item ---");
      console.log("Title:", item.title);
      console.log("Summary:", item.summary);
      console.log("extractedText length:", item.extractedText?.length ?? 0);
      console.log("extractedText (first 1500):", item.extractedText?.substring(0, 1500));
    }
  }
}
main().then(() => process.exit(0));
