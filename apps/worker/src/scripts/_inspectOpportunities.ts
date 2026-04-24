/**
 * Diagnostic: Inspect why /opportunites is empty.
 *
 * Mirrors the exact filtering pipeline used by the web page so we can
 * count drop-offs at every stage:
 *   1. items with vertical=opportunites OR opportunity-like category
 *   2. content_versions(published) for each
 *   3. smell test (contentLooksLikeOpportunity)
 *   4. deadline still open
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const OPPORTUNITY_CATEGORIES = new Set([
  "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
]);

function normalise(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim();
}
const NEGATIVE_RE =
  /\b(?:electora[l]|electeur|electeurs|scrutin|vote|mandat|depute|parlement|senat(?:eur)?|remporte|laureat|gagne|gagnant|proclam|sacr[e]e?\s+champion|arrestation|assassin|complot|accuse|condamn|gang|armee|militaire|tir|fusillade|enlev|kidnapp|lettre\s+ouverte|tribune\s+libre|appel\s+a\s+l['\s]?(?:unite|paix|dialogue|reconciliation)|salue\s+(?:la\s+)?victoire|felicit\w*\s+(?:la|le|les)?\s*(?:laureat|gagnant|vainqueur|equipe|champion)|(?:obtient|obtenu|decroche|recoit|recu)\s+(?:un|son|une|sa|le|la|leur|ses|leurs)\s+(?:doctorat|master|licence|diplome|mba|phd|prix|bourse|distinction|titre)|a\s+(?:obtenu|recu|decroche|remporte)\s+(?:un|son|une|sa|le|la|leur)\s+(?:doctorat|master|licence|diplome|mba|phd|prix|bourse))/i;
const SMELL_KW = [
  "bourse","bourses","scholarship","fellowship","bursary","stipend",
  "stage","stages","internship","alternance","apprentissage",
  "inscription","inscriptions","admission","admissions","candidature","candidatures",
  "master","licence","doctorat","diplome","mba","bootcamp",
  "concours","hackathon","olympiade",
  "postuler","universitaire","university","opportunit",
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

  // Step 1: query items
  const verticalSnap = await db.collection("items")
    .where("vertical", "==", "opportunites").limit(500).get();
  const catSnaps = await Promise.all(
    Array.from(OPPORTUNITY_CATEGORIES).map((c) =>
      db.collection("items").where("category", "==", c).limit(200).get()
    ),
  );
  const utilSnap = await db.collection("items")
    .where("itemType", "==", "utility").limit(200).get();

  const itemsMap = new Map<string, any>();
  for (const doc of verticalSnap.docs) itemsMap.set(doc.id, { id: doc.id, ...doc.data() });
  for (const snap of catSnaps) {
    for (const doc of snap.docs) itemsMap.set(doc.id, { id: doc.id, ...doc.data() });
  }
  for (const doc of utilSnap.docs) {
    const d = doc.data() as any;
    if (d.utilityMeta?.series === "ScholarshipRadar") {
      itemsMap.set(doc.id, { id: doc.id, ...d });
    }
  }
  const items = Array.from(itemsMap.values());
  console.log(`[1] candidate items (vertical/category/utility-radar): ${items.length}`);
  console.log(`    by vertical:           ${verticalSnap.size}`);
  console.log(`    by utility radar:      ${Array.from(utilSnap.docs).filter(d => (d.data() as any).utilityMeta?.series === "ScholarshipRadar").length}`);
  for (let i = 0; i < catSnaps.length; i++) {
    const c = Array.from(OPPORTUNITY_CATEGORIES)[i];
    console.log(`    by category=${c}:`.padEnd(30) + `${catSnaps[i].size}`);
  }

  // Step 2: published content_versions (lang=fr)
  let publishedFr = 0, publishedHt = 0;
  let withSmell = 0, openDeadline = 0;
  const droppedSmell: string[] = [];
  const droppedDeadline: string[] = [];
  const itemsNoCv: string[] = [];

  for (const item of items) {
    const cvSnap = await db.collection("content_versions")
      .where("itemId", "==", item.id)
      .where("status", "==", "published")
      .where("channel", "==", "web")
      .get();
    const fr = cvSnap.docs.find((d) => (d.data() as any).language === "fr");
    const ht = cvSnap.docs.find((d) => (d.data() as any).language === "ht");
    if (fr) publishedFr++;
    if (ht) publishedHt++;
    if (!fr && !ht) {
      itemsNoCv.push(`${item.id} | ${String(item.title ?? "").slice(0, 60)}`);
      continue;
    }
    const cv = (fr ?? ht)!.data() as any;
    const title = cv.title ?? item.title ?? "";
    const summary = cv.summary ?? item.summary ?? "";
    const smellPass = smellOk(title, summary);
    if (smellPass) {
      withSmell++;
      if (isOpen(item.deadline)) {
        openDeadline++;
      } else {
        droppedDeadline.push(`${item.id} | deadline=${item.deadline} | ${title.slice(0, 60)}`);
      }
    } else {
      droppedSmell.push(`${item.id} | ${title.slice(0, 60)} || ${String(summary).slice(0, 60)}`);
    }
  }

  console.log(`\n[2] published content_versions:`);
  console.log(`    fr published:          ${publishedFr}`);
  console.log(`    ht published:          ${publishedHt}`);
  console.log(`    items with NO cv:      ${itemsNoCv.length}`);

  console.log(`\n[3] survives smell test: ${withSmell}`);
  console.log(`[4] survives deadline gate: ${openDeadline}`);

  console.log(`\n── DROPPED by smell test (${droppedSmell.length}) ──`);
  droppedSmell.slice(0, 20).forEach((s) => console.log("  " + s));

  console.log(`\n── DROPPED by deadline expired (${droppedDeadline.length}) ──`);
  droppedDeadline.slice(0, 20).forEach((s) => console.log("  " + s));

  console.log(`\n── items WITHOUT published cv (${itemsNoCv.length}) ──`);
  itemsNoCv.slice(0, 20).forEach((s) => console.log("  " + s));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
