/**
 * @edlight-news/publisher
 *
 * Publishes content to:
 *  1. Instagram (via Graph API — or dry-run mode)
 *
 * Processes entries from the publish_queue collection.
 */

import type { PublishQueueEntry, IGQueueItem, IGFormattedPayload, WaQueueItem, WaMessagePayload } from "@edlight-news/types";
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

    if (publishData.id) {
      console.log(`[publisher] IG post published: ${publishData.id}`);
      return {
        posted: true,
        igPostId: publishData.id,
        dryRun: false,
      };
    }

    // Instagram sometimes returns "Application request limit reached" but still
    // publishes the post. Wait and check the media list before giving up.
    if (publishData.error?.message?.includes("request limit")) {
      console.warn(`[publisher] Rate-limit response — checking if post appeared anyway...`);
      await new Promise((r) => setTimeout(r, 20_000));

      const checkRes = await fetch(
        `https://${apiHost}/v21.0/${creds.igUserId}/media?fields=id,timestamp&limit=1`,
        { headers: { Authorization: authHeader } },
      );
      const checkData = (await checkRes.json()) as { data?: { id: string; timestamp: string }[] };
      const newest = checkData.data?.[0];
      if (newest) {
        const age = Date.now() - new Date(newest.timestamp).getTime();
        if (age < 120_000) {
          console.log(`[publisher] Post appeared on IG despite rate-limit error: ${newest.id}`);
          return { posted: true, igPostId: newest.id, dryRun: false };
        }
      }
    }

    throw new Error(`IG API error: ${publishData.error?.message ?? "unknown"}`);
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

// ── Delete IG media ─────────────────────────────────────────────────────────

export interface IGDeleteResult {
  deleted: boolean;
  igMediaId: string;
  error?: string;
}

/**
 * Delete a published Instagram post (or story) via the Graph API.
 *
 * Requires: IG_ACCESS_TOKEN with `instagram_content_publish` permission.
 *
 *   DELETE /{ig-media-id}
 *
 * Works on both graph.instagram.com and graph.facebook.com.
 */
