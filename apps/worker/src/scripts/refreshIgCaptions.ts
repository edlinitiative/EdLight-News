import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import {
  getDb,
  igQueueRepo,
  itemsRepo,
  contentVersionsRepo,
  uploadCarouselSlides,
} from "@edlight-news/firebase";
import { formatForIG } from "@edlight-news/generator/ig/formatters/index.js";
import type { BilingualText } from "@edlight-news/generator/ig/index.js";
import { generateCarouselAssets } from "@edlight-news/renderer/ig-carousel.js";
import { publishIgPost } from "@edlight-news/publisher";
import type { IGQueueItem, IGQueueStatus, IGPostType, Item, IGFormattedPayload } from "@edlight-news/types";
import { generateContextualImage } from "../services/geminiImageGen.js";

const ACTIVE_STATUSES: IGQueueStatus[] = [
  "queued",
  "scheduled",
  "rendering",
  "scheduled_ready_for_manual",
];
const ALL_STATUSES: IGQueueStatus[] = [...ACTIVE_STATUSES, "posted"];
const IG_ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_API_HOST = process.env.IG_API_HOST
  ?? ((IG_ACCESS_TOKEN ?? "").startsWith("IGAA") ? "graph.instagram.com" : "graph.facebook.com");

if (!process.env.IG_API_HOST) {
  process.env.IG_API_HOST = IG_API_HOST;
}

interface Options {
  statuses: IGQueueStatus[];
  limit: number;
  postedLimit: number;
  sinceDays: number;
  republishPosted: boolean;
  dryRun: boolean;
}

interface RefreshOutcome {
  id: string;
  status: IGQueueStatus;
  changed: boolean;
  republished: boolean;
  skipped: boolean;
  liveMismatch?: boolean;
  manualReplacementId?: string;
  error?: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    statuses: [...ACTIVE_STATUSES],
    limit: 100,
    postedLimit: 10,
    sinceDays: 3,
    republishPosted: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const next = args[i + 1];

    if (arg === "--republish-posted") options.republishPosted = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg.startsWith("--limit=")) options.limit = Number(arg.split("=")[1]);
    else if (arg === "--limit" && next) options.limit = Number(args[++i]);
    else if (arg.startsWith("--posted-limit=")) options.postedLimit = Number(arg.split("=")[1]);
    else if (arg === "--posted-limit" && next) options.postedLimit = Number(args[++i]);
    else if (arg.startsWith("--since-days=")) options.sinceDays = Number(arg.split("=")[1]);
    else if (arg === "--since-days" && next) options.sinceDays = Number(args[++i]);
    else if (arg.startsWith("--statuses=")) {
      options.statuses = parseStatuses(arg.split("=")[1] ?? "");
    } else if (arg === "--statuses" && next) {
      options.statuses = parseStatuses(args[++i] ?? "");
    }
  }

  if (options.republishPosted && !options.statuses.includes("posted")) {
    options.statuses.push("posted");
  }

  if (!Number.isFinite(options.limit) || options.limit <= 0) options.limit = 100;
  if (!Number.isFinite(options.postedLimit) || options.postedLimit <= 0) options.postedLimit = 10;
  if (!Number.isFinite(options.sinceDays) || options.sinceDays <= 0) options.sinceDays = 3;

  return options;
}

function parseStatuses(value: string): IGQueueStatus[] {
  const statuses = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as IGQueueStatus[];

  const invalid = statuses.filter((status) => !ALL_STATUSES.includes(status));
  if (invalid.length > 0) {
    throw new Error(`Invalid statuses: ${invalid.join(", ")}`);
  }

  return statuses.length > 0 ? statuses : [...ACTIVE_STATUSES];
}

async function getBilingualText(itemId: string): Promise<BilingualText | undefined> {
  try {
    const versions = await contentVersionsRepo.listByItemId(itemId);
    const fr = versions.find((v) => v.language === "fr");
    const ht = versions.find((v) => v.language === "ht");
    if (!fr) return undefined;

    return {
      frTitle: fr.title,
      frSummary: fr.summary,
      htTitle: ht?.title,
      htSummary: ht?.summary,
      frSections: fr.sections as { heading: string; content: string }[] | undefined,
      frBody: fr.body || undefined,
    };
  } catch {
    return undefined;
  }
}

async function collectQueueItems(options: Options): Promise<IGQueueItem[]> {
  const results: IGQueueItem[] = [];

  for (const status of options.statuses) {
    if (status === "posted") {
      const posted = await igQueueRepo.listRecentPosted(options.sinceDays, options.postedLimit);
      results.push(...posted);
      continue;
    }

    const items = await igQueueRepo.listByStatus(status, options.limit);
    results.push(...items);
  }

  const deduped = new Map<string, IGQueueItem>();
  for (const item of results) {
    if (!deduped.has(item.id)) deduped.set(item.id, item);
  }
  return [...deduped.values()];
}

