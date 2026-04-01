import { igQueueRepo } from "@edlight-news/firebase";
import { validatePayloadForPublishing } from "../services/igPublishValidation.js";
import { needsReview, countEmojis } from "@edlight-news/generator/ig/review.js";

async function main() {
  const item = await igQueueRepo.getIGQueueItem("b1fKQKNkwCnCRQNu8cFW");
  if (!item?.payload) { console.log("No item or payload"); return; }

  console.log("=== HISTOIRE ITEM ===");
  console.log("Caption length:", item.payload.caption.length);
  console.log("Slides:", item.payload.slides.length);

  const result = validatePayloadForPublishing(item.payload, item.igType);
  console.log("\n=== VALIDATION RESULT ===");
  console.log("shouldHold:", result.shouldHold);
  console.log("issues:", JSON.stringify(result.issues, null, 2));

  console.log("\n=== SLIDE HEADINGS ===");
  item.payload.slides.forEach((s, i) => {
    console.log(`  Slide ${i}: "${s.heading}" (${s.bullets.length} bullets)`);
  });

  console.log("\n=== CAPTION (first 300 chars) ===");
  console.log(item.payload.caption.substring(0, 300));

  console.log("\nneedsReview:", needsReview(item.payload, item.igType));
}
main().catch(console.error);
