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
 *  - cta:      Branded close with follow prompt (@edlight.news)
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
/* Aggressive multi-stop overlay — readable on any image brightness */
.overlay {
  position:absolute; inset:0;
  background: linear-gradient(180deg,
    rgba(0,0,0,0.50) 0%,
    rgba(0,0,0,0.20) 20%,
    rgba(0,0,0,0.10) 40%,
    rgba(0,0,0,0.45) 60%,
    rgba(0,0,0,0.85) 85%,
    rgba(0,0,0,0.92) 100%);
}
.c {
  position:relative; z-index:1; height:100%;
  display:flex; flex-direction:column; justify-content:flex-end;
  padding:${SAFE_TOP + 20}px 72px ${SAFE_BOTTOM + 20}px;
}
.date {
  font-family:${FONT_HEADLINE}; font-size:16px; font-weight:700; text-transform:uppercase;
  letter-spacing:5px; opacity:0.7; margin-bottom:24px;
}
.dot {
  display:inline-block; width:10px; height:10px;
  background:${accent}; border-radius:50%; margin-right:12px; vertical-align:middle;
}
.h {
  font-family:${FONT_HEADLINE}; font-size:68px; font-weight:900; line-height:1.05; letter-spacing:-1.5px;
  text-shadow:0 4px 50px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.6);
  margin-bottom:28px;
}
.sub ul { list-style:none; }
.sub li {
  font-size:22px; font-weight:500; line-height:1.55; opacity:0.9;
  text-shadow:0 2px 16px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.4);
  margin-bottom:8px;
}
.bm {
  margin-top:40px; font-family:${FONT_HEADLINE}; font-size:20px; font-weight:800;
  letter-spacing:3.5px; display:flex; align-items:center; gap:8px;
}
.bm .el { color:rgba(255,255,255,0.72); }
.bm .nw { color:${accent}; }
</style></head>
<body>
<div class="overlay"></div>
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <div class="date"><span class="dot"></span>${escapeHtml(dateLabel)}</div>
  <div class="h">${escapeHtml(slide.heading)}</div>
  <div class="sub"><ul>${bulletsHtml}</ul></div>
  <div class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
</div>
</body></html>`;
}

// ── Taux frame (premium navy/gold financial card) ─────────────────────────

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
    : "background: linear-gradient(180deg, #0a1628 0%, #0d2137 40%, #0a1628 100%);";
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
.img-overlay { position:absolute; inset:0; background:linear-gradient(180deg, rgba(5,10,24,0.48) 0%, rgba(5,10,24,0.38) 30%, rgba(5,10,24,0.72) 75%, rgba(5,10,24,0.88) 100%); }
.glow { position:absolute; top:30%; left:50%; transform:translate(-50%,-50%); width:700px; height:700px; background:radial-gradient(circle, rgba(234,179,8,0.10) 0%, transparent 70%); }
.c {
  position:relative; z-index:1; height:100%;
  display:flex; flex-direction:column; justify-content:center; align-items:center;
  padding:${SAFE_TOP + 40}px 72px ${SAFE_BOTTOM + 40}px;
  text-align:center;
}
.card {
  width:100%; max-width:820px; padding:54px 52px; border-radius:34px;
  background:linear-gradient(180deg, rgba(7,18,35,0.78) 0%, rgba(7,18,35,0.88) 100%);
  backdrop-filter:blur(10px); box-shadow:0 28px 80px rgba(0,0,0,0.26);
  border:1px solid rgba(255,255,255,0.08);
}
.pill { font-family:${FONT_HEADLINE}; display:inline-flex; align-items:center; gap:8px; background:${accent}; color:#000; font-size:18px; font-weight:800; text-transform:uppercase; letter-spacing:3px; padding:10px 24px; border-radius:999px; margin-bottom:28px; }
.rate-label { font-family:${FONT_HEADLINE}; font-size:18px; font-weight:600; opacity:0.40; letter-spacing:3px; text-transform:uppercase; margin-bottom:12px; }
.rate { font-family:${FONT_HEADLINE}; font-size:120px; font-weight:900; letter-spacing:-3px; color:${accent}; line-height:1; margin-bottom:8px; }
.unit { font-size:24px; font-weight:500; opacity:0.35; letter-spacing:1.5px; margin-bottom:32px; }
.date-line { font-size:16px; font-weight:600; opacity:0.50; letter-spacing:1px; margin-bottom:40px; }
.mk { font-size:20px; font-weight:500; opacity:0.55; margin-bottom:12px; line-height:1.4; }
.bm { position:absolute; bottom:${SAFE_BOTTOM + 18}px; left:0; right:0; font-family:${FONT_HEADLINE}; font-size:20px; font-weight:800; letter-spacing:3.5px; display:flex; justify-content:center; align-items:center; gap:8px; }
.bm .el { color:rgba(255,255,255,0.65); }
.bm .nw { color:${accent}; }
</style></head>
<body>
${slide.backgroundImage ? '<div class="img-overlay"></div>' : ""}
<div class="glow"></div>
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <div class="card">
    <span class="pill">TAUX DU JOUR</span>
    <div class="rate-label">TAUX DE RÉFÉRENCE BRH</div>
    <div class="rate">${escapeHtml(rate)}</div>
    <div class="unit">HTG / 1 USD</div>
    <div class="date-line">${escapeHtml(rateDate)}</div>
    ${marketHtml}
  </div>
</div>
<div class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
</body></html>`;
}

