import { test } from "node:test";
import assert from "node:assert/strict";
import { SANDRA_VOICE, speakAsSandra } from "./index.js";

test("SANDRA_VOICE has stable defaults", () => {
  assert.equal(SANDRA_VOICE.format, "mp3");
  assert.ok(SANDRA_VOICE.model.length > 0);
  assert.ok(SANDRA_VOICE.voice.length > 0);
  assert.ok(SANDRA_VOICE.speed > 0 && SANDRA_VOICE.speed <= 4);
});

test("speakAsSandra rejects empty input", async () => {
  await assert.rejects(
    () => speakAsSandra("", { apiKey: "sk-test" }),
    /empty text/i,
  );
});

test("speakAsSandra rejects when no API key is available", async () => {
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      () => speakAsSandra("Bonjou! Sandra la."),
      /OPENAI_API_KEY/,
    );
  } finally {
    if (original !== undefined) process.env.OPENAI_API_KEY = original;
  }
});
