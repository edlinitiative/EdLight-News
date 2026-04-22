import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

async function main() {
  const db = getDb();
  const snap = await db
    .collection("fb_queue")
    .where("status", "in", ["queued", "scheduled"])
    .limit(500)
    .get();

  console.log(`\nFound ${snap.size} queued/scheduled FB items\n`);
  const byStatus: Record<string, number> = {};
  const items: Array<{
    id: string;
    status: string;
    sourceContentId: string;
    score?: number;
    scheduledFor?: string;
    textPreview: string;
  }> = [];

  for (const doc of snap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const status = String(d.status);
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    items.push({
      id: doc.id,
      status,
      sourceContentId: String(d.sourceContentId ?? ""),
      score: d.score as number | undefined,
      scheduledFor: d.scheduledFor as string | undefined,
      textPreview: String((d.payload as { text?: string } | undefined)?.text ?? "").slice(0, 200),
    });
  }
  console.log("By status:", byStatus);
  console.log("\nAll items:");
  for (const it of items) {
    console.log(
      `\n[${it.status}] ${it.id}  src=${it.sourceContentId}  score=${it.score}  sched=${it.scheduledFor ?? "-"}`,
    );
    console.log(`  ${it.textPreview.replace(/\n/g, " | ")}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
