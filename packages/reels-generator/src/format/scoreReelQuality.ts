/**
 * scoreReelQuality — pure heuristic scoring over the storyboard + caption.
 *
 * No LLM call: the storyboard already encodes editorial intent, so quality
 * is checked against measurable rules (length, asset coverage, brand close,
 * mobile safe area, duration fit). Each axis is 0..100. The total is a
 * weighted average. `passed` is true when total ≥ pass threshold AND no
 * axis fell below its hard floor.
 *
 * Each warning emitted into `notes` should be actionable in Slack — e.g.
 * "scene 3 onScreenText too long (74 chars)" rather than "low score".
 */

import {
  FORMAT_DURATION,
  REEL_QUALITY_PASS_THRESHOLD,
  type GeneratedReel,
  type ReelFormat,
  type ReelQualityScore,
  type ReelScene,
} from "./types.js";

interface ScoreInput {
  format: ReelFormat;
  storyboard: ReelScene[];
  caption: string;
  hashtags: string[];
  voiceover: string;
  durationSec: number;
}

const MAX_ON_SCREEN_CHARS = 60;
const MAX_SCENE_WORDS = 14;
const MIN_SCENES = 3;

const STRONG_HOOK_OPENERS = [
  // FR
  "nouveau", "nouvelle", "voici", "attention", "urgent", "incroyable",
  // EN
  "new", "here", "breaking", "alert", "watch",
  // HT
  "men", "gen", "atansyon",
];

function scoreHook(storyboard: ReelScene[]): { score: number; note?: string } {
  const first = storyboard[0];
  if (!first) return { score: 0, note: "no scenes" };
  const text = first.voiceover.trim().toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);
  let score = 60;
  if (words.length <= 12) score += 20;
  if (words.length <= 8) score += 10;
  if (STRONG_HOOK_OPENERS.some((w) => text.startsWith(w))) score += 10;
  if (words.length > 18) {
    return { score: Math.min(score, 40), note: `hook too long (${words.length} words)` };
  }
  return { score: Math.min(score, 100) };
}

function scoreClarity(voiceover: string): { score: number; note?: string } {
  const sentences = voiceover.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length === 0) return { score: 0, note: "empty voiceover" };
  const totalWords = voiceover.split(/\s+/).filter(Boolean).length;
  const avg = totalWords / sentences.length;
  let score = 100;
  if (avg > 18) score -= 30;
  else if (avg > 14) score -= 15;
  if (avg < 4) score -= 10;
  const note = avg > 18 ? `avg sentence ${avg.toFixed(1)} words (target ≤ 14)` : undefined;
  return { score: Math.max(0, score), note };
}

function scoreVisualRelevance(storyboard: ReelScene[]): { score: number; note?: string } {
  const needing = storyboard.filter((s) =>
    ["image_card", "b_roll", "roundup_item"].includes(s.visualType),
  );
  if (needing.length === 0) return { score: 90 };
  const covered = needing.filter((s) => (s.assetUrls?.length ?? 0) > 0);
  const ratio = covered.length / needing.length;
  const score = Math.round(40 + ratio * 60);
  const note =
    ratio < 0.5
      ? `${needing.length - covered.length}/${needing.length} visual scenes have no asset`
      : undefined;
  return { score, note };
}

function scoreVoiceNaturalness(storyboard: ReelScene[]): { score: number; note?: string } {
  let longCount = 0;
  for (const s of storyboard) {
    const w = s.voiceover.split(/\s+/).filter(Boolean).length;
    if (w > MAX_SCENE_WORDS) longCount++;
  }
  if (longCount === 0) return { score: 100 };
  const score = Math.max(0, 100 - longCount * 25);
  return { score, note: `${longCount} scene(s) have spoken lines > ${MAX_SCENE_WORDS} words` };
}

function scoreCaption(caption: string, hashtags: string[]): { score: number; note?: string } {
  let score = 80;
  if (caption.length < 30) score -= 20;
  if (caption.length > 600) score -= 15;
  if (hashtags.length < 3) score -= 25;
  if (hashtags.length > 8) score -= 10;
  const sentences = caption.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length > 4) score -= 10;
  const note =
    caption.length > 600
      ? "caption too long for mobile preview"
      : hashtags.length < 3
        ? "fewer than 3 hashtags"
        : undefined;
  return { score: Math.max(0, Math.min(100, score)), note };
}

