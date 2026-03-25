/**
 * Image generation for IG posts & editorial illustrations.
 *
 * Uses Google's Gemini 2.5 Flash Image as primary model ($0.039/image).
 * Falls back to Gemini 2.0 Flash (deprecated, may stop working soon).
 * Produces 4:5 portrait images (1080×1350) for IG carousels.
 *
 * ⚠️ gemini-3.1-flash-image-preview was removed because Google bills it
 * at Pro-tier rates ($0.067+/image) despite the "flash" name.
 *
 * Designed for one-off or batch use — NOT called on every tick.
 */

import { uploadImageBuffer } from "@edlight-news/firebase";
import type { Item } from "@edlight-news/types";
import { findEditorialImage } from "./editorialImageSearch.js";

// Read lazily — dotenv may not have run yet when this module is imported
function getApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface GeneratedImage {
  /** Public URL after upload to Firebase Storage */
  url: string;
  /** The prompt that generated it */
  prompt: string;
}

// ── Prompt engineering ─────────────────────────────────────────────────────

function buildUtilitySeriesPrompt(item: Item): string | null {
  const series = item.utilityMeta?.series;
  const title = item.title ?? "";
  const summary = item.summary ?? "";
  const context = summary.slice(0, 260);

  if (series === "HaitiHistory") {
    return [
      `Create a premium editorial illustration for a Haitian history feature.`,
      ``,
      `SUBJECT: "${title}"`,
      `CONTEXT: ${context}`,
      ``,
      `ART DIRECTION:`,
      `- Publication quality, like a New York Times Magazine or Bloomberg weekend feature illustration`,
      `- Historically grounded Haitian setting, period-accurate clothing, architecture, and objects`,
      `- Bold but refined composition, clear focal point, dignified mood`,
      `- Rich contrast, warm Caribbean palette balanced with deep shadows`,
      `- Portrait orientation 4:5, crisp details, clean edges, no blur`,
      `- NO text, NO lettering, NO watermark, NO collage`,
    ].join("\n");
  }

  if (series === "HaitiFactOfTheDay") {
    return [
      `Create a premium editorial image for a short educational fact about Haiti.`,
      ``,
      `FACT TITLE: "${title}"`,
      `FACT CONTEXT: ${context}`,
      ``,
      `ART DIRECTION:`,
      `- Refined magazine-style illustration or photo-illustration, not generic stock art`,
      `- Show the specific Haitian subject clearly and immediately`,
      `- If it is a person, create a dignified portrait with strong visual presence`,
      `- If it is a place, monument, or object, frame it heroically with architectural detail`,
      `- Deep contrast, premium color grading, polished publication-ready finish`,
      `- Portrait orientation 4:5, ultra sharp, visually premium`,
      `- NO text, NO letters, NO numbers, NO watermark`,
    ].join("\n");
  }

  if (series === "HaitianOfTheWeek") {
    return [
      `Create a premium editorial portrait for a Haitian profile feature.`,
      ``,
      `SUBJECT: "${title}"`,
      `PROFILE CONTEXT: ${context}`,
      ``,
      `ART DIRECTION:`,
      `- Elegant portrait photography or portrait illustration suitable for a major magazine`,
      `- Direct eye contact or confident three-quarter pose`,
      `- Clean composition, strong light shaping, premium wardrobe and setting cues`,
      `- Rich but restrained color grading with deep blacks and crisp highlights`,
      `- Portrait orientation 4:5, publication-ready sharpness`,
      `- NO text, NO letters, NO watermark`,
    ].join("\n");
  }

  return null;
}

