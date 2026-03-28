/**
 * One-off: add a proper "En bref" slide 2 to the AUF doc
 * since it was originally a single-slide document.
 *
 * Usage: npx tsx src/scripts/patchAufAddSlide2.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";

const db = getDb();
const DOC_ID = "BuuRtXXndHOZ4OIHov4L";

async function main() {
  const ref = db.collection("ig_queue").doc(DOC_ID);
  const snap = await ref.get();
  const data = snap.data()!;
  const slides: any[] = data.payload?.slides ?? [];

  console.log(`Current slides: ${slides.length}`);
  slides.forEach((s, i) => {
    console.log(`  [${i}] heading="${s.heading}" bullets=${JSON.stringify(s.bullets)}`);
  });

  // Build slide 2 using the summary from caption
  const caption: string = data.payload?.caption ?? "";
  // Extract first meaningful paragraph from caption (after the title line)
  const captionLines = caption.split("\n").filter((l: string) => l.trim());
  // The summary is usually the 2nd line (after title)
  const summaryLine = captionLines.find(
    (l: string) => l.length > 60 && !l.startsWith("#") && !l.startsWith("📌") && !l.startsWith("🔗") && !l.startsWith("🇭🇹")
  ) ?? "";

  const bgImage = slides[0]?.backgroundImage ?? null;

  const slide2 = {
    heading: "En bref",
    bullets: summaryLine ? [summaryLine.slice(0, 350)] : [
      "L'AUF propose une formation en ligne gratuite sur l'IA dans l'éducation. Cette initiative vise à renforcer les compétences des enseignants francophones.",
    ],
    layout: "explanation",
    footer: slides[0]?.footer ?? null,
    ...(bgImage ? { backgroundImage: bgImage } : {}),
  };

  // Move footer from cover to slide 2
  const newSlides = [
    { ...slides[0], footer: null },
    slide2,
  ];

  await ref.update({ "payload.slides": newSlides });

  console.log("\n✅ Done. New slides:");
  newSlides.forEach((s, i) => {
    console.log(`  [${i}] heading="${s.heading}" bullets=${JSON.stringify(s.bullets).slice(0, 80)}…`);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