function scoreBrand(
  storyboard: ReelScene[],
  caption: string,
): { score: number; note?: string } {
  const hasClose = storyboard.some((s) => s.visualType === "brand_close");
  const captionMentions = /edlight/i.test(caption);
  let score = 50;
  if (hasClose) score += 35;
  if (captionMentions) score += 15;
  const note = !hasClose ? "missing brand_close scene" : undefined;
  return { score: Math.min(100, score), note };
}

function scoreDurationFit(
  format: ReelFormat,
  durationSec: number,
): { score: number; note?: string } {
  const { min, max, target } = FORMAT_DURATION[format];
  if (durationSec >= min && durationSec <= max) {
    const distance = Math.abs(durationSec - target);
    const span = Math.max(target - min, max - target);
    return { score: Math.round(100 - (distance / span) * 20) };
  }
  if (durationSec < min) {
    return {
      score: Math.max(0, 60 - (min - durationSec) * 5),
      note: `too short (${durationSec.toFixed(1)}s < ${min}s)`,
    };
  }
  return {
    score: Math.max(0, 60 - (durationSec - max) * 5),
    note: `too long (${durationSec.toFixed(1)}s > ${max}s)`,
  };
}

function scoreMobileSafe(storyboard: ReelScene[]): { score: number; note?: string } {
  const offenders = storyboard.filter((s) => s.onScreenText.length > MAX_ON_SCREEN_CHARS);
  if (offenders.length === 0) return { score: 100 };
  const score = Math.max(0, 100 - offenders.length * 20);
  return {
    score,
    note: `${offenders.length} scene(s) exceed ${MAX_ON_SCREEN_CHARS}-char overlay limit`,
  };
}

const WEIGHTS = {
  hookStrength: 0.18,
  scriptClarity: 0.14,
  visualRelevance: 0.14,
  voiceNaturalness: 0.12,
  captionReadability: 0.08,
  brandConsistency: 0.10,
  durationFit: 0.16,
  mobileSafeArea: 0.08,
} as const;

export function scoreReelQuality(input: ScoreInput): ReelQualityScore {
  const notes: string[] = [];

  if (input.storyboard.length < MIN_SCENES) {
    notes.push(`storyboard has only ${input.storyboard.length} scene(s)`);
  }

  const hook = scoreHook(input.storyboard);
  const clarity = scoreClarity(input.voiceover);
  const visual = scoreVisualRelevance(input.storyboard);
  const voice = scoreVoiceNaturalness(input.storyboard);
  const cap = scoreCaption(input.caption, input.hashtags);
  const brand = scoreBrand(input.storyboard, input.caption);
  const duration = scoreDurationFit(input.format, input.durationSec);
  const mobile = scoreMobileSafe(input.storyboard);

  for (const part of [hook, clarity, visual, voice, cap, brand, duration, mobile]) {
    if (part.note) notes.push(part.note);
  }

  const total = Math.round(
    hook.score * WEIGHTS.hookStrength +
      clarity.score * WEIGHTS.scriptClarity +
      visual.score * WEIGHTS.visualRelevance +
      voice.score * WEIGHTS.voiceNaturalness +
      cap.score * WEIGHTS.captionReadability +
      brand.score * WEIGHTS.brandConsistency +
      duration.score * WEIGHTS.durationFit +
      mobile.score * WEIGHTS.mobileSafeArea,
  );

  // Hard floors: any single axis below 30 fails the whole Reel, regardless
  // of the weighted total. This is the safety net for "great average,
  // unwatchable hook" cases.
  const hardFail =
    hook.score < 30 ||
    duration.score < 30 ||
    visual.score < 30;

  const passed = !hardFail && total >= REEL_QUALITY_PASS_THRESHOLD;

  return {
    total,
    hookStrength: hook.score,
    scriptClarity: clarity.score,
    visualRelevance: visual.score,
    voiceNaturalness: voice.score,
    captionReadability: cap.score,
    brandConsistency: brand.score,
    durationFit: duration.score,
    mobileSafeArea: mobile.score,
    notes,
    passed,
  };
}

/** Convenience: score a fully-assembled GeneratedReel. */
export function scoreGeneratedReel(reel: GeneratedReel): ReelQualityScore {
  return scoreReelQuality({
    format: reel.format,
    storyboard: reel.storyboard,
    caption: reel.caption,
    hashtags: reel.hashtags,
    voiceover: reel.script,
    durationSec: reel.durationSec ?? 0,
  });
}
