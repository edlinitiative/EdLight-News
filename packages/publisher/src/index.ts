/**
 * @edlight-news/publisher
 *
 * Publishes content to:
 *  1. Instagram (via Graph API — or dry-run mode)
 *  2. WhatsApp (via Cloud API — placeholder)
 *
 * Processes entries from the publish_queue collection.
 */

import type { PublishQueueEntry, IGQueueItem, IGFormattedPayload } from "@edlight-news/types";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ── IG Graph API configuration ──────────────────────────────────────────────

function getIGCredentials(): { accessToken: string; igUserId: string } | null {
  const accessToken = process.env.IG_ACCESS_TOKEN;
  const igUserId = process.env.IG_USER_ID;
  if (!accessToken || !igUserId) return null;
  return { accessToken, igUserId };
}

export interface IGPublishResult {
  posted: boolean;
  igPostId?: string;
  dryRun: boolean;
  dryRunPath?: string;
  error?: string;
}

/**
 * Publish carousel to Instagram via Graph API.
 * Falls back to dry-run mode if credentials are not configured.
 */
export async function publishIgPost(
  queueItem: IGQueueItem,
  payload: IGFormattedPayload,
  slidePaths: string[],
): Promise<IGPublishResult> {
  const creds = getIGCredentials();

  if (!creds) {
    // Dry-run mode: save payload for manual posting
    const exportDir = `/tmp/ig_exports/${queueItem.id}`;
    mkdirSync(exportDir, { recursive: true });

    const manifestPath = join(exportDir, "publish_manifest.json");
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          queueItemId: queueItem.id,
          igType: queueItem.igType,
          score: queueItem.score,
          caption: payload.caption,
          slidesCount: payload.slides.length,
          slidePaths,
          status: "ready_for_manual_posting",
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf-8",
    );

    console.log(`[publisher] IG dry-run: saved manifest to ${manifestPath}`);
    return {
      posted: false,
      dryRun: true,
      dryRunPath: exportDir,
    };
  }

  // ── Real IG Graph API publishing ────────────────────────────────────────
  // Supports both token types:
  //   • Instagram Login tokens → graph.instagram.com
  //   • Facebook Login tokens  → graph.facebook.com
  // Detect based on IG_API_HOST env var (defaults to graph.instagram.com).
  try {
    const { accessToken, igUserId } = creds;
    const apiHost = process.env.IG_API_HOST ?? "graph.instagram.com";
    const baseUrl = `https://${apiHost}/v21.0/${igUserId}`;

    // Step 1: Create carousel container items (one per slide image)
    const containerIds: string[] = [];
    for (const imagePath of slidePaths) {
      // In production, images should be hosted at public URLs.
      // For now, we assume slidePaths are public URLs if API creds exist.
      const res = await fetch(`${baseUrl}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imagePath,
          is_carousel_item: true,
          access_token: accessToken,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: { message: string } };
      if (data.error) throw new Error(`IG API error: ${data.error.message}`);
      if (data.id) containerIds.push(data.id);
    }

    // Step 2: Create carousel container
    const carouselRes = await fetch(`${baseUrl}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "CAROUSEL",
        children: containerIds.join(","),
        caption: payload.caption,
        access_token: accessToken,
      }),
    });
    const carouselData = (await carouselRes.json()) as { id?: string; error?: { message: string } };
    if (carouselData.error) throw new Error(`IG API error: ${carouselData.error.message}`);

    // Step 3: Publish the carousel
    const publishRes = await fetch(`${baseUrl}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: carouselData.id,
        access_token: accessToken,
      }),
    });
    const publishData = (await publishRes.json()) as { id?: string; error?: { message: string } };
    if (publishData.error) throw new Error(`IG API error: ${publishData.error.message}`);

    console.log(`[publisher] IG post published: ${publishData.id}`);
    return {
      posted: true,
      igPostId: publishData.id,
      dryRun: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[publisher] IG publish failed: ${msg}`);
    return {
      posted: false,
      dryRun: false,
      error: msg,
    };
  }
}

// ── Legacy API (kept for backwards compat) ──────────────────────────────────

export async function publishToInstagram(
  _entry: PublishQueueEntry,
): Promise<void> {
  // Legacy — use publishIgPost() for the new IG pipeline
  throw new Error("publishToInstagram: use publishIgPost() instead");
}

export async function publishToWhatsApp(
  _entry: PublishQueueEntry,
): Promise<void> {
  // TODO: implement WhatsApp Cloud API publishing
  throw new Error("publishToWhatsApp not yet implemented");
}
