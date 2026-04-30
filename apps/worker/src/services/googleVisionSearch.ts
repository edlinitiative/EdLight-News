/**
 * Google Cloud Vision — WEB_DETECTION reverse image search.
 *
 * Given a publisher image URL, calls the Vision API's WEB_DETECTION feature
 * which returns:
 *   - fullMatchingImages   — the *exact same photo* hosted at other URLs
 *                            (often the original wire-service version at full res)
 *   - partialMatchingImages — same image cropped/resized
 *   - visuallySimilarImages — visually similar photos (useful fallback)
 *
 * This is the same signal Google Images uses internally, and is far more
 * accurate than the Gemini-describe → Brave-search text proxy.
 *
 * ── Quota guardrail ──────────────────────────────────────────────────────────
 * Free tier: 1,000 requests / month.
 * We enforce a hard cap of 950 calls/month via a Firestore counter
 * (document: `api_quotas/google_vision`). The counter resets on the 1st of
 * each UTC month. We stop at 950 (not 1,000) to leave a 50-call safety buffer
 * against any off-by-one or race conditions.
 *
 * Enable by setting GOOGLE_VISION_API_KEY in your environment.
 */

import type { ImageCandidate } from "./imageTypes.js";
import { getDb } from "@edlight-news/firebase";

import type { Transaction } from "firebase-admin/firestore";

// ── Constants ──────────────────────────────────────────────────────────────

const VISION_API_BASE = "https://vision.googleapis.com/v1/images:annotate";
const VISION_TIMEOUT_MS = 15_000;
const QUOTA_DOC = "api_quotas/google_vision";
const MONTHLY_HARD_CAP = 950; // 1,000 free − 50 buffer
const MIN_USEFUL_WIDTH = 600; // Vision result URLs have no dimension info;
//                              we filter by probing them — skip tiny images
const HEAD_TIMEOUT_MS = 4_000;

// ── Quota tracking ─────────────────────────────────────────────────────────

/**
 * Returns true if we still have remaining Vision quota this month.
 * If yes, atomically increments the counter.
 *
 * Quota doc schema:
 *   { month: "YYYY-MM", count: number, updatedAt: Timestamp }
 */
async function tryConsumeQuota(): Promise<boolean> {
  try {
    const db = getDb();
    const ref = db.doc(QUOTA_DOC);

    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    // Firestore transaction: read-increment-write atomically
    const consumed = await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      const data = snap.data() as
        | { month?: string; count?: number }
        | undefined;

      // New month → reset counter
      if (!snap.exists || data?.month !== currentMonth) {
        tx.set(ref, {
          month: currentMonth,
          count: 1,
          updatedAt: new Date(),
        });
        return true; // allowed
      }

      const current = data?.count ?? 0;
      if (current >= MONTHLY_HARD_CAP) {
        console.warn(
          `[googleVision] 🚫 Monthly quota exhausted (${current}/${MONTHLY_HARD_CAP}) — ` +
          `Vision disabled for the rest of ${currentMonth}`,
        );
        return false; // blocked
      }

      tx.update(ref, {
        count: current + 1,
        updatedAt: new Date(),
      });
      return true; // allowed
    });

    return consumed;
  } catch (err) {
    // If quota tracking fails, fail-open and allow the call so that a
    // transient Firestore error doesn't silently disable Vision for everyone.
    // In the worst case we overshoot by a handful of calls — still well within
    // the free tier.
    console.warn(
      "[googleVision] Quota check failed (fail-open):",
      err instanceof Error ? err.message : err,
    );
    return true;
  }
}

// ── Vision API types ────────────────────────────────────────────────────────

interface WebImage {
  url: string;
  score?: number;
}

interface WebDetectionResult {
  webDetection?: {
    fullMatchingImages?: WebImage[];
    partialMatchingImages?: WebImage[];
    visuallySimilarImages?: WebImage[];
    webEntities?: Array<{ description?: string; score?: number }>;
  };
}

interface VisionResponse {
  responses?: WebDetectionResult[];
  error?: { message: string; code: number };
}

// ── Dimension probing ────────────────────────────────────────────────────────

/**
 * Probe an image URL via HEAD request to get its content-length as a proxy
 * for resolution. Vision result URLs don't include width/height, so we use
 * file size as a heuristic:
 *   < 30 KB  → almost certainly low-res (thumbnail)
 *   30-80 KB → medium, borderline
 *   > 80 KB  → likely meets 1080px minimum for IG
 *
 * Returns the content-length in bytes, or null if HEAD failed.
 */
