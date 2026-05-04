/**
 * Unified Instagram image-selection pipeline.
 *
 * Single entry point used by `buildIgQueue.ts` (and any future renderer
 * code path) so that every IG post goes through the SAME image-selection
 * logic and the SAME validation gates. Previously this lived inline in
 * `buildIgQueue.ts` and parts of it were duplicated in `geminiImageGen.ts`,
 * which made it possible for an unvalidated keyword/tiered result (e.g. a
 * white scanned book page from the Library of Congress) to slip through.
 *
 * Selection order:
 *
 *   IF the item already has a publisher image:
 *     1. Vision-validate the publisher image (Gemini Flash-Lite).
 *        - Approved → use it. Done.
 *        - Rejected → continue.
 *     2. Reverse image search (Google Vision WEB_DETECTION → Brave).
 *        Pixel-anchored to the publisher image, so any hit is "the same
 *        photo at a higher resolution". When found, use it. Done.
 *     3. STOP. Do NOT fall through to keyword/tiered substitution: with a
 *        publisher image present, a topical-but-wrong stock photo is worse
 *        than rendering the article on the branded gradient. Returns
 *        `igImageSafe: false` so the formatter drops the bad photo.
 *
 *   IF the item has NO publisher image at all:
 *     1. LLM image finder (Flash-Lite vision-validated by design).
 *     2. Tiered keyword pipeline (Brave / Unsplash / LoC / Wikimedia) →
 *        result is vision-validated before being accepted.
 *     3. Wikimedia Commons fallback → also vision-validated.
 *     4. Nothing → branded gradient.
 *
 * Vision validation always uses `validateImageForItem`, the same Gemini
 * Flash-Lite check that `validatePublisherImage` already used. This closes
 * the "white scanned book page" failure mode that came out of the tiered
 * pipeline.
 */

import type { Item } from "@edlight-news/types";
import { isItemImageUsableForIG } from "@edlight-news/generator/ig/index.js";
import { findFreeImage } from "./commonsImageSearch.js";
import { findTieredImage } from "./tieredImagePipeline.js";
import { findHighResVersion } from "./reverseImageSearch.js";
import { findImageWithLlm } from "./llmImageFinder.js";
import {
  validateImageForItem,
} from "./llmPublisherImageValidator.js";

// Env flags (centralized here so the pipeline owns its policy).
const IG_STRICT_IMAGE_ACCURACY =
  process.env.IG_STRICT_IMAGE_ACCURACY !== "false";
const IG_ALLOW_EDITORIAL_IMAGE_SUBSTITUTION =
  process.env.IG_ALLOW_EDITORIAL_IMAGE_SUBSTITUTION === "true";
const IG_LLM_IMAGE_FINDER = process.env.IG_LLM_IMAGE_FINDER === "true";
const IG_LLM_VALIDATE_PUBLISHER =
  process.env.IG_LLM_VALIDATE_PUBLISHER === "true";

/** Confidence threshold below which a vision validation is treated as a reject. */
const MIN_VALIDATION_CONFIDENCE = 0.5;
/**
 * Floor for the publisher's og:image. Lowered from 0.65 → 0.50 (and the
 * validator below now runs in non-strict mode) because the prior settings
 * rejected too many real publisher images — file photos of named figures,
 * archive shots from the venue, mood photos that match the topic — sending
 * an unnecessary fraction of news posts to the Gemini AI background
 * fallback in `processIgScheduled`. The non-strict prompt still rejects
 * logos, CAPTCHAs, and clearly-wrong-person photos.
 */
const MIN_PUBLISHER_VALIDATION_CONFIDENCE = 0.5;

export interface ImageSelection {
  /**
   * URL the formatter should use to override `item.imageUrl`. `undefined`
   * means "use the publisher image as-is" or "use no image" depending on
   * `igImageSafe`.
   */
  overrideImageUrl?: string;
  /**
   * True when the selected image is safe to render. False means the
   * formatter should drop the photo and fall back to the branded gradient.
   */
  igImageSafe: boolean;
  /** Source label for logging (e.g. "publisher", "reverse-vision", "llm-finder"). */
  source: string;
  /** Short human-readable explanation of why this image was selected. */
  reason: string;
}

/**
 * Run the unified IG image selection for a single item.
 *
 * This function is side-effect-free apart from network calls and structured
 * console logs. It never throws — sub-step failures are logged and the
 * pipeline continues to the next strategy.
 */
