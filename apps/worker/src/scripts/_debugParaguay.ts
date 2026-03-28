import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import serviceAccount from "../config/serviceAccount.js";

initializeApp({ credential: cert(serviceAccount as any) });
const db = getFirestore();

async function main() {
  const snap = await db
    .collection("ig_queue")
    .orderBy("createdAt", "desc")
    .limit(80)
    .get();

  for (const doc of snap.docs) {
    const d = doc.data();
    const cap: string = d.payload?.caption ?? "";
    const heading0: string = d.payload?.slides?.[0]?.heading ?? "";
    if (
      cap.toLowerCase().includes("paraguay") ||
      heading0.toLowerCase().includes("paraguay")
    ) {
      console.log("=== FOUND:", doc.id, "===");
      console.log("Status:", d.status);
      console.log("igType:", d.igType);
      console.log("\n--- CAPTION ---\n" + cap);
      console.log("\n--- SLIDES ---");
      const slides: any[] = d.payload?.slides ?? [];
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        console.log(`\nSlide ${i + 1} [layout=${s.layout}]:`);
        console.log("  heading:", s.heading);
        console.log("  bullets:", JSON.stringify(s.bullets, null, 2));
        if (s.footer) console.log("  footer:", s.footer);
      }
    }
  }
  console.log("\nDone");
}

main().catch(console.error);