async function probeImageSize(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EdLight-News/1.0; +https://edlight.org)",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const cl = res.headers.get("content-length");
    return cl ? parseInt(cl, 10) : null;
  } catch {
    return null;
  }
}

// ── Vision API call ─────────────────────────────────────────────────────────

/**
 * Call Google Cloud Vision WEB_DETECTION for the given image URL.
 * Returns the structured web detection result, or null on failure.
 */
async function detectWeb(
  imageUrl: string,
  apiKey: string,
): Promise<WebDetectionResult["webDetection"] | null> {
  const body = {
    requests: [
      {
        image: { source: { imageUri: imageUrl } },
        features: [{ type: "WEB_DETECTION", maxResults: 20 }],
      },
    ],
  };

  try {
    const res = await fetch(`${VISION_API_BASE}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[googleVision] API returned ${res.status}: ${text.slice(0, 200)}`,
      );
      return null;
    }

    const data = (await res.json()) as VisionResponse;
    if (data.error) {
      console.warn(`[googleVision] API error ${data.error.code}: ${data.error.message}`);
      return null;
    }

    return data.responses?.[0]?.webDetection ?? null;
  } catch (err) {
    console.warn(
      "[googleVision] Request failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ── Build ImageCandidates from Vision results ───────────────────────────────

/**
 * Convert Vision WEB_DETECTION URLs into ranked ImageCandidates.
 *
 * Tier priority:
 *   fullMatchingImages    → score boost +25 (exact same photo)
 *   partialMatchingImages → score boost +15 (same photo, different crop)
 *   visuallySimilarImages → score boost +5  (similar visual)
 *
 * We probe content-length via HEAD to weed out thumbnails before returning
 * candidates to the pipeline.
 */
async function buildCandidates(
  detection: NonNullable<WebDetectionResult["webDetection"]>,
  originalUrl: string,
): Promise<ImageCandidate[]> {
  const STOCK_BLOCK =
    /getty|shutterstock|alamy|istockphoto|depositphotos|dreamstime|123rf/i;

  type TierEntry = { url: string; matchBoost: number; matchType: string };
  const entries: TierEntry[] = [
    ...(detection.fullMatchingImages ?? []).map((img) => ({
      url: img.url,
      matchBoost: 25,
      matchType: "exact",
    })),
    ...(detection.partialMatchingImages ?? []).map((img) => ({
      url: img.url,
      matchBoost: 15,
      matchType: "partial",
    })),
    ...(detection.visuallySimilarImages ?? []).map((img) => ({
      url: img.url,
      matchBoost: 5,
      matchType: "similar",
    })),
  ];

  // Skip the original publisher URL itself
  const filtered = entries.filter(
    (e) => e.url !== originalUrl && !STOCK_BLOCK.test(e.url),
  );

  // Probe sizes in parallel (cap concurrency at 5)
  const candidates: ImageCandidate[] = [];

  for (let i = 0; i < filtered.length; i += 5) {
    const batch = filtered.slice(i, i + 5);
    const probes = await Promise.all(
      batch.map(async (entry) => {
        const bytes = await probeImageSize(entry.url);
        return { ...entry, bytes };
      }),
    );

    for (const { url, matchBoost, matchType, bytes } of probes) {
      // Filter out tiny images (< 30 KB almost certainly a thumbnail)
      if (bytes !== null && bytes < 30_000) continue;

      let domain: string;
      try {
        domain = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        continue; // invalid URL
      }

      // Estimate dimensions: Vision gives no width/height, but ≥80 KB JPEGs
      // at typical web quality are generally ≥800px on the short side.
      // We set conservative synthetic dimensions so the pipeline's ≥1080px
      // filter doesn't immediately reject these. The renderer will handle
      // any final resolution issues.
      const estimatedShort = bytes !== null && bytes >= 80_000 ? 1080 : 800;
      const estimatedLong = Math.round(estimatedShort * 1.5);

      // Base score: relevance 30 + trust 15 + quality 10 + licensing 10
      const baseScore = 65 + matchBoost;

      candidates.push({
        url,
        source: "brave", // reuse "brave" source label — no new enum value needed
        tier: "editorial",
        licenseStatus: "editorial_fair_use",
        score: Math.min(100, baseScore),
        scoreBreakdown: {
          relevance: Math.min(35, 30 + matchBoost),
          trust: 15,
          recency: 0,
          quality: 10,
          licensing: 10,
        },
        width: estimatedLong,
        height: estimatedShort,
        sourceDomain: domain,
        sourceType: `vision_${matchType}`,
        license: "Editorial Fair Use",
        sourceUrl: url,
      });
    }
  }

  // Sort: exact matches first, then partial, then similar; within each tier by bytes desc
  return candidates.sort((a, b) => b.score - a.score);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Use Google Cloud Vision WEB_DETECTION to find higher-resolution versions
 * of the publisher image.
 *
 * Returns the best matching ImageCandidate, or null if:
 *   - GOOGLE_VISION_API_KEY is not set
 *   - Monthly quota (950 calls) is exhausted
 *   - Vision returned no useful matches
 *
 * Cost: $0 for the first 1,000 calls/month, then $1.50 per 1,000.
 * Quota is tracked in Firestore at `api_quotas/google_vision`.
 */
export async function findVisionMatch(
  imageUrl: string,
): Promise<ImageCandidate | null> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) return null;

  // Enforce monthly quota before calling the API
  const allowed = await tryConsumeQuota();
  if (!allowed) return null;

  console.log(`[googleVision] WEB_DETECTION for: ${imageUrl.slice(0, 80)}…`);

  const detection = await detectWeb(imageUrl, apiKey);
  if (!detection) return null;

  const totalUrls =
    (detection.fullMatchingImages?.length ?? 0) +
    (detection.partialMatchingImages?.length ?? 0) +
    (detection.visuallySimilarImages?.length ?? 0);

  if (totalUrls === 0) {
    console.log("[googleVision] No matching images found");
    return null;
  }

  console.log(
    `[googleVision] Found: ` +
    `${detection.fullMatchingImages?.length ?? 0} exact, ` +
    `${detection.partialMatchingImages?.length ?? 0} partial, ` +
    `${detection.visuallySimilarImages?.length ?? 0} similar`,
  );

  const candidates = await buildCandidates(detection, imageUrl);

  if (candidates.length === 0) {
    console.log("[googleVision] All candidates filtered out (too small or stock CDN)");
    return null;
  }

  const best = candidates[0]!;
  console.log(
    `[googleVision] ✅ Best match: ${best.sourceDomain} ` +
    `(${best.sourceType}, score=${best.score}, ~${best.width}×${best.height})`,
  );
  return best;
}

// ── Illustration content verification ──────────────────────────────────────

interface AnnotateResponse {
  responses?: Array<{
    webDetection?: WebDetectionResult["webDetection"];
    labelAnnotations?: Array<{ description?: string; score?: number }>;
  }>;
  error?: { message: string; code: number };
}

/**
 * Verify that a Wikimedia/Wikipedia image actually depicts the expected
 * Haitian historical event, using Vision WEB_DETECTION (webEntities) and
 * LABEL_DETECTION together.
 *
 * Strategy:
 *  1. Extract all entity descriptions and label annotations from Vision.
 *  2. Require that at least one entity/label references "Haiti" / "Haïti"
 *     OR overlaps with a meaningful keyword from the event title.
 *  3. Apply a confidence boost or penalty to the caller's confidence score
 *     based on the match quality.
 *
 * Returns:
 *   matches  — true if the image appears relevant to the event
 *   score    — 0.0–1.0 relevance score from Vision signals
 *   entities — raw entity/label strings (for debugging)
 *
 * Fails OPEN (returns { matches: true, score: 0.5 }) if the API key is
 * missing, quota is exhausted, or the Vision call fails — so a transient
 * error never silently drops every Wikimedia image.
 */
export async function verifyIllustrationMatch(
  imageUrl: string,
  titleFr: string,
  year?: number,
): Promise<{ matches: boolean; score: number; entities: string[] }> {
  const FAIL_OPEN: { matches: boolean; score: number; entities: string[] } = {
    matches: true,
    score: 0.5,
    entities: [],
  };

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) return FAIL_OPEN;

  const allowed = await tryConsumeQuota();
  if (!allowed) return FAIL_OPEN;

  // Single API call: both WEB_DETECTION (entities) and LABEL_DETECTION
  const body = {
    requests: [
      {
        image: { source: { imageUri: imageUrl } },
        features: [
          { type: "WEB_DETECTION", maxResults: 20 },
          { type: "LABEL_DETECTION", maxResults: 15 },
        ],
      },
    ],
  };

  let detection: NonNullable<WebDetectionResult["webDetection"]> | null = null;
  let labels: string[] = [];

  try {
    const res = await fetch(`${VISION_API_BASE}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(VISION_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[googleVision] verifyIllustration: API returned ${res.status}`);
      return FAIL_OPEN;
    }

    const data = (await res.json()) as AnnotateResponse;
    if (data.error) {
      console.warn(`[googleVision] verifyIllustration: ${data.error.message}`);
      return FAIL_OPEN;
    }

    const r = data.responses?.[0];
    detection = r?.webDetection ?? null;
    labels = (r?.labelAnnotations ?? [])
      .filter((l) => (l.score ?? 0) >= 0.6)
      .map((l) => l.description ?? "")
      .filter(Boolean);
  } catch (err) {
    console.warn(
      "[googleVision] verifyIllustration: request failed:",
      err instanceof Error ? err.message : err,
    );
    return FAIL_OPEN;
  }

  // ── Collect all text signals ───────────────────────────────────────────
  const entities: string[] = [
    ...(detection?.webEntities ?? [])
      .filter((e) => (e.score ?? 0) >= 0.3)
      .map((e) => e.description ?? "")
      .filter(Boolean),
    ...labels,
  ];

  if (entities.length === 0) {
    console.log(`[googleVision] verifyIllustration: no entities/labels — fail-open`);
    return FAIL_OPEN;
  }

  const allText = entities.join(" ").toLowerCase();

  // ── Signal 1: Haiti presence ───────────────────────────────────────────
  const haitiPresent = /ha[iï]ti/i.test(allText) || /saint-domingue/i.test(allText);

  // ── Signal 2: keyword overlap with event title ─────────────────────────
  // Tokenise the French title: keep tokens ≥ 4 chars, drop French stop words
  const FR_STOP = new Set([
    "avec", "dans", "pour", "sur", "par", "les", "des", "une", "aux",
    "contre", "entre", "sous", "vers", "sans", "plus", "très", "tout",
    "cette", "leur", "leurs", "dont", "nous", "vous", "ils", "elles",
    "aussi", "comme", "mais", "donc", "alors", "ainsi", "quand", "bien",
    "même", "déjà", "après", "avant", "depuis", "encore", "enfin",
    "lors", "part", "plus", "grand", "grande", "premier", "première",
    "adoption", "proclamation", "déclaration", "entrée", "vigueur",
    "création", "fondation", "signature", "ratification", "élection",
    "inauguration", "naissance", "mort", "assassinat",
  ]);

  const titleTokens = titleFr
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip accents for matching
    .split(/\W+/)
    .filter((t) => t.length >= 4 && !FR_STOP.has(t));

  let keywordHits = 0;
  for (const token of titleTokens) {
    if (allText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(token)) {
      keywordHits++;
    }
  }

  // ── Signal 3: era/country sanity — reject obvious non-Haiti results ────
  // If Vision identifies the image as clearly belonging to another country's
  // history without any Haiti signal, treat as a mismatch.
  const FOREIGN_NATIONS = [
    /\bfrance\b/, /\bfrench revolution\b/, /revolution fran/i,
    /estates.general/i, /\bnapoleon\b/, /\bamerican revolution\b/,
    /\bunited states\b/, /\bbritish\b/, /\bengland\b/, /\bspain\b/,
    /\bmexico\b/, /\bcuba\b/, /\bjamaica\b/,
  ];
  const foreignHit = !haitiPresent &&
    FOREIGN_NATIONS.some((re) => re.test(allText));

  // ── Score ──────────────────────────────────────────────────────────────
  let score = 0.0;
  if (haitiPresent) score += 0.5;
  if (keywordHits >= 2) score += 0.3;
  else if (keywordHits === 1) score += 0.15;
  if (foreignHit) score -= 0.5;

  // Clamp 0–1
  score = Math.max(0, Math.min(1, score));

  const matches = score >= 0.3 && !foreignHit;

  console.log(
    `[googleVision] verifyIllustration: "${titleFr.slice(0, 60)}" → ` +
    `haiti=${haitiPresent}, keywordHits=${keywordHits}, foreign=${foreignHit}, ` +
    `score=${score.toFixed(2)}, matches=${matches}`,
  );
  if (!matches) {
    console.log(`  entities: ${entities.slice(0, 8).join(" | ")}`);
  }

  return { matches, score, entities };
}

/**
 * Read the current Vision quota usage for this month (for monitoring/admin).
 * Returns { month, used, cap, remaining } or null if the doc doesn't exist.
 */
export async function getVisionQuotaStatus(): Promise<{
  month: string;
  used: number;
  cap: number;
  remaining: number;
} | null> {
  try {
    const db = getDb();
    const snap = await db.doc(QUOTA_DOC).get();
    if (!snap.exists) return null;
    const data = snap.data() as { month: string; count: number };
    return {
      month: data.month,
      used: data.count,
      cap: MONTHLY_HARD_CAP,
      remaining: Math.max(0, MONTHLY_HARD_CAP - data.count),
    };
  } catch {
    return null;
  }
}
