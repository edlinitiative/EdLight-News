/**
 * @edlight-news/renderer – IG Story asset generation
 *
 * Renders 1080×1920 (9:16) story frames for the daily morning briefing.
 * Each frame becomes a single image posted as an IG Story.
 *
 * Frame types (v2 — Morning Briefing):
 *  - taux:     Premium navy/gold financial rate card
 *  - facts:    Green-accented "Le saviez-vous ?" card with all daily facts
 *  - headline: Dark bg + accent bar + number badge (article summaries)
 *  - cta:      Branded close with follow prompt (@edlightnews)
 *
 * Design system:
 *  - IG safe zones respected: 270 px top, 230 px bottom
 *  - Google Fonts Inter for consistent premium typography
 *  - Progress dots on every frame for visual cohesion
 *  - Branding: "EDLIGHT NEWS" on every frame
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  IGStorySlide,
  IGStoryPayload,
  IGStoryQueueItem,
} from "@edlight-news/types";
import {
  FONT_HEADLINE,
  FONT_BODY,
  GOOGLE_FONTS_LINK,
} from "./design-tokens.js";

// ── Design tokens ─────────────────────────────────────────────────────────

const DEFAULT_ACCENT = "#14b8a6";
const DEFAULT_DARK = "#060f0b";

// IG safe zones (pixels on 1080×1920)
const SAFE_TOP = 270; // profile bar + story header
const SAFE_BOTTOM = 230; // reply field + navigation

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Story progress bars are intentionally hidden for a cleaner editorial look. */
function buildProgressDots(
  current: number,
  total: number,
  accent: string,
): string {
  void current;
  void total;
  void accent;
  return "";
}

interface StoryHeadlineContent {
  eyebrow: string;
  heading: string;
  subheading: string;
  meta: string[];
  footer: string;
}

interface StoryHeadlineMetrics {
  eyebrowSize: number;
  headingSize: number;
  headingSpacing: number;
  summarySize: number;
  summarySpacing: number;
  metaSize: number;
  metaGap: number;
  panelPaddingY: number;
  panelPaddingX: number;
}

interface StoryFactsMetrics {
  titleSize: number;
  factFont: number;
  factGap: number;
  panelPaddingY: number;
  panelPaddingX: number;
  numberSize: number;
  numberRing: number;
}

function resolveStoryHeadlineContent(
  slide: IGStorySlide,
): StoryHeadlineContent {
  const legacyBullets: string[] = [];
  let legacyFooter = "";

  for (const bullet of slide.bullets) {
    if (/^Source:/i.test(bullet)) {
      legacyFooter = bullet;
    } else {
      legacyBullets.push(bullet);
    }
  }

  const subheading = (slide.subheading ?? legacyBullets[0] ?? "").trim();
  const meta = (slide.meta ?? legacyBullets.slice(subheading ? 1 : 0))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return {
    eyebrow: (slide.eyebrow ?? "À LA UNE").trim() || "À LA UNE",
    heading: slide.heading,
    subheading,
    meta,
    footer: (slide.footer ?? legacyFooter).trim(),
  };
}

function getStoryHeadlineMetrics(
  content: StoryHeadlineContent,
): StoryHeadlineMetrics {
  const density =
    content.heading.length +
    Math.round(content.subheading.length * 0.9) +
    Math.round(content.meta.join(" ").length * 0.75);

  if (
    content.heading.length > 120 ||
    content.subheading.length > 220 ||
    density > 360
  ) {
    return {
      eyebrowSize: 14,
      headingSize: 46,
      headingSpacing: 20,
      summarySize: 22,
      summarySpacing: 22,
      metaSize: 16,
      metaGap: 10,
      panelPaddingY: 34,
      panelPaddingX: 34,
    };
  }

  if (
    content.heading.length > 92 ||
    content.subheading.length > 170 ||
    density > 280
  ) {
    return {
      eyebrowSize: 15,
      headingSize: 54,
      headingSpacing: 22,
      summarySize: 23,
      summarySpacing: 22,
      metaSize: 17,
      metaGap: 11,
      panelPaddingY: 38,
      panelPaddingX: 38,
    };
  }

  return {
    eyebrowSize: 16,
    headingSize: 62,
    headingSpacing: 24,
    summarySize: 25,
    summarySpacing: 24,
    metaSize: 18,
    metaGap: 12,
    panelPaddingY: 42,
    panelPaddingX: 42,
  };
}

