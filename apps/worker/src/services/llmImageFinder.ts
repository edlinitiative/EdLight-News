/**
 * LLM-orchestrated image finder.
 *
 * Three-step retrieve-and-validate loop:
 *   1. craftQueries  — Flash-Lite writes 3 image-search queries from the item
 *   2. gather        — Brave Image Search runs each query, collects candidates
 *   3. validate      — Flash-Lite *vision* call per top candidate decides
 *                      whether the image plausibly depicts the article subject
 *
 * Returns the highest-confidence "match=true" candidate at ≥ 1080 px shortest
 * side, or null if nothing passes. Designed to fix the class of bugs where the
 * publisher's og:image is technically valid (right size, not a stock CDN) but
 * is the WRONG photo for this story (recurring column header, generic NBA shot,
 * default share image, etc.).
 *
 * Cost: ~$0.001/item with Flash-Lite (1 text + ≤4 vision calls).
 *
 * Environment:
 *   IG_LLM_IMAGE_FINDER=true            — opt-in flag (off by default)
 *   GEMINI_API_KEY                      — required for both text + vision
 *   BRAVE_SEARCH_API_KEY                — required for the gather step
 */

import type { Item } from "@edlight-news/types";
import { getGenAI } from "@edlight-news/generator";

// ── Constants ─────────────────────────────────────────────────────────────

const BRAVE_IMAGE_API = "https://api.search.brave.com/res/v1/images/search";
const MIN_WIDTH = 1080;
const MAX_QUERIES = 3;
const CANDIDATES_PER_QUERY = 8;
const MAX_VALIDATIONS = 4; // vision calls per item, hard cap on cost
const VISION_MODEL = "gemini-2.5-flash-lite";
const TEXT_MODEL = "gemini-2.5-flash-lite";
const FETCH_TIMEOUT_MS = 8_000;

const STOCK_DOMAINS =
  /getty|shutterstock|alamy|istockphoto|depositphotos|dreamstime|123rf|bigstock|stock\.adobe/i;

// ── Public types ──────────────────────────────────────────────────────────

export interface LlmImageCandidate {
  url: string;
  thumbnail: string;
  width: number;
  height: number;
  source: string;
  pageUrl: string;
  fromQuery: string;
  /** Set after validation. */
  validation?: {
    match: boolean;
    confidence: number;
    reason: string;
  };
}

export interface LlmImageFinderResult {
  /** Final selected URL, or null when nothing passed validation. */
  url: string | null;
  width: number;
  height: number;
  /** Source domain of the chosen image. */
  source: string;
  /** Original article page URL where this image lives. */
  pageUrl: string;
  /** The Flash-Lite-generated queries we ran. */
  queries: string[];
  /** All candidates considered, ordered by validation score then size. */
  candidates: LlmImageCandidate[];
  /** Why we picked / didn't pick. Surfaced in logs and demo script. */
  reason: string;
  /** Approximate Gemini cost in USD for this run (text + vision). */
  estCostUsd: number;
}

// ── Gemini client (re-uses generator's lazy singleton) ───────────────────

function getClient(): ReturnType<typeof getGenAI> | null {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    return getGenAI();
  } catch {
    return null;
  }
}

// ── Step 1: craft queries ─────────────────────────────────────────────────

/**
 * Ask Flash-Lite to produce 3 image-search queries that would surface the
 * actual photo of the story. Falls back to a heuristic if the call fails.
 */
async function craftQueries(item: Item): Promise<string[]> {
  const client = getClient();
  const heuristicFallback = heuristicQueries(item);

  if (!client) return heuristicFallback;

  const personHint = item.entity?.personName ? `Key person: ${item.entity.personName}.` : "";
  const geoHint = item.geoTag === "HT" ? "Country: Haiti." : "";
  const summary = (item.summary ?? "").slice(0, 400);

  const prompt = [
    "You craft Google/Brave image-search queries that surface the REAL news photo for an article.",
    "Return exactly 3 queries as a JSON array of strings.",
    "Rules:",
    "- Lead with proper nouns (people, organizations, locations).",
    "- Avoid generic words like 'news', 'article', 'photo', 'image'.",
    "- Prefer short queries (3-7 words). Vary them so they don't all return the same hits.",
    "- Use the language most likely to find the original photo (often the original publication's language).",
    "",
    `Article title: ${item.title ?? ""}`,
    `Summary: ${summary}`,
    personHint,
    geoHint,
    "",
    'Output JSON only. Example: ["Tatiana Auguste Canada election", "Tatiana Auguste portrait", "Haitian-Canadian elected MP 2026"]',
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const model = client.getGenerativeModel({
      model: TEXT_MODEL,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    });
    const res = await model.generateContent(prompt);
    const txt = res.response.text().trim();
    const parsed = JSON.parse(txt) as unknown;
    if (Array.isArray(parsed)) {
      const cleaned = parsed
        .filter((q): q is string => typeof q === "string")
        .map((q) => q.trim())
        .filter((q) => q.length >= 4 && q.length <= 120);
      if (cleaned.length > 0) return cleaned.slice(0, MAX_QUERIES);
    }
  } catch (err) {
    console.warn("[llmImageFinder] craftQueries LLM failed:", err instanceof Error ? err.message : err);
  }

  return heuristicFallback;
}

