/**
 * scripts/smoke-social.ts
 *
 * End-to-end dry-run smoke test for every social publisher.
 *
 * Goal: prove that with no credentials in the environment, NONE of the
 * publishers reach the network. They must all return `{ dryRun: true }` and
 * the global fetch spy must record zero calls.
 *
 * Usage:
 *   pnpm tsx scripts/smoke-social.ts
 *
 * Exits 0 on success, 1 on any failure. Used by the smoke-social CI job.
 */

import {
  publishToFacebook,
  publishToWhatsApp,
  publishToThreads,
  publishToX,
  publishIgStory,
  publishIgPost,
} from "../packages/publisher/src/index.js";

// ── 1. Blank every credential the publishers might read ───────────────────
const TOKENS_TO_BLANK = [
  // Instagram / Facebook / Threads / WhatsApp share Meta tokens
  "IG_ACCESS_TOKEN",
  "IG_USER_ID",
  "FB_PAGE_ACCESS_TOKEN",
  "FB_PAGE_ID",
  "TH_ACCESS_TOKEN",
  "TH_USER_ID",
  "WA_ACCESS_TOKEN",
  "WA_PHONE_NUMBER_ID",
  "WA_CHANNEL_ID",
  // X / Twitter
  "X_API_KEY",
  "X_API_SECRET",
  "X_ACCESS_TOKEN",
  "X_ACCESS_SECRET",
  "X_BEARER_TOKEN",
];
for (const k of TOKENS_TO_BLANK) {
  delete process.env[k];
}

// ── 2. Install a fetch spy that fails the test if anything reaches out ────
let fetchCalls = 0;
const recordedUrls: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input?.url ?? String(input);
  fetchCalls += 1;
  recordedUrls.push(url);
  // Still return a benign response so any code path that ignores dryRun
  // doesn't crash before we have a chance to assert.
  return new Response(JSON.stringify({ id: "smoke-fake" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;

// ── 3. Build minimal fake queue items for each publisher ──────────────────
const now = new Date();
const fakeTimestamp = { _seconds: Math.floor(now.getTime() / 1000), _nanoseconds: 0 } as any;

const fakeFb = {
  queueItem: {
    id: "smoke-fb-1",
    sourceContentId: "smoke-src-1",
    score: 50,
    status: "scheduled",
    createdAt: fakeTimestamp,
    updatedAt: fakeTimestamp,
  } as any,
  payload: {
    text: "smoke fb post",
    linkUrl: "https://news.edlight.org/news/smoke",
    imageUrl: undefined,
  },
};

const fakeWa = {
  queueItem: {
    id: "smoke-wa-1",
    sourceContentId: "smoke-src-1",
    score: 50,
    status: "scheduled",
    createdAt: fakeTimestamp,
    updatedAt: fakeTimestamp,
  } as any,
  payload: {
    text: "smoke wa message",
    linkUrl: "https://news.edlight.org/news/smoke",
  },
};

const fakeTh = {
  queueItem: {
    id: "smoke-th-1",
    sourceContentId: "smoke-src-1",
    score: 50,
    status: "scheduled",
    createdAt: fakeTimestamp,
    updatedAt: fakeTimestamp,
  } as any,
  payload: {
    text: "smoke threads post",
    replyLinkUrl: "https://news.edlight.org/news/smoke",
  },
};

const fakeX = {
  queueItem: {
    id: "smoke-x-1",
    sourceContentId: "smoke-src-1",
    score: 50,
    status: "scheduled",
    createdAt: fakeTimestamp,
    updatedAt: fakeTimestamp,
  } as any,
  payload: {
    text: "smoke x post https://news.edlight.org/news/smoke",
  },
};

const fakeIgPost = {
  queueItem: {
    id: "smoke-ig-1",
    sourceContentId: "smoke-src-1",
    igType: "news",
    score: 50,
    status: "rendered",
    createdAt: fakeTimestamp,
    updatedAt: fakeTimestamp,
  } as any,
  payload: {
    caption: "smoke ig caption",
    slides: [{ kind: "cover", title: "smoke", subtitle: "" }],
  } as any,
  publicSlideUrls: ["https://example.com/smoke-1.jpg"],
};

// ── 4. Run every publisher and assert dryRun ──────────────────────────────
const failures: string[] = [];

function assertDryRun(name: string, result: any) {
  const flag = result?.dryRun;
  if (flag !== true) {
    failures.push(`${name}: expected dryRun=true, got ${JSON.stringify(result)}`);
  } else {
    console.log(`✅ ${name}: dryRun=true`);
  }
}

async function main() {
  try {
    assertDryRun("publishToFacebook", await publishToFacebook(fakeFb.queueItem, fakeFb.payload));
  } catch (err) {
    failures.push(`publishToFacebook threw: ${(err as Error).message}`);
  }

  try {
    assertDryRun("publishToWhatsApp", await publishToWhatsApp(fakeWa.queueItem, fakeWa.payload));
  } catch (err) {
    failures.push(`publishToWhatsApp threw: ${(err as Error).message}`);
  }

  try {
    assertDryRun("publishToThreads", await publishToThreads(fakeTh.queueItem, fakeTh.payload));
  } catch (err) {
    failures.push(`publishToThreads threw: ${(err as Error).message}`);
  }

  try {
    assertDryRun("publishToX", await publishToX(fakeX.queueItem, fakeX.payload));
  } catch (err) {
    failures.push(`publishToX threw: ${(err as Error).message}`);
  }

  try {
    assertDryRun(
      "publishIgStory",
      await publishIgStory("https://example.com/smoke-story.jpg", "smoke-story-1", {
        linkUrl: "https://news.edlight.org",
        pollQuestion: "Smoke?",
        pollOptions: ["Yes", "No"],
      }),
    );
  } catch (err) {
    failures.push(`publishIgStory threw: ${(err as Error).message}`);
  }

  try {
    assertDryRun(
      "publishIgPost",
      await publishIgPost(fakeIgPost.queueItem, fakeIgPost.payload, fakeIgPost.publicSlideUrls),
    );
  } catch (err) {
    failures.push(`publishIgPost threw: ${(err as Error).message}`);
  }

  // ── 5. Verify the fetch spy stayed at zero ──────────────────────────────
  if (fetchCalls > 0) {
    failures.push(
      `expected 0 outbound fetch calls, got ${fetchCalls}. URLs: ${recordedUrls.join(", ")}`,
    );
  } else {
    console.log("✅ no outbound fetch calls were made");
  }

  // Restore real fetch (no-op in CI, but tidy)
  globalThis.fetch = realFetch;

  if (failures.length > 0) {
    console.error("\n❌ smoke-social FAILED:");
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log("\n🎉 smoke-social PASSED — every publisher honoured dry-run.");
}

void main();