function getStoryFactsMetrics(slide: IGStorySlide): StoryFactsMetrics {
  const longestFact = slide.bullets.reduce(
    (max, fact) => Math.max(max, fact.length),
    0,
  );
  const totalChars = slide.bullets.reduce((sum, fact) => sum + fact.length, 0);

  if (slide.bullets.length >= 3 || longestFact > 220 || totalChars > 720) {
    return {
      titleSize: 40,
      factFont: 19,
      factGap: 14,
      panelPaddingY: 30,
      panelPaddingX: 30,
      numberSize: 15,
      numberRing: 32,
    };
  }

  if (slide.bullets.length >= 3 || longestFact > 140 || totalChars > 480) {
    return {
      titleSize: 44,
      factFont: 20,
      factGap: 16,
      panelPaddingY: 34,
      panelPaddingX: 34,
      numberSize: 16,
      numberRing: 34,
    };
  }

  return {
    titleSize: 52,
    factFont: 24,
    factGap: 22,
    panelPaddingY: 44,
    panelPaddingX: 40,
    numberSize: 18,
    numberRing: 38,
  };
}

// ── Cover frame ───────────────────────────────────────────────────────────

function buildCoverFrameHTML(
  slide: IGStorySlide,
  dateLabel: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = slide.accent ?? DEFAULT_ACCENT;
  const bulletsHtml = slide.bullets
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1920px;
  font-family: ${FONT_BODY};
  background: ${DEFAULT_DARK} ${slide.backgroundImage ? `url('${slide.backgroundImage}') center/cover no-repeat` : ""};
  color:#fff; overflow:hidden; position:relative;
}
/* Editorial bottom-anchored gradient — keeps the photo readable up top
   and pools darkness around the headline for legibility, no panel needed. */
.overlay {
  position:absolute; inset:0;
  background: linear-gradient(180deg,
    rgba(0,0,0,0.45) 0%,
    rgba(0,0,0,0.18) 22%,
    rgba(0,0,0,0.08) 42%,
    rgba(0,0,0,0.40) 60%,
    rgba(0,0,0,0.82) 80%,
    rgba(0,0,0,0.94) 100%);
}
.c {
  position:relative; z-index:1; height:100%;
  display:flex; flex-direction:column; justify-content:flex-end;
  padding:${SAFE_TOP + 20}px 88px ${SAFE_BOTTOM + 24}px;
}
/* Top-left kicker: accent rule + uppercase date, like a wire dateline. */
.kicker {
  position:absolute; top:${SAFE_TOP + 8}px; left:88px;
  display:flex; align-items:center; gap:14px;
  font-family:${FONT_HEADLINE}; font-size:16px; font-weight:800;
  text-transform:uppercase; letter-spacing:4px;
  color:${accent};
  text-shadow:0 2px 14px rgba(0,0,0,0.5);
}
.kicker .bar { width:36px; height:3px; background:${accent}; border-radius:2px; }
.h {
  font-family:${FONT_HEADLINE}; font-size:74px; font-weight:900; line-height:1.02; letter-spacing:-2px;
  text-shadow:0 4px 50px rgba(0,0,0,0.92), 0 2px 8px rgba(0,0,0,0.7);
  margin-bottom:26px;
}
.sub ul { list-style:none; }
.sub li {
  font-size:23px; font-weight:500; line-height:1.55; opacity:0.92;
  text-shadow:0 2px 16px rgba(0,0,0,0.78), 0 1px 4px rgba(0,0,0,0.5);
  margin-bottom:6px;
}
.bm {
  position:absolute; bottom:${SAFE_BOTTOM - 8}px; left:0; right:0;
  text-align:center;
  font-family:${FONT_HEADLINE}; font-size:18px; font-weight:800; letter-spacing:5px;
}
.bm .el { color:rgba(255,255,255,0.78); }
.bm .nw { color:${accent}; margin-left:6px; }
</style></head>
<body>
<div class="overlay"></div>
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="kicker"><span class="bar"></span>${escapeHtml(dateLabel)}</div>
<div class="c">
  <div class="h">${escapeHtml(slide.heading)}</div>
  <div class="sub"><ul>${bulletsHtml}</ul></div>
