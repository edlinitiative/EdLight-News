import { getDb } from "@edlight-news/firebase";

(async () => {
  const db = getDb();
  // Search by permalink fragment
  const snap = await db.collection("ig_queue").orderBy("updatedAt", "desc").limit(500).get();
  for (const doc of snap.docs) {
    const d: any = doc.data();
    const perma = d.igPermalink || d.permalink || "";
    if (/DXcGaRMlGVd/i.test(perma) || /DXcGaRMlGVd/i.test(JSON.stringify(d))) {
      console.log("FOUND:", doc.id);
      console.log(JSON.stringify(d, null, 2).slice(0, 4000));
      return;
    }
  }
  console.log("Not found by permalink. Listing the 5 most-recently posted Fils-Aimé / Citadelle items:");
  for (const doc of snap.docs) {
    const d: any = doc.data();
    if (d.status !== "posted") continue;
    const slides: any[] = d.payload?.slides || [];
    const txt = slides.map((s) => s.heading).join(" | ");
    if (/citadelle|fils[- ]?aim/i.test(txt)) {
      console.log("---");
      console.log(doc.id, "perma=", d.igPermalink, "  postedAt=", d.postedAt?.toDate?.() || d.updatedAt?.toDate?.());
      console.log("  heading:", slides[0]?.heading);
    }
  }
})();
