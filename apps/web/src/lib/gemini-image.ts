/**
 * Server-side Gemini image generation with filesystem cache.
 *
 * Called during ISR so images are pre-baked into the page HTML.
 * Users never wait for Gemini — they get the cached image instantly.
 */

import { createHash } from "crypto";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CACHE_DIR = join(process.cwd(), ".next", "cache", "gemini-images");
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

function cacheKey(prompt: string, theme: string): string {
  const hash = createHash("sha256")
    .update(`${prompt}::${theme}`)
    .digest("hex")
    .slice(0, 16);
  return hash;
}

interface CacheEntry {
  dataUrl: string;
  ts: number;
}

async function readCache(key: string): Promise<string | null> {
  try {
    const raw = await readFile(join(CACHE_DIR, `${key}.json`), "utf-8");
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts < CACHE_TTL_MS) return entry.dataUrl;
  } catch {
    // Cache miss — fine
  }
  return null;
}

async function writeCache(key: string, dataUrl: string): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const entry: CacheEntry = { dataUrl, ts: Date.now() };
    await writeFile(join(CACHE_DIR, `${key}.json`), JSON.stringify(entry));
  } catch {
    // Non-critical — just means next render will regenerate
  }
}

/**
 * Generate (or retrieve cached) a Gemini hero image.
 * Returns a base64 data URL, or null on failure.
 */
export async function generateHeroImage(
  prompt: string,
  theme: string = "universal",
): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;

  const key = cacheKey(prompt, theme);

  // 1. Check filesystem cache
  const cached = await readCache(key);
  if (cached) return cached;

  // 2. Call Gemini API
  const fullPrompt = [
    `Generate a photorealistic, ultra-premium hero image.`,
    prompt,
    `Style: cinematic, editorial-quality, shallow depth of field, natural lighting, 16:9 aspect ratio, 800x450 resolution.`,
    `This is for a premium education technology platform. The image must look like a high-end stock photo. Only include text if explicitly requested in the prompt, otherwise no text at all.`,
  ].join(" ");

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: {
              aspectRatio: "16:9",
            },
          },
        }),
      },
    );

    if (!res.ok) {
      console.error("[Gemini] API error:", res.status);
      return null;
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find(
      (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData,
    );

    if (imagePart?.inlineData) {
      const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
      await writeCache(key, dataUrl);
      return dataUrl;
    }

    return null;
  } catch (err) {
    console.error("[Gemini] Image generation failed:", err);
    return null;
  }
}
