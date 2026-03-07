/**
 * Minimal publish test: create one carousel and publish with token in form body.
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

const token = process.env.IG_ACCESS_TOKEN!;
const userId = process.env.IG_USER_ID!;
const apiHost = process.env.IG_API_HOST ?? "graph.instagram.com";
const baseUrl = `https://${apiHost}/v21.0/${userId}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(url: string, params: Record<string, string>) {
  // Use access_token in form body instead of Authorization header
  const body = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(url, { method: "POST", body });
  return { status: res.status, data: (await res.json()) as any };
}

async function get(url: string) {
  const res = await fetch(`${url}&access_token=${token}`);
  return (await res.json()) as any;
}

async function main() {
  // Use already-uploaded images from the last render
  const { igQueueRepo } = await import("@edlight-news/firebase");

  // Get the URLs from Firebase Storage directly
  const storageBase =
    "https://storage.googleapis.com/edlight-news-prod.firebasestorage.app/ig-carousels/zXwhd2P8zydLjrPHeZFg";
  const slides = [`${storageBase}/slide-0.png`, `${storageBase}/slide-1.png`, `${storageBase}/slide-2.png`];

  console.log("Step 1: Create carousel items...");
  const kids: string[] = [];
  for (let i = 0; i < slides.length; i++) {
    const { status, data } = await post(`${baseUrl}/media`, {
      image_url: slides[i]!,
      is_carousel_item: "true",
    });
    if (data.error) {
      console.log(`  ✗ Item ${i + 1} error (${status}):`, data.error.message);
      return;
    }
    kids.push(data.id);
    console.log(`  ✓ Item ${i + 1}: ${data.id}`);
    await sleep(3000);
  }

  console.log("\nStep 2: Wait for items to finish...");
  for (const kid of kids) {
    for (let a = 0; a < 10; a++) {
      await sleep(3000);
      const s = await get(`https://${apiHost}/v21.0/${kid}?fields=status_code`);
      if (s.status_code === "FINISHED") {
        console.log(`  ✓ ${kid}: FINISHED`);
        break;
      }
      if (s.status_code === "ERROR") {
        console.log(`  ✗ ${kid}: ERROR`);
        return;
      }
    }
  }

  console.log("\nStep 3: Create carousel...");
  const { status: cs, data: cd } = await post(`${baseUrl}/media`, {
    media_type: "CAROUSEL",
    children: kids.join(","),
    caption: "Test post — bourse Samuel Fellows",
  });
  if (cd.error) {
    console.log(`  ✗ Carousel error (${cs}):`, cd.error.message);
    return;
  }
  console.log(`  ✓ Carousel: ${cd.id}`);

  console.log("\nStep 4: Wait for carousel...");
  for (let a = 0; a < 10; a++) {
    await sleep(5000);
    const s = await get(`https://${apiHost}/v21.0/${cd.id}?fields=status_code`);
    console.log(`  Status: ${s.status_code} (attempt ${a + 1})`);
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR") {
      console.log("  ERROR");
      return;
    }
  }

  console.log("\nStep 5: PUBLISH (token in form body, not header)...");
  const { status: ps, data: pd } = await post(`${baseUrl}/media_publish`, {
    creation_id: cd.id,
  });
  console.log(`  Status: ${ps}`);
  console.log(`  Response:`, JSON.stringify(pd));

  if (pd.id) {
    console.log(`\n✓ PUBLISHED: ${pd.id}`);
    await igQueueRepo.markPosted("zXwhd2P8zydLjrPHeZFg", pd.id);
  } else {
    console.log("\n✗ Failed");
    await igQueueRepo.updateStatus("zXwhd2P8zydLjrPHeZFg", "queued");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
