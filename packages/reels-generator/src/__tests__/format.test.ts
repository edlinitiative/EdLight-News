/**
 * Unit tests for the v2 format layer — classifier + quality scorer.
 *
 * These tests are intentionally pure (no LLM, no network) so they can run
 * in CI on every PR. End-to-end coverage of generateStoryboard /
 * buildReelV2 lives behind integration tests gated by REELS_LIVE_LLM=1.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyReelFormat } from "../format/classifyReelFormat.js";
import { scoreReelQuality } from "../format/scoreReelQuality.js";
import {
  FORMAT_TO_TEMPLATE,
  FORMAT_TO_TOPIC,
  REEL_QUALITY_PASS_THRESHOLD,
  type ReelScene,
} from "../format/types.js";

// ── classifier ───────────────────────────────────────────────────────────

test("classifier: scholarship category → opportunity_alert", () => {
  assert.equal(
    classifyReelFormat({ category: "scholarship", title: "x", summary: "y" }),
    "opportunity_alert",
  );
});

test("classifier: Haiti vertical → haiti_explainer", () => {
  assert.equal(
    classifyReelFormat({ vertical: "haiti", title: "x", summary: "y" }),
    "haiti_explainer",
  );
});

test("classifier: 3 opportunity items forces roundup", () => {
  assert.equal(
    classifyReelFormat({
      category: "scholarship",
      opportunityBundleSize: 3,
    }),
    "weekly_opportunity_roundup",
  );
});

test("classifier: keyword fallback catches opportunity-shaped news", () => {
  assert.equal(
    classifyReelFormat({
      category: "news",
      title: "Nouvelle bourse pour étudiants haïtiens",
      summary: "Deadline coming",
    }),
    "opportunity_alert",
  );
});

test("classifier: default falls back to haiti_explainer", () => {
  assert.equal(
    classifyReelFormat({ title: "Random fact", summary: "About something" }),
    "haiti_explainer",
  );
});

// ── format maps ──────────────────────────────────────────────────────────

test("every format maps to a topic and a template", () => {
  for (const f of ["opportunity_alert", "haiti_explainer", "weekly_opportunity_roundup"] as const) {
    assert.ok(FORMAT_TO_TOPIC[f], `topic missing for ${f}`);
    assert.ok(FORMAT_TO_TEMPLATE[f], `template missing for ${f}`);
  }
});

// ── quality scorer ───────────────────────────────────────────────────────

function makeScenes(): ReelScene[] {
  return [
    {
      id: "s1",
      startSec: 0,
      endSec: 3,
      voiceover: "Nouvelle bourse pour étudiants haïtiens.",
      onScreenText: "Nouvelle bourse",
      visualType: "animated_headline",
    },
    {
      id: "s2",
      startSec: 3,
      endSec: 7,
      voiceover: "Elle couvre les frais de scolarité.",
      onScreenText: "Couvre la scolarité",
      visualType: "image_card",
      assetUrls: ["https://example.com/x.jpg"],
    },
    {
      id: "s3",
      startSec: 7,
      endSec: 11,
      voiceover: "Date limite le 15 juin.",
      onScreenText: "15 juin",
      visualType: "deadline_card",
    },
    {
      id: "s4",
      startSec: 11,
      endSec: 15,
      voiceover: "Suivez EdLight News pour plus.",
      onScreenText: "Suivez @edlightnews",
      visualType: "brand_close",
    },
  ];
}

test("scorer: a well-formed opportunity_alert passes", () => {
  const q = scoreReelQuality({
    format: "opportunity_alert",
    storyboard: makeScenes(),
    caption: "Une nouvelle bourse pour les étudiants haïtiens — EdLight News.",
    hashtags: ["edlight", "bourse", "haiti"],
    voiceover:
      "Nouvelle bourse pour étudiants haïtiens. Elle couvre les frais de scolarité. Date limite le 15 juin. Suivez EdLight News pour plus.",
    durationSec: 15,
  });
  assert.ok(q.total >= REEL_QUALITY_PASS_THRESHOLD, `expected pass, got ${q.total} (notes: ${q.notes.join("; ")})`);
  assert.equal(q.passed, true);
});

test("scorer: missing brand_close flags brandConsistency note", () => {
  const scenes = makeScenes().filter((s) => s.visualType !== "brand_close");
  const q = scoreReelQuality({
    format: "opportunity_alert",
    storyboard: scenes,
    caption: "Some caption.",
    hashtags: ["a", "b", "c"],
    voiceover: scenes.map((s) => s.voiceover).join(" "),
    durationSec: 11,
  });
  assert.ok(q.notes.some((n) => /brand_close/i.test(n)));
});

test("scorer: too-long scene voiceover lowers voiceNaturalness", () => {
  const scenes = makeScenes();
  scenes[1] = {
    ...scenes[1]!,
    voiceover:
      "Cette bourse couvre les frais de scolarité l’hébergement le transport les livres et plus encore vraiment incroyable",
  };
  const q = scoreReelQuality({
    format: "opportunity_alert",
    storyboard: scenes,
    caption: "x",
    hashtags: ["a", "b", "c"],
    voiceover: scenes.map((s) => s.voiceover).join(" "),
    durationSec: 15,
  });
  assert.ok(q.voiceNaturalness < 100);
});

test("scorer: duration outside window is flagged", () => {
  const q = scoreReelQuality({
    format: "opportunity_alert",
    storyboard: makeScenes(),
    caption: "x",
    hashtags: ["a", "b", "c"],
    voiceover: "ok",
    durationSec: 60, // way over the 22s cap for alerts
  });
  assert.ok(q.notes.some((n) => /too long/.test(n)));
});