// ── Facts frame (green-accented "Le saviez-vous ?" card) ──────────────────

function buildFactsFrameHTML(
  slide: IGStorySlide,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = slide.accent ?? "#34d399";
  const eyebrow = slide.eyebrow ?? "CE MATIN";
  const hasImage = !!slide.backgroundImage;
  const longestFact = slide.bullets.reduce(
    (max, fact) => Math.max(max, fact.length),
    0,
  );
  const dense = slide.bullets.length >= 4 || longestFact > 120;
  const titleSize = dense ? 44 : 50;
  const factFont = dense ? 20 : 22;
  const factGap = dense ? 18 : 22;
  const bgCss = hasImage
    ? `background:#040e09 url('${slide.backgroundImage}') center/cover no-repeat;`
    : `background:
        radial-gradient(ellipse at 15% 15%, ${accent}18 0%, transparent 45%),
        radial-gradient(ellipse at 85% 85%, ${accent}0D 0%, transparent 50%),
        #040e09;`;
  const factsHtml = slide.bullets
    .map(
      (f, i) =>
        `<div class="fact"><span class="fn">${i + 1}</span><span class="ft">${escapeHtml(f)}</span></div>`,
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
    rgba(2,10,7,0.32) 0%,
    rgba(2,10,7,0.16) 18%,
    rgba(2,10,7,0.40) 44%,
    rgba(2,10,7,0.78) 74%,
    rgba(2,10,7,0.92) 100%);
}
.img-vignette {
  position:absolute; inset:0;
  background:radial-gradient(circle at 18% 18%, ${accent}12 0%, transparent 34%),
             radial-gradient(circle at 82% 82%, rgba(0,0,0,0.18) 0%, transparent 42%);
}
.bar { position:absolute; left:0; top:0; bottom:0; width:6px; background:${accent}; }
.c {
  position:relative; z-index:1; height:100%;
  display:flex; flex-direction:column; justify-content:center;
  padding:${SAFE_TOP + 20}px 80px ${SAFE_BOTTOM + 60}px 100px;
}
.top { display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; }
.pill { font-family:${FONT_HEADLINE}; display:inline-flex; align-items:center; gap:8px; background:${accent}; color:#000; font-size:15px; font-weight:800; text-transform:uppercase; letter-spacing:3px; padding:9px 20px; border-radius:999px; }
.count {
  font-family:${FONT_HEADLINE}; font-size:15px; font-weight:700; letter-spacing:2px;
  color:rgba(255,255,255,0.74);
  padding:8px 14px;
  border-radius:999px;
  background:rgba(0,0,0,0.34);
  border:1px solid rgba(255,255,255,0.08);
}
.panel {
  max-width: 860px;
  padding:36px 36px 18px;
  border-radius:34px;
  background:linear-gradient(180deg, rgba(5,16,11,0.74) 0%, rgba(5,16,11,0.90) 100%);
  border:1px solid rgba(255,255,255,0.08);
  box-shadow:0 24px 70px rgba(0,0,0,0.24);
  backdrop-filter:blur(16px);
}
.h { font-family:${FONT_HEADLINE}; font-size:${titleSize}px; font-weight:900; line-height:1.08; letter-spacing:-0.8px; margin-bottom:28px; color:#fff; }
.fact { display:flex; gap:${factGap}px; align-items:flex-start; margin-bottom:${factGap}px; }
.fn { font-family:${FONT_HEADLINE}; flex-shrink:0; width:32px; height:32px; background:${accent}28; color:${accent}; font-size:16px; font-weight:800; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-top:3px; }
.ft { font-size:${factFont}px; line-height:1.58; opacity:0.92; font-weight:500; }
.bm {
  position:absolute; bottom:${SAFE_BOTTOM + 18}px; left:0; right:0;
  display:flex; justify-content:center; align-items:center; gap:8px;
  font-family:${FONT_HEADLINE}; font-size:20px; font-weight:800; letter-spacing:3.5px;
}
.bm .el { color:rgba(255,255,255,0.72); }
.bm .nw { color:${accent}; }
</style></head>
<body>
${hasImage ? '<div class="img-overlay"></div><div class="img-vignette"></div>' : ""}
<div class="bar"></div>
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <div class="top">
    <span class="pill">${escapeHtml(eyebrow)}</span>
    <div class="count">${slideIndex + 1}/${totalSlides}</div>
  </div>
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
    : `background: radial-gradient(ellipse at 30% 40%, rgba(255,255,255,0.03) 0%, transparent 60%),
              radial-gradient(ellipse at 80% 80%, ${accent}08 0%, transparent 50%),
              ${dark};`;
  const panelBackground = hasImage
    ? "linear-gradient(180deg, rgba(7,12,20,0.80) 0%, rgba(7,12,20,0.92) 100%)"
    : "linear-gradient(180deg, rgba(7,12,20,0.76) 0%, rgba(7,12,20,0.88) 100%)";
  const metaHtml = content.meta
    .map((entry) => `<span class="chip">${escapeHtml(entry)}</span>`)
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
/* Aggressive overlay for strong text contrast over any background image */
.img-overlay { position:absolute; inset:0; background:linear-gradient(180deg,
  rgba(0,0,0,0.42) 0%,
  rgba(0,0,0,0.22) 16%,
  rgba(0,0,0,0.42) 40%,
  rgba(0,0,0,0.72) 66%,
  rgba(0,0,0,0.90) 84%,
  rgba(0,0,0,0.96) 100%); }
.img-vignette { position:absolute; inset:0; background:
  radial-gradient(circle at 18% 18%, ${accent}10 0%, transparent 30%),
  radial-gradient(circle at 82% 78%, rgba(255,255,255,0.04) 0%, transparent 34%); }
.bar { position:absolute; left:0; top:0; bottom:0; width:6px; background:${accent}; }
.c {
  position:relative; z-index:1;
  height:100%; display:flex; flex-direction:column; justify-content:flex-end;
  padding:${SAFE_TOP + 24}px 76px ${SAFE_BOTTOM + 84}px 88px;
}
.top {
  display:flex; justify-content:space-between; align-items:center;
  margin-bottom:18px;
}
.cat {
  font-family:${FONT_HEADLINE}; display:inline-flex; align-items:center; gap:8px;
  color:${accent}; background:rgba(0,0,0,0.42);
  border:1px solid rgba(255,255,255,0.10);
  font-size:${metrics.eyebrowSize}px; font-weight:800; text-transform:uppercase; letter-spacing:3px;
  padding:9px 18px; border-radius:999px;
}
.count {
  font-family:${FONT_HEADLINE}; font-size:15px; font-weight:700; letter-spacing:2px;
  color:rgba(255,255,255,0.68);
  padding:8px 14px;
  border-radius:999px;
  background:rgba(0,0,0,0.36);
  border:1px solid rgba(255,255,255,0.08);
}
.panel {
  max-width: 900px;
  padding:${metrics.panelPaddingY}px ${metrics.panelPaddingX}px;
  border-radius:36px;
  background:${panelBackground};
  border:1px solid rgba(255,255,255,0.08);
  box-shadow:0 28px 80px rgba(0,0,0,0.26);
  backdrop-filter:blur(18px);
}
.rule {
  width:72px; height:4px; border-radius:999px; background:${accent};
  margin-bottom:20px;
}
.h {
  font-family:${FONT_HEADLINE}; font-size:${metrics.headingSize}px; font-weight:900; line-height:1.03; letter-spacing:-1.1px;
  margin-bottom:${metrics.headingSpacing}px; text-shadow:0 2px 20px rgba(0,0,0,0.8);
}
.dek {
  font-size:${metrics.summarySize}px; line-height:1.60; opacity:0.95; font-weight:500;
  margin-bottom:${content.meta.length > 0 ? metrics.summarySpacing : 0}px;
  text-shadow:0 1px 12px rgba(0,0,0,0.72);
}
.meta {
  display:flex; flex-wrap:wrap; gap:${metrics.metaGap}px;
  margin-top:${content.subheading ? 0 : 6}px;
}
.chip {
  font-size:${metrics.metaSize}px; line-height:1.3; font-weight:600;
  color:rgba(255,255,255,0.92);
  padding:10px 16px;
  border-radius:999px;
  background:rgba(255,255,255,0.08);
  border:1px solid rgba(255,255,255,0.08);
}
.src {
  margin-top:20px; font-size:14px; font-weight:600;
  opacity:0.52; letter-spacing:0.5px;
}
.bm {
  position:absolute; bottom:${SAFE_BOTTOM + 18}px; left:0; right:0;
  display:flex; justify-content:center; align-items:center; gap:8px;
  font-family:${FONT_HEADLINE}; font-size:20px; font-weight:800; letter-spacing:3.5px;
}
.bm .el { color:rgba(255,255,255,0.72); }
.bm .nw { color:${accent}; }
</style></head>
<body>
${hasImage ? '<div class="img-overlay"></div><div class="img-vignette"></div>' : ""}
<div class="bar"></div>
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <div class="top">
    <div class="cat">${escapeHtml(content.eyebrow)}</div>
    <div class="count">${slideIndex + 1}/${totalSlides}</div>
  </div>
  <div class="panel">
    <div class="rule"></div>
    <div class="h">${escapeHtml(content.heading)}</div>
    ${content.subheading ? `<div class="dek">${escapeHtml(content.subheading)}</div>` : ""}
    ${content.meta.length > 0 ? `<div class="meta">${metaHtml}</div>` : ""}
    ${content.footer ? `<div class="src">${escapeHtml(content.footer)}</div>` : ""}
  </div>
</div>
<div class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
</body></html>`;
}

// ── CTA closing frame ─────────────────────────────────────────────────────

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
  background: radial-gradient(ellipse at 50% 50%, ${accent}15 0%, transparent 70%),
              ${DEFAULT_DARK};
  color:#fff; overflow:hidden; position:relative;
  display:flex; align-items:center; justify-content:center;
}
.c { text-align:center; padding:0 100px; }
.logo {
  font-family:${FONT_HEADLINE}; font-size:42px; font-weight:900; letter-spacing:4px; margin-bottom:48px;
  display:flex; align-items:center; justify-content:center; gap:10px;
}
.logo .el { color:#fff; }
.logo .nw { color:${accent}; }
.line {
  width:60px; height:3px; background:${accent}; opacity:0.4;
  margin:0 auto 48px; border-radius:2px;
}
.msg {
  font-size:28px; font-weight:500; line-height:1.6; opacity:0.7;
  margin-bottom:16px;
}
.msg2 {
  font-size:24px; font-weight:400; line-height:1.6; opacity:0.45;
}
.handle {
  margin-top:48px; font-size:20px; font-weight:700;
  color:${accent}; opacity:0.8; letter-spacing:1px;
}
</style></head>
<body>
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <div class="logo"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
  <div class="line"></div>
  <div class="msg">Suivez-nous pour les dernières<br>actualités éducation & bourses</div>
  <div class="msg2">🇭🇹 Swiv nou pou tout dènye nouvèl<br>sou edikasyon ak bous</div>
  <div class="handle">@edlight.news</div>
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
 *   "cta"      → follow/close frame (auto-appended by asset generator)
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

/**
 * Generate story assets for an IG story queue item.
 *
 * Renders: content slides from payload + auto-appended CTA closing frame.
 * Total frames = payload.slides.length + 1 (CTA).
 *
 * Uses `waitUntil: "networkidle"` so Google Fonts finish loading before
 * the screenshot is taken, ensuring premium Inter typography.
 */
export async function generateStoryAssets(
  queueItem: IGStoryQueueItem,
  payload: IGStoryPayload,
): Promise<StoryAssetResult> {
  const exportDir = `/tmp/ig_stories/${queueItem.id}`;
  mkdirSync(exportDir, { recursive: true });

  const slidePaths: string[] = [];
  let mode: "rendered" | "dry-run" = "dry-run";

  // +1 for the auto-appended CTA frame
  const totalSlides = payload.slides.length + 1;

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

      // Render CTA closing frame
      const ctaSlide: IGStorySlide = {
        heading: "",
        bullets: [],
        accent: dominantAccent,
      };
      const ctaHtml = buildStorySlideHTML(
        ctaSlide,
        payload.dateLabel,
        totalSlides - 1,
        totalSlides,
        true,
      );
      const ctaPath = join(exportDir, `story_cta.png`);
      await renderFrameToFile(browser, ctaHtml, ctaPath);
      slidePaths.push(ctaPath);

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

    // CTA dry-run
    const ctaSlide: IGStorySlide = {
      heading: "",
      bullets: [],
      accent: dominantAccent,
    };
    const ctaHtml = buildStorySlideHTML(
      ctaSlide,
      payload.dateLabel,
      totalSlides - 1,
      totalSlides,
      true,
    );
    const ctaPath = join(exportDir, `story_cta.html`);
    writeFileSync(ctaPath, ctaHtml, "utf-8");
    slidePaths.push(ctaPath);
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