</div>
<div class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
</body></html>`;
}

// ── Taux frame (editorial financial moment, no card) ──────────────────────

function buildTauxFrameHTML(
  slide: IGStorySlide,
  dateLabel: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = "#eab308"; // gold
  const rate = slide.heading; // e.g. "131.2589"
  const bgCss = slide.backgroundImage
    ? `background:#0a1628 url('${slide.backgroundImage}') center/cover no-repeat;`
    : "background: radial-gradient(ellipse at 50% 35%, #102842 0%, #0a1628 55%, #060f1c 100%);";
  // bullets[0] = rate date label, rest are optional market bullets
  const rateDate = slide.bullets[0] ?? dateLabel;
  const marketBullets = slide.bullets.slice(1);
  const marketHtml = marketBullets
    .map((b) => `<div class="mk">${escapeHtml(b)}</div>`)
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1920px;
  font-family: ${FONT_BODY};
  ${bgCss}
  color:#fff; overflow:hidden; position:relative;
}
.img-overlay {
  position:absolute; inset:0;
  background:linear-gradient(180deg,
    rgba(5,10,24,0.62) 0%,
    rgba(5,10,24,0.50) 35%,
    rgba(5,10,24,0.78) 75%,
    rgba(5,10,24,0.92) 100%);
}
.c {
  position:relative; z-index:1; height:100%;
  display:flex; flex-direction:column; justify-content:center; align-items:center;
  padding:${SAFE_TOP + 40}px 88px ${SAFE_BOTTOM + 60}px;
  text-align:center;
}
.kicker {
  display:flex; align-items:center; gap:14px;
  font-family:${FONT_HEADLINE};
  color:${accent}; font-size:18px; font-weight:800;
  text-transform:uppercase; letter-spacing:5px;
  margin-bottom:28px;
}
.kicker .bar { width:36px; height:3px; background:${accent}; border-radius:2px; }
.rate-label {
  font-family:${FONT_HEADLINE};
  font-size:16px; font-weight:600;
  opacity:0.55; letter-spacing:4px;
  text-transform:uppercase;
  margin-bottom:18px;
}
.rate {
  font-family:${FONT_HEADLINE};
  font-size:200px; font-weight:900;
  letter-spacing:-7px;
  color:${accent};
  line-height:0.95;
  margin-bottom:14px;
  text-shadow:0 6px 60px rgba(234,179,8,0.20);
}
.unit {
  font-family:${FONT_HEADLINE};
  font-size:22px; font-weight:700;
  opacity:0.55; letter-spacing:6px;
  text-transform:uppercase;
  margin-bottom:42px;
}
.rule {
  width:80px; height:2px; background:rgba(255,255,255,0.22);
  margin:0 auto 30px;
}
.date-line {
  font-size:17px; font-weight:600; opacity:0.55; letter-spacing:2px;
  text-transform:uppercase;
  margin-bottom:24px;
}
.mk {
  font-size:21px; font-weight:600; opacity:0.78;
  margin-bottom:10px; line-height:1.4;
}
.bm {
  position:absolute; bottom:${SAFE_BOTTOM - 8}px; left:0; right:0;
  text-align:center;
  font-family:${FONT_HEADLINE}; font-size:18px; font-weight:800; letter-spacing:5px;
}
.bm .el { color:rgba(255,255,255,0.65); }
.bm .nw { color:${accent}; margin-left:6px; }
</style></head>
<body>
${slide.backgroundImage ? '<div class="img-overlay"></div>' : ""}
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <div class="kicker"><span class="bar"></span>TAUX DU JOUR</div>
  <div class="rate-label">Taux de référence BRH</div>
  <div class="rate">${escapeHtml(rate)}</div>
  <div class="unit">HTG / 1 USD</div>
  <div class="rule"></div>
  <div class="date-line">${escapeHtml(rateDate)}</div>
  ${marketHtml}
