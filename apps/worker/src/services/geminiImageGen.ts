/**
 * Gemini image generation for IG posts.
 *
 * Uses Gemini 2.0 Flash image generation to create contextual visuals
 * for news/utility posts that lack good publisher images.
 *
 * Designed for one-off or batch use — NOT called on every tick.
 */

import { uploadImageBuffer } from "@edlight-news/firebase";
import type { Item } from "@edlight-news/types";

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
    `- Square format (1:1 aspect ratio, 1080x1080 resolution)`,
    `- Cinematic, editorial-quality photography style`,
    `- Natural lighting with rich warm tones`,
    isHaiti ? `- Must evoke Haiti / Caribbean: tropical architecture, vibrant colors, mountainous terrain` : "",
    `- Visual elements: ${hint}`,
    `- NO TEXT whatsoever in the image`,
    `- Must look like a premium stock photo, NOT AI-generated`,
    `- Deep depth of field for establishing shots, shallow for portraits`,
  ];

  return parts.filter(Boolean).join("\n");
}

// ── Gemini API call ────────────────────────────────────────────────────────

async function callGeminiImageGen(prompt: string): Promise<Buffer | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[geminiImageGen] No GEMINI_API_KEY set");
    return null;
  }

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
      console.error("[geminiImageGen] API error:", res.status, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> } }>;
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      (p) => p.inlineData,
    );

    if (!imagePart?.inlineData?.data) {
      console.warn("[geminiImageGen] No image in response");
      return null;
    }

    return Buffer.from(imagePart.inlineData.data, "base64");
  } catch (err) {
    console.error("[geminiImageGen] Error:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a contextual image for an IG post using Gemini.
 * Uploads to Firebase Storage and returns the public URL.
 *
 * Returns null if generation fails (non-blocking).
 */
export async function generateContextualImage(
  item: Item,
  customPrompt?: string,
): Promise<GeneratedImage | null> {
  const prompt = customPrompt ?? buildImagePrompt(item);
  console.log(`[geminiImageGen] Generating image for "${item.title?.slice(0, 60)}..."`);

  const buffer = await callGeminiImageGen(prompt);
  if (!buffer) return null;

  // Upload to Firebase Storage
  try {
    const path = `ig/generated/${item.id}_${Date.now()}.png`;
    const url = await uploadImageBuffer(path, buffer, "image/png");
    console.log(`[geminiImageGen] Uploaded: ${url.slice(0, 80)}...`);
    return { url, prompt };
  } catch (err) {
    console.error("[geminiImageGen] Upload failed:", err instanceof Error ? err.message : err);
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
  const buffer = await callGeminiImageGen(prompt);
  if (!buffer) return null;

  try {
    const url = await uploadImageBuffer(storagePath, buffer, "image/png");
    return url;
  } catch (err) {
    console.error("[geminiImageGen] Upload failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
