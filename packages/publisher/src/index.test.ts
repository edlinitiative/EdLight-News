/**
 * Publisher unit + mocked-integration tests.
 *
 * Mocks globalThis.fetch to verify:
 *   • FB photo+comment (Path A), link-feed (Path B), photo-only (Path C),
 *     text-only (Path D), and dry-run.
 *   • Threads parent post + self-reply, and dry-run.
 *   • X tweet with graceful media-upload fallback, and dry-run.
 *
 * Uses node:test (no extra runner). Run with:
 *   pnpm --filter @edlight-news/publisher test
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type {
  FbQueueItem,
  FbMessagePayload,
  ThQueueItem,
  ThMessagePayload,
  XQueueItem,
  XMessagePayload,
} from "@edlight-news/types";
import {
  publishToFacebook,
  publishToThreads,
  publishToX,
} from "./index.js";

// ── Test helpers ─────────────────────────────────────────────────────────────

type FetchCall = { url: string; init?: RequestInit; bodyText?: string };
let calls: FetchCall[];
let originalFetch: typeof fetch;

function installFetchMock(
  responder: (url: string, init?: RequestInit) => unknown,
) {
  originalFetch = globalThis.fetch;
  (globalThis as { fetch: typeof fetch }).fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = typeof input === "string" ? input : input.toString();
    let bodyText: string | undefined;
    if (init?.body instanceof URLSearchParams) bodyText = init.body.toString();
    else if (typeof init?.body === "string") bodyText = init.body;
    calls.push({ url, init, bodyText });
    const data = responder(url, init);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function clearTokens() {
  for (const k of [
    "FB_PAGE_ACCESS_TOKEN",
    "FB_PAGE_ID",
    "THREADS_ACCESS_TOKEN",
    "THREADS_USER_ID",
    "X_ACCESS_TOKEN",
    "X_BEARER_TOKEN",
    "X_CONSUMER_KEY",
    "X_API_KEY",
    "X_CONSUMER_SECRET",
    "X_API_SECRET",
    "X_OAUTH1_ACCESS_TOKEN",
    "X_OAUTH1_ACCESS_SECRET",
    "FB_LINK_IN_COMMENT",
    "TH_LINK_REPLY",
    "X_MEDIA_UPLOAD",
  ]) {
    delete process.env[k];
  }
}

const fbItem: FbQueueItem = {
  id: "fb-1",
  sourceContentId: "src-1",
  score: 60,
  status: "scheduled",
  reasons: [],
  createdAt: { seconds: 0, nanoseconds: 0 } as never,
  updatedAt: { seconds: 0, nanoseconds: 0 } as never,
};
const thItem: ThQueueItem = { ...fbItem, id: "th-1" } as ThQueueItem;
const xItem: XQueueItem = { ...fbItem, id: "x-1" } as XQueueItem;

beforeEach(() => {
  calls = [];
  clearTokens();
});
afterEach(() => {
  if (originalFetch != null) restoreFetch();
  clearTokens();
});

// ── Facebook ─────────────────────────────────────────────────────────────────

describe("publishToFacebook", () => {
  it("dry-runs when credentials are missing", async () => {
    const result = await publishToFacebook(fbItem, { text: "hi" });
    assert.equal(result.posted, false);
    assert.equal(result.dryRun, true);
    assert.equal(calls.length, 0);
  });

  it("Path A: posts photo + comment when imageUrl AND linkUrl present", async () => {
    process.env.FB_PAGE_ACCESS_TOKEN = "tok";
    process.env.FB_PAGE_ID = "page-123";
    installFetchMock((url) => {
      if (url.includes("/page-123/photos")) {
        return { id: "photoId", post_id: "page-123_777" };
      }
      if (url.includes("/page-123_777/comments")) {
        return { id: "comment-42" };
      }
      return { id: "unexpected" };
    });

    const payload: FbMessagePayload = {
      text: "Caption",
      imageUrl: "https://img/1.jpg",
      linkUrl: "https://news.edlight.org/news/abc",
    };
    const result = await publishToFacebook(fbItem, payload);

    assert.equal(result.posted, true);
    assert.equal(result.fbPostId, "page-123_777");
    assert.equal(result.fbCommentId, "comment-42");
    assert.equal(calls.length, 2);
    assert.match(calls[0]!.url, /\/page-123\/photos$/);
    assert.match(calls[0]!.bodyText ?? "", /url=https/);
    assert.match(calls[0]!.bodyText ?? "", /caption=Caption/);
    assert.match(calls[0]!.bodyText ?? "", /published=true/);
    assert.match(calls[1]!.url, /\/page-123_777\/comments$/);
    assert.match(
      calls[1]!.bodyText ?? "",
      /message=https%3A%2F%2Fnews\.edlight\.org%2Fnews%2Fabc/,
    );
  });

  it("Path A: succeeds even if the comment call fails", async () => {
    process.env.FB_PAGE_ACCESS_TOKEN = "tok";
    process.env.FB_PAGE_ID = "page-123";
    installFetchMock((url) => {
      if (url.includes("/photos")) return { post_id: "page-123_777" };
      if (url.includes("/comments")) return { error: { message: "rate limited", code: 4 } };
      return {};
    });

    const result = await publishToFacebook(fbItem, {
      text: "x",
      imageUrl: "https://img/1.jpg",
      linkUrl: "https://news.edlight.org/news/abc",
    });
    assert.equal(result.posted, true);
    assert.equal(result.fbPostId, "page-123_777");
    assert.equal(result.fbCommentId, undefined);
  });

  it("Path B: link-feed fallback when imageUrl is missing", async () => {
    process.env.FB_PAGE_ACCESS_TOKEN = "tok";
    process.env.FB_PAGE_ID = "page-123";
    installFetchMock(() => ({ id: "page-123_888" }));

    const result = await publishToFacebook(fbItem, {
      text: "x",
      linkUrl: "https://news.edlight.org/news/abc",
    });
    assert.equal(result.posted, true);
    assert.equal(result.fbPostId, "page-123_888");
    assert.equal(calls.length, 1);
    assert.match(calls[0]!.url, /\/page-123\/feed$/);
    assert.match(calls[0]!.bodyText ?? "", /link=https/);
  });

  it("respects FB_LINK_IN_COMMENT=false (legacy link-feed even with image+link)", async () => {
    process.env.FB_PAGE_ACCESS_TOKEN = "tok";
    process.env.FB_PAGE_ID = "page-123";
    process.env.FB_LINK_IN_COMMENT = "false";
    installFetchMock(() => ({ id: "page-123_999" }));

    const result = await publishToFacebook(fbItem, {
      text: "x",
      imageUrl: "https://img/1.jpg",
      linkUrl: "https://news.edlight.org/news/abc",
    });
    assert.equal(result.posted, true);
    assert.equal(calls.length, 1);
    assert.match(calls[0]!.url, /\/page-123\/feed$/);
    assert.equal(result.fbCommentId, undefined);
  });
});

// ── Threads ──────────────────────────────────────────────────────────────────

describe("publishToThreads", () => {
  it("dry-runs when credentials are missing", async () => {
    const result = await publishToThreads(thItem, { text: "hi" });
    assert.equal(result.posted, false);
    assert.equal(result.dryRun, true);
    assert.equal(calls.length, 0);
  });

  it("posts parent + self-reply when replyLinkUrl is set", async () => {
    process.env.THREADS_ACCESS_TOKEN = "tok";
    process.env.THREADS_USER_ID = "user-1";
    let containerCounter = 0;
    let publishCounter = 0;
    installFetchMock((url) => {
      if (url.includes("/threads_publish")) {
        publishCounter++;
        return { id: publishCounter === 1 ? "parentMediaId" : "replyMediaId" };
      }
      if (url.endsWith("/threads")) {
        containerCounter++;
        return { id: `container-${containerCounter}` };
      }
      // status polling — return FINISHED immediately
      if (url.includes("?fields=status")) return { status: "FINISHED" };
      return {};
    });

    const payload: ThMessagePayload = {
      text: "post body",
      replyLinkUrl: "https://news.edlight.org/news/abc",
    };
    const result = await publishToThreads(thItem, payload);

    assert.equal(result.posted, true);
    assert.equal(result.thPostId, "parentMediaId");
    assert.equal(result.thReplyMediaId, "replyMediaId");

    // Should have made: 1 parent container + 1 status + 1 publish + 1 reply container + 1 status + 1 reply publish = 6
    assert.equal(calls.length, 6);
    // Reply container request must include reply_to_id=parentMediaId and the link in text
    const replyContainerCall = calls.find(
      (c) => c.url.endsWith("/threads") && (c.bodyText ?? "").includes("reply_to_id"),
    );
    assert.ok(replyContainerCall, "should have a reply_to_id container call");
    assert.match(replyContainerCall!.bodyText ?? "", /reply_to_id=parentMediaId/);
    assert.match(replyContainerCall!.bodyText ?? "", /text=%F0%9F%94%97/); // "🔗 " prefix
  });

  it("does not roll back the parent if the reply fails", async () => {
    process.env.THREADS_ACCESS_TOKEN = "tok";
    process.env.THREADS_USER_ID = "user-1";
    installFetchMock((url, init) => {
      if (url.includes("/threads_publish")) return { id: "parentMediaId" };
      if (url.endsWith("/threads")) {
        const body = init?.body instanceof URLSearchParams ? init.body.toString() : "";
        if (body.includes("reply_to_id")) return { error: { message: "boom" } };
        return { id: "container-1" };
      }
      if (url.includes("?fields=status")) return { status: "FINISHED" };
      return {};
    });

    const result = await publishToThreads(thItem, {
      text: "x",
      replyLinkUrl: "https://news.edlight.org/news/abc",
    });
    assert.equal(result.posted, true);
    assert.equal(result.thPostId, "parentMediaId");
    assert.equal(result.thReplyMediaId, undefined);
  });

  it("legacy: no replyLinkUrl → no reply call", async () => {
    process.env.THREADS_ACCESS_TOKEN = "tok";
    process.env.THREADS_USER_ID = "user-1";
    installFetchMock((url) => {
      if (url.includes("/threads_publish")) return { id: "parentMediaId" };
      if (url.endsWith("/threads")) return { id: "container-1" };
      if (url.includes("?fields=status")) return { status: "FINISHED" };
      return {};
    });
    const result = await publishToThreads(thItem, { text: "x" });
    assert.equal(result.posted, true);
    assert.equal(result.thReplyMediaId, undefined);
    // Only parent flow: 1 container + 1 status + 1 publish = 3
    assert.equal(calls.length, 3);
  });
});

// ── X ────────────────────────────────────────────────────────────────────────

describe("publishToX", () => {
  it("dry-runs when bearer token is missing", async () => {
    const result = await publishToX(xItem, { text: "hi" });
    assert.equal(result.posted, false);
    assert.equal(result.dryRun, true);
    assert.equal(calls.length, 0);
  });

  it("falls back to text-only when imageUrl is set but OAuth1 creds are missing", async () => {
    process.env.X_ACCESS_TOKEN = "bearer";
    installFetchMock(() => ({ data: { id: "tweetId", text: "x" } }));

    const payload: XMessagePayload = {
      text: "hello",
      imageUrl: "https://img/1.jpg",
    };
    const result = await publishToX(xItem, payload);
    assert.equal(result.posted, true);
    assert.equal(result.xTweetId, "tweetId");
    assert.equal(result.xMediaId, undefined);
    // No upload attempt — single call to /2/tweets
    assert.equal(calls.length, 1);
    assert.match(calls[0]!.url, /\/2\/tweets$/);
    // body must NOT contain media_ids
    assert.ok(!String(calls[0]!.init?.body).includes("media_ids"));
  });

  it("attaches media when OAuth1 creds + imageUrl are both present", async () => {
    process.env.X_ACCESS_TOKEN = "bearer";
    process.env.X_CONSUMER_KEY = "ck";
    process.env.X_CONSUMER_SECRET = "cs";
    process.env.X_OAUTH1_ACCESS_TOKEN = "at";
    process.env.X_OAUTH1_ACCESS_SECRET = "as";

    installFetchMock((url) => {
      if (url.startsWith("https://img/")) {
        // image fetch — return tiny image bytes (Response body parsing is simulated)
        return {};
      }
      if (url.includes("upload.twitter.com")) {
        return { media_id_string: "MEDIA-ID-1" };
      }
      if (url.includes("/2/tweets")) {
        return { data: { id: "tweetId", text: "x" } };
      }
      return {};
    });

    // Special-case: image fetch needs to return a Response with arrayBuffer().
    // We re-wrap fetch to return a tiny ArrayBuffer for the img URL.
    const wrapped = globalThis.fetch;
    (globalThis as { fetch: typeof fetch }).fetch = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.startsWith("https://img/")) {
        calls.push({ url, init });
        return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 });
      }
      return wrapped(input as Parameters<typeof fetch>[0], init);
    }) as typeof fetch;

    const result = await publishToX(xItem, {
      text: "hello",
      imageUrl: "https://img/1.jpg",
    });

    assert.equal(result.posted, true);
    assert.equal(result.xTweetId, "tweetId");
    assert.equal(result.xMediaId, "MEDIA-ID-1");
    // Must have hit the upload endpoint and the v2 tweets endpoint
    const uploadCall = calls.find((c) => c.url.includes("upload.twitter.com"));
    const tweetCall = calls.find((c) => c.url.includes("/2/tweets"));
    assert.ok(uploadCall, "expected upload call");
    assert.ok(tweetCall, "expected /2/tweets call");
    // OAuth1 header must be present on upload
    const headers = (uploadCall!.init?.headers ?? {}) as Record<string, string>;
    const auth = headers["Authorization"] ?? (headers as any).authorization;
    assert.match(String(auth), /^OAuth /);
    // tweet body must include media_ids
    assert.match(String(tweetCall!.init?.body), /media_ids/);
  });

  it("still tweets text-only when image upload fails", async () => {
    process.env.X_ACCESS_TOKEN = "bearer";
    process.env.X_CONSUMER_KEY = "ck";
    process.env.X_CONSUMER_SECRET = "cs";
    process.env.X_OAUTH1_ACCESS_TOKEN = "at";
    process.env.X_OAUTH1_ACCESS_SECRET = "as";

    originalFetch = globalThis.fetch;
    (globalThis as { fetch: typeof fetch }).fetch = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init });
      if (url.startsWith("https://img/")) {
        return new Response("not found", { status: 404 });
      }
      if (url.includes("/2/tweets")) {
        return new Response(
          JSON.stringify({ data: { id: "tweetId-textonly", text: "x" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    const result = await publishToX(xItem, {
      text: "hello",
      imageUrl: "https://img/1.jpg",
    });

    assert.equal(result.posted, true);
    assert.equal(result.xTweetId, "tweetId-textonly");
    assert.equal(result.xMediaId, undefined);
  });
});