</div>
<div class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
</body></html>`;
}

// ── Facts frame (editorial "Le saviez-vous ?" — flat, no card) ───────────

function buildFactsFrameHTML(
  slide: IGStorySlide,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = slide.accent ?? "#34d399";
  const eyebrow = slide.eyebrow ?? "CE MATIN";
  const hasImage = !!slide.backgroundImage;
  const metrics = getStoryFactsMetrics(slide);
  const bgCss = hasImage
    ? `background:#040e09 url('${slide.backgroundImage}') center/cover no-repeat;`
    : `background:
        radial-gradient(ellipse at 18% 18%, ${accent}1F 0%, transparent 48%),
        radial-gradient(ellipse at 82% 82%, ${accent}0F 0%, transparent 50%),
        #040e09;`;
  const factsHtml = slide.bullets
    .map(
      (f, i) =>
        `<div class="fact"><span class="fn">${String(i + 1).padStart(2, "0")}</span><span class="ft">${escapeHtml(f)}</span></div>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1920px;
  font-family: ${FONT_BODY};
  ${bgCss}
  color:#fff; overflow:hidden; position:relative;
}
.img-overlay {
  position:absolute; inset:0;
  background:linear-gradient(180deg,
    rgba(2,10,7,0.55) 0%,
    rgba(2,10,7,0.32) 22%,
    rgba(2,10,7,0.46) 50%,
    rgba(2,10,7,0.82) 78%,
    rgba(2,10,7,0.94) 100%);
}
.c {
  position:relative; z-index:1; height:100%;
  display:flex; flex-direction:column; justify-content:center;
  padding:${SAFE_TOP + 30}px 88px ${SAFE_BOTTOM + 60}px;
}
.kicker {
  display:flex; align-items:center; gap:14px;
  font-family:${FONT_HEADLINE};
  color:${accent}; font-size:18px; font-weight:800;
  text-transform:uppercase; letter-spacing:5px;
  margin-bottom:30px;
  text-shadow:0 2px 14px rgba(0,0,0,0.5);
}
.kicker .bar { width:36px; height:3px; background:${accent}; border-radius:2px; }
/* .panel kept as a logical wrapper (referenced by tests) — no visual chrome. */
.panel { max-width:920px; }
.h {
  font-family:${FONT_HEADLINE};
  font-size:${metrics.titleSize + 4}px; font-weight:900;
  line-height:1.05; letter-spacing:-1.2px;
  margin-bottom:36px;
  text-shadow:0 2px 24px rgba(0,0,0,0.7);
  color:#fff;
}
.fact {
  display:flex; gap:${metrics.factGap + 2}px; align-items:flex-start;
  padding:${metrics.factGap + 2}px 0;
}
.fact + .fact {
  border-top:1px solid rgba(255,255,255,0.12);
}
.fn {
  font-family:${FONT_HEADLINE}; flex-shrink:0;
  width:48px;
  color:${accent}; font-size:${metrics.numberSize + 2}px; font-weight:800;
  letter-spacing:1px;
  margin-top:4px;
}
.ft {
  font-size:${metrics.factFont + 1}px; line-height:1.55;
  opacity:0.96; font-weight:500;
  text-shadow:0 1px 10px rgba(0,0,0,0.55);
}
.bm {
  position:absolute; bottom:${SAFE_BOTTOM - 8}px; left:0; right:0;
  text-align:center;
  font-family:${FONT_HEADLINE}; font-size:18px; font-weight:800; letter-spacing:5px;
}
.bm .el { color:rgba(255,255,255,0.78); }
.bm .nw { color:${accent}; margin-left:6px; }
</style></head>
<body>
${hasImage ? '<div class="img-overlay"></div>' : ""}
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <div class="kicker"><span class="bar"></span>${escapeHtml(eyebrow)}</div>
  <div class="panel">
    <div class="h">${escapeHtml(slide.heading)}</div>
    ${factsHtml}
  </div>
</div>
<div class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
</body></html>`;
}

