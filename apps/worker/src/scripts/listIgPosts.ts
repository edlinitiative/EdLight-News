import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

const token = process.env.IG_ACCESS_TOKEN!;
const userId = process.env.IG_USER_ID!;
const baseUrl = token.startsWith("IGAA")
  ? "https://graph.instagram.com"
  : "https://graph.facebook.com";

async function main() {
  // Fetch ALL posts
  let allMedia: any[] = [];
  let url: string | null = `${baseUrl}/${userId}/media?fields=id,caption,timestamp,media_type&limit=50&access_token=${token}`;

  while (url) {
    const res = await fetch(url);
    const data = (await res.json()) as any;
    if (data.data) allMedia = allMedia.concat(data.data);
    url = data.paging?.next ?? null;
  }

  console.log(`Total posts on IG: ${allMedia.length}\n`);
  for (const m of allMedia) {
    const ts = m.timestamp.substring(0, 16);
    const cap = m.caption?.substring(0, 70) ?? "(no caption)";
    console.log(`  ${ts}  ${m.media_type.padEnd(14)}  ${m.id}  ${cap}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