function buildImagePrompt(item: Item): string {
  const utilitySeriesPrompt = buildUtilitySeriesPrompt(item);
  if (utilitySeriesPrompt) {
    return utilitySeriesPrompt;
  }

  const title = item.title ?? "";
  const summary = item.summary ?? "";
  const geoTag = item.geoTag ?? "";
  const category = item.category ?? "news";

  // Context hints for different categories
  const contextHints: Record<string, string> = {
    scholarship: "academic campus, graduation caps, books, university building",
    opportunity: "professional workspace, career growth, modern office",
    news: "Haiti, Caribbean, editorial photojournalism style",
    local_news: "Port-au-Prince cityscape, Haitian landmarks, Caribbean architecture",
    event: "conference hall, seminar, educational gathering",
    resource: "modern workspace, technology, learning tools",
    taux: "financial terminal, currency exchange, gold accents on dark navy",
    histoire: "bold editorial cartoon in the style of The New Yorker or The Economist, depicting the specific Haitian historical event with stylised cartoon characters, strong outlines, flat bold colours",
  };

  const hint = contextHints[category] ?? contextHints.news;
  const isHaiti = geoTag === "HT" || title.toLowerCase().includes("haïti") || title.toLowerCase().includes("haiti");

  const parts = [
    `Generate a photorealistic editorial image for this news headline:`,
    `"${title}"`,
    ``,
    `Context: ${summary.slice(0, 200)}`,
    ``,
    `Requirements:`,
    `- Portrait orientation (4:5 aspect ratio)`,
    `- Cinematic, editorial-quality photography style`,
    `- Natural lighting with rich warm tones`,
    isHaiti ? `- Must evoke Haiti / Caribbean: tropical architecture, vibrant colors, mountainous terrain` : "",
    `- Visual elements: ${hint}`,
    `- NO TEXT whatsoever in the image — no words, no letters, no numbers, no watermarks`,
    `- Must look like a premium stock photo from Bloomberg or Reuters`,
    `- Deep depth of field for establishing shots, shallow for portraits`,
    `- Rich contrast, slightly desaturated editorial color grading`,
  ];

  return parts.filter(Boolean).join("\n");
}

function getEditorialMinScore(item: Item): number {
  const series = item.utilityMeta?.series;

  if (
    series === "HaitiHistory" ||
    series === "HaitiFactOfTheDay" ||
    series === "HaitianOfTheWeek"
  ) {
    return 7;
  }

  return 5;
}

// ── Gemini image generation with model fallback chain ───────────────────────

/** Response shape shared across all Gemini generateContent image models */
interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        thought?: boolean;
        inlineData?: { mimeType: string; data: string };
      }>;
    };
  }>;
}

/** Extract the final (non-thought) image buffer from a Gemini response. */
function extractImageBuffer(data: GeminiImageResponse): Buffer | null {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  // Thinking models (3.1+) emit thought images first — skip them
  const nonThoughtImages = parts.filter((p) => p.inlineData && !p.thought);
  const imagePart =
    nonThoughtImages.length > 0
      ? nonThoughtImages[nonThoughtImages.length - 1] // last non-thought image
      : parts.find((p) => p.inlineData); // fallback: any image
  if (!imagePart?.inlineData?.data) return null;
  return Buffer.from(imagePart.inlineData.data, "base64");
}

/** 90-second timeout for image generation requests */
const IMAGE_GEN_TIMEOUT_MS = 90_000;

async function callImagen3(prompt: string): Promise<Buffer | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[imagen] No GEMINI_API_KEY set");
    return null;
  }

  try {
    // Primary: Gemini 2.5 Flash Image — cheapest image model ($0.039/image)
    // (gemini-3.1-flash-image-preview was billed at Pro rates, ~$0.067+/image)
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(IMAGE_GEN_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio: "4:5",
            },
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[imagen] Gemini 2.5 Flash Image error:", res.status, errText.slice(0, 200));
      console.log("[imagen] Trying Gemini 2.0 Flash fallback...");
      return callGemini20Fallback(prompt, apiKey);
    }

    const data = (await res.json()) as GeminiImageResponse;
    const buffer = extractImageBuffer(data);

    if (!buffer) {
      console.warn("[imagen] No image in 2.5 response, trying 2.0 fallback...");
      return callGemini20Fallback(prompt, apiKey);
    }

    console.log("[imagen] ✓ Gemini 2.5 Flash Image generated successfully");
    return buffer;
  } catch (err) {
    console.error("[imagen] Error:", err instanceof Error ? err.message : err);
    const key = getApiKey();
    if (key) return callGemini20Fallback(prompt, key);
    return null;
  }
}

