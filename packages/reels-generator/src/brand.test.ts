import { test } from "node:test";
import assert from "node:assert/strict";
import { TOPIC_PALETTE, TYPE, MOTION, FRAME, getPalette } from "./brand.js";
import type { ReelTopic } from "./types.js";

const TOPICS: ReelTopic[] = [
  "scholarship",
  "opportunity",
  "taux",
  "news",
  "histoire",
  "fact",
  "education",
];

test("every topic has a complete 5-color palette", () => {
  for (const t of TOPICS) {
    const p = TOPIC_PALETTE[t];
    assert.ok(p, `missing palette for ${t}`);
    for (const k of ["primary", "secondary", "accent", "ink", "paper"] as const) {
      assert.match(p[k], /^#[0-9A-Fa-f]{6}$/, `${t}.${k} must be 6-hex color`);
    }
  }
});

test("getPalette throws on unknown topic", () => {
  assert.throws(() => getPalette("nonsense" as ReelTopic), /no palette defined/);
});

test("typography defines display + body + mono families", () => {
  assert.match(TYPE.display, /serif/i);
  assert.match(TYPE.body, /sans/i);
  assert.match(TYPE.mono, /mono|Fira/i);
});

test("motion intro + outro durations are positive integers", () => {
  assert.ok(MOTION.intro.durationFrames > 0);
  assert.ok(MOTION.outro.durationFrames > 0);
  assert.ok(Number.isInteger(MOTION.intro.durationFrames));
});

test("frame is 9:16 vertical at 30fps", () => {
  assert.equal(FRAME.width, 1080);
  assert.equal(FRAME.height, 1920);
  assert.equal(FRAME.fps, 30);
});
