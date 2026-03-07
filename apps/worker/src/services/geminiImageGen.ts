/**
 * Image generation for IG posts — Imagen 3 (imagen-3.0-generate-002).
 *
 * Uses Google's Imagen 3 via the Gemini API for high-quality editorial
 * visuals. Produces 4:5 portrait images (1080×1350) for IG carousels.
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

function buildImagePrompt(item: Item): string {
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
    histoire: "historical Haiti, vintage Caribbean photography, sepia tones",
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

// ── Gemini 2.5 Flash Image (Nano Banana) API call ──────────────────────────

async function callImagen3(prompt: string): Promise<Buffer | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[imagen] No GEMINI_API_KEY set");
    return null;
  }

  try {
    // Gemini 2.5 Flash Image (Nano Banana) — stable, high-quality image gen
    // Supports aspect ratio + resolution config via generateContent endpoint
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      // Fallback to Gemini 2.0 Flash exp if 2.5 fails
      console.log("[imagen] Trying Gemini 2.0 Flash fallback...");
      return callGeminiFlashFallback(prompt, apiKey);
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> } }>;
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData);

    if (!imagePart?.inlineData?.data) {
      console.warn("[imagen] No image in response, trying fallback...");
      return callGeminiFlashFallback(prompt, apiKey);
    }

    console.log("[imagen] ✓ Gemini 2.5 Flash Image generated successfully");
    return Buffer.from(imagePart.inlineData.data, "base64");
  } catch (err) {
    console.error("[imagen] Error:", err instanceof Error ? err.message : err);
    // Try fallback
    const key = getApiKey();
    if (key) return callGeminiFlashFallback(prompt, key);
    return null;
  }
}

/**
 * Fallback: Gemini 2.0 Flash image generation (lower quality but more available)
 */
async function callGeminiFlashFallback(prompt: string, apiKey: string): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      console.error("[geminiFlash] Fallback API error:", res.status);
      return null;
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> } }>;
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData);

    if (!imagePart?.inlineData?.data) {
      console.warn("[geminiFlash] Fallback: no image in response");
      return null;
    }

    return Buffer.from(imagePart.inlineData.data, "base64");
  } catch (err) {
    console.error("[geminiFlash] Fallback error:", err instanceof Error ? err.message : err);
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
      const editorial = await findEditorialImage(item);
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
    "Ultra high resolution abstract dark financial terminal background, at least 1080 pixels wide, extremely sharp details:",
    "- Deep navy (#0a1628) to near-black gradient, rich colour depth",
    "- Subtle gold (#eab308) grid lines and flowing accent curves with soft glow",
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