// ── Headline frame ────────────────────────────────────────────────────────

function buildHeadlineFrameHTML(
  slide: IGStorySlide,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = slide.accent ?? DEFAULT_ACCENT;
  const dark = DEFAULT_DARK;
  const hasImage = !!slide.backgroundImage;
  const content = resolveStoryHeadlineContent(slide);
  const metrics = getStoryHeadlineMetrics(content);
  const bgCss = hasImage
    ? `background:${dark} url('${slide.backgroundImage}') center/cover no-repeat;`
    : `background: radial-gradient(ellipse at 30% 40%, rgba(255,255,255,0.04) 0%, transparent 60%),
              radial-gradient(ellipse at 80% 80%, ${accent}10 0%, transparent 50%),
              ${dark};`;
  const metaInline = content.meta
    .map((entry) => escapeHtml(entry))
    .join('<span class="dot">·</span>');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1920px;
  font-family: ${FONT_BODY};
  ${bgCss}
  color:#fff; overflow:hidden; position:relative;
}
/* Editorial bottom-anchored gradient — no panel, type sits on the photo
   with strong text-shadows for legibility (Reuters/Bloomberg approach). */
.img-overlay { position:absolute; inset:0; background:linear-gradient(180deg,
  rgba(0,0,0,0.40) 0%,
  rgba(0,0,0,0.18) 18%,
  rgba(0,0,0,0.32) 42%,
  rgba(0,0,0,0.72) 66%,
  rgba(0,0,0,0.90) 84%,
  rgba(0,0,0,0.96) 100%); }
.c {
  position:relative; z-index:1;
  height:100%; display:flex; flex-direction:column; justify-content:flex-end;
  padding:${SAFE_TOP + 24}px 88px ${SAFE_BOTTOM + 28}px;
}
.kicker {
  display:flex; align-items:center; gap:14px;
  font-family:${FONT_HEADLINE};
  color:${accent}; font-size:${metrics.eyebrowSize + 2}px; font-weight:800;
  text-transform:uppercase; letter-spacing:5px;
  margin-bottom:24px;
  text-shadow:0 2px 14px rgba(0,0,0,0.55);
}
.kicker .bar { width:36px; height:3px; background:${accent}; border-radius:2px; }
.h {
  font-family:${FONT_HEADLINE};
  font-size:${metrics.headingSize + 6}px; font-weight:900;
  line-height:1.02; letter-spacing:-1.4px;
  margin-bottom:${metrics.headingSpacing}px;
  text-shadow:0 4px 32px rgba(0,0,0,0.92), 0 2px 10px rgba(0,0,0,0.7);
}
.dek {
  font-size:${metrics.summarySize + 1}px; line-height:1.55; opacity:0.96; font-weight:500;
  margin-bottom:${content.meta.length > 0 ? metrics.summarySpacing : 0}px;
  text-shadow:0 2px 16px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.5);
  max-width:880px;
}
.meta {
  font-family:${FONT_HEADLINE};
  display:flex; flex-wrap:wrap; align-items:center; gap:10px;
  font-size:${metrics.metaSize}px; line-height:1.4; font-weight:700;
  letter-spacing:1.5px; text-transform:uppercase;
  color:rgba(255,255,255,0.85);
  margin-top:${content.subheading ? 4 : 8}px;
  text-shadow:0 2px 12px rgba(0,0,0,0.65);
}
.meta .dot { color:${accent}; opacity:0.9; }
.src {
  margin-top:18px; font-size:15px; font-weight:600;
  opacity:0.62; letter-spacing:1px;
  text-transform:uppercase;
  text-shadow:0 1px 8px rgba(0,0,0,0.7);
}
.bm {
  position:absolute; bottom:${SAFE_BOTTOM - 8}px; left:0; right:0;
  text-align:center;
  font-family:${FONT_HEADLINE}; font-size:18px; font-weight:800; letter-spacing:5px;
}
.bm .el { color:rgba(255,255,255,0.78); }
.bm .nw { color:${accent}; margin-left:6px; }
</style></head>
<body>
${hasImage ? '<div class="img-overlay"></div>' : ""}
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <div class="kicker"><span class="bar"></span>${escapeHtml(content.eyebrow)}</div>
  <div class="h">${escapeHtml(content.heading)}</div>
  ${content.subheading ? `<div class="dek">${escapeHtml(content.subheading)}</div>` : ""}
  ${content.meta.length > 0 ? `<div class="meta">${metaInline}</div>` : ""}
  ${content.footer ? `<div class="src">${escapeHtml(content.footer)}</div>` : ""}
