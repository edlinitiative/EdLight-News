/**
 * Check IG API rate limit status and content publishing quota.
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

const token = process.env.IG_ACCESS_TOKEN!;
const userId = process.env.IG_USER_ID!;
const baseUrl = token.startsWith("IGAA")
  ? "https://graph.instagram.com"
  : "https://graph.facebook.com";

async function main() {
  // Check content publishing limit
  console.log("=== Content Publishing Limit ===");
  const limitRes = await fetch(
    `${baseUrl}/${userId}/content_publishing_limit?fields=config,quota_usage&access_token=${token}`
  );
  console.log("Status:", limitRes.status);
  const limitData = await limitRes.json();
  console.log(JSON.stringify(limitData, null, 2));

  // Count posts from today
  console.log("\n=== Posts from today ===");
  const mediaRes = await fetch(
    `${baseUrl}/${userId}/media?fields=id,timestamp&limit=50&access_token=${token}`
  );
  const mediaData = (await mediaRes.json()) as any;
  const today = new Date().toISOString().substring(0, 10);
  const todayPosts = mediaData.data?.filter((m: any) => m.timestamp.startsWith(today)) ?? [];
  console.log(`Total posts today: ${todayPosts.length}`);
  
  // Try a simple non-publish API call to check if basic rate limit is lifted
  console.log("\n=== Basic API Health ===");
  const meRes = await fetch(`${baseUrl}/${userId}?fields=id,username&access_token=${token}`);
  console.log("Me endpoint status:", meRes.status);
  const meData = await meRes.json();
  console.log(JSON.stringify(meData, null, 2));
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
