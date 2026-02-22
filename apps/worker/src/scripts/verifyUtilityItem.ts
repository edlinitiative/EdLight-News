/**
 * Quick verification of the utility item created by the engine.
 */
import "dotenv/config";
import { itemsRepo, contentVersionsRepo } from "@edlight-news/firebase";

async function main() {
  // Fetch the item
  const itemId = "25Veu26ze9UNgGI3VfNw";
  const item = await itemsRepo.getItem(itemId);
  if (!item) {
    console.error("Item not found!");
    process.exit(1);
  }

  console.log("═══ ITEM ═══");
  console.log("  ID:          ", item.id);
  console.log("  Title:       ", item.title);
  console.log("  ItemType:    ", item.itemType);
  console.log("  Category:    ", item.category);
  console.log("  Status:      ", item.status);
  console.log("  UtilityMeta: ", JSON.stringify(item.utilityMeta, null, 4));

  // Fetch content versions
  const frVersions = await contentVersionsRepo.listByItemId(itemId);
  const htVersions: any[] = []; // filter from frVersions

  for (const cv of [...frVersions, ...htVersions]) {
    console.log(`\n═══ CONTENT VERSION (${cv.language}) ═══`);
    console.log("  ID:          ", cv.id);
    console.log("  Status:      ", cv.status);
    console.log("  Title:       ", cv.title);
    console.log("  Summary:     ", cv.summary?.substring(0, 120) + "…");
    console.log("  Sections:    ", cv.sections?.length ?? 0);
    if (cv.sections?.length) {
      for (const s of cv.sections) {
        console.log(`    • ${s.heading}: ${s.body?.substring(0, 80)}…`);
      }
    }
    console.log("  Citations:   ", (cv as any).sourceCitations?.length ?? 0);
    if ((cv as any).sourceCitations?.length) {
      for (const c of (cv as any).sourceCitations) {
        console.log(`    📎 [${c.label}] ${c.url}`);
      }
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
