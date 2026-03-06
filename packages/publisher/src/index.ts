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
    const authHeader = `Bearer ${accessToken}`;

    /** POST helper – uses URLSearchParams (form-encoded) as required by the
     *  Instagram Graph API (JSON body causes "Cannot parse access token"). */
    async function igPost(
      url: string,
      params: Record<string, string>,
    ): Promise<{ id?: string; error?: { message: string } }> {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: authHeader },
        body: new URLSearchParams(params),
      });
      return (await res.json()) as { id?: string; error?: { message: string } };
    }

    /** GET helper for checking container status. */
    async function igGet(
      url: string,
    ): Promise<{ status_code?: string; id?: string; error?: { message: string } }> {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: authHeader },
      });
      return (await res.json()) as any;
    }

    /** Poll until a media container is FINISHED (ready to publish).
     *  IG recommends polling once per minute for up to 5 minutes. */
    async function waitForContainer(containerId: string, label = ""): Promise<void> {
      const apiBase = `https://${apiHost}/v21.0`;
      for (let attempt = 0; attempt < 10; attempt++) {
        const status = await igGet(`${apiBase}/${containerId}?fields=status_code`);
        const code = status.status_code ?? "UNKNOWN";
        console.log(`[publisher] Container ${label}${containerId}: ${code} (attempt ${attempt + 1})`);
        if (code === "FINISHED") return;
        if (code === "ERROR" || code === "EXPIRED") {
          throw new Error(`Container ${containerId} status: ${code}`);
        }
        // Wait 5 seconds between polls
        await new Promise((r) => setTimeout(r, 5000));
      }
      throw new Error(`Container ${containerId} did not become FINISHED in time`);
    }

    // Carousel requires ≥ 2 images. If only 1, publish as single image post.
    let creationId: string;

    if (slidePaths.length === 1) {
      // Single image post
      const data = await igPost(`${baseUrl}/media`, {
        image_url: slidePaths[0]!,
        caption: payload.caption,
      });
      if (data.error) throw new Error(`IG API error (single): ${data.error.message}`);
      creationId = data.id!;
      console.log(`[publisher] Single image container created: ${creationId}`);

      // Wait for single image container to be ready
      await waitForContainer(creationId, "single ");
    } else {
      // Step 1: Create carousel container items (one per slide image)
      const containerIds: string[] = [];
      for (let i = 0; i < slidePaths.length; i++) {
        const data = await igPost(`${baseUrl}/media`, {
          image_url: slidePaths[i]!,
          is_carousel_item: "true",
        });
        if (data.error) throw new Error(`IG API error: ${data.error.message}`);
        if (data.id) containerIds.push(data.id);
        console.log(`[publisher] Carousel item ${i + 1}/${slidePaths.length} created: ${data.id}`);
      }

      // Wait for each child container to finish processing
      for (let i = 0; i < containerIds.length; i++) {
        await waitForContainer(containerIds[i]!, `slide ${i + 1} `);
      }

      // Step 2: Create carousel container
      const carouselData = await igPost(`${baseUrl}/media`, {
        media_type: "CAROUSEL",
        children: containerIds.join(","),
        caption: payload.caption,
      });
      if (carouselData.error) throw new Error(`IG API error: ${carouselData.error.message}`);
      creationId = carouselData.id!;
      console.log(`[publisher] Carousel container created: ${creationId}`);

      // Wait for carousel container to finish
      await waitForContainer(creationId, "carousel ");
    }

    // Publish (works for both single image and carousel)
    const publishData = await igPost(`${baseUrl}/media_publish`, {
      creation_id: creationId,
    });
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