export async function deleteIgPost(igMediaId: string): Promise<IGDeleteResult> {
  const creds = getIGCredentials();
  if (!creds) {
    return { deleted: false, igMediaId, error: "IG credentials not configured" };
  }

  const { accessToken } = creds;
  const apiHost = process.env.IG_API_HOST ?? "graph.instagram.com";

  try {
    const res = await fetch(
      `https://${apiHost}/v21.0/${igMediaId}?access_token=${accessToken}`,
      { method: "DELETE" },
    );
    const body = (await res.json()) as { success?: boolean; error?: { message: string } };

    if (body.success) {
      console.log(`[publisher] IG media deleted: ${igMediaId}`);
      return { deleted: true, igMediaId };
    }

    const errMsg = body.error?.message ?? `HTTP ${res.status}`;
    console.error(`[publisher] IG delete failed for ${igMediaId}: ${errMsg}`);
    return { deleted: false, igMediaId, error: errMsg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[publisher] IG delete error for ${igMediaId}: ${msg}`);
    return { deleted: false, igMediaId, error: msg };
  }
}

// ── Legacy API (kept for backwards compat) ──────────────────────────────────

export async function publishToInstagram(
  _entry: PublishQueueEntry,
): Promise<void> {
  // Legacy — use publishIgPost() for the new IG pipeline
  throw new Error("publishToInstagram: use publishIgPost() instead");
}

// ── IG Stories API ──────────────────────────────────────────────────────────

export interface IGStoryPublishResult {
  posted: boolean;
  igMediaId?: string;
  dryRun: boolean;
  dryRunPath?: string;
  error?: string;
}

/**
 * Publish a single image as an Instagram Story via Graph API.
 *
 * The IG Graph API processes Stories via the same two-step flow:
 *   1. POST /media  with media_type=STORIES + image_url
 *   2. POST /media_publish  with creation_id
 *
 * Stories support only a single image per API call (no carousel).
 * For multi-frame stories, call this function once per frame.
 *
 * Falls back to dry-run if credentials are not configured.
 */
export async function publishIgStory(
  imageUrl: string,
  storyId: string,
): Promise<IGStoryPublishResult> {
  const creds = getIGCredentials();

  if (!creds) {
    const exportDir = `/tmp/ig_stories/${storyId}`;
    console.log(`[publisher] IG Story dry-run: ${storyId} → ${imageUrl}`);
    return { posted: false, dryRun: true, dryRunPath: exportDir };
  }

  try {
    const { accessToken, igUserId } = creds;
    const apiHost = process.env.IG_API_HOST ?? "graph.instagram.com";
    const baseUrl = `https://${apiHost}/v21.0/${igUserId}`;
    const authHeader = `Bearer ${accessToken}`;

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

    async function igGet(
      url: string,
    ): Promise<{ status_code?: string; id?: string; error?: { message: string } }> {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: authHeader },
      });
      return (await res.json()) as any;
    }

    async function waitForContainer(containerId: string): Promise<void> {
      const apiBase = `https://${apiHost}/v21.0`;
      for (let attempt = 0; attempt < 10; attempt++) {
        const status = await igGet(`${apiBase}/${containerId}?fields=status_code`);
        const code = status.status_code ?? "UNKNOWN";
        console.log(`[publisher] Story container ${containerId}: ${code} (attempt ${attempt + 1})`);
        if (code === "FINISHED") return;
        if (code === "ERROR" || code === "EXPIRED") {
          throw new Error(`Story container ${containerId} status: ${code}`);
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
      throw new Error(`Story container ${containerId} did not become FINISHED in time`);
    }

    // Step 1: Create Story media container
    const data = await igPost(`${baseUrl}/media`, {
      media_type: "STORIES",
      image_url: imageUrl,
    });
    if (data.error) throw new Error(`IG Story API error: ${data.error.message}`);
    const containerId = data.id!;
    console.log(`[publisher] Story container created: ${containerId}`);

    // Wait for container to finish processing
    await waitForContainer(containerId);

    // Step 2: Publish
    const publishData = await igPost(`${baseUrl}/media_publish`, {
      creation_id: containerId,
    });
    if (publishData.error) throw new Error(`IG Story publish error: ${publishData.error.message}`);

    console.log(`[publisher] IG Story published: ${publishData.id}`);
    return { posted: true, igMediaId: publishData.id, dryRun: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[publisher] IG Story publish failed: ${msg}`);
    return { posted: false, dryRun: false, error: msg };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── WhatsApp Business API publishing ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function getWACredentials(): { accessToken: string; phoneNumberId: string } | null {
  const accessToken = process.env.WA_ACCESS_TOKEN ?? process.env.IG_ACCESS_TOKEN;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) return null;
  return { accessToken, phoneNumberId };
}

export interface WAPublishResult {
  sent: boolean;
  waMessageId?: string;
  dryRun: boolean;
  error?: string;
}

/**
 * Send a message to a WhatsApp Channel via the WhatsApp Business API.
 *
 * Uses the Meta Graph API (same infrastructure as IG):
 *   POST /{phone-number-id}/messages
 *
 * Supports two modes:
 *   1. Text-only: sends a plain text message
 *   2. Image + caption: sends an image message with caption text
 *
 * Falls back to dry-run if WA_PHONE_NUMBER_ID is not set.
 *
 * Environment variables:
 *   - WA_ACCESS_TOKEN (falls back to IG_ACCESS_TOKEN — same Meta Business token)
 *   - WA_PHONE_NUMBER_ID — the WhatsApp Business phone number ID
 *   - WA_CHANNEL_ID — the WhatsApp Channel ID to post updates to
 *   - WA_API_HOST — defaults to graph.facebook.com
 */
export async function publishToWhatsApp(
  queueItem: WaQueueItem,
  payload: WaMessagePayload,
): Promise<WAPublishResult> {
  const creds = getWACredentials();

  if (!creds) {
    // Dry-run mode
    console.log(`[publisher] WA dry-run: ${queueItem.id} — "${payload.text.slice(0, 80)}…"`);
    return { sent: false, dryRun: true };
  }

  try {
    const { accessToken, phoneNumberId } = creds;
    const apiHost = process.env.WA_API_HOST ?? "graph.facebook.com";
    const apiVersion = "v21.0";
    const url = `https://${apiHost}/${apiVersion}/${phoneNumberId}/messages`;

    // WhatsApp Channel updates use the "newsletter" messaging type.
    // If WA_CHANNEL_ID is set, we post to the channel; otherwise we send
    // to a regular recipient (for testing).
    const channelId = process.env.WA_CHANNEL_ID;

    let body: Record<string, unknown>;

    if (payload.imageUrl) {
      // Image message with caption
      body = {
        messaging_product: "whatsapp",
        ...(channelId ? { to: channelId } : {}),
        type: "image",
        image: {
          link: payload.imageUrl,
          caption: payload.text,
        },
      };
    } else {
      // Text-only message
      body = {
        messaging_product: "whatsapp",
        ...(channelId ? { to: channelId } : {}),
        type: "text",
        text: {
          body: payload.text,
          preview_url: !!payload.linkUrl,
        },
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string; code: number };
    };

    if (data.error) {
      throw new Error(`WA API error (${data.error.code}): ${data.error.message}`);
    }

    const messageId = data.messages?.[0]?.id;
    if (messageId) {
      console.log(`[publisher] WA message sent: ${messageId}`);
      return { sent: true, waMessageId: messageId, dryRun: false };
    }

    throw new Error("WA API returned no message ID and no error");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[publisher] WA publish failed: ${msg}`);
    return { sent: false, dryRun: false, error: msg };
  }
}