</div>
<div class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
</body></html>`;
}

// ── CTA closing frame (editorial colophon, no shell) ─────────────────────

function buildCtaFrameHTML(
  accent: string,
  slideIndex: number,
  totalSlides: number,
): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1920px;
  font-family: ${FONT_BODY};
  background:
    radial-gradient(ellipse at 20% 25%, ${accent}1A 0%, transparent 38%),
    radial-gradient(ellipse at 80% 78%, rgba(255,255,255,0.04) 0%, transparent 40%),
    linear-gradient(180deg, #08121e 0%, #061018 56%, #060f0b 100%);
  color:#fff; overflow:hidden; position:relative;
}
.c {
  position:relative; z-index:1; height:100%;
  display:flex; flex-direction:column; justify-content:center;
  padding:${SAFE_TOP + 20}px 100px ${SAFE_BOTTOM + 40}px;
}
.kicker {
  display:flex; align-items:center; gap:14px;
  font-family:${FONT_HEADLINE};
  color:${accent}; font-size:18px; font-weight:800;
  text-transform:uppercase; letter-spacing:5px;
  margin-bottom:36px;
}
.kicker .bar { width:36px; height:3px; background:${accent}; border-radius:2px; }
.logo {
  font-family:${FONT_HEADLINE};
  font-size:54px; font-weight:900; letter-spacing:6px;
  margin-bottom:18px;
  display:flex; align-items:baseline; gap:12px;
}
.logo .el { color:#fff; }
.logo .nw { color:${accent}; }
.line {
  width:96px; height:3px; background:${accent};
  margin:0 0 36px; border-radius:2px;
}
.headline {
  font-family:${FONT_HEADLINE};
  font-size:68px; font-weight:900;
  line-height:1.04; letter-spacing:-1.6px;
  margin-bottom:28px; max-width:760px;
}
.summary {
  font-size:26px; font-weight:500; line-height:1.55;
  opacity:0.86; max-width:720px;
  margin-bottom:42px;
}
.tags {
  font-family:${FONT_HEADLINE};
  display:flex; flex-wrap:wrap; align-items:center; gap:14px;
  font-size:17px; font-weight:800; letter-spacing:3px; text-transform:uppercase;
  color:rgba(255,255,255,0.72);
  margin-bottom:48px;
}
.tags .dot { color:${accent}; opacity:0.9; }
.handle-block {
  border-top:1px solid rgba(255,255,255,0.14);
  padding-top:30px;
  display:flex; align-items:baseline; justify-content:space-between; gap:16px;
}
.handle {
  font-family:${FONT_HEADLINE};
  font-size:36px; font-weight:900; letter-spacing:0;
  color:${accent};
}
.note {
  font-family:${FONT_HEADLINE};
  font-size:15px; font-weight:700; letter-spacing:3px;
  color:rgba(255,255,255,0.55);
  text-transform:uppercase;
}
.kreyol {
  margin-top:26px;
  font-size:21px; line-height:1.55; opacity:0.55; max-width:760px;
}
</style></head>
<body>
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <div class="kicker"><span class="bar"></span>Édition quotidienne</div>
  <div class="logo"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
  <div class="line"></div>
  <div class="headline">Votre briefing étudiant, chaque matin.</div>
  <div class="summary">Actualités, bourses et repères pensés pour les élèves et étudiants haïtiens.</div>
  <div class="tags">
    <span>Actualités</span><span class="dot">·</span>
    <span>Bourses</span><span class="dot">·</span>
    <span>Repères</span>
  </div>
  <div class="handle-block">
    <div class="handle">@edlightnews</div>
    <div class="note">En story chaque matin</div>
  </div>
  <div class="kreyol">Nouvèl, opòtinite ak repè pou elèv ak etidyan ayisyen, chak jou.</div>
</div>
</body></html>`;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Build HTML for a single story frame.
 *
 * Dispatch by `slide.frameType` (v2) with backward-compatible fallback:
 *   "taux"     → financial rate card
 *   "facts"    → daily facts card
 *   "headline" → article summary card (dark bg + accent bar)
 *   "cover"    → full-bleed image cover (legacy default for frame 0)
 *   "cta"      → follow/close frame
 *
 * Legacy slides without `frameType` fall back to positional logic:
 *   Frame 0 → cover, Frame N-1 → CTA, others → headline
 */
