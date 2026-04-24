/**
 * Diagnostic 2: For opportunity items WITHOUT a published content_version,
 * understand WHY (generationAttempts? draft status? etc.)
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const OPP_CATS = ["scholarship", "opportunity", "bourses", "concours", "stages", "programmes"];

async function main() {
  const db = getDb();

  // Get items by vertical=opportunites
  const verticalSnap = await db.collection("items")
    .where("vertical", "==", "opportunites").limit(500).get();
  const catSnaps = await Promise.all(
    OPP_CATS.map((c) => db.collection("items").where("category", "==", c).limit(200).get()),
  );

  const itemsMap = new Map<string, any>();
  for (const doc of verticalSnap.docs) itemsMap.set(doc.id, { id: doc.id, ...doc.data() });
  for (const snap of catSnaps) {
    for (const doc of snap.docs) itemsMap.set(doc.id, { id: doc.id, ...doc.data() });
  }
  const items = Array.from(itemsMap.values());
  console.log(`total opportunity-tagged items: ${items.length}`);

  let anyCv = 0, draftCv = 0, publishedCv = 0, noCv = 0;
  const buckets = {
    noCv_attempts0: 0, noCv_attempts1: 0, noCv_attempts2: 0, noCv_attempts3plus: 0,
    noCv_lowScore: 0, noCv_offMission: 0,
  };
  const samplesNoCvNoAttempts: any[] = [];
  const samplesDraft: any[] = [];

  for (const item of items) {
    const cvSnap = await db.collection("content_versions")
      .where("itemId", "==", item.id).get();
    if (cvSnap.empty) {
      noCv++;
      const attempts = item.generationAttempts ?? 0;
      if (attempts === 0) {
        buckets.noCv_attempts0++;
        if (samplesNoCvNoAttempts.length < 10) samplesNoCvNoAttempts.push({
          id: item.id, title: item.title?.slice(0, 80),
          score: item.audienceFitScore, offMission: item.qualityFlags?.offMission,
          createdAt: item.createdAt?.toDate?.()?.toISOString(),
        });
      } else if (attempts === 1) buckets.noCv_attempts1++;
      else if (attempts === 2) buckets.noCv_attempts2++;
      else buckets.noCv_attempts3plus++;
      if ((item.audienceFitScore ?? 1) < 0.14) buckets.noCv_lowScore++;
      if (item.qualityFlags?.offMission) buckets.noCv_offMission++;
    } else {
      anyCv++;
      const hasPub = cvSnap.docs.some((d) => (d.data() as any).status === "published");
      const hasDraft = cvSnap.docs.some((d) => (d.data() as any).status === "draft");
      if (hasPub) publishedCv++;
      else if (hasDraft) {
        draftCv++;
        if (samplesDraft.length < 10) {
          const draftDoc = cvSnap.docs.find((d) => (d.data() as any).status === "draft")!;
          const dd = draftDoc.data() as any;
          samplesDraft.push({
            id: item.id, title: item.title?.slice(0, 60),
            draftReason: dd.draftReason, lang: dd.language,
            qualityFlags: item.qualityFlags?.reasons,
          });
        }
      }
    }
  }

  console.log(`\n── content_versions distribution ──`);
  console.log(`  with published cv:  ${publishedCv}`);
  console.log(`  with draft only:    ${draftCv}`);
  console.log(`  with NO cv at all:  ${noCv}`);
  console.log(`\n── for items with NO cv ──`);
  console.log(`  generationAttempts=0:    ${buckets.noCv_attempts0}  (never tried!)`);
  console.log(`  generationAttempts=1:    ${buckets.noCv_attempts1}`);
  console.log(`  generationAttempts=2:    ${buckets.noCv_attempts2}`);
  console.log(`  generationAttempts>=3:   ${buckets.noCv_attempts3plus}  (permanently skipped)`);
  console.log(`  audienceFitScore < 0.14: ${buckets.noCv_lowScore}  (skipped pre-Gemini)`);
  console.log(`  offMission flag:         ${buckets.noCv_offMission}`);

  console.log(`\n── samples: NO cv, attempts=0 (should have been generated!) ──`);
  for (const s of samplesNoCvNoAttempts) console.log(" ", s);

  console.log(`\n── samples: draft cv (why not published?) ──`);
  for (const s of samplesDraft) console.log(" ", s);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
