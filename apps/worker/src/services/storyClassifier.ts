/**
 * Story classifier for image sourcing.
 *
 * Classifies each item as person-led, event-led, or country/topic-led
 * so the image search pipeline can apply the right search strategy.
 *
 * - **person**: headshot, podium shot, summit appearance
 * - **event**: actual event photo, venue, protest, parliament
 * - **topic**: official building, map, flag, abstract visual
 */

import type { Item } from "@edlight-news/types";
import type { StoryType } from "./imageTypes.js";
import { detectPersonName } from "./wikidata.js";

// ── Event keywords (FR + EN) ───────────────────────────────────────────────

const EVENT_PATTERNS: RegExp[] = [
  /\bsommet\b/i,
  /\bsummit\b/i,
  /\b[eé]lection[s]?\b/i,
  /\bvote[s]?\b/i,
  /\bscrutin\b/i,
  /\bmanifest(?:ation|er)\b/i,
  /\bprotest(?:ation)?\b/i,
  /\bparlement(?:aire)?\b/i,
  /\bassembl[eé]e\b/i,
  /\bs[eé]nat\b/i,
  /\bconseil\s+des?\s+ministres?\b/i,
  /\bcabinet\b/i,
  /\bconf[eé]rence\b/i,
  /\bforum\b/i,
  /\bcolloque\b/i,
  /\bc[eé]r[eé]monie\b/i,
  /\binaugur(?:ation|er)\b/i,
  /\bralliement\b/i,
  /\brally\b/i,
  /\bcoup\s+d['']?[eé]tat\b/i,
  /\battaque\b/i,
  /\battack\b/i,
  /\bexplosion\b/i,
  /\bs[eé]isme\b/i,
  /\bearthquake\b/i,
  /\bouragan\b/i,
  /\bhurricane\b/i,
  /\bfun[eé]railles\b/i,
  /\bfuneral\b/i,
  /\bcomm[eé]mor(?:ation|er)\b/i,
  /\bcr[eé]ation\b/i,
  /\bfondation\b/i,
  /\baccord\b/i,
  /\btrait[eé]\b/i,
  /\bsignature\b/i,
  /\bvisite\s+(?:officielle|d'[eé]tat)\b/i,
  /\bstate\s+visit\b/i,
];

// ── Topic keywords (broader) ───────────────────────────────────────────────

const TOPIC_PATTERNS: RegExp[] = [
  /\binflation\b/i,
  /\b[eé]conomie\b/i,
  /\beconomy\b/i,
  /\bbudget\b/i,
  /\bfiscal\b/i,
  /\bsanction[s]?\b/i,
  /\bembargo\b/i,
  /\bloi\b/i,
  /\blaw\b/i,
  /\bd[eé]cret\b/i,
  /\bdecree\b/i,
  /\bcrise\b/i,
  /\bcrisis\b/i,
  /\bconflit\b/i,
  /\bconflict\b/i,
  /\bguerre\b/i,
  /\bwar\b/i,
  /\baide\s+(?:humanitaire|internationale)\b/i,
  /\bhumanitarian\b/i,
  /\bmigration\b/i,
  /\bdiaspora\b/i,
  /\bcorruption\b/i,
  /\br[eé]forme\b/i,
  /\breform\b/i,
  /\bs[eé]curit[eé]\b/i,
  /\bsecurity\b/i,
  /\bgangs?\b/i,
  /\bviolence\b/i,
  /\b[eé]ducation\b/i,
  /\bsant[eé]\b/i,
  /\bhealth\b/i,
  /\benvironnement\b/i,
  /\bclima(?:t|te)\b/i,
  /\btaux\s+de?\s+change\b/i,
  /\bexchange\s+rate\b/i,
];

/**
 * Classify an item's story type for image search strategy.
 *
 * Priority: person > event > topic (person images are the most specific
 * and impactful; generic topic imagery is the fallback).
 */
export function classifyStory(item: Item): StoryType {
  const title = item.title ?? "";
  const summary = item.summary ?? "";
  const text = `${title} ${summary}`;

  // Person-led: explicit entity or name detected in title
  if (item.entity?.personName) return "person";
  const personName = detectPersonName(title, item.category);
  if (personName) return "person";

  // Event-led: title/summary matches event patterns
  for (const rx of EVENT_PATTERNS) {
    if (rx.test(text)) return "event";
  }

  // Utility series are always topic-led
  if (item.utilityMeta?.series === "HaitiHistory") return "event"; // historical events get event treatment
  if (item.utilityMeta?.series === "HaitiFactOfTheDay") return "topic";
  if (item.utilityMeta?.series === "HaitianOfTheWeek") return "person";

  // Topic-led: title/summary matches topic patterns
  for (const rx of TOPIC_PATTERNS) {
    if (rx.test(text)) return "topic";
  }

  // Default: topic (safest fallback — generic imagery)
  return "topic";
}

/**
 * Extract the primary person name from an item (for person-led stories).
 * Returns null for non-person stories.
 */
export function extractPersonName(item: Item): string | null {
  if (item.entity?.personName) return item.entity.personName;
  return detectPersonName(item.title ?? "", item.category);
}