export function buildStorySlideHTML(
  slide: IGStorySlide,
  dateLabel: string,
  slideIndex: number,
  totalSlides: number,
  isCta = false,
): string {
  // Explicit CTA flag (from asset generator) takes priority
  if (isCta || slide.frameType === "cta") {
    return buildCtaFrameHTML(
      slide.accent ?? DEFAULT_ACCENT,
      slideIndex,
      totalSlides,
    );
  }

  // v2 frame types
  if (slide.frameType === "taux") {
    return buildTauxFrameHTML(slide, dateLabel, slideIndex, totalSlides);
  }
  if (slide.frameType === "facts") {
    return buildFactsFrameHTML(slide, slideIndex, totalSlides);
  }
  if (slide.frameType === "headline") {
    return buildHeadlineFrameHTML(slide, slideIndex, totalSlides);
  }

  // Legacy fallback: frame 0 = cover, rest = headline
  if (slideIndex === 0) {
    return buildCoverFrameHTML(slide, dateLabel, slideIndex, totalSlides);
  }
  return buildHeadlineFrameHTML(slide, slideIndex, totalSlides);
}

// ── Asset generation ──────────────────────────────────────────────────────

export interface StoryAssetResult {
  mode: "rendered" | "dry-run";
  /** Paths to PNG files (rendered) or HTML files (dry-run) */
  slidePaths: string[];
  /** Base directory for all assets */
  exportDir: string;
}

export interface GenerateStoryAssetOptions {
  /**
   * Whether to append the branded CTA closing frame.
   * Defaults to true.
   */
  appendCta?: boolean;
}

/**
 * Generate story assets for an IG story queue item.
 *
 * Renders content slides from payload.
 *
 * Uses `waitUntil: "networkidle"` so Google Fonts finish loading before
 * the screenshot is taken, ensuring premium Inter typography.
 */
