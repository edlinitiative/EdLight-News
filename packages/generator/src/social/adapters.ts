/**
 * Adapters: SocialPostsOutput → existing per-queue payload shapes.
 *
 * The new generator returns a richer, platform-aware JSON object. The
 * existing FB / Threads / WhatsApp / X queues each consume a small, flat
 * `*MessagePayload` shape. These adapters bridge the two so we can wire
 * the new generator behind a feature flag without touching the queue
 * builders' internal logic.
 *
 * Icon tokens (`[Icon: Name]`) are passed through unchanged on FB and
 * Threads — they read as descriptive text on those surfaces and the
 * downstream renderer can swap them for SVGs later if we ship icon
 * support. They ARE stripped from the X (Twitter) text path because of
 * the 280-char ceiling.
 */

import type {
  FbMessagePayload,
  ThMessagePayload,
} from "@edlight-news/types";
import type { SocialPostsOutput } from "./schema.js";

export interface ToFbAdapterOpts {
  /** Canonical article URL on news.edlight.org. Goes in first_comment. */
  articleUrl: string;
  /** Optional cover image. Leave undefined to let FB generate the link card. */
  imageUrl?: string;
}

export interface ToThAdapterOpts {
  /** Canonical article URL — appended to the last post in the thread. */
  articleUrl: string;
  /** Optional image attached to the first post. */
  imageUrl?: string;
}

/**
 * Format hashtags as a single trailing line. Returns "" when none.
 */
function hashtagsLine(tags: string[]): string {
  return tags.length ? tags.join(" ") : "";
}

/**
 * Map the FB section of the social output to the existing FbMessagePayload.
 *
 * - The link goes in `linkUrl` (existing publisher posts it as a first
 *   comment when supported, or appends to the body otherwise).
 * - Hashtags are appended to `post_text`. We do NOT add the link to
 *   `text` because the Graph API duplicates it from `linkUrl`.
 */
export function socialToFbPayload(
  output: SocialPostsOutput,
  opts: ToFbAdapterOpts,
): FbMessagePayload {
  const fb = output.facebook;
  const tagLine = hashtagsLine(fb.hashtags);
  const text = tagLine ? `${fb.post_text}\n\n${tagLine}` : fb.post_text;
  return {
    text,
    linkUrl: opts.articleUrl,
    imageUrl: opts.imageUrl,
  };
}

/**
 * Map the Threads section to a single ThMessagePayload.
 *
 * Threads supports replies, but our existing queue/processor model is
 * one-message-per-queue-item. We collapse the thread into a single post
 * for now: take the first post verbatim, and if there's a reply, append
 * the article URL on a new line. The hashtags ride at the end.
 *
 * If the model returned exactly one post and is_reply_to_previous=false,
 * we just append the URL and hashtags — same shape as the legacy builder.
 */
export function socialToThPayload(
  output: SocialPostsOutput,
  opts: ToThAdapterOpts,
): ThMessagePayload {
  const th = output.threads;
  const lead = th.posts[0]?.text ?? "";
  const tagLine = hashtagsLine(th.hashtags);

  // Build text with strict 500-char ceiling. Priority order:
  //   1) lead text
  //   2) two newlines + URL
  //   3) two newlines + hashtags
  // Drop hashtags first if over budget; truncate lead last.
  const MAX = 500;
  const url = opts.articleUrl;
  const overhead = (s: string) => (s ? `\n\n${s}` : "");
  let body = lead;
  let withUrl = body + overhead(url);
  let withTags = withUrl + overhead(tagLine);

  if (withTags.length > MAX) {
    withTags = withUrl; // drop tags
  }
  if (withTags.length > MAX) {
    // Truncate lead so the URL still fits (URL is more valuable than text tail)
    const room = MAX - overhead(url).length - 1;
    body = lead.slice(0, Math.max(0, room - 1)).trimEnd() + "…";
    withTags = body + overhead(url);
  }

  return {
    text: withTags.slice(0, MAX),
    imageUrl: opts.imageUrl,
  };
}