function captionsDiffer(existing: IGFormattedPayload | undefined, next: IGFormattedPayload): boolean {
  if (!existing) return true;
  return existing.caption.trim() !== next.caption.trim();
}

async function ensureImages(item: Item, payload: IGFormattedPayload, dryRun: boolean): Promise<void> {
  const missing = payload.slides.filter((slide) => !slide.backgroundImage);
  if (missing.length === 0 || dryRun) return;

  const generated = await generateContextualImage(item);
  if (!generated?.url) return;

  for (const slide of missing) {
    slide.backgroundImage = generated.url;
  }
}

async function republishEntry(
  queueItem: IGQueueItem,
  payload: IGFormattedPayload,
  item: Item,
  dryRun: boolean,
): Promise<{ republished: boolean; error?: string; manualReplacementId?: string }> {
  if (!queueItem.igPostId) {
    return { republished: false, error: "Missing igPostId on posted queue item" };
  }

  if (dryRun) {
    return { republished: false };
  }

  const deleted = await deleteExistingIgPost(queueItem.igPostId);
  if (!deleted.deleted) {
    const manualReplacementId = await createOrUpdateManualReplacement(queueItem, payload, item);
    return {
      republished: false,
      error: deleted.error ?? "Failed to delete existing IG post",
      manualReplacementId,
    };
  }

  await igQueueRepo.setPayload(queueItem.id, payload);
  await igQueueRepo.updateStatus(queueItem.id, "rendering");

  await ensureImages(item, payload, dryRun);
  await igQueueRepo.setPayload(queueItem.id, payload);

  const assets = await generateCarouselAssets(queueItem, payload);
  const urls = await uploadCarouselSlides(assets.slidePaths, queueItem.id);
  const publishResult = await publishIgPost(queueItem, payload, urls);

  if (!publishResult.posted || !publishResult.igPostId) {
    await igQueueRepo.updateStatus(queueItem.id, "queued");
    return { republished: false, error: publishResult.error ?? "Publish failed" };
  }

  await igQueueRepo.markPosted(queueItem.id, publishResult.igPostId);
  return { republished: true };
}

