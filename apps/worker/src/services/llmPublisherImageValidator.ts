/**
 * Single-shot LLM vision validator for the publisher's og:image.
 *
 * Catches the "right size, wrong photo" failure mode: the publisher's image
 * is technically usable (≥ 720 px, valid aspect ratio, not a stock CDN) but
 * is the WRONG photo for this story — typically a recurring column header
 * (e.g. every "Lettre ouverte à Ariana" piece reuses the same Ariana photo)
 * or a generic illustration for a topic vertical (e.g. an NBA league logo
 * on every basketball post regardless of the actual player covered).
 *
 * One Flash-Lite vision call. Cost ≈ $0.000058 per call.
 */

import type { Item } from "@edlight-news/types";
import { getGenAI } from "@edlight-news/generator";

const FETCH_TIMEOUT_MS = 8_000;
const VISION_MODEL = "gemini-2.5-flash-lite";

function getClient(): ReturnType<typeof getGenAI> | null {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    return getGenAI();
  } catch {
    return null;
  }
}

export interface PublisherImageValidation {
  /** True when the LLM thinks the image plausibly depicts the article subject. */
  match: boolean;
  /** 0-1 confidence. */
  confidence: number;
  /** Short human-readable reason. */
  reason: string;
}

async function fetchAsInlineData(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; EdLight-News/1.0; +https://edlight.org)",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 5_000_000) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    return { data: buf.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

/**
 * Returns null when the validator can't run (no API key, no image, fetch
 * failure). Callers should treat null as "unknown" — i.e. don't change
 * existing behavior. Returns a validation result when a real opinion was
 * formed.
 */
export async function validatePublisherImage(
  item: Item,
): Promise<PublisherImageValidation | null> {
  if (!item.imageUrl) return null;
  return validateImageForItem(item, item.imageUrl);
}

/**
 * Same vision check as `validatePublisherImage`, but accepts an arbitrary
 * URL — used by the unified IG image pipeline to validate substitute
 * images returned by the keyword/tiered/Commons fallbacks before they
 * ship. A `null` return means "could not form an opinion" (no key, fetch
 * failed, etc.) and callers should treat it as a soft pass.
 */
export async function validateImageForItem(
  item: Item,
  imageUrl: string,
): Promise<PublisherImageValidation | null> {
  if (!imageUrl) return null;
  const client = getClient();
  if (!client) return null;

  const inline = await fetchAsInlineData(imageUrl);
  if (!inline) return null;

  const personHint = item.entity?.personName
    ? `Subject person: ${item.entity.personName}.`
    : "";
  const prompt =
    "You verify whether a candidate news image plausibly depicts the subject of an article.\n" +
    "Reply ONLY with JSON: {\"match\": boolean, \"confidence\": number 0-1, \"reason\": short string}.\n" +
    "Be strict. Return match=false when ANY of the following is true:\n" +
    "  - The image is a generic stock photo, illustration, or icon.\n" +
    "  - The image is a website screenshot, logo, or banner.\n" +
    "  - The image clearly depicts a different person than the named subject.\n" +
    "  - The image depicts a clearly different event, place, or topic.\n" +
    "  - The image is a recurring column header that doesn't depict the article subject.\n" +
    "Return match=true when the depicted subject reasonably matches the article topic and the named person (if any).\n\n" +
    `Article title: ${item.title ?? ""}\n` +
    `Summary: ${(item.summary ?? "").slice(0, 300)}\n` +
    `${personHint}`;

  try {
    const model = client.getGenerativeModel({
      model: VISION_MODEL,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 128,
        responseMimeType: "application/json",
      },
    });
    const res = await model.generateContent([
      { inlineData: inline },
      { text: prompt },
    ]);
    const txt = res.response.text().trim();
    const parsed = JSON.parse(txt) as Partial<PublisherImageValidation>;
    if (typeof parsed.match !== "boolean") return null;
    return {
      match: parsed.match,
      confidence:
        typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : "",
    };
  } catch (err) {
    console.warn(
      "[llmPublisherImageValidator] vision call failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
