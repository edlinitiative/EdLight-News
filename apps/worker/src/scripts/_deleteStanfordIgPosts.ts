import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

const token = process.env.IG_ACCESS_TOKEN!;
const apiHost = process.env.IG_API_HOST ?? "graph.instagram.com";

const POST_IDS = [
  "18165837571411042",
  "18068985350293182",
  "18164022547423520",
  "18068030276658591",
];

async function deleteMedia(mediaId: string): Promise<boolean> {
  const res = await fetch(
    `https://${apiHost}/v21.0/${mediaId}?access_token=${token}`,
    { method: "DELETE" },
  );
  const body = (await res.json()) as { success?: boolean; error?: { message: string } };
  if (body.success) return true;
  console.error(`  ✗ ${mediaId}: ${body.error?.message ?? `HTTP ${res.status}`}`);
  return false;
}

async function main() {
  console.log(`API host: ${apiHost}\n`);
  for (const id of POST_IDS) {
    const ok = await deleteMedia(id);
    if (ok) console.log(`✅ Deleted ${id}`);
  }
}

main().catch(console.error);
