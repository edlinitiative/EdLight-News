import { test } from "node:test";
import assert from "node:assert/strict";
import { SANDRA_VOICE, speakAsSandra } from "./index.js";

test("SANDRA_VOICE has stable Google Cloud TTS defaults", () => {
  assert.equal(SANDRA_VOICE.audioEncoding, "MP3");
  assert.ok(SANDRA_VOICE.voice.length > 0);
  assert.ok(SANDRA_VOICE.languageCode.includes("-"));
  assert.ok(SANDRA_VOICE.speakingRate > 0 && SANDRA_VOICE.speakingRate <= 4);
  assert.ok(SANDRA_VOICE.pitch >= -20 && SANDRA_VOICE.pitch <= 20);
});

test("speakAsSandra rejects empty input", async () => {
  await assert.rejects(
    () => speakAsSandra("", { apiKey: "test-key" }),
    /empty text/i,
  );
});

test("speakAsSandra rejects when no Google API key is available", async () => {
  const originals = {
    GOOGLE_TTS_API_KEY: process.env.GOOGLE_TTS_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GOOGLE_VISION_API_KEY: process.env.GOOGLE_VISION_API_KEY,
  };
  delete process.env.GOOGLE_TTS_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_VISION_API_KEY;
  try {
    await assert.rejects(
      () => speakAsSandra("Bonjou! Sandra la."),
      /Google TTS API key/,
    );
  } finally {
    for (const [k, v] of Object.entries(originals)) {
      if (v !== undefined) process.env[k] = v;
    }
  }
});
