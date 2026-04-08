import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });
import { itemsRepo, contentVersionsRepo } from "@edlight-news/firebase";

async function main() {
  for (const [label, id] of [
    ["Bourse Mexique", "xQfouTLF2N3ln4e5BNVD"],
    ["Concours AUF", "EanAlMZdVqggQpA7tuRY"],
  ]) {
    console.log(`\n${"=".repeat(60)}\n${label} — ${id}\n${"=".repeat(60)}`);
    const item = await itemsRepo.getItem(id);
    console.log("title:", item?.title);
    console.log("geoTag:", item?.geoTag);
    console.log("category:", item?.category);
    console.log("deadline:", item?.deadline);
    console.log("imageUrl:", item?.imageUrl ? "✅" : "❌");
    console.log("opportunity:", JSON.stringify(item?.opportunity ?? null, null, 2));
    const versions = await contentVersionsRepo.listByItemId(id);
    const fr = versions.find((v: any) => v.language === "fr");
    console.log("\n--- FR content ---");
    console.log("summary:", fr?.summary);
    console.log("narrative:", fr?.narrative ?? "(none)");
    console.log("sections:", JSON.stringify(fr?.sections ?? [], null, 2));
  }
}
main().catch(console.error);