export async function generateStoryAssets(
  queueItem: IGStoryQueueItem,
  payload: IGStoryPayload,
  options?: GenerateStoryAssetOptions,
): Promise<StoryAssetResult> {
  const exportDir = `/tmp/ig_stories/${queueItem.id}`;
  mkdirSync(exportDir, { recursive: true });

  const slidePaths: string[] = [];
  let mode: "rendered" | "dry-run" = "dry-run";

  const shouldAppendCta = options?.appendCta ?? true;
  const totalSlides = payload.slides.length + (shouldAppendCta ? 1 : 0);

  // Determine dominant accent (from the first content slide, fallback to default)
  const dominantAccent =
    payload.slides[1]?.accent ?? payload.slides[0]?.accent ?? DEFAULT_ACCENT;

  try {
    const pw = await import("playwright-core");
    const chromiumModule = pw.chromium;

    const executablePaths = [
      process.env.PLAYWRIGHT_CHROMIUM_PATH,
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
    ].filter(Boolean) as string[];

    let browser;
    for (const executablePath of executablePaths) {
      try {
        browser = await chromiumModule.launch({
          executablePath,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
          ],
        });
        break;
      } catch {
        // Try next
      }
    }
    if (!browser) {
      browser = await chromiumModule.launch({
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });
    }

    try {
      // Render content slides
      for (let i = 0; i < payload.slides.length; i++) {
        const slide = payload.slides[i]!;
        const html = buildStorySlideHTML(
          slide,
          payload.dateLabel,
          i,
          totalSlides,
        );
        const pngPath = join(exportDir, `story_${i + 1}.png`);
        await renderFrameToFile(browser, html, pngPath);
        slidePaths.push(pngPath);
      }

      if (shouldAppendCta) {
        const ctaSlide: IGStorySlide = {
          heading: "",
          bullets: [],
          accent: dominantAccent,
          frameType: "cta",
        };
        const ctaHtml = buildStorySlideHTML(
          ctaSlide,
          payload.dateLabel,
          totalSlides - 1,
          totalSlides,
          true,
        );
        const ctaPath = join(exportDir, "story_cta.png");
        await renderFrameToFile(browser, ctaHtml, ctaPath);
        slidePaths.push(ctaPath);
      }

      mode = "rendered";
    } finally {
      await browser.close();
    }
  } catch {
    console.warn("[ig-story] Chromium unavailable, using dry-run HTML mode");

    for (let i = 0; i < payload.slides.length; i++) {
      const slide = payload.slides[i]!;
      const html = buildStorySlideHTML(
        slide,
        payload.dateLabel,
        i,
        totalSlides,
      );
      const htmlPath = join(exportDir, `story_${i + 1}.html`);
      writeFileSync(htmlPath, html, "utf-8");
      slidePaths.push(htmlPath);
    }

    if (shouldAppendCta) {
      const ctaSlide: IGStorySlide = {
        heading: "",
        bullets: [],
        accent: dominantAccent,
        frameType: "cta",
      };
      const ctaHtml = buildStorySlideHTML(
        ctaSlide,
        payload.dateLabel,
        totalSlides - 1,
        totalSlides,
        true,
      );
      const ctaPath = join(exportDir, "story_cta.html");
      writeFileSync(ctaPath, ctaHtml, "utf-8");
      slidePaths.push(ctaPath);
    }

  }

  return { mode, slidePaths, exportDir };
}

/**
 * Render a single HTML frame to a PNG file using Playwright.
 * Waits for network idle to ensure Google Fonts are fully loaded.
 */
async function renderFrameToFile(
  browser: import("playwright-core").Browser,
  html: string,
  outPath: string,
): Promise<void> {
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 2,
  });
  try {
    await page.setContent(html, { waitUntil: "networkidle", timeout: 60_000 });
    // Extra font-loading safety: wait for document.fonts.ready
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    await page.evaluate("document.fonts.ready");
    const buffer = await page.screenshot({ type: "png", timeout: 60_000 });
    writeFileSync(outPath, Buffer.from(buffer));
  } finally {
    await page.close();
  }
}
