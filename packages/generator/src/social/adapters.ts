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
  IGFormattedPayload,
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
 * Returns `null` when the LLM marked the article as `story_only` (Taux,
 * Histoire, ambient cultural posts) — these belong on the IG story rail,
 * not the Facebook feed. Callers should skip-queue when null is returned.
 *
 * - The link goes in `linkUrl` (existing publisher posts it as a first
 *   comment when supported, or appends to the body otherwise).
 * - Hashtags are appended to `post_text`. We do NOT add the link to
 *   `text` because the Graph API duplicates it from `linkUrl`.
 */
export function socialToFbPayload(
  output: SocialPostsOutput,
  opts: ToFbAdapterOpts,
): FbMessagePayload | null {
  if (output.instagram.post_type === "story_only") return null;
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
 * Returns `null` when the LLM marked the article as `story_only` — same
 * rationale as `socialToFbPayload`.
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
): ThMessagePayload | null {
  if (output.instagram.post_type === "story_only") return null;
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

// ── Instagram caption wedge ──────────────────────────────────────────────────
//
// The IG carousel renderer still owns slide layout, fonts, and backgrounds —
// the social v2 generator does NOT replace it. What v2 *does* improve, even
// without renderer changes, is the off-image content: caption (the part that
// drives saves/shares/comments), hashtag mix, and accessibility alt text.
//
// `socialToIgCaptionPatch` returns just those fields, and `applyIgCaptionPatch`
// merges them into an existing `IGFormattedPayload` produced by `formatForIG`.
// This is the safest possible IG integration — slides untouched, captions
// upgraded — and lets us ship the v2 voice on IG without touching the
// renderer.

export interface IgCaptionPatch {
  /** Cleaned caption (Lucide `[Icon: X]` tokens stripped). */
  caption: string;
  /** Hashtag list, capped at 10 (IG soft limit). */
  hashtags: string[];
  /** Accessibility description; empty string when LLM didn't supply one. */
  altText: string;
  /** Original IG post type from the LLM — useful for downstream routing. */
  postType: SocialPostsOutput["instagram"]["post_type"];
}

/**
 * Strip Lucide icon tokens from text. The PRD has the LLM emit
 * `[Icon: GraduationCap]` tokens that the renderer is supposed to swap for
 * SVGs. Until that lands (and arguably even after — see project notes), the
 * tokens read as broken markup on IG/FB/Threads. Replace with a centered
 * dot so the visual cadence the LLM intended is preserved.
 */
export function stripIconTokens(text: string): string {
  return text
    .replace(/\[Icon:\s*[A-Za-z0-9_]+\]\s?/g, "• ")
    // Normalize accidental "•  •" or trailing bullets caused by stripping
    .replace(/(•\s*){2,}/g, "• ")
    .replace(/\s+•\s*$/g, "")
    .trim();
}

/**
 * Map the IG section of the social output to a caption patch. Returns null
 * for `story_only` items — those go to the IG story rail, which has its own
 * pipeline; the carousel queue should skip them.
 */
export function socialToIgCaptionPatch(
  output: SocialPostsOutput,
): IgCaptionPatch | null {
  if (output.instagram.post_type === "story_only") return null;
  const ig = output.instagram;
  return {
    caption: stripIconTokens(ig.caption),
    hashtags: ig.hashtags.slice(0, 10),
    altText: (ig.alt_text ?? "").trim(),
    postType: ig.post_type,
  };
}

/**
 * Merge a caption patch into an existing `IGFormattedPayload`. Slides are
 * preserved verbatim — the renderer keeps doing what it does. Only the
 * caption (with hashtags appended) and the slide-level alt text are touched.
 *
 * Keeps the legacy formatter's caption as a fallback when the patch caption
 * is suspiciously short (LLM occasionally returns a one-liner on weak input).
 */
export function applyIgCaptionPatch(
  payload: IGFormattedPayload,
  patch: IgCaptionPatch,
): IGFormattedPayload {
  const MIN_CAPTION_CHARS = 80;
  const newCaption =
    patch.caption.length >= MIN_CAPTION_CHARS ? patch.caption : payload.caption;
  const hashtagLine = patch.hashtags.length ? patch.hashtags.join(" ") : "";
  const captionWithTags = hashtagLine
    ? `${newCaption}\n\n${hashtagLine}`
    : newCaption;

  return {
    ...payload,
    caption: captionWithTags,
  };
}
