/**
 * Deterministic scoring & classification utilities for the worker pipeline.
 * No LLM needed — rules-based audience-fit scoring, geo-tagging, dedup hashing.
 */

import { createHash } from "node:crypto";
import type { GeoTag, QualityFlags, ItemSource } from "@edlight-news/types";

// ── Haiti keyword markers ───────────────────────────────────────────────────
const HAITI_MARKERS = [
  "haiti", "haïti", "ayiti", "port-au-prince", "cap-haïtien", "cap-haitien",
  "les cayes", "gonaïves", "jacmel", "jérémie", "hinche", "mirebalais",
  "pétion-ville", "petionville", "delmas", "carrefour", "cité soleil",
  "menfp", "brh", "bnrh", "uniq", "ueh", "fondasyon", "kreyòl",
  "phtk", "fanmi lavalas", "diaspora haïtien",
];

const STUDENT_MARKERS = [
  "bourse", "scholarship", "programme", "candidature", "deadline", "inscription",
  "université", "university", "étudiant", "student", "elèv", "formation",
  "stage", "internship", "concours", "admission", "diplôme", "master",
  "licence", "doctorat", "phd", "baccalauréat", "campus", "académique",
  "éducation", "education", "edikasyon", "recherche", "research",
  "curriculum", "apprentissage", "learning", "mentor", "fellowship",
  "graduate", "undergraduate", "tuition", "financial aid",
];

const OFF_MISSION_MARKERS = [
  "meurtre", "murder", "homicide", "trafic de drogue", "drug trafficking",
  "gang violence", "kidnapping", "assassinat", "fusillade", "shooting",
  "massacre", "braquage", "armed robbery",
];

// ── Domain extraction ───────────────────────────────────────────────────────
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

// ── Google News / aggregator detection ──────────────────────────────────────
const AGGREGATOR_DOMAINS = [
  "news.google.com", "google.com/amp", "news.yahoo.com",
  "msn.com", "flipboard.com", "smartnews.com",
];

export function isAggregatorUrl(url: string): boolean {
  const domain = extractDomain(url);
  return AGGREGATOR_DOMAINS.some(
    (agg) => domain === agg || domain.endsWith("." + agg),
  );
}

/**
 * Attempt to extract the original publisher URL from a Google News or
 * aggregator link. Falls back to the input url if extraction fails.
 */
export function extractOriginalUrl(url: string): { originalUrl: string; aggregatorUrl?: string } {
  try {
    const parsed = new URL(url);

    // Google News articles: "https://news.google.com/rss/articles/..."
    // or redirect URLs with a ?url= parameter
    if (parsed.hostname === "news.google.com") {
      // Some Google News URLs have the original in the query param
      const target = parsed.searchParams.get("url");
      if (target) {
        return { originalUrl: target, aggregatorUrl: url };
      }
      // Otherwise we can't extract — mark as aggregator
      return { originalUrl: url, aggregatorUrl: url };
    }

    // Generic aggregator with ?url= or ?source= param
    for (const param of ["url", "source", "redirect", "target"]) {
      const val = parsed.searchParams.get(param);
      if (val && val.startsWith("http")) {
        return { originalUrl: val, aggregatorUrl: url };
      }
    }

    if (isAggregatorUrl(url)) {
      return { originalUrl: url, aggregatorUrl: url };
    }

    return { originalUrl: url };
  } catch {
    return { originalUrl: url };
  }
}

// ── Scoring ─────────────────────────────────────────────────────────────────

function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function countMatches(text: string, markers: string[]): number {
  const normalized = normalizeForSearch(text);
  let count = 0;
  for (const marker of markers) {
    if (normalized.includes(normalizeForSearch(marker))) {
      count++;
    }
  }
  return count;
}

export interface ScoringResult {
  audienceFitScore: number;
  geoTag: GeoTag;
  offMission: boolean;
}

/**
 * Compute audience-fit score and geo-tag from title + body text.
 * Pure deterministic rules — no LLM.
 */
export function computeScoring(title: string, body: string, category?: string): ScoringResult {
  const text = `${title} ${body}`;

  const haitiHits = countMatches(text, HAITI_MARKERS);
  const studentHits = countMatches(text, STUDENT_MARKERS);
  const offMissionHits = countMatches(text, OFF_MISSION_MARKERS);

  // Base score from relevance signals
  let score = 0;

  // Haiti relevance (max +0.45)
  if (haitiHits >= 3) score += 0.45;
  else if (haitiHits >= 1) score += 0.25;

  // Student / education relevance (max +0.35)
  if (studentHits >= 3) score += 0.35;
  else if (studentHits >= 1) score += 0.20;

  // Category bonus (max +0.20)
  if (category === "scholarship" || category === "opportunity") score += 0.20;
  else if (category === "local_news") score += 0.15;
  else if (category === "resource" || category === "event") score += 0.10;

  // Off-mission penalty
  const offMission = offMissionHits >= 2 && studentHits === 0;
  if (offMission) score = Math.max(0, score - 0.40);

  // Clamp
  score = Math.min(1, Math.max(0, score));
  score = Math.round(score * 100) / 100;

  // Geo tag
  let geoTag: GeoTag = "Global";
  if (haitiHits >= 2) geoTag = "HT";
  else if (haitiHits >= 1 || normalizeForSearch(text).includes("diaspora")) geoTag = "Diaspora";

  // For Bourses/Ressources, allow Global only if student-relevant
  if ((category === "scholarship" || category === "resource") && geoTag === "Global") {
    if (studentHits === 0) {
      score = Math.max(0, score - 0.20);
    }
  }

  return { audienceFitScore: score, geoTag, offMission };
}

// ── Dedupe group ID ─────────────────────────────────────────────────────────

/**
 * Normalize title for dedup grouping: lowercase, strip accents/punctuation, first 60 chars.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Compute dedupeGroupId = sha256(normalizedTitle).
 *
 * Domain is intentionally excluded so that articles about the same story
 * from different publishers share the same group — which is required by the
 * synthesis pipeline to detect multi-source clusters.
 */
export function computeDedupeGroupId(title: string, _url?: string): string {
  const normalized = normalizeTitle(title);
  return createHash("sha256")
    .update(normalized)
    .digest("hex")
    .slice(0, 16); // 16 hex chars = 64 bits, plenty for grouping
}

// ── Build ItemSource ────────────────────────────────────────────────────────

export function buildItemSource(
  sourceName: string,
  rawUrl: string,
): { source: ItemSource; weakSource: boolean } {
  const { originalUrl, aggregatorUrl } = extractOriginalUrl(rawUrl);

  const weakSource = !!aggregatorUrl && originalUrl === aggregatorUrl;

  return {
    source: {
      name: sourceName,
      originalUrl,
      ...(aggregatorUrl ? { aggregatorUrl } : {}),
    },
    weakSource,
  };
}
