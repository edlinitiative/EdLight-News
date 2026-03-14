import type { IGFormattedPayload, IGPostType, IGSlide } from "@edlight-news/types";

const SENTENCE_BOUNDARY_RE = /[.!?](?=\s|$)/g;
const STOP_WORDS = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "et", "en",
  "est", "sont", "dans", "pour", "par", "avec", "sur", "qui", "que",
  "ce", "cette", "au", "aux", "se", "ne", "pas", "a", "à", "été",
  "il", "elle", "ils", "ont", "son", "sa", "ses", "leurs", "leur",
  "mais", "ou", "où", "aussi", "plus", "très", "tout", "tous",
  "the", "of", "and", "to", "in", "is", "for", "that", "on", "was",
]);
const EN_MARKERS = [
  /\bmust be\b/i, /\bshould be\b/i, /\bapplicants?\b/i,
  /\brequired\b/i, /\bsubmit\b/i, /\byou must\b/i,
  /\beligible\b/i, /\bcitizens? of\b/i, /\bapply online\b/i,
  /\bscholarship\b/i, /\bfunding\b/i, /\bfellowship\b/i,
  /\bthe applicant\b/i, /\bopen to\b/i, /\bmust have\b/i,
  /\bdeveloping countr/i, /\ball nationalities\b/i,
  /\bthe following\b/i, /\bin order to\b/i, /\bplease note\b/i,
  /\bfor more information\b/i, /\bclick here\b/i,
];

export interface IGPublishIssue {
  severity: "error" | "warning";
  message: string;
}

export interface IGPublishValidationResult {
  payload: IGFormattedPayload;
  issues: IGPublishIssue[];
  shouldHold: boolean;
}

export function validatePayloadForPublishing(
  payload: IGFormattedPayload,
  igType: IGPostType,
): IGPublishValidationResult {
  const normalizedPayload = normalizePayloadForPublishing(payload);
  const issues: IGPublishIssue[] = [];

  if (normalizedPayload.slides.length === 0) {
    issues.push({ severity: "error", message: "Aucune slide à publier." });
  }

  if (normalizedPayload.caption.length < 140) {
    issues.push({
      severity: "error",
      message: "Légende trop courte pour un post Instagram éditorial.",
    });
  }

  if (hasCaptionQualityIssues(normalizedPayload.caption)) {
    issues.push({
      severity: "error",
      message: "La légende contient encore des répétitions ou une fin incomplète.",
    });
  }

  if (needsReview(normalizedPayload, igType)) {
    issues.push({
      severity: "error",
      message: "Le contenu présente encore des problèmes de langue ou de cohérence.",
    });
  }

  for (let i = 0; i < normalizedPayload.slides.length; i++) {
    const slide = normalizedPayload.slides[i]!;
    if (!slide.heading.trim()) {
      issues.push({ severity: "error", message: `Slide ${i + 1}: titre vide.` });
    }

    const bulletSet = new Set<string>();
    for (const bullet of slide.bullets) {
      if (!bullet.trim()) {
        issues.push({ severity: "error", message: `Slide ${i + 1}: puce vide.` });
        continue;
      }
      const key = bullet.toLowerCase();
      if (bulletSet.has(key)) {
        issues.push({ severity: "error", message: `Slide ${i + 1}: puces dupliquées.` });
      }
      bulletSet.add(key);
    }
  }

  for (let i = 0; i < normalizedPayload.slides.length; i++) {
    for (let j = i + 1; j < normalizedPayload.slides.length; j++) {
      const score = similarity(slideText(normalizedPayload.slides[i]!), slideText(normalizedPayload.slides[j]!));
      if (score >= 0.72) {
        issues.push({
          severity: "error",
          message: `Slides ${i + 1} et ${j + 1}: contenu trop similaire.`,
        });
      }
    }
  }

  return {
    payload: normalizedPayload,
    issues,
    shouldHold: issues.some((issue) => issue.severity === "error"),
  };
}

function normalizePayloadForPublishing(payload: IGFormattedPayload): IGFormattedPayload {
  return {
    ...payload,
    slides: payload.slides.map((slide) => normalizeSlide(slide)),
    caption: finalizeCaption(payload.caption),
  };
}

function normalizeSlide(slide: IGSlide): IGSlide {
  const bullets: string[] = [];
  const seen = new Set<string>();

  for (const bullet of slide.bullets) {
    const normalized = normalizeLine(bullet);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    bullets.push(normalized);
  }

  return {
    ...slide,
    heading: normalizeLine(slide.heading),
    bullets,
    ...(slide.footer ? { footer: normalizeLine(slide.footer) } : {}),
  };
}

function normalizeLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function needsReview(payload: IGFormattedPayload, igType: IGPostType): boolean {
  const maxEmoji = igType === "histoire" ? 2 : 5;
  if (countPayloadEmojis(payload) > maxEmoji) return true;

  const allText = payload.slides.flatMap((slide) => [slide.heading, ...slide.bullets]).join(" ");
  if (hasEnglishMarkers(allText) || hasEnglishMarkers(payload.caption)) return true;
  if (hasCaptionQualityIssues(payload.caption)) return true;

  if (payload.slides.length >= 2) {
    const heading0 = payload.slides[0]!.heading.toLowerCase();
    for (let i = 1; i < payload.slides.length; i++) {
      const heading = payload.slides[i]!.heading.toLowerCase();
      if (heading === heading0 || similarity(heading0, heading) > 0.8) return true;
    }
  }

  return false;
}

