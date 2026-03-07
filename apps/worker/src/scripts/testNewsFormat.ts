/**
 * Test the news formatter output for the BRH and Pétion-Ville items
 * to verify beat quality after the fix.
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { itemsRepo, contentVersionsRepo } from "@edlight-news/firebase";
import { formatForIG } from "@edlight-news/generator/ig/formatters/index.js";
import type { BilingualText } from "@edlight-news/generator/ig/index.js";

async function testItem(label: string, itemId: string) {
  const item = await itemsRepo.getItem(itemId);
  if (!item) { console.log(`${label}: item not found`); return; }

  let bi: BilingualText | undefined;
  try {
    const versions = await contentVersionsRepo.listByItemId(item.id);
    const fr = versions.find((v: any) => v.language === "fr");
    const ht = versions.find((v: any) => v.language === "ht");
    if (fr) bi = { frTitle: fr.title, frSummary: fr.summary, htTitle: ht?.title, htSummary: ht?.summary };
  } catch { /* ignore */ }

  const formatted = formatForIG("news", item, bi ? { bi } : undefined);

  console.log(`\n=== ${label} ===`);
  console.log(`Slides: ${formatted.slides.length}`);
  for (let i = 0; i < formatted.slides.length; i++) {
    const s = formatted.slides[i]!;
    console.log(`\n--- Slide ${i+1} (layout: ${s.layout}) ---`);
    console.log(`Heading (${s.heading.length} chars): ${s.heading}`);
    if (s.bullets.length) console.log("Bullets:", s.bullets);
    if (s.footer) console.log("Footer:", s.footer);
  }
}

async function main() {
  await testItem("BRH Global Money Week", "zLiU3Uk17RmOvoMJaZRQ");
  await testItem("Pétion-Ville Camions", "CxZ8NSDbT01rijqWoeut");
}

main().then(() => process.exit(0));
