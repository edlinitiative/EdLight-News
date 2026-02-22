/**
 * Deactivate stale utility sources that were replaced by working URLs.
 */
import "dotenv/config";
import { getDb } from "@edlight-news/firebase";

const STALE_URLS = [
  "https://menfp.gouv.ht",
  "https://www.ueh.edu.ht",
  "https://www.haiti.campusfrance.org/actualites",
  "https://www.faes.ht",
  "https://www.scholarships.com/financial-aid/college-scholarships/scholarships-by-type/international-scholarships/",
  "https://www.francophonie.org/bourses",
  "https://www.auf.org/nouvelles/appels-a-candidatures/",
  "https://ht.indeed.com/emplois?q=stage+%C3%A9tudiant",
  "https://www.studyrama.com/formations/conseils-guides",
];

async function main() {
  const db = getDb();
  let deactivated = 0;

  for (const url of STALE_URLS) {
    const snap = await db.collection("utility_sources").where("url", "==", url).get();
    for (const doc of snap.docs) {
      await doc.ref.update({ active: false });
      console.log(`  ❌ Deactivated: ${doc.data().label} (${url})`);
      deactivated++;
    }
  }

  console.log(`\nDone: ${deactivated} stale sources deactivated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
