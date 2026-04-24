/**
 * Simulate the *new* /opportunites filter pipeline (post-fix #4) against
 * current Firestore data to confirm the page would now render content.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const OPP_CATS = new Set([
  "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
]);

function normalise(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}
const NEGATIVE_RE =
  /\b(?:lettre\s+ouverte|tribune\s+libre|salue\s+(?:la\s+)?victoire|(?:obtient|obtenu|decroche|recoit|recu)\s+(?:un|son|une|sa|le|la|leur|ses|leurs)\s+(?:doctorat|master|licence|diplome|mba|phd|prix|bourse|distinction|titre))/i;
const SMELL_KW = [
  "bourse","bourses","scholarship","fellowship","bursary","stipend",
  "stage","stages","internship","alternance","apprentissage",
  "inscription","inscriptions","admission","admissions","candidature","candidatures",
  "master","licence","doctorat","diplome","mba","bootcamp",
  "concours","hackathon","olympiade","postuler","universitaire","university","opportunit",
  "okazyon","bous","estaj","konkou",
];
const SMELL_RE = SMELL_KW.map((kw) => new RegExp(`\\b${kw}\\b`));
function smellOk(title: string, summary?: string): boolean {
  const blob = normalise(`${title} ${summary ?? ""}`);
  if (NEGATIVE_RE.test(blob)) return false;
  return SMELL_RE.some((re) => re.test(blob));
}
function isOpen(deadline?: string | null): boolean {
  if (!deadline) return true;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return true;
  return d.getTime() >= Date.now() - 24 * 60 * 60 * 1000;
}

async function main() {
  const db = getDb();
  // Mirror fetchEnrichedFeed: published cv (web) joined with item.
  const cvSnap = await db.collection("content_versions")
    .where("status", "==", "published")
    .where("channel", "==", "web")
    .where("language", "==", "fr")
    .limit(200).get();

  const itemIds = Array.from(new Set(cvSnap.docs.map((d) => (d.data() as any).itemId)));
  const itemMap = new Map<string, any>();
  // Chunk by 10 (Firestore "in" limit)
  for (let i = 0; i < itemIds.length; i += 10) {
    const chunk = itemIds.slice(i, i + 10);
    const snap = await db.collection("items").where("__name__", "in", chunk).get();
    for (const d of snap.docs) itemMap.set(d.id, { id: d.id, ...d.data() });
  }

  type EA = { id: string; itemId: string; title: string; summary?: string;
    vertical?: string; category?: string; itemType?: string; series?: string;
    deadline?: string | null; audienceFitScore?: number; offMission?: boolean };
  const enriched: EA[] = cvSnap.docs.map((d) => {
    const cv = d.data() as any;
    const it = itemMap.get(cv.itemId) ?? {};
    return {
      id: d.id, itemId: cv.itemId,
      title: cv.title ?? it.title ?? "",
      summary: cv.summary ?? it.summary,
      vertical: it.vertical, category: cv.category ?? it.category,
      itemType: it.itemType, series: it.utilityMeta?.series,
      deadline: it.deadline, audienceFitScore: it.audienceFitScore,
      offMission: it.qualityFlags?.offMission,
    };
  });

  const candidates = enriched.filter((a) =>
    a.vertical === "opportunites" || OPP_CATS.has(a.category ?? "") ||
    (a.itemType === "utility" && a.series === "ScholarshipRadar")
  );
  console.log(`step 1 candidates (vertical|cat|radar): ${candidates.length}`);

  // OLD smell-test (pre-fix)
  const smellPassOld = candidates.filter((a) =>
    (a.itemType === "utility" && a.series === "ScholarshipRadar") || smellOk(a.title, a.summary)
  );
  // NEW smell-test (post-fix #4: trust vertical=opportunites)
  const smellPassNew = candidates.filter((a) =>
    (a.itemType === "utility" && a.series === "ScholarshipRadar") ||
    a.vertical === "opportunites" ||
    smellOk(a.title, a.summary)
  );
  console.log(`step 2 smell-test  OLD: ${smellPassOld.length}   NEW: ${smellPassNew.length}`);

  const openOld = smellPassOld.filter((a) => isOpen(a.deadline));
  const openNew = smellPassNew.filter((a) => isOpen(a.deadline));
  console.log(`step 3 deadline    OLD: ${openOld.length}   NEW: ${openNew.length}`);

  // Final ranking gate (audienceFitThreshold=0.40, offMission filter)
  const rankOld = openOld.filter((a) =>
    !a.offMission && (a.audienceFitScore == null || a.audienceFitScore >= 0.40)
  );
  const rankNew = openNew.filter((a) =>
    !a.offMission && (a.audienceFitScore == null || a.audienceFitScore >= 0.40)
  );
  console.log(`step 4 rank gate   OLD: ${rankOld.length}   NEW: ${rankNew.length}\n`);

  console.log(`── sample of NEW results that page will render ──`);
  for (const a of rankNew.slice(0, 15)) {
    console.log(`  · [${a.category ?? "-"}] ${a.title.slice(0, 80)}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