export async function selectImageForIG(
  item: Item,
  opts: { igImageSafe: boolean },
): Promise<ImageSelection> {
  let igImageSafe = opts.igImageSafe;

  const hasPublisherImage = !!item.imageUrl;
  let publisherImageUsable = isItemImageUsableForIG(item);

  // ── CAPTCHA / JS-challenge / error-page image URL pre-filter ──────────
  // Zero-cost regex gate. Rejects image URLs whose path/filename strongly
  // indicates a bot-detection page, a Cloudflare screen, or an error page.
  // This catches the "MS-13" case (lenouvelliste.com served a JS-challenge
  // interstitial whose og:image was lenouvelliste.com/article/...) and the
  // "CAPTCHA og:image" case before wasting a Gemini API call.
  if (publisherImageUsable && hasPublisherImage) {
    const url = item.imageUrl!.toLowerCase();
    const reason =
      /\/cdn-cgi\//.test(url) ? "Cloudflare challenge image" :
      /captcha/.test(url) ? "CAPTCHA image" :
      /challenge/.test(url) ? "JS-challenge image" :
      /__captcha\//.test(url) ? "CAPTCHA image" :
      /_cf_chl_/.test(url) ? "Cloudflare challenge image" :
      /recaptcha/.test(url) ? "reCAPTCHA image" :
      /stc=/.test(url) ? "Cloudfront bot-detection image" :
      /turnstile/.test(url) ? "Turnstile challenge image" :
      /error/.test(url) && url.includes("/wp-content/uploads/") ? "Error image upload" :
      null;
    if (reason) {
      console.log(
        `[igImagePipeline] CAPTCHA/error-page image URL pre-filter rejected ${item.id}: ${reason}`,
      );
      publisherImageUsable = false;
      igImageSafe = false;
    }
  }

  // ── Path A: item has a publisher image ────────────────────────────────
  if (hasPublisherImage) {
    // A.1 Vision-validate the publisher image when the dimensions/CDN gates
    // already approved it. This catches "right size, wrong photo".
    //
    // We use the NON-STRICT validator (`validateImageForItem` w/o strict)
    // rather than `validatePublisherImage` (which is strict-mode). Strict
    // mode demanded the image depict THIS SPECIFIC moment — which rejected
    // legitimate file photos, archive shots, and on-topic mood images,
    // shunting too many news posts to the AI Gemini background fallback.
    // The non-strict prompt still rejects logos, CAPTCHAs, JS-challenge
    // pages, and clearly wrong-person photos.
    if (publisherImageUsable && igImageSafe && IG_LLM_VALIDATE_PUBLISHER) {
      try {
        const v = await validateImageForItem(item, item.imageUrl!);
        if (v && (!v.match || v.confidence < MIN_PUBLISHER_VALIDATION_CONFIDENCE)) {
          console.log(
            `[igImagePipeline] LLM rejected publisher image for ${item.id}: ` +
              `match=${v.match} confidence=${v.confidence.toFixed(2)} — ${v.reason}`,
          );
          publisherImageUsable = false;
          igImageSafe = false;
        } else if (v) {
          console.log(
            `[igImagePipeline] LLM approved publisher image for ${item.id} ` +
              `(confidence ${v.confidence.toFixed(2)})`,
          );
        }
      } catch (err) {
        console.warn(
          `[igImagePipeline] publisher validation failed for ${item.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (publisherImageUsable && igImageSafe) {
      return {
        igImageSafe: true,
        source: "publisher",
        reason: "Publisher image passed dimension and (when enabled) vision checks.",
      };
    }

    // A.2 Reverse image search — pixel-anchored to the publisher image.
    // Any hit here is "the same photo at higher resolution", so it is
    // implicitly topic-correct.
    try {
      const hqMatch = await findHighResVersion(item);
      if (hqMatch && hqMatch.width >= 1080) {
        const isStrictApproved =
          !IG_STRICT_IMAGE_ACCURACY ||
          hqMatch.sourceType === "vision_exact" ||
          hqMatch.sourceType === "vision_partial";
        if (isStrictApproved) {
          console.log(
            `[igImagePipeline] reverse search HQ match for ${item.id}: ` +
              `${hqMatch.source} (${hqMatch.width}×${hqMatch.height}, ${hqMatch.sourceType})`,
          );
          return {
            overrideImageUrl: hqMatch.url,
            igImageSafe: false, // formatter switches off the original publisher bg
            source: `reverse:${hqMatch.sourceType}`,
            reason: `Higher-res twin of publisher image found via ${hqMatch.source}.`,
          };
        }
      }
    } catch (err) {
      console.warn(
        `[igImagePipeline] reverse search failed for ${item.id}:`,
        err instanceof Error ? err.message : err,
      );
    }

    // A.3 STOP. With a publisher image present we refuse to substitute a
    // keyword/tiered result — that's how "MS-13 article shows a stock gang
    // photo" and "white scanned book page" failures happen.
    console.log(
      `[igImagePipeline] no reverse match for ${item.id} — keeping publisher image ` +
        `(or gradient if formatter drops it). Skipping keyword substitution.`,
    );
    return {
      igImageSafe,
      source: "publisher-fallback",
      reason:
        "Publisher image present but rejected by quality/vision gates and " +
        "no reverse-search twin found. Keyword substitution intentionally skipped.",
    };
  }

  // ── Path B: item has no publisher image at all ────────────────────────
  // Substitution is unavoidable. Every candidate must clear vision
  // validation before being returned.

  // B.1 LLM image finder (already vision-validates internally).
  if (IG_LLM_IMAGE_FINDER) {
    try {
      const llmResult = await findImageWithLlm(item);
      if (llmResult.url) {
        console.log(
          `[igImagePipeline] LLM finder picked image for ${item.id}: ${llmResult.source} ` +
            `(${llmResult.width}×${llmResult.height}) cost≈$${llmResult.estCostUsd.toFixed(5)}`,
        );
        return {
          overrideImageUrl: llmResult.url,
          igImageSafe: false,
          source: "llm-finder",
          reason: llmResult.reason,
        };
      }
    } catch (err) {
      console.warn(
        `[igImagePipeline] LLM finder failed for ${item.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // B.2 Tiered keyword pipeline → MUST pass vision validation before use.
  if (!IG_STRICT_IMAGE_ACCURACY && IG_ALLOW_EDITORIAL_IMAGE_SUBSTITUTION) {
    try {
      const tiered = await findTieredImage(item);
      if (tiered && tiered.width >= 1080) {
        const v = await validateImageForItem(item, tiered.url);
        if (!v || (v.match && v.confidence >= MIN_VALIDATION_CONFIDENCE)) {
          console.log(
            `[igImagePipeline] tiered match for ${item.id}: ${tiered.source} ` +
              `(${tiered.width}×${tiered.height}); validation=${v ? `${v.match}/${v.confidence.toFixed(2)}` : "n/a"}`,
          );
          return {
            overrideImageUrl: tiered.url,
            igImageSafe: false,
            source: `tiered:${tiered.source}`,
            reason:
              v?.reason ?? "Tiered result accepted (validator unavailable).",
          };
        }
        console.log(
          `[igImagePipeline] tiered candidate REJECTED by vision for ${item.id}: ` +
            `match=${v.match} confidence=${v.confidence.toFixed(2)} — ${v.reason}`,
        );
      }
    } catch (err) {
      console.warn(
        `[igImagePipeline] tiered pipeline failed for ${item.id}:`,
        err instanceof Error ? err.message : err,
      );
    }

    // B.3 Wikimedia Commons fallback → also vision-validated.
    try {
      const free = await findFreeImage(item);
      if (free?.imageUrl) {
        const v = await validateImageForItem(item, free.imageUrl);
        if (!v || (v.match && v.confidence >= MIN_VALIDATION_CONFIDENCE)) {
          console.log(
            `[igImagePipeline] commons match for ${item.id}; ` +
              `validation=${v ? `${v.match}/${v.confidence.toFixed(2)}` : "n/a"}`,
          );
          return {
            overrideImageUrl: free.imageUrl,
            igImageSafe: false,
            source: "commons",
            reason: v?.reason ?? "Commons result accepted (validator unavailable).",
          };
        }
        console.log(
          `[igImagePipeline] commons candidate REJECTED by vision for ${item.id}: ` +
            `match=${v.match} confidence=${v.confidence.toFixed(2)} — ${v.reason}`,
        );
      }
    } catch (err) {
      console.warn(
        `[igImagePipeline] commons fallback failed for ${item.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // B.4 Nothing — formatter will render branded gradient.
  console.log(
    `[igImagePipeline] no acceptable image for ${item.id} — falling back to gradient`,
  );
  return {
    igImageSafe: false,
    source: "gradient",
    reason: "No publisher image and no validated substitute available.",
  };
}
