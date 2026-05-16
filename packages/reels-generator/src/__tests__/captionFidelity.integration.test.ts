/**
 * Integration test: alignCaptions never emits a token that wasn't in the
 * source script.
 *
 * The unit test (`alignCaptions.test.ts`) only exercises `tokenizeScript`.
 * That doesn't catch the v1 regression — Whisper-substituted tokens
 * ("sisters in public house" instead of "Sisters in Public Health")
 * leaking into the rendered caption bar — because the leak happens in
 * the `repairTimestampsWithGroundTruth` / fallback decision, not in
 * tokenization.
 *
 * This test runs the real `alignCaptions` against a mocked Google STT
 * response that deliberately mistranscribes proper nouns. It then
 * asserts that every token in the returned `.words[].word` list
 * appears in the ground-truth script. The reverse is NOT required —
 * the alignment may legitimately omit tokens (e.g. the recognizer
 * dropped a leading filler word and the proportional fallback didn't
 * fire). What we forbid is *extras* — anything Whisper invented.
 *
 * No network is hit: `globalThis.fetch` is replaced for the lifetime
 * of the test. No real audio either — `audioPath` points at an empty
 * file because the bytes go straight to the mocked fetch.
 */

import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { alignCaptions, tokenizeScript } from "../alignCaptions.js";

/** Strip punctuation + lowercase so "Public" and "public," compare equal. */
function normalize(token: string): string {
  return token
    .toLowerCase()
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .trim();
}

/**
 * Build a fake Google STT response. Purposely inserts the v1-regression
 * substitution `"Health" → "house"` and lowercases the proper nouns so
 * the test would FAIL if `alignCaptions` ever forwarded recognizer
 * tokens to the caption bar.
 */
function fakeSttResponse(misWords: string[], totalDurationSec: number) {
  const perWord = totalDurationSec / Math.max(1, misWords.length);
  return {
    results: [
      {
        alternatives: [
          {
            transcript: misWords.join(" "),
            words: misWords.map((w, i) => ({
              word: w,
              startTime: `${(i * perWord).toFixed(3)}s`,
              endTime: `${((i + 1) * perWord).toFixed(3)}s`,
            })),
          },
        ],
      },
    ],
  };
}

describe("alignCaptions caption fidelity (integration)", () => {
  let originalFetch: typeof globalThis.fetch;
  let originalKey: string | undefined;
  let stubAudioPath: string;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    originalKey = process.env.GOOGLE_STT_API_KEY;
    // alignCaptions() refuses to run without a key. Any non-empty value
    // is fine — fetch is mocked so the key is never sent anywhere.
    process.env.GOOGLE_STT_API_KEY = "ci-test-key";
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "align-captions-"));
    stubAudioPath = path.join(tmp, "stub.mp3");
    // 1 KB of zeros — alignCaptions only base64-encodes and forwards it.
    await fs.writeFile(stubAudioPath, Buffer.alloc(1024));
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_STT_API_KEY;
    else process.env.GOOGLE_STT_API_KEY = originalKey;
    await fs.rm(path.dirname(stubAudioPath), { recursive: true, force: true });
  });

  it("never emits a caption token absent from the ground-truth script", async () => {
    const script =
      "Sisters in Public Health offre 30 bourses Mastercard Foundation pour étudiants haïtiens avant le 15 mars 2026.";

    // Whisper-style mistranscription that triggered the v1 regression:
    //   "Public Health" → "public house", "Mastercard" → "master card",
    //   "haïtiens"      → "haitiennes",   "Sisters"    → "sisters" (case)
    const mis = [
      "sisters", "in", "public", "house", "offre", "30", "bourses",
      "master", "card", "foundation", "pour", "etudiants",
      "haitiennes", "avant", "le", "15", "mars", "2026",
    ];

    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => fakeSttResponse(mis, 18),
      text: async () => "",
    })) as unknown as typeof globalThis.fetch;

    const result = await alignCaptions({
      audioPath: stubAudioPath,
      scriptText: script,
      audioDurationSec: 18,
    });

    const groundTruth = new Set(tokenizeScript(script).map(normalize));
    const offenders: string[] = [];
    for (const w of result.words) {
      if (!groundTruth.has(normalize(w.word))) offenders.push(w.word);
    }

    assert.equal(
      offenders.length,
      0,
      `alignCaptions leaked ${offenders.length} non-script tokens: ${JSON.stringify(offenders)}`,
    );
    // Sanity: we did get *some* output (not an empty array masquerading as success).
    assert.ok(result.words.length > 0, "expected at least one aligned token");
    // The mock response had exactly the same word count as the script,
    // so the "stt-prompt" branch (re-pair timestamps with ground-truth
    // tokens) should have been chosen.
    assert.equal(result.alignment.method, "stt-prompt");
  });

  it("falls back to proportional split when STT fails — and still uses ground-truth tokens", async () => {
    // Hard failure path: fetch rejects. alignCaptions logs a warning,
    // then proportional-splits the script across audioDurationSec.
    const script = "Erasmus Mundus accueille 200 candidats africains et caribéens.";

    globalThis.fetch = (async () => {
      throw new Error("simulated STT outage");
    }) as unknown as typeof globalThis.fetch;

    const result = await alignCaptions({
      audioPath: stubAudioPath,
      scriptText: script,
      audioDurationSec: 9,
    });

    const groundTruth = new Set(tokenizeScript(script).map(normalize));
    for (const w of result.words) {
      assert.ok(
        groundTruth.has(normalize(w.word)),
        `proportional fallback emitted non-script token: ${w.word}`,
      );
    }
    assert.equal(result.alignment.method, "proportional-fallback");
    assert.equal(result.words.length, tokenizeScript(script).length);
  });
});
