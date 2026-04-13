import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { IGStoryQueueItem, IGStoryPayload } from "@edlight-news/types";
import { processIgStory, processIgStoryDeps } from "./processIgStory.js";

function makePayload(overrides: Partial<IGStoryPayload> = {}): IGStoryPayload {
  return {
    dateLabel: "17 mars 2026",
    slides: [
      {
        heading: "Résumé du jour",
        bullets: ["Aucune actualité aujourd'hui"],
        frameType: "cover",
      },
    ],
    ...overrides,
  };
}

function makeStoryItem(overrides: Partial<IGStoryQueueItem> = {}): IGStoryQueueItem {
  return {
    id: "story-queue-item",
    dateKey: "2026-03-17",
    status: "queued",
    sourceItemIds: [],
    payload: makePayload(),
    createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    updatedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
    ...overrides,
  };
}

const originalDeps = { ...processIgStoryDeps };

/** Stub listPostedAndScheduledToday so staples gate passes by default. */
function stubStaplesPosted() {
  processIgStoryDeps.listPostedAndScheduledToday = async () => [
    { id: "t1", igType: "taux", status: "posted", targetPostDate: undefined },
    { id: "h1", igType: "histoire", status: "posted", targetPostDate: undefined },
    { id: "u1", igType: "utility", status: "posted", targetPostDate: undefined },
  ] as any;
}

afterEach(() => {
  Object.assign(processIgStoryDeps, originalDeps);
});

describe("processIgStory", () => {
  it("waits for staple posts before processing any stories", async () => {
    // taux posted, histoire only scheduled, utility absent but in queue
    processIgStoryDeps.listPostedAndScheduledToday = async () => [
      { id: "t1", igType: "taux", status: "posted", targetPostDate: undefined },
      { id: "h1", igType: "histoire", status: "scheduled", targetPostDate: undefined },
      { id: "u1", igType: "utility", status: "scheduled", targetPostDate: undefined },
    ] as any;

    let listQueuedCalled = false;
    processIgStoryDeps.listQueuedStories = async () => {
      listQueuedCalled = true;
      return [];
    };

    const result = await processIgStory();

    assert.equal(listQueuedCalled, false, "Should not fetch stories while staples are pending");
    assert.equal(result.processed, 0);
    assert.ok(result.waitingForStaples);
    assert.ok(result.waitingForStaples!.includes("histoire"));
    assert.ok(result.waitingForStaples!.includes("utility"));
  });

  it("does NOT block on staples absent from today's queue (weekend/missing)", async () => {
    // Weekend scenario: only utility is queued+posted; taux and histoire
    // were never generated today → gate should NOT block.
    processIgStoryDeps.listPostedAndScheduledToday = async () => [
      { id: "u1", igType: "utility", status: "posted", targetPostDate: undefined },
    ] as any;

    processIgStoryDeps.listQueuedStories = async () => [];

    const result = await processIgStory();

    // Gate passes — processed 0 because queue is empty, but NOT waiting
    assert.equal(result.waitingForStaples, undefined);
  });

  it("fails story items that do not pass preflight before rendering any frames", async () => {
    stubStaplesPosted();

    const updates: Array<{
      id: string;
      status: IGStoryQueueItem["status"];
      data?: Record<string, unknown>;
    }> = [];
    let renderCalled = false;
    let publishCalled = false;

    processIgStoryDeps.listQueuedStories = async () => [makeStoryItem()];
    processIgStoryDeps.updateStoryStatus = async (id, status, data) => {
      updates.push({ id, status, data });
    };
    processIgStoryDeps.generateStoryAssets = async () => {
      renderCalled = true;
      throw new Error("generateStoryAssets should not run for invalid stories");
    };
    processIgStoryDeps.uploadStorySlide = async () => "https://example.com/story.png";
    processIgStoryDeps.publishIgStory = async () => {
      publishCalled = true;
      return { posted: true, igMediaId: "ig-story-1" } as any;
    };
    processIgStoryDeps.sleep = async () => undefined;

    const result = await processIgStory();

    assert.equal(result.processed, 1);
    assert.equal(result.posted, 0);
    assert.equal(result.errors, 1);
    assert.equal(renderCalled, false);
    assert.equal(publishCalled, false);
    assert.deepEqual(
      updates.map((update) => update.status),
      ["failed"],
    );
    assert.match(
      String(updates[0]?.data?.error ?? ""),
      /Story validation failed/i,
    );
  });
});
