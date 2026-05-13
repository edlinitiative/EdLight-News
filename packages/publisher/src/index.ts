/**
 * @edlight-news/publisher
 *
 * Publishes content to:
 *  1. Instagram (via Graph API — or dry-run mode)
 *
 * Processes entries from the publish_queue collection.
 */

import type { PublishQueueEntry, IGQueueItem, IGFormattedPayload, WaQueueItem, WaMessagePayload, FbQueueItem, FbMessagePayload, ThQueueItem, ThMessagePayload, XQueueItem, XMessagePayload } from "@edlight-news/types";
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
      // NOTE: media_type=IMAGE is required for carousel children in the Instagram
      // Graph API — omitting it causes "Only photo or video can be accepted as
      // media type" (even when image_url is provided).
      const containerIds: string[] = [];
      for (let i = 0; i < slidePaths.length; i++) {
        const data = await igPost(`${baseUrl}/media`, {
          image_url: slidePaths[i]!,
          media_type: "IMAGE",
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
  /**
   * Per-feature outcome of attempted sticker overlays (rollout PR Task 3).
   * Empty when no `features` argument was passed. The publisher records
   * one entry per attempted sticker (link / poll) so the worker can
   * persist them to the queue item for the Story Stickers dashboard panel.
   */
  stickerAttempts?: Array<{
    feature: "linkSticker" | "poll";
    status: "attached" | "skipped";
    reason?: string;
  }>;
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
  features?: {
    linkUrl?: string;
    pollQuestion?: string;
    pollOptions?: string[];
    ctaText?: string;
  },
): Promise<IGStoryPublishResult> {
  const creds = getIGCredentials();

  if (!creds) {
    const exportDir = `/tmp/ig_stories/${storyId}`;
    console.log(
      `[publisher] IG Story dry-run: ${storyId} → ${imageUrl}` +
        (features ? ` (features=${Object.keys(features).join(",")})` : ""),
    );
    // In dry-run we report stickers as "attached" so the dashboard can
    // distinguish "never tried" from "tried + would have worked".
    const stickerAttempts = buildDryRunStickerAttempts(features);
    return { posted: false, dryRun: true, dryRunPath: exportDir, stickerAttempts };
  }

  // Hoisted so the catch block can return a partial attempts list when
  // an error occurs after we already tried (or skipped) the sticker step.
  const stickerAttempts: NonNullable<IGStoryPublishResult["stickerAttempts"]> = [];

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

    // Step 1: Create Story media container.
    // Sticker overlays are best-effort: we attempt with stickers first; if
    // the API rejects (e.g. parameter not supported on this account), we
    // log `igStoryFeatureSkipped` and retry without stickers so the story
    // still goes out. We also record one entry per attempted sticker so
    // the rollout dashboard can flag silent collapses (Task 3).
    async function createContainerWithFeatures(): Promise<string> {
      const baseParams: Record<string, string> = {
        media_type: "STORIES",
        image_url: imageUrl,
      };
      if (features) {
        const wantsLink = !!features.linkUrl;
        const wantsPoll =
          !!features.pollQuestion &&
          !!features.pollOptions &&
          features.pollOptions.length >= 2;
        const stickerParams: Record<string, string> = { ...baseParams };
        if (wantsLink) {
          stickerParams.link_sticker = JSON.stringify({
            link: { url: features.linkUrl },
          });
        }
        if (wantsPoll) {
          stickerParams.poll_sticker = JSON.stringify({
            question: features.pollQuestion,
            options: features.pollOptions!.slice(0, 4),
          });
        }
        if (wantsLink || wantsPoll) {
          const withFeatures = await igPost(`${baseUrl}/media`, stickerParams);
          if (!withFeatures.error && withFeatures.id) {
            if (wantsLink) stickerAttempts.push({ feature: "linkSticker", status: "attached" });
            if (wantsPoll) stickerAttempts.push({ feature: "poll", status: "attached" });
            return withFeatures.id;
          }
          const reason = withFeatures.error?.message ?? "unknown";
          console.warn(`[publisher] igStoryFeatureSkipped: ${reason}`);
          if (wantsLink) stickerAttempts.push({ feature: "linkSticker", status: "skipped", reason });
          if (wantsPoll) stickerAttempts.push({ feature: "poll", status: "skipped", reason });
        }
      }
      const plain = await igPost(`${baseUrl}/media`, baseParams);
      if (plain.error) throw new Error(`IG Story API error: ${plain.error.message}`);
      return plain.id!;
    }

    const containerId = await createContainerWithFeatures();
    console.log(`[publisher] Story container created: ${containerId}`);

    // Wait for container to finish processing
    await waitForContainer(containerId);

    // Step 2: Publish
    const publishData = await igPost(`${baseUrl}/media_publish`, {
      creation_id: containerId,
    });
    if (publishData.error) throw new Error(`IG Story publish error: ${publishData.error.message}`);

    console.log(`[publisher] IG Story published: ${publishData.id}`);
    return { posted: true, igMediaId: publishData.id, dryRun: false, stickerAttempts };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[publisher] IG Story publish failed: ${msg}`);
    return { posted: false, dryRun: false, error: msg, stickerAttempts };
  }
}

/** Build the synthetic stickerAttempts array used in dry-run mode. */
function buildDryRunStickerAttempts(
  features?: { linkUrl?: string; pollQuestion?: string; pollOptions?: string[] },
): IGStoryPublishResult["stickerAttempts"] {
  if (!features) return undefined;
  const out: NonNullable<IGStoryPublishResult["stickerAttempts"]> = [];
  if (features.linkUrl) out.push({ feature: "linkSticker", status: "attached" });
  if (features.pollQuestion && features.pollOptions && features.pollOptions.length >= 2) {
    out.push({ feature: "poll", status: "attached" });
  }
  return out.length ? out : undefined;
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

// ══════════════════════════════════════════════════════════════════════════════
// ── Facebook Page publishing (Graph API) ───────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function getFBCredentials(): { accessToken: string; pageId: string } | null {
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FB_PAGE_ID;
  if (!accessToken || !pageId) return null;
  return { accessToken, pageId };
}

export interface FBPublishResult {
  posted: boolean;
  fbPostId?: string;
  /** ID of the auto-comment that contains the article link (P1.1). */
  fbCommentId?: string;
  dryRun: boolean;
  error?: string;
}

/**
 * Publish to a Facebook Page via Graph API.
 *
 * Strategy (controlled by FB_LINK_IN_COMMENT, default ON):
 *   • imageUrl + linkUrl → photo post + auto-comment with the link
 *     (Facebook suppresses link posts; native photo + first-comment link
 *     typically lifts reach 2–4×)
 *   • linkUrl only       → text+link feed post (legacy fallback)
 *   • imageUrl only      → photo post, no comment step
 *   • text only          → plain feed post
 *
 * Falls back to dry-run if FB_PAGE_ACCESS_TOKEN / FB_PAGE_ID are not set.
 */
export async function publishToFacebook(
  queueItem: FbQueueItem,
  payload: FbMessagePayload,
): Promise<FBPublishResult> {
  const creds = getFBCredentials();

  if (!creds) {
    console.log(`[publisher] FB dry-run: ${queueItem.id} — "${payload.text.slice(0, 80)}…"`);
    return { posted: false, dryRun: true };
  }

  // Feature flag: defaults to ON. Set FB_LINK_IN_COMMENT=false to revert
  // to the legacy `/feed` link post behavior.
  const linkInComment = process.env.FB_LINK_IN_COMMENT !== "false";

  const startedAt = Date.now();
  try {
    const { accessToken, pageId } = creds;
    const apiHost = "graph.facebook.com";
    const apiVersion = "v21.0";
    const apiBase = `https://${apiHost}/${apiVersion}`;

    async function fbPost(
      endpoint: string,
      params: Record<string, string>,
    ): Promise<{
      id?: string;
      post_id?: string;
      error?: { message: string; code: number };
    }> {
      const body = new URLSearchParams({ access_token: accessToken, ...params });
      const res = await fetch(endpoint, { method: "POST", body });
      return (await res.json()) as {
        id?: string;
        post_id?: string;
        error?: { message: string; code: number };
      };
    }

    // ── Path A: photo + comment-with-link (preferred) ────────────────────
    if (linkInComment && payload.imageUrl && payload.linkUrl) {
      const photoData = await fbPost(`${apiBase}/${pageId}/photos`, {
        url: payload.imageUrl,
        caption: payload.text,
        published: "true",
      });
      if (photoData.error) {
        throw new Error(
          `FB photo error (${photoData.error.code}): ${photoData.error.message}`,
        );
      }
      // /photos returns { id: photoId, post_id: pageId_postId }
      const postId = photoData.post_id ?? photoData.id;
      if (!postId) throw new Error("FB photo returned no post_id and no error");

      // Comment with the link. Failure here must NOT roll back the post —
      // we still consider the publish a success and log the comment failure.
      let commentId: string | undefined;
      try {
        const commentData = await fbPost(`${apiBase}/${postId}/comments`, {
          message: payload.linkUrl,
        });
        if (commentData.error) {
          console.warn(
            `[publisher] FB comment failed for ${postId} (${commentData.error.code}): ${commentData.error.message}`,
          );
        } else {
          commentId = commentData.id;
        }
      } catch (err) {
        console.warn(
          `[publisher] FB comment threw for ${postId}:`,
          err instanceof Error ? err.message : err,
        );
      }

      console.log(
        JSON.stringify({
          platform: "fb",
          action: "photo+comment",
          postId,
          commentId,
          ok: true,
          durationMs: Date.now() - startedAt,
        }),
      );
      return { posted: true, fbPostId: postId, fbCommentId: commentId, dryRun: false };
    }

    // ── Path B: link post fallback (no image) ────────────────────────────
    if (payload.linkUrl) {
      const data = await fbPost(`${apiBase}/${pageId}/feed`, {
        message: payload.text,
        link: payload.linkUrl,
      });
      if (data.error) {
        throw new Error(`FB API error (${data.error.code}): ${data.error.message}`);
      }
      const postId = data.post_id ?? data.id;
      if (!postId) throw new Error("FB API returned no post ID and no error");
      console.log(
        JSON.stringify({
          platform: "fb",
          action: "link-feed",
          postId,
          ok: true,
          durationMs: Date.now() - startedAt,
        }),
      );
      return { posted: true, fbPostId: postId, dryRun: false };
    }

    // ── Path C: photo-only (no link → no comment step) ───────────────────
    if (payload.imageUrl) {
      const data = await fbPost(`${apiBase}/${pageId}/photos`, {
        url: payload.imageUrl,
        caption: payload.text,
        published: "true",
      });
      if (data.error) {
        throw new Error(`FB API error (${data.error.code}): ${data.error.message}`);
      }
      const postId = data.post_id ?? data.id;
      if (!postId) throw new Error("FB API returned no post ID and no error");
      console.log(
        JSON.stringify({
          platform: "fb",
          action: "photo-only",
          postId,
          ok: true,
          durationMs: Date.now() - startedAt,
        }),
      );
      return { posted: true, fbPostId: postId, dryRun: false };
    }

    // ── Path D: text-only ────────────────────────────────────────────────
    const data = await fbPost(`${apiBase}/${pageId}/feed`, { message: payload.text });
    if (data.error) {
      throw new Error(`FB API error (${data.error.code}): ${data.error.message}`);
    }
    const postId = data.post_id ?? data.id;
    if (!postId) throw new Error("FB API returned no post ID and no error");
    console.log(
      JSON.stringify({
        platform: "fb",
        action: "text-only",
        postId,
        ok: true,
        durationMs: Date.now() - startedAt,
      }),
    );
    return { posted: true, fbPostId: postId, dryRun: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        platform: "fb",
        action: "publish",
        ok: false,
        durationMs: Date.now() - startedAt,
        error: msg,
      }),
    );
    return { posted: false, dryRun: false, error: msg };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Threads publishing (Threads API) ───────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function getThreadsCredentials(): { accessToken: string; userId: string } | null {
  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  const userId = process.env.THREADS_USER_ID;
  if (!accessToken || !userId) return null;
  return { accessToken, userId };
}

export interface ThPublishResult {
  posted: boolean;
  thPostId?: string;
  /** Threads media ID of the self-reply containing the article link (P1.2). */
  thReplyMediaId?: string;
  dryRun: boolean;
  error?: string;
}

/**
 * Publish to Threads via the Threads Publishing API.
 *
 * Uses the same two-step container flow as Instagram:
 *   1. POST /threads — create media container
 *   2. POST /threads_publish — publish the container
 *
 * When `payload.replyLinkUrl` is set (P1.2), an immediate self-reply is
 * posted containing only the link. Threads suppresses outbound links in
 * the parent body, so the reply keeps the parent clean while still giving
 * users a tap target.
 *
 * Falls back to dry-run if THREADS_ACCESS_TOKEN / THREADS_USER_ID are not set.
 */
export async function publishToThreads(
  queueItem: ThQueueItem,
  payload: ThMessagePayload,
): Promise<ThPublishResult> {
  const creds = getThreadsCredentials();

  if (!creds) {
    console.log(`[publisher] Threads dry-run: ${queueItem.id} — "${payload.text.slice(0, 80)}…"`);
    return { posted: false, dryRun: true };
  }

  const startedAt = Date.now();
  try {
    const { accessToken, userId } = creds;
    const apiHost = "graph.threads.net";
    const apiVersion = "v1.0";
    const baseUrl = `https://${apiHost}/${apiVersion}/${userId}`;
    const apiBase = `https://${apiHost}/${apiVersion}`;
    const authHeader = `Bearer ${accessToken}`;

    async function thPost(
      url: string,
      params: Record<string, string>,
    ): Promise<{ id?: string; error?: { message: string; code?: number } }> {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: authHeader },
        body: new URLSearchParams(params),
      });
      return (await res.json()) as { id?: string; error?: { message: string } };
    }

    async function thGet(
      url: string,
    ): Promise<{ status?: string; id?: string; error?: { message: string } }> {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: authHeader },
      });
      return (await res.json()) as any;
    }

    async function waitForContainer(containerId: string): Promise<void> {
      for (let attempt = 0; attempt < 10; attempt++) {
        const status = await thGet(`${apiBase}/${containerId}?fields=status`);
        const code = status.status ?? "UNKNOWN";
        console.log(`[publisher] Threads container ${containerId}: ${code} (attempt ${attempt + 1})`);
        if (code === "FINISHED") return;
        if (code === "ERROR" || code === "EXPIRED") {
          throw new Error(`Threads container ${containerId} status: ${code}`);
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
      throw new Error(`Threads container ${containerId} did not become FINISHED in time`);
    }

    // ── Step 1: Create parent media container ────────────────────────────
    const containerParams: Record<string, string> = { text: payload.text };
    if (payload.imageUrl) {
      containerParams.media_type = "IMAGE";
      containerParams.image_url = payload.imageUrl;
    } else {
      containerParams.media_type = "TEXT";
    }

    const containerData = await thPost(`${baseUrl}/threads`, containerParams);
    if (containerData.error) {
      throw new Error(`Threads API error: ${containerData.error.message}`);
    }
    const containerId = containerData.id!;
    console.log(`[publisher] Threads container created: ${containerId}`);

    // Wait for container to finish processing
    await waitForContainer(containerId);

    // ── Step 2: Publish parent ───────────────────────────────────────────
    const publishData = await thPost(`${baseUrl}/threads_publish`, {
      creation_id: containerId,
    });
    if (publishData.error) {
      throw new Error(`Threads publish error: ${publishData.error.message}`);
    }

    const parentMediaId = publishData.id!;
    console.log(`[publisher] Threads post published: ${parentMediaId}`);

    // ── Step 3 (optional): Self-reply with link ──────────────────────────
    let replyMediaId: string | undefined;
    if (payload.replyLinkUrl) {
      try {
        const replyText = `🔗 ${payload.replyLinkUrl}`;
        const replyContainer = await thPost(`${baseUrl}/threads`, {
          media_type: "TEXT",
          text: replyText,
          reply_to_id: parentMediaId,
        });
        if (replyContainer.error) {
          throw new Error(replyContainer.error.message);
        }
        const replyContainerId = replyContainer.id!;
        await waitForContainer(replyContainerId);
        const replyPublish = await thPost(`${baseUrl}/threads_publish`, {
          creation_id: replyContainerId,
        });
        if (replyPublish.error) {
          throw new Error(replyPublish.error.message);
        }
        replyMediaId = replyPublish.id;
        console.log(`[publisher] Threads reply published: ${replyMediaId} (parent ${parentMediaId})`);
      } catch (err) {
        // Reply failure must NOT roll back the parent post.
        console.warn(
          `[publisher] Threads self-reply failed for ${parentMediaId}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    console.log(
      JSON.stringify({
        platform: "th",
        action: payload.replyLinkUrl ? "post+reply" : "post",
        postId: parentMediaId,
        replyMediaId,
        ok: true,
        durationMs: Date.now() - startedAt,
      }),
    );
    return {
      posted: true,
      thPostId: parentMediaId,
      thReplyMediaId: replyMediaId,
      dryRun: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        platform: "th",
        action: "publish",
        ok: false,
        durationMs: Date.now() - startedAt,
        error: msg,
      }),
    );
    return { posted: false, dryRun: false, error: msg };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── X (Twitter) publishing (X API v2) ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function getXCredentials(): { accessToken: string } | null {
  const accessToken = process.env.X_ACCESS_TOKEN || process.env.X_BEARER_TOKEN;
  if (!accessToken) return null;
  return { accessToken };
}

/**
 * OAuth 1.0a user-context credentials for X v1.1 media upload (P1.3).
 * X v2 still requires v1.1 + OAuth1 for media. When any of the four are
 * missing, image upload is skipped and tweets fall back to text-only.
 */
function getXOAuth1Credentials(): {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessSecret: string;
} | null {
  const consumerKey = process.env.X_CONSUMER_KEY ?? process.env.X_API_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET ?? process.env.X_API_SECRET;
  const accessToken = process.env.X_OAUTH1_ACCESS_TOKEN;
  const accessSecret = process.env.X_OAUTH1_ACCESS_SECRET;
  if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) return null;
  return { consumerKey, consumerSecret, accessToken, accessSecret };
}

let _xOAuth1WarnedMissing = false;
function warnXOAuth1MissingOnce(): void {
  if (_xOAuth1WarnedMissing) return;
  _xOAuth1WarnedMissing = true;
  console.log(
    "[publisher] X media upload disabled — set X_CONSUMER_KEY, X_CONSUMER_SECRET, X_OAUTH1_ACCESS_TOKEN, X_OAUTH1_ACCESS_SECRET to enable image tweets",
  );
}

export interface XPublishResult {
  posted: boolean;
  xTweetId?: string;
  /** Media ID attached to the tweet when image upload succeeded (P1.3). */
  xMediaId?: string;
  dryRun: boolean;
  error?: string;
}

/**
 * Build an OAuth 1.0a Authorization header for a request.
 * Implements the standard signature flow described at
 * https://developer.x.com/en/docs/authentication/oauth-1-0a
 */
async function buildOAuth1Header(
  method: "GET" | "POST",
  url: string,
  bodyParams: Record<string, string>,
  creds: NonNullable<ReturnType<typeof getXOAuth1Credentials>>,
): Promise<string> {
  const { createHmac, randomBytes } = await import("node:crypto");
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };
  const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) =>
    "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  const allParams: Record<string, string> = { ...oauthParams, ...bodyParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${enc(k)}=${enc(allParams[k]!)}`)
    .join("&");
  const baseString = [method, enc(url), enc(paramString)].join("&");
  const signingKey = `${enc(creds.consumerSecret)}&${enc(creds.accessSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");
  oauthParams.oauth_signature = signature;
  return (
    "OAuth " +
    Object.keys(oauthParams)
      .sort()
      .map((k) => `${enc(k)}="${enc(oauthParams[k]!)}"`)
      .join(", ")
  );
}

/**
 * Download an image and upload it to X via the v1.1 media endpoint.
 * Returns null on any failure — the caller falls back to text-only.
 *
 * Limits: 10s download timeout, 5MB max file size.
 */
async function uploadXMedia(imageUrl: string): Promise<string | null> {
  const oauth1 = getXOAuth1Credentials();
  if (!oauth1) {
    warnXOAuth1MissingOnce();
    return null;
  }
  try {
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 10_000);
    const imgRes = await fetch(imageUrl, { signal: ac.signal }).finally(() =>
      clearTimeout(timeoutId),
    );
    if (!imgRes.ok) {
      console.warn(`[publisher] xMediaUploadFailed: image fetch ${imgRes.status}`);
      return null;
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.byteLength > 5 * 1024 * 1024) {
      console.warn(`[publisher] xMediaUploadFailed: image too large (${buf.byteLength}B)`);
      return null;
    }

    const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
    // Multipart upload — body params are NOT signed in OAuth1 for multipart,
    // but the simple base64-in-form variant IS signed (treated like form params).
    // We use the simple variant: send `media_data` (base64) as a form field.
    const mediaData = buf.toString("base64");
    const bodyParams = { media_data: mediaData };
    const auth = await buildOAuth1Header("POST", uploadUrl, bodyParams, oauth1);
    const form = new URLSearchParams(bodyParams);
    const upRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const upJson = (await upRes.json()) as {
      media_id_string?: string;
      errors?: { message: string }[];
    };
    if (!upRes.ok || !upJson.media_id_string) {
      console.warn(
        `[publisher] xMediaUploadFailed: upload ${upRes.status} ${upJson.errors?.[0]?.message ?? ""}`,
      );
      return null;
    }
    return upJson.media_id_string;
  } catch (err) {
    console.warn(
      `[publisher] xMediaUploadFailed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Publish a tweet via the X API v2.
 *
 *   POST https://api.x.com/2/tweets
 *
 * When `payload.imageUrl` is set AND OAuth1 credentials are configured
 * (P1.3), the image is first uploaded via the v1.1 media endpoint and
 * attached to the tweet. Any failure during media upload (no creds,
 * fetch failure, file too large, upload error) silently falls back to
 * a text-only tweet — never blocking the post.
 *
 * Falls back to dry-run if X_ACCESS_TOKEN / X_BEARER_TOKEN is not set.
 */
export async function publishToX(
  queueItem: XQueueItem,
  payload: XMessagePayload,
): Promise<XPublishResult> {
  const creds = getXCredentials();

  if (!creds) {
    console.log(`[publisher] X dry-run: ${queueItem.id} — "${payload.text.slice(0, 80)}…"`);
    return { posted: false, dryRun: true };
  }

  const startedAt = Date.now();
  try {
    const { accessToken } = creds;

    // ── Optional: upload media (graceful fallback to text-only) ──────────
    const mediaUploadEnabled = process.env.X_MEDIA_UPLOAD !== "false";
    let mediaId: string | undefined;
    if (mediaUploadEnabled && payload.imageUrl) {
      const id = await uploadXMedia(payload.imageUrl);
      if (id) mediaId = id;
    }

    const tweetBody: { text: string; media?: { media_ids: string[] } } = {
      text: payload.text,
    };
    if (mediaId) tweetBody.media = { media_ids: [mediaId] };

    const res = await fetch("https://api.x.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tweetBody),
    });

    const data = (await res.json()) as {
      data?: { id: string; text: string };
      errors?: { message: string; title: string }[];
    };

    if (data.errors && data.errors.length > 0) {
      throw new Error(`X API error: ${data.errors[0]!.message}`);
    }

    const tweetId = data.data?.id;
    if (tweetId) {
      console.log(
        JSON.stringify({
          platform: "x",
          action: mediaId ? "tweet+media" : "tweet",
          postId: tweetId,
          mediaId,
          ok: true,
          durationMs: Date.now() - startedAt,
        }),
      );
      return { posted: true, xTweetId: tweetId, xMediaId: mediaId, dryRun: false };
    }

    throw new Error("X API returned no tweet ID and no error");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        platform: "x",
        action: "publish",
        ok: false,
        durationMs: Date.now() - startedAt,
        error: msg,
      }),
    );
    return { posted: false, dryRun: false, error: msg };
  }
}