async function findManualReplacement(originalQueueItemId: string): Promise<IGQueueItem | null> {
  const snap = await getDb()
    .collection("ig_queue")
    .where("replacementForId", "==", originalQueueItemId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as IGQueueItem;
}

async function createOrUpdateManualReplacement(
  queueItem: IGQueueItem,
  payload: IGFormattedPayload,
  item: Item,
): Promise<string> {
  const existing = await findManualReplacement(queueItem.id);
  const scheduledFor = new Date().toISOString();

  let replacementId = existing?.id;
  if (!replacementId) {
    const created = await igQueueRepo.createIGQueueItem({
      sourceContentId: queueItem.sourceContentId,
      igType: queueItem.igType,
      score: queueItem.score,
      status: "scheduled_ready_for_manual",
      scheduledFor,
      reasons: [
        ...(queueItem.reasons ?? []),
        `Manual repost replacement for posted item ${queueItem.id}`,
      ],
      payload,
    });
    replacementId = created.id;
    await getDb().collection("ig_queue").doc(replacementId).update({
      replacementForId: queueItem.id,
      replacementForIgPostId: queueItem.igPostId,
      scheduledFor,
      updatedAt: new Date(),
    });
  } else {
    await getDb().collection("ig_queue").doc(replacementId).update({
      status: "scheduled_ready_for_manual",
      scheduledFor,
      payload,
      replacementForId: queueItem.id,
      replacementForIgPostId: queueItem.igPostId,
      updatedAt: new Date(),
    });
  }

  const replacementItem = {
    ...queueItem,
    id: replacementId,
    status: "scheduled_ready_for_manual" as IGQueueStatus,
  };

  await ensureImages(item, payload, false);
  const assets = await generateCarouselAssets(replacementItem, payload);
  await uploadCarouselSlides(assets.slidePaths, replacementId);

  return replacementId;
}

async function deleteExistingIgPost(igMediaId: string): Promise<{ deleted: boolean; error?: string }> {
  if (!IG_ACCESS_TOKEN) {
    return { deleted: false, error: "IG credentials not configured" };
  }

  try {
    const response = await fetch(
      `https://${IG_API_HOST}/v21.0/${igMediaId}?access_token=${IG_ACCESS_TOKEN}`,
      { method: "DELETE" },
    );
    const body = (await response.json()) as { success?: boolean; error?: { message?: string } };
    if (body.success) {
      return { deleted: true };
    }

    return {
      deleted: false,
      error: body.error?.message ?? `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      deleted: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function fetchLiveIgCaption(igMediaId: string): Promise<{ caption?: string; error?: string }> {
  if (!IG_ACCESS_TOKEN) {
    return { error: "IG credentials not configured" };
  }

  try {
    const response = await fetch(
      `https://${IG_API_HOST}/v21.0/${igMediaId}?fields=id,caption&access_token=${IG_ACCESS_TOKEN}`,
    );
    const body = (await response.json()) as { caption?: string; error?: { message?: string } };
    if (body.error) {
      return { error: body.error.message ?? `HTTP ${response.status}` };
    }
    return { caption: body.caption ?? "" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function normalizeCaption(text: string | undefined): string {
  return (text ?? "").replace(/\r\n/g, "\n").trim();
}

async function refreshEntry(queueItem: IGQueueItem, options: Options): Promise<RefreshOutcome> {
  const item = await itemsRepo.getItem(queueItem.sourceContentId);
  if (!item) {
    return {
      id: queueItem.id,
      status: queueItem.status,
      changed: false,
      republished: false,
      skipped: true,
      error: "Source item not found",
    };
  }

  const bi = await getBilingualText(item.id);
  const payload = await formatForIG(queueItem.igType as IGPostType, item, bi ? { bi } : undefined);
  const changed = captionsDiffer(queueItem.payload, payload);
  let liveMismatch = false;

  if (queueItem.status === "posted" && options.republishPosted && queueItem.igPostId) {
    const live = await fetchLiveIgCaption(queueItem.igPostId);
    if (!live.error) {
      liveMismatch = normalizeCaption(live.caption) !== normalizeCaption(payload.caption);
    }
  }

  if (options.dryRun) {
    return {
      id: queueItem.id,
      status: queueItem.status,
      changed,
      republished: false,
      skipped: false,
      liveMismatch,
    };
  }

  await igQueueRepo.setPayload(queueItem.id, payload);

  if (queueItem.status === "rendering") {
    await igQueueRepo.updateStatus(queueItem.id, "queued", { refreshReason: "caption-refresh" });
  }

  if (queueItem.status === "posted" && options.republishPosted && (changed || liveMismatch)) {
    const result = await republishEntry(queueItem, payload, item, options.dryRun);
    return {
      id: queueItem.id,
      status: queueItem.status,
      changed,
      republished: result.republished,
      skipped: false,
      liveMismatch,
      manualReplacementId: result.manualReplacementId,
      error: result.error,
    };
  }

  return {
    id: queueItem.id,
    status: queueItem.status,
    changed,
    republished: false,
    skipped: false,
    liveMismatch,
  };
}

async function main() {
  const options = parseArgs();
  console.log("\n=== Refresh IG captions ===");
  console.log(`Statuses: ${options.statuses.join(", ")}`);
  console.log(`Limit per active status: ${options.limit}`);
  console.log(`Recent posted window: ${options.sinceDays} day(s), limit ${options.postedLimit}`);
  console.log(`Republish posted: ${options.republishPosted ? "yes" : "no"}`);
  console.log(`Mode: ${options.dryRun ? "DRY RUN" : "LIVE"}\n`);

  const entries = await collectQueueItems(options);
  console.log(`Found ${entries.length} queue item(s) to process.\n`);

  const outcomes: RefreshOutcome[] = [];
  for (const [index, entry] of entries.entries()) {
    console.log(`[${index + 1}/${entries.length}] ${entry.id}  ${entry.igType}  status=${entry.status}`);
    try {
      const outcome = await refreshEntry(entry, options);
      outcomes.push(outcome);
      if (outcome.error) {
        console.log(`  ⚠ ${outcome.error}`);
        if (outcome.manualReplacementId) {
          console.log(`  ↳ Manual repost prepared: ${outcome.manualReplacementId}`);
        }
      } else if (outcome.republished) {
        console.log("  ✓ Refreshed and republished");
      } else if (outcome.liveMismatch) {
        console.log("  ✓ Live post caption differs and is ready to be republished");
      } else if (outcome.changed) {
        console.log("  ✓ Refreshed payload");
      } else {
        console.log("  ✓ No caption diff, payload re-saved");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcomes.push({
        id: entry.id,
        status: entry.status,
        changed: false,
        republished: false,
        skipped: false,
        error: message,
      });
      console.log(`  ✗ ${message}`);
    }
    console.log("");
  }

  const changed = outcomes.filter((o) => o.changed).length;
  const republished = outcomes.filter((o) => o.republished).length;
  const failed = outcomes.filter((o) => o.error).length;
  const skipped = outcomes.filter((o) => o.skipped).length;

  console.log("=== Summary ===");
  console.log(`Processed:   ${outcomes.length}`);
  console.log(`Changed:     ${changed}`);
  console.log(`Republished: ${republished}`);
  console.log(`Skipped:     ${skipped}`);
  console.log(`Failed:      ${failed}`);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
