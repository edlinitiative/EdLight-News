import { getDb } from "@edlight-news/firebase";

(async () => {
  const db = getDb();
  const id = "G0SfCxZfBOD6YHXzkvvr";
  const doc = await db.collection("ig_queue").doc(id).get();
  const d: any = doc.data();
  console.log("---FULL DOC---");
  console.log(JSON.stringify(d, null, 2));
})();
