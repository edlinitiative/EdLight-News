/**
 * Rotating Creole/diaspora hashtag pools (P3).
 *
 * Each topic has a pool of thematically appropriate hashtags.
 * `pickHashtags(topic, seed)` deterministically selects a pair from the
 * pool using a numeric seed (e.g. a hash of the item ID), so the same item
 * always gets the same tags but different items rotate through the pool.
 *
 * Feature-flagged: when HASHTAG_ROTATION=false the legacy static pair is
 * returned instead (safe default off for existing posts in flight).
 */

export type SocialHashtagTopic =
  | "scholarship"
  | "opportunity"
  | "education"
  | "news"
  | "other";

// ── Hashtag pools ─────────────────────────────────────────────────────────────
// Each pool contains pairs (2 hashtags per post) so the returned string is
// always a consistent length and won't blow the character budget.

const POOLS: Record<SocialHashtagTopic, [string, string][]> = {
  scholarship: [
    ["#Haïti", "#Bourses"],
    ["#Haiti", "#Scholarships"],
    ["#Diaspora", "#Bourses"],
    ["#Haïti", "#BoursesDEtudes"],
    ["#JeunesseHaïtienne", "#Bourses"],
    ["#EdLightNews", "#Bourses"],
  ],
  opportunity: [
    ["#Haïti", "#Opportunités"],
    ["#Haiti", "#Opportunities"],
    ["#Diaspora", "#Opportunités"],
    ["#Haïti", "#Emploi"],
    ["#JeunesseHaïtienne", "#Opportunités"],
    ["#EdLightNews", "#Opportunités"],
  ],
  education: [
    ["#Haïti", "#Éducation"],
    ["#Haiti", "#Education"],
    ["#Diaspora", "#Éducation"],
    ["#Haïti", "#Apprentissage"],
    ["#JeunesseHaïtienne", "#Éducation"],
    ["#EdLightNews", "#Éducation"],
  ],
  news: [
    ["#Haïti", "#Actualités"],
    ["#Haiti", "#News"],
    ["#Haïti", "#NouvelHaïti"],
    ["#Diaspora", "#Haïti"],
    ["#EdLightNews", "#Haïti"],
    ["#Haïti", "#MédiaHaïtien"],
  ],
  other: [
    ["#Haïti", "#EdLightNews"],
    ["#Haiti", "#News"],
    ["#Haïti", "#Actualités"],
  ],
};

// ── Simple deterministic string hash (djb2-ish) ───────────────────────────────
function hashCode(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
    h = h >>> 0; // keep 32-bit unsigned
  }
  return h;
}

/**
 * Pick a hashtag pair for a given topic and seed string (typically item ID).
 * Returns a single space-separated string ready to append to post text.
 *
 * When HASHTAG_ROTATION is not "true", falls back to the legacy static pair.
 */
export function pickHashtags(topic: SocialHashtagTopic, seed: string): string {
  const pool = POOLS[topic] ?? POOLS.other;
  if (process.env.HASHTAG_ROTATION !== "true") {
    // Legacy static pairs (pre-P3 behavior)
    const legacy: Record<SocialHashtagTopic, string> = {
      scholarship: "#Haïti #Bourses",
      opportunity: "#Haïti #Opportunités",
      education: "#Haïti #Éducation",
      news: "#Haïti #Actualités",
      other: "#Haïti #EdLightNews",
    };
    return legacy[topic] ?? "#Haïti #EdLightNews";
  }
  const idx = hashCode(seed) % pool.length;
  return pool[idx]!.join(" ");
}

/**
 * X-specific hashtag pool — shorter tags (no accents for ASCII-safe clients).
 */
const X_POOLS: Record<SocialHashtagTopic, [string, string][]> = {
  scholarship: [
    ["#Haiti", "#Bourses"],
    ["#Haiti", "#Scholarships"],
    ["#Diaspora", "#Bourses"],
    ["#HaitiYouth", "#Scholarships"],
    ["#EdLightNews", "#Bourses"],
  ],
  opportunity: [
    ["#Haiti", "#Opportunités"],
    ["#Haiti", "#Opportunities"],
    ["#Diaspora", "#Opportunités"],
    ["#HaitiJobs", "#Opportunités"],
    ["#EdLightNews", "#Opportunités"],
  ],
  education: [
    ["#Haiti", "#Éducation"],
    ["#Haiti", "#Education"],
    ["#Diaspora", "#Education"],
    ["#HaitiYouth", "#Education"],
    ["#EdLightNews", "#Education"],
  ],
  news: [
    ["#Haiti", "#EdLightNews"],
    ["#Haiti", "#News"],
    ["#Diaspora", "#Haiti"],
    ["#EdLightNews", "#Haiti"],
  ],
  other: [
    ["#Haiti", "#EdLightNews"],
    ["#Haiti", "#News"],
  ],
};

/** Same as pickHashtags but uses the X-optimised pool. */
export function pickHashtagsX(topic: SocialHashtagTopic, seed: string): string {
  const pool = X_POOLS[topic] ?? X_POOLS.other;
  if (process.env.HASHTAG_ROTATION !== "true") {
    const legacy: Record<SocialHashtagTopic, string> = {
      scholarship: "#Haiti #Bourses",
      opportunity: "#Haiti #Opportunités",
      education: "#Haiti #Éducation",
      news: "#Haiti #EdLightNews",
      other: "#Haiti #EdLightNews",
    };
    return legacy[topic] ?? "#Haiti #EdLightNews";
  }
  const idx = hashCode(seed) % pool.length;
  return pool[idx]!.join(" ");
}

/**
 * Instagram caption hashtag bundle (P4 followup).
 *
 * Returns a deterministic bundle of `count` unique hashtags drawn from the
 * topic pool, falling back to evergreen tags so we always hit the requested
 * count. Only emits non-empty output when `HASHTAG_ROTATION=true`; otherwise
 * returns "" so callers can append nothing without a layout change.
 */
const IG_EVERGREEN: string[] = [
  "#Haïti",
  "#Haiti",
  "#EdLightNews",
  "#Diaspora",
  "#HaitiYouth",
  "#Éducation",
  "#Education",
  "#Actualités",
];

export function pickHashtagsIg(
  topic: SocialHashtagTopic,
  seed: string,
  count = 6,
): string {
  if (process.env.HASHTAG_ROTATION !== "true") return "";

  const pool = (POOLS[topic] ?? POOLS.other).flat();
  const seen = new Set<string>();
  const ordered: string[] = [];
  const startIdx = hashCode(seed) % Math.max(pool.length, 1);

  // Walk the topic pool starting from a seed-determined offset so the same
  // item gets the same bundle on every retry.
  for (let i = 0; i < pool.length && ordered.length < count; i++) {
    const tag = pool[(startIdx + i) % pool.length]!;
    if (!seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      ordered.push(tag);
    }
  }
  // Top up from evergreen pool, also seeded so order is deterministic.
  for (let i = 0; i < IG_EVERGREEN.length && ordered.length < count; i++) {
    const tag = IG_EVERGREEN[(startIdx + i) % IG_EVERGREEN.length]!;
    if (!seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      ordered.push(tag);
    }
  }
  return ordered.join(" ");
}