/**
 * Fallback (last resort): Gemini 2.0 Flash image generation
 * NOTE: gemini-2.0-flash-exp is also deprecated — may stop working soon.
 */
async function callGemini20Fallback(prompt: string, apiKey: string): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(IMAGE_GEN_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
            maxOutputTokens: 4096,
          },
        }),
      },
    );

    if (!res.ok) {
      console.error("[imagen] Gemini 2.0 last-resort fallback error:", res.status);
      return null;
    }

    const data = (await res.json()) as GeminiImageResponse;
    const buffer = extractImageBuffer(data);

    if (!buffer) {
      console.warn("[imagen] No image in 2.0 response — all models exhausted");
      return null;
    }

    console.log("[imagen] ✓ Gemini 2.0 Flash last-resort fallback succeeded");
    return buffer;
  } catch (err) {
    console.error("[imagen] Gemini 2.0 fallback error:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a contextual image for an IG post.
 *
 * Pipeline:
 *   1. Editorial search (Unsplash → Wikimedia Commons) — free, high-quality
 *   2. Gemini AI generation (Imagen 3 → Flash fallback) — if editorial fails
 *
 * Uploads to Firebase Storage and returns the public URL.
 * Returns null if all methods fail (non-blocking).
 */
export async function generateContextualImage(
  item: Item,
  customPrompt?: string,
): Promise<GeneratedImage | null> {
  // Skip editorial search when a custom prompt is provided (caller wants AI art)
  if (!customPrompt) {
    try {
      const editorial = await findEditorialImage(item, getEditorialMinScore(item));
      if (editorial) {
        console.log(`[imagen3] Using editorial image from ${editorial.source} (score=${editorial.score})`);
        return { url: editorial.url, prompt: `editorial:${editorial.source}` };
      }
    } catch (err) {
      console.warn("[imagen3] Editorial search failed, falling back to AI:", err instanceof Error ? err.message : err);
    }
  }

  // Fall through to Gemini AI generation
  const prompt = customPrompt ?? buildImagePrompt(item);
  console.log(`[imagen3] Generating AI image for "${item.title?.slice(0, 60)}..."`);

  const buffer = await callImagen3(prompt);
  if (!buffer) return null;

  // Upload to Firebase Storage
  try {
    const path = `ig/generated/${item.id}_${Date.now()}.png`;
    const url = await uploadImageBuffer(path, buffer, "image/png");
    console.log(`[imagen3] Uploaded: ${url.slice(0, 80)}...`);
    return { url, prompt };
  } catch (err) {
    console.error("[imagen3] Upload failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── One-time taux background ───────────────────────────────────────────────

const TAUX_BG_PATH = "ig/assets/taux-background.png";

/**
 * Ensure the branded taux-du-jour background image exists in Firebase Storage.
 * Generates it exactly once via Gemini AI and reuses the same URL forever.
 * Returns the public download URL.
 */
export async function ensureTauxBackground(forceRegenerate = false): Promise<string | null> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? undefined;
  const { getStorage } = await import("firebase-admin/storage");
  const { getApp } = await import("@edlight-news/firebase");
  const bucket = getStorage(getApp()).bucket(bucketName);
  const file = bucket.file(TAUX_BG_PATH);

  // Delete cached image if caller wants regeneration
  if (forceRegenerate) {
    try {
      await file.delete({ ignoreNotFound: true });
      console.log("[taux-bg] Deleted cached taux background for regeneration");
    } catch { /* ignore */ }
  }

  // Check if it already exists
  const [exists] = await file.exists();
  if (exists) {
    // Build the download URL from existing metadata
    const [meta] = await file.getMetadata();
    const token = (meta.metadata as Record<string, string> | undefined)?.firebaseStorageDownloadTokens;
    if (token) {
      const encoded = encodeURIComponent(TAUX_BG_PATH);
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media&token=${token}`;
      console.log("[taux-bg] Reusing existing taux background");
      return url;
    }
  }

  // Generate a new one with premium quality prompt
  console.log("[taux-bg] Generating one-time taux background image...");
  const prompt = [
    "Ultra high resolution abstract dark background for a financial data display, at least 1080 pixels wide, extremely sharp details:",
    "- Deep navy (#0a1628) to near-black smooth gradient, near-black everywhere, minimal luminosity, rich colour depth",
    "- Extremely faint, barely visible gold (#eab308) dim accent wisps — no bright spots, no bokeh, no glow",
    "- NO grid lines, NO chart lines, NO rulers, NO sharp geometric patterns",
    "- Smooth organic shapes only — flowing gradients, soft particles, subtle noise texture",
    "- Faint currency symbols ($ HTG) as ghosted watermarks blended into background",
    "- Cinematic depth of field, slight film grain texture, photorealistic quality",
    "- NO text, NO numbers, NO charts, NO people — purely atmospheric",
    "- Portrait orientation 4:5 (1080×1350), premium Bloomberg/Reuters aesthetic",
    "- Must look like a high-end financial wallpaper, not AI-generated",
  ].join("\n");

  const url = await generateCustomImage(prompt, TAUX_BG_PATH);
  if (url) {
    console.log("[taux-bg] ✓ Taux background generated and stored permanently");
  }
  return url;
}

// ── One-time opportunity background ───────────────────────────────────────

const OPPORTUNITY_BG_PATH = "ig/assets/opportunity-background.png";

/**
 * Ensure the branded opportunity-post background image exists in Firebase Storage.
 * Generates it exactly once via Gemini AI and reuses the same URL forever.
 * Returns the public download URL.
 */
export async function ensureOpportunityBackground(forceRegenerate = false): Promise<string | null> {
  try {
    const { getApp } = await import("@edlight-news/firebase");
    const { getStorage } = await import("firebase-admin/storage");
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? undefined;
    const bucket = getStorage(getApp()).bucket(bucketName);
    const file = bucket.file(OPPORTUNITY_BG_PATH);

    if (!forceRegenerate) {
      const [exists] = await file.exists();
      if (exists) {
        const [meta] = await file.getMetadata();
        const token = (meta.metadata as Record<string, string> | undefined)?.firebaseStorageDownloadTokens;
        if (token) {
          const encoded = encodeURIComponent(OPPORTUNITY_BG_PATH);
          const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media&token=${token}`;
          console.log("[opp-bg] Reusing existing opportunity background");
          return url;
        }
      }
    }

    console.log("[opp-bg] Generating one-time opportunity background image...");
    const prompt = [
      "Ultra high resolution abstract dark background for a professional career and opportunity social media post, at least 1080 pixels wide, extremely sharp details:",
      "- Very dark near-black base (#0f0d08) with subtle warm amber/gold (#fbbf24) accent undertones",
      "- Abstract flowing shapes evoking upward movement, growth, horizons, or open pathways",
      "- Smooth organic gradients, faint soft-focus bokeh orbs, no sharp edges or hard lines",
      "- Extremely subtle — text overlaid on it must remain fully readable",
      "- NO text, NO people, NO recognizable logos or objects — purely atmospheric",
      "- Portrait orientation 4:5 (1080×1350), premium editorial / career-media aesthetic",
      "- Cinematic depth of field, slight film grain, professional media wallpaper quality",
      "- Evokes ambition and opportunity — reminiscent of premium LinkedIn or Forbes editorial backgrounds",
      "- Must look like a high-end career media wallpaper, not AI-generated",
    ].join("\n");

    const url = await generateCustomImage(prompt, OPPORTUNITY_BG_PATH);
    if (url) {
      console.log("[opp-bg] ✓ Opportunity background generated and stored permanently");
    }
    return url;
  } catch (err) {
    console.error("[opp-bg] Failed to ensure opportunity background:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Generate a contextual image with a fully custom prompt (not tied to an item).
 * Useful for branded/generic images (maps, backgrounds, etc.).
 */
export async function generateCustomImage(
  prompt: string,
  storagePath: string,
): Promise<string | null> {
  const buffer = await callImagen3(prompt);
  if (!buffer) return null;

  try {
    const url = await uploadImageBuffer(storagePath, buffer, "image/png");
    return url;
  } catch (err) {
    console.error("[imagen3] Upload failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
