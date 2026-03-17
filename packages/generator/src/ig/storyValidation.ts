import type { IGStoryPayload, IGStorySlide } from "@edlight-news/types";
import { looksEnglish } from "./formatters/helpers.js";
import type { IGPublishIssue } from "./review.js";

const STORY_MIN_CONTENT_SLIDES = 2;
const STORY_MAX_CONTENT_SLIDES = 7;
const STORY_FACT_MAX_BULLETS = 3;
const STORY_FACT_FRAME_CHAR_BUDGET = 440;
const STORY_SIMILARITY_THRESHOLD = 0.78;

const STORY_CUTOFF_WORDS = new Set([
  "a",
  "à",
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "dans",
  "de",
  "des",
  "du",
  "en",
  "et",
  "la",
  "le",
  "les",
  "ou",
  "par",
  "pour",
  "sa",
  "ses",
  "son",
  "sur",
  "un",
  "une",
]);

export interface IGStoryPublishValidationResult {
  payload: IGStoryPayload;
  issues: IGPublishIssue[];
  shouldHold: boolean;
}

function normalizeLine(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;

  const normalized = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("\n")
    .trim();

  return normalized || undefined;
}

function normalizeStorySlide(slide: IGStorySlide): IGStorySlide {
  const bullets = slide.bullets
    .map((bullet) => normalizeLine(bullet))
    .filter((bullet): bullet is string => Boolean(bullet));

  const meta = slide.meta
    ?.map((entry) => normalizeLine(entry))
    .filter((entry): entry is string => Boolean(entry));

  return {
    ...slide,
    heading: normalizeLine(slide.heading) ?? "",
    bullets,
    eyebrow: normalizeLine(slide.eyebrow),
    subheading: normalizeLine(slide.subheading),
    meta: meta?.length ? meta : undefined,
    footer: normalizeLine(slide.footer),
    backgroundImage: normalizeLine(slide.backgroundImage),
    accent: normalizeLine(slide.accent),
  };
}

export function normalizeStoryPayloadForPublishing(
  payload: IGStoryPayload,
): IGStoryPayload {
  return {
    ...payload,
    dateLabel: normalizeLine(payload.dateLabel) ?? "",
    slides: payload.slides.map((slide) => normalizeStorySlide(slide)),
  };
}

function splitWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function similarity(a: string, b: string): number {
  const setA = new Set(splitWords(a));
  const setB = new Set(splitWords(b));
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  return intersection / (setA.size + setB.size - intersection);
}

function endsWithCutoffWord(text: string): boolean {
  const words = splitWords(text);
  const last = words.at(-1);
  return last ? STORY_CUTOFF_WORDS.has(last) : false;
}

function isLabelLike(line: string): boolean {
  return /^[A-ZÀ-ÿ0-9][^.!?]{0,28}:\s/u.test(line) || /^Source:/i.test(line);
}

function looksLikeBrokenStoryHeading(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/…$/.test(trimmed)) return true;
  if (/[,:;–—-]$/.test(trimmed)) return true;
  const words = splitWords(trimmed);
  return words.length >= 6 && endsWithCutoffWord(trimmed);
}

function looksLikeBrokenStoryLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/…$/.test(trimmed)) return true;
  if (/[,:;–—-]$/.test(trimmed)) return true;
  if (isLabelLike(trimmed)) return false;

  const words = splitWords(trimmed);
  if (words.length >= 8 && endsWithCutoffWord(trimmed)) return true;
  if (trimmed.length < 70 && words.length < 10) return false;

  const hasTerminalPunctuation = /[.!?](?:["')\]]+)?$/u.test(trimmed);
  if (hasTerminalPunctuation) return false;

  return /[.!?]/u.test(trimmed) || trimmed.length >= 120;
}

function slideSupportLines(slide: IGStorySlide): string[] {
  return [
    ...slide.bullets,
    ...(slide.meta ?? []),
    slide.subheading,
    slide.footer,
  ].filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function slideBodyText(slide: IGStorySlide): string {
  return [
    slide.eyebrow,
    slide.heading,
    slide.subheading,
    ...slide.bullets,
    ...(slide.meta ?? []),
    slide.footer,
  ].filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    .join(" ");
}

export function validateStoryPayloadForPublishing(
  payload: IGStoryPayload,
): IGStoryPublishValidationResult {
  const normalizedPayload = normalizeStoryPayloadForPublishing(payload);
  const issues: IGPublishIssue[] = [];

  if (!normalizedPayload.dateLabel) {
    issues.push({
      severity: "error",
      message: "Date de story manquante ou vide.",
    });
  }

  if (normalizedPayload.slides.length === 0) {
    issues.push({
      severity: "error",
      message: "Aucune slide de story à publier.",
    });
  }

  if (normalizedPayload.slides.length < STORY_MIN_CONTENT_SLIDES) {
    issues.push({
      severity: "error",
      message: "Story trop mince pour une diffusion éditoriale: au moins 2 frames de contenu sont requises.",
    });
  }

  if (normalizedPayload.slides.length > STORY_MAX_CONTENT_SLIDES) {
    issues.push({
      severity: "error",
      message: "Story trop longue pour le briefing quotidien: maximum 7 frames de contenu.",
    });
  }

  for (let i = 0; i < normalizedPayload.slides.length; i++) {
    const slide = normalizedPayload.slides[i]!;
    const slideNumber = i + 1;

    if (!slide.heading) {
      issues.push({
        severity: "error",
        message: `Slide ${slideNumber}: titre vide.`,
      });
    }

    if (looksLikeBrokenStoryHeading(slide.heading)) {
      issues.push({
        severity: "error",
        message: `Slide ${slideNumber}: titre probablement tronqué.`,
      });
    }

    const supportLines = slideSupportLines(slide);
    if (supportLines.length === 0) {
      issues.push({
        severity: "error",
        message: `Slide ${slideNumber}: texte d'appui manquant.`,
      });
    }

    if (looksEnglish(slideBodyText(slide))) {
      issues.push({
        severity: "error",
        message: `Slide ${slideNumber}: contenu probablement en anglais.`,
      });
    }

    const bulletSet = new Set<string>();
    for (const bullet of slide.bullets) {
      const key = bullet.toLowerCase();
      if (bulletSet.has(key)) {
        issues.push({
          severity: "error",
          message: `Slide ${slideNumber}: puces dupliquées.`,
        });
        break;
      }
      bulletSet.add(key);
    }

    for (const line of supportLines) {
      if (looksLikeBrokenStoryLine(line)) {
        issues.push({
          severity: "error",
          message: `Slide ${slideNumber}: texte probablement tronqué.`,
        });
        break;
      }
    }

    if (slide.frameType === "facts") {
      if (slide.bullets.length === 0) {
        issues.push({
          severity: "error",
          message: `Slide ${slideNumber}: repère sans faits.`,
        });
      }

      if (slide.bullets.length > STORY_FACT_MAX_BULLETS) {
        issues.push({
          severity: "error",
          message: `Slide ${slideNumber}: trop de repères sur une seule frame.`,
        });
      }

      const totalFactChars = slide.bullets.reduce(
        (total, bullet) => total + bullet.length,
        0,
      );
      if (totalFactChars > STORY_FACT_FRAME_CHAR_BUDGET) {
        issues.push({
          severity: "error",
          message: `Slide ${slideNumber}: repères trop denses pour une story lisible.`,
        });
      }
    }
  }

  for (let i = 0; i < normalizedPayload.slides.length; i++) {
    for (let j = i + 1; j < normalizedPayload.slides.length; j++) {
      const left = slideBodyText(normalizedPayload.slides[i]!);
      const right = slideBodyText(normalizedPayload.slides[j]!);
      if (similarity(left, right) >= STORY_SIMILARITY_THRESHOLD) {
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
