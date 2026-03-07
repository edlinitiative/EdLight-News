import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

const token = process.env.IG_ACCESS_TOKEN!;
const userId = process.env.IG_USER_ID!;
const baseUrl = token.startsWith("IGAA")
  ? "https://graph.instagram.com"
  : "https://graph.facebook.com";

async function main() {
  // Fetch current posts
  const listRes = await fetch(
    `${baseUrl}/${userId}/media?fields=id,caption,timestamp&limit=3&access_token=${token}`
  );
  const listData = (await listRes.json()) as any;
  console.log("Current posts count:", listData.data?.length ?? 0);

  if (!listData.data?.[0]) {
    console.log("No posts found.");
    return;
  }

  const mediaId = listData.data[0].id;
  const caption = listData.data[0].caption?.substring(0, 60) ?? "(none)";
  console.log(`\nFirst post: ${mediaId} — ${caption}`);

  // Attempt 1: DELETE on graph.instagram.com
  console.log("\n--- Attempt 1: DELETE via graph.instagram.com ---");
  const r1 = await fetch(
    `https://graph.instagram.com/${mediaId}?access_token=${token}`,
    { method: "DELETE" }
  );
  console.log("Status:", r1.status);
  console.log("Response:", await r1.text());

  // Attempt 2: DELETE on graph.facebook.com
  console.log("\n--- Attempt 2: DELETE via graph.facebook.com ---");
  const r2 = await fetch(
    `https://graph.facebook.com/v21.0/${mediaId}?access_token=${token}`,
    { method: "DELETE" }
  );
  console.log("Status:", r2.status);
  console.log("Response:", await r2.text());

  // Attempt 3: Check the media object via GET first
  console.log("\n--- Attempt 3: GET media details ---");
  const r3 = await fetch(
    `${baseUrl}/${mediaId}?fields=id,caption,media_type,permalink&access_token=${token}`
  );
  console.log("Status:", r3.status);
  console.log("Response:", await r3.text());
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