/** Last-resort query builder so the pipeline still works if the LLM is down. */
function heuristicQueries(item: Item): string[] {
  const out: string[] = [];
  const person = item.entity?.personName;
  const geo = item.geoTag === "HT" ? "Haiti" : "";
  const titleTokens = (item.title ?? "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6)
    .join(" ");

  if (person && titleTokens) out.push(`${person} ${titleTokens}`.trim());
  if (titleTokens) out.push(`${titleTokens} ${geo}`.trim());
  if (person) out.push(`${person} ${geo}`.trim());
  return [...new Set(out.filter((q) => q.length >= 4))].slice(0, MAX_QUERIES);
}

// ── Step 2: gather candidates from Brave ──────────────────────────────────

interface BraveImageResult {
  title: string;
  url: string; // page URL
  thumbnail: { src: string };
  properties: { url: string; width?: number; height?: number };
  source: string;
}

async function gather(queries: string[]): Promise<LlmImageCandidate[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) {
    console.warn("[llmImageFinder] BRAVE_SEARCH_API_KEY missing — gather step disabled");
    return [];
  }

  const all = new Map<string, LlmImageCandidate>(); // dedupe by image url
  for (const q of queries) {
    try {
      const url = new URL(BRAVE_IMAGE_API);
      url.searchParams.set("q", q);
      url.searchParams.set("count", String(CANDIDATES_PER_QUERY));
      url.searchParams.set("safesearch", "strict");

      const res = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": apiKey,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        console.warn(`[llmImageFinder] Brave returned ${res.status} for "${q}"`);
        continue;
      }

      const data = (await res.json()) as { results?: BraveImageResult[] };
      for (const r of data.results ?? []) {
        const w = r.properties?.width ?? 0;
        const h = r.properties?.height ?? 0;
        if (Math.min(w, h) < MIN_WIDTH) continue;
        const src = r.properties?.url || r.thumbnail?.src;
        if (!src) continue;
        if (/\.(svg|pdf)$/i.test(src)) continue;
        if (STOCK_DOMAINS.test(r.source ?? "")) continue;
        if (all.has(src)) continue;
        all.set(src, {
          url: src,
          thumbnail: r.thumbnail?.src ?? src,
          width: w,
          height: h,
          source: r.source ?? "",
          pageUrl: r.url,
          fromQuery: q,
        });
      }
    } catch (err) {
      console.warn(
        `[llmImageFinder] gather failed for "${q}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Order by short-side resolution (proxy for editorial quality)
  return [...all.values()].sort(
    (a, b) => Math.min(b.width, b.height) - Math.min(a.width, a.height),
  );
}

// ── Step 3: validate candidates with vision ───────────────────────────────

/**
 * Fetch image bytes (resized cap is implicit; we trust Brave thumbnails or
 * the full image — Gemini handles both). Returns base64 + mime, or null.
 */
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
    if (buf.length === 0) return null;
    // Cap at ~3 MB to stay within token budget. Brave thumbs are tiny anyway.
    if (buf.length > 3_000_000) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    return { data: buf.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

interface ValidationResponse {
  match: boolean;
  confidence: number;
  reason: string;
}

async function validateOne(
  item: Item,
  candidate: LlmImageCandidate,
): Promise<ValidationResponse | null> {
  const client = getClient();
  if (!client) return null;

  // Prefer thumbnail (cheaper to download + cheaper to tokenize).
  const inline = await fetchAsInlineData(candidate.thumbnail);
  if (!inline) return null;

  const personHint = item.entity?.personName ? `Subject person: ${item.entity.personName}.` : "";
  const prompt =
    "You verify whether a candidate image plausibly depicts the subject of a news article.\n" +
    "Reply ONLY with JSON: {\"match\": boolean, \"confidence\": number 0-1, \"reason\": short string}.\n" +
    "Be strict. Return match=false if the image is a generic stock photo, an unrelated person, " +
    "a logo, a screenshot of a website, or shows a clearly different event/place.\n" +
    "Return match=true ONLY if the depicted subject matches the article topic and (when present) the named person.\n\n" +
    `Article title: ${item.title ?? ""}\n` +
    `Summary: ${(item.summary ?? "").slice(0, 300)}\n` +
    `${personHint}\n` +
    `Image source: ${candidate.source}`;

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
    const parsed = JSON.parse(txt) as Partial<ValidationResponse>;
    if (typeof parsed.match !== "boolean") return null;
    return {
      match: parsed.match,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : "",
    };
  } catch (err) {
    console.warn("[llmImageFinder] vision validation failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function validate(
  item: Item,
  candidates: LlmImageCandidate[],
): Promise<LlmImageCandidate[]> {
  const top = candidates.slice(0, MAX_VALIDATIONS);
  // Run in parallel — ≤ MAX_VALIDATIONS calls is well within Gemini limits
  await Promise.all(
    top.map(async (c) => {
      const v = await validateOne(item, c);
      if (v) c.validation = v;
    }),
  );
  return candidates;
}

// ── Cost estimation ───────────────────────────────────────────────────────

/**
 * Rough Gemini 2.5 Flash-Lite pricing (Apr 2026):
 *   $0.10 / 1M input tokens, $0.40 / 1M output tokens
 *   ~258 tokens per image input
 *
 * craftQueries: ~250 in + 80 out  → $0.000057
 * validateOne: ~258 (img) + 200 (prompt) + 30 (out) → $0.000058
 */
function estimateCost(numValidations: number, llmQueriesUsed: boolean): number {
  const queryCost = llmQueriesUsed ? 0.000057 : 0;
  const validationCost = numValidations * 0.000058;
  return queryCost + validationCost;
}

// ── Public entry point ────────────────────────────────────────────────────

/**
 * Find a topically-correct image for an item using the LLM-orchestrated
 * retrieve-and-validate loop. Returns null when no candidate passed validation.
 *
 * Always returns a fully-populated `candidates` array for traceability — the
 * demo script renders this so a human can sanity-check what the model saw.
 */
export async function findImageWithLlm(item: Item): Promise<LlmImageFinderResult> {
  const llmAvailable = !!process.env.GEMINI_API_KEY;
  const queries = await craftQueries(item);

  if (queries.length === 0) {
    return {
      url: null,
      width: 0,
      height: 0,
      source: "",
      pageUrl: "",
      queries: [],
      candidates: [],
      reason: "No queries could be crafted.",
      estCostUsd: 0,
    };
  }

  const candidates = await gather(queries);
  if (candidates.length === 0) {
    return {
      url: null,
      width: 0,
      height: 0,
      source: "",
      pageUrl: "",
      queries,
      candidates: [],
      reason: "No image candidates returned by Brave for any crafted query.",
      estCostUsd: estimateCost(0, llmAvailable),
    };
  }

  await validate(item, candidates);

  // Sort by (matched && confidence desc, then short-side desc).
  candidates.sort((a, b) => {
    const am = a.validation?.match ? 1 : 0;
    const bm = b.validation?.match ? 1 : 0;
    if (am !== bm) return bm - am;
    const ac = a.validation?.confidence ?? 0;
    const bc = b.validation?.confidence ?? 0;
    if (ac !== bc) return bc - ac;
    return Math.min(b.width, b.height) - Math.min(a.width, a.height);
  });

  const best = candidates[0];
  const validated = candidates.filter((c) => c.validation).length;

  if (!best || !best.validation?.match || (best.validation?.confidence ?? 0) < 0.55) {
    return {
      url: null,
      width: 0,
      height: 0,
      source: "",
      pageUrl: "",
      queries,
      candidates,
      reason: best?.validation
        ? `Best candidate rejected: match=${best.validation.match} confidence=${best.validation.confidence.toFixed(2)} — ${best.validation.reason}`
        : "No candidate could be validated.",
      estCostUsd: estimateCost(validated, llmAvailable),
    };
  }

  return {
    url: best.url,
    width: best.width,
    height: best.height,
    source: best.source,
    pageUrl: best.pageUrl,
    queries,
    candidates,
    reason: `Selected ${best.source} (${best.width}×${best.height}) — confidence ${best.validation.confidence.toFixed(2)}: ${best.validation.reason}`,
    estCostUsd: estimateCost(validated, llmAvailable),
  };
}