function countPayloadEmojis(payload: IGFormattedPayload): number {
  let total = 0;
  for (const slide of payload.slides) {
    total += countEmojis(slide.heading);
    for (const bullet of slide.bullets) total += countEmojis(bullet);
  }
  return total;
}

function countEmojis(text: string): number {
  return (text.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu) || []).length;
}

function hasEnglishMarkers(text: string): boolean {
  let hits = 0;
  for (const marker of EN_MARKERS) {
    if (marker.test(text)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

function finalizeCaption(caption: string): string {
  const rawBlocks = normalizeCaptionWhitespace(caption)
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const keptBlocks: string[] = [];
  const proseBlocks: string[] = [];

  for (const rawBlock of rawBlocks) {
    const block = rawBlock
      .split("\n")
      .map((line) => line.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!block) continue;
    if (isCaptionMetaBlock(block)) {
      keptBlocks.push(block);
      continue;
    }

    const repaired = repairCaptionBlock(block);
    if (!repaired) continue;
    if (proseBlocks.some((previous) => areCaptionBlocksSimilar(previous, repaired))) continue;

    proseBlocks.push(repaired);
    keptBlocks.push(repaired);
  }

  return trimToCompleteThought(keptBlocks.join("\n\n"), 2200);
}

function hasCaptionQualityIssues(caption: string): boolean {
  const blocks = normalizeCaptionWhitespace(caption)
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  const proseBlocks: string[] = [];
  for (const block of blocks) {
    if (isCaptionMetaBlock(block)) continue;
    if (looksLikeBrokenCaptionBlock(block)) return true;
    if (proseBlocks.some((previous) => areCaptionBlocksSimilar(previous, block))) return true;
    proseBlocks.push(block);
  }

  return false;
}

function normalizeCaptionWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isCaptionMetaBlock(block: string): boolean {
  const trimmed = block.trim();
  return /^#/.test(trimmed)
    || /^source:/i.test(trimmed)
    || /lien dans la bio|lyen nan biyo/i.test(trimmed)
    || /https?:\/\//i.test(trimmed);
}

function looksLikeBrokenCaptionBlock(block: string): boolean {
  if (isCaptionMetaBlock(block)) return false;
  const trimmed = block.trim();
  if (!trimmed) return false;
  if (/…$/.test(trimmed)) return true;
  if (/[,:;–—-]$/.test(trimmed)) return true;
  return !/[.!?](?:["')\]]+)?$/u.test(trimmed);
}

function repairCaptionBlock(block: string): string {
  const trimmed = normalizeCaptionWhitespace(block);
  if (!trimmed) return "";
  if (isCaptionMetaBlock(trimmed)) return trimmed;
  if (!looksLikeBrokenCaptionBlock(trimmed)) return trimmed;

  const withoutEllipsis = trimmed.replace(/…+$/u, "").trim();
  const lastBoundary = findLastSentenceBoundary(withoutEllipsis);
  if (lastBoundary > withoutEllipsis.length * 0.45) {
    return withoutEllipsis.slice(0, lastBoundary + 1).trim();
  }

  return withoutEllipsis.replace(/[,:;–—\-\s]+$/u, "").trim() + ".";
}

function trimToCompleteThought(text: string, max: number): string {
  const cleaned = normalizeCaptionWhitespace(text);
  if (cleaned.length <= max) return repairCaptionBlock(cleaned);

  const chunk = cleaned.slice(0, max);
  const lastSentenceBoundary = findLastSentenceBoundary(chunk);
  if (lastSentenceBoundary > max * 0.45) {
    return chunk.slice(0, lastSentenceBoundary + 1).trim();
  }

  const lastClauseBoundary = Math.max(
    chunk.lastIndexOf(", "),
    chunk.lastIndexOf("; "),
    chunk.lastIndexOf(": "),
    chunk.lastIndexOf(" – "),
    chunk.lastIndexOf(" — "),
  );
  if (lastClauseBoundary > max * 0.4) {
    return chunk.slice(0, lastClauseBoundary).replace(/[,:;–—\-\s]+$/u, "").trim() + ".";
  }

  const lastSpace = chunk.lastIndexOf(" ");
  const fallback = (lastSpace > max * 0.5 ? chunk.slice(0, lastSpace) : chunk)
    .replace(/[,:;–—\-\s]+$/u, "")
    .trim();
  return fallback + ".";
}

function findLastSentenceBoundary(text: string): number {
  let last = -1;
  for (const match of text.matchAll(SENTENCE_BOUNDARY_RE)) {
    last = match.index ?? last;
  }
  return last;
}

function areCaptionBlocksSimilar(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  if (left === right) return true;

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  if (shorter.length >= 30 && longer.includes(shorter)) return true;

  return similarity(left, right) >= 0.72;
}

function similarity(a: string, b: string): number {
  const setA = contentWords(a);
  const setB = contentWords(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  return intersection / (setA.size + setB.size - intersection);
}

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

function slideText(slide: IGSlide): string {
  return [slide.heading, ...slide.bullets].join(" ").trim();
}
