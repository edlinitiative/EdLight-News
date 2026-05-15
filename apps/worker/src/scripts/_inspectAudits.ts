import dotenv from "dotenv";
dotenv.config({ path: "/workspaces/EdLight-News/.env" });
import { getDb } from "@edlight-news/firebase";

const IDS = [
  "0qIKIkgebP2StF7w8lxp", // Epstein exhibit
  "0u4AFLjUf5GFiJ0qOSqR", // Italy/Israel
  "0SdBet6rHg3CjoFXK0sH", // Doctoriales (legit)
  "0eBpQ727Z6ixvk4pl03o", // Bayer Foundation (legit)
];

async function main() {
  const db = getDb();
  for (const id of IDS) {
    const auditDoc = await db.collection("classification_audits").doc(id).get();
    const itemDoc = await db.collection("items").doc(id).get();
    console.log("─".repeat(80));
    console.log("ID         :", id);
    console.log("title      :", String(itemDoc.data()?.title ?? "").slice(0, 100));
    if (auditDoc.exists) {
      const d = auditDoc.data() as any;
      console.log("AUDIT exists:");
      console.log("  label    :", d.label);
      console.log("  finalTopic:", d.finalTopic);
      console.log("  conf     :", d.confidence);
      console.log("  demoted  :", d.demoted);
      console.log("  reason   :", String(d.reason ?? "").slice(0, 200));
      console.log("  model    :", d.model);
      console.log("  verifiedAt:", d.verifiedAt?.toDate?.());
    } else {
      console.log("AUDIT: (none)");
    }
  }

  // Also: total audit count + label histogram
  const allAudits = await db.collection("classification_audits").get();
  const histo: Record<string, number> = {};
  let demotedCount = 0;
  for (const doc of allAudits.docs) {
    const d = doc.data() as any;
    histo[d.label ?? "?"] = (histo[d.label ?? "?"] ?? 0) + 1;
    if (d.demoted) demotedCount++;
  }
  console.log("─".repeat(80));
  console.log("TOTAL audits:", allAudits.size);
  console.log("Label histogram:", histo);
  console.log("Demoted count  :", demotedCount);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
