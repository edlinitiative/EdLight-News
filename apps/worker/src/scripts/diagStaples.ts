import { igQueueRepo } from "@edlight-news/firebase";

async function main() {
  // Get a large pool to check staple scores
  const all = await igQueueRepo.listQueuedByScore(100);
  const staples = all.filter(i => ["taux", "histoire", "utility"].includes(i.igType));
  console.log("Queued staples in top-100:", JSON.stringify(staples.map(i => ({
    id: i.id, igType: i.igType, score: i.score,
    targetPostDate: i.targetPostDate,
    createdAt: (i as any).createdAt?._seconds ?? (i as any).createdAt?.seconds
  })), null, 2));

  // Top-30 breakdown
  const top30 = all.slice(0, 30);
  const types: Record<string, number> = {};
  for (const i of top30) types[i.igType] = (types[i.igType] ?? 0) + 1;
  console.log("Top-30 by score breakdown:", types);
  const minScore = top30.at(-1)?.score ?? 0;
  const maxScore = top30[0]?.score ?? 0;
  console.log(`Score range in top-30: ${minScore} – ${maxScore}`);
  console.log(`Total queued: ${all.length}`);
}
main().catch(console.error);
