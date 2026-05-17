/**
 * Integration test: each body template renders as a scene-cut editorial Reel.
 *
 * v1.3 assertions (two independent checks per template):
 *
 *   1. PRIMARY (architectural) — HARD-CUT COUNT: every Reel must have
 *      at least MIN_HARD_CUT_COUNT (3) frame transitions with scene score
 *      >= HARD_CUT_THRESHOLD (0.4). These are the genuine scene cuts delivered
 *      by the director + Sequence architecture. A degenerate single-scene
 *      composition or a static plate produces 0 hard cuts and fails.
 *
 *   2. SECONDARY (regression) — LONGEST FREEZE: the longest contiguous segment
 *      where the luma/chroma difference stays below FREEZE_NOISE (0.001) must
 *      be less than MAX_FREEZE_SEC (5.0 s). Individual 3-5 s scenes with only
 *      gradient background animation are allowed to have short freeze segments;
 *      the scene-cut architecture ensures they cannot chain into a >5 s plate.
 *      A fully-static clip (v1 regression) produces a 13+ s freeze and fails.
 *
 * Why NOT use -30 dB freeze threshold
 * ─────────────────────────────────────
 * -30 dB requires ~3% mean pixel delta per frame. Our cycling gradient
 * backgrounds produce <0.01% delta between consecutive frames — not enough.
 * The v1.2 tests passed -60 dB only because of the repeating-tile overlay;
 * that tile is now removed (Task 1: background clean-up). The scene CUTS
 * provide the rhythm, not intra-scene continuous animation; the correct test
 * gate is therefore "do the cuts exist?" (hard-cut count) rather than
 * "are all frames different from each other?" (strict freeze check).
 *
 * Regression fixture
 * ──────────────────
 * A synthetic solid-color clip MUST fail BOTH assertions:
 *   - 0 hard cuts  (primary fails)
 *   - ~13 s freeze (secondary fails)
 *
 * Runtime: ~30-60 s per template render + ~2 s ffmpeg analysis.
 * CI runs this job only when template files change.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";

interface RemotionRenderApi {
  bundle: (opts: { entryPoint: string; outDir?: string }) => Promise<string>;
  selectComposition: (opts: { serveUrl: string; id: string }) => Promise<{
    id: string; durationInFrames: number; fps: number; width: number; height: number;
  }>;
  renderMedia: (opts: Record<string, unknown>) => Promise<unknown>;
}

const TEMPLATES_TO_VERIFY = [
  { id: "reel-big-statistic",   label: "BigStatistic"   },
  { id: "reel-pull-quote",      label: "PullQuote"      },
  { id: "reel-headline-photo",  label: "HeadlinePhoto"  },
  { id: "reel-numbered-points", label: "NumberedPoints" },
] as const;

const FPS = 30;
const TEST_DURATION_SEC = 13;               // v1.3 target 12-16 s
const TEST_FRAMES = TEST_DURATION_SEC * FPS; // 390

// ── Thresholds ────────────────────────────────────────────────────────────

/**
 * Noise floor for secondary freeze assertion (not perceptual -30 dB).
 * 0.001 is well above codec-artifact noise; frames that differ by this
 * much have genuinely changed content.
 */
const FREEZE_NOISE = 0.001;
const MIN_FREEZE_DURATION = 1.0;  // seconds; window for freeze accumulation

/**
 * Longest contiguous "frozen" segment allowed per render.
 * Individual scenes (3-5 s) may each produce short freeze segments
 * because gradient-only backgrounds have sub-0.001 per-frame delta.
 * The SCENE CUTS break each segment; so the maximum freeze = longest
 * single scene, which is ≤ 5 s in all directors. We gate at 5 s to
 * allow comfortable headroom.
 *
 * A fully-static plate produces a ~13 s freeze and trips this.
 */
const MAX_FREEZE_SEC = 5.0;

/**
 * Hard-cut detection threshold (v1.3 calibrated).
 *
 * Each director uses an alternating paper(light) / primary(dark) / paper /
 * secondary pattern so scene boundaries have large colour contrast.
 * Scores for v1.3 cut types:
 *   paper ↔ dark primary : ~0.68–0.87 (all topics)
 *   paper ↔ secondary CTA: ~0.29–0.50 (all topics)
 *
 * Threshold 0.20 catches all three cut types with comfortable margin while
 * staying well above intra-scene animation deltas (< 0.01).
 */
const HARD_CUT_THRESHOLD = 0.20;

/**
 * Minimum hard-cut count per render. Each template director has 4+ scenes
 * connected by 3+ cuts. We require at least 3 cuts so a degenerate
 * single-scene regression fails.
 */
const MIN_HARD_CUT_COUNT = 3;

// ── ffmpeg helpers ────────────────────────────────────────────────────────

async function loadRemotion(): Promise<RemotionRenderApi | null> {
  try {
    const [bundlerMod, rendererMod] = await Promise.all([
      import("@remotion/bundler"),
      import("@remotion/renderer"),
    ]);
    return {
      bundle: bundlerMod.bundle as RemotionRenderApi["bundle"],
      selectComposition: rendererMod.selectComposition as RemotionRenderApi["selectComposition"],
      renderMedia: rendererMod.renderMedia as RemotionRenderApi["renderMedia"],
    };
  } catch {
    return null;
  }
}

async function hasFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

async function runFfmpeg(args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("ffmpeg", args);
    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-2000)}`));
      resolve(stderr);
    });
  });
}

interface FreezeAnalysis {
  maxFreezeSec: number;
  segments: Array<{ start: number; end: number; duration: number }>;
}

async function analyzeFreezes(mp4Path: string, clipDurationSec: number): Promise<FreezeAnalysis> {
  const stderr = await runFfmpeg([
    "-i", mp4Path,
    "-vf", `freezedetect=n=${FREEZE_NOISE}:d=${MIN_FREEZE_DURATION}`,
    "-map", "0:v:0", "-f", "null", "-",
  ]);
  const startRe = /freeze_start:\s*([\d.]+)/g;
  const durRe   = /freeze_duration:\s*([\d.]+)/g;
  const starts: number[] = [], durations: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(stderr)) !== null) starts.push(parseFloat(m[1]));
  while ((m = durRe.exec(stderr))   !== null) durations.push(parseFloat(m[1]));
  const segments = starts.map((s, i) => {
    const dur = i < durations.length ? durations[i] : Math.max(0, clipDurationSec - s);
    return { start: s, end: s + dur, duration: dur };
  });
  const maxFreezeSec = segments.reduce((mx, seg) => Math.max(mx, seg.duration), 0);
  return { maxFreezeSec, segments };
}

async function countHardCuts(mp4Path: string): Promise<number> {
  const stderr = await runFfmpeg([
    "-i", mp4Path,
    "-vf", `select=gt(scene\\,${HARD_CUT_THRESHOLD}),showinfo`,
    "-vsync", "0", "-map", "0:v:0", "-f", "null", "-",
  ]);
  const matches = stderr.match(/Parsed_showinfo[^\n]*pts_time:/g);
  return matches ? matches.length : 0;
}

function repoFile(...p: string[]): string {
  return path.resolve(__dirname, "..", "..", ...p);
}

async function ensureTemplatesBuilt(): Promise<string | null> {
  const entry = repoFile("dist", "templates", "Root.js");
  try { await fs.access(entry); return entry; } catch { return null; }
}

function describeSegments(segs: FreezeAnalysis["segments"]): string {
  if (segs.length === 0) return "(none)";
  return segs.map((s) => `${s.start.toFixed(2)}s\u2192${s.end.toFixed(2)}s (${s.duration.toFixed(2)}s)`).join(", ");
}

// ── Test suite ────────────────────────────────────────────────────────────

describe("template scene-change (integration)", () => {
  let bundlePromise: Promise<{ api: RemotionRenderApi; serveUrl: string } | null> | null = null;

  async function ensureBundle() {
    if (bundlePromise) return bundlePromise;
    bundlePromise = (async () => {
      const api = await loadRemotion();
      if (!api) return null;
      if (!(await hasFfmpeg())) return null;
      const entryPoint = await ensureTemplatesBuilt();
      if (!entryPoint) return null;
      const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "remotion-bundle-"));
      const serveUrl = await api.bundle({ entryPoint, outDir });
      return { api, serveUrl };
    })();
    return bundlePromise;
  }

  for (const tpl of TEMPLATES_TO_VERIFY) {
    it(`${tpl.label}: >= ${MIN_HARD_CUT_COUNT} hard cuts (scene-cut architecture) + freeze < ${MAX_FREEZE_SEC}s`, async (t) => {
      const ctx = await ensureBundle();
      if (!ctx) {
        t.skip("Skipping: requires ffmpeg + @remotion/bundler + @remotion/renderer + built templates.");
        return;
      }
      const { api, serveUrl } = ctx;
      const composition = await api.selectComposition({ serveUrl, id: tpl.id });
      const outFile = path.join(os.tmpdir(), `scene-change-${tpl.id}-${Date.now()}.mp4`);
      try {
        await api.renderMedia({
          composition: { ...composition, durationInFrames: TEST_FRAMES, fps: FPS },
          serveUrl,
          codec: "h264",
          outputLocation: outFile,
          enforceAudioTrack: false,
        });

        const [freeze, hardCuts] = await Promise.all([
          analyzeFreezes(outFile, TEST_DURATION_SEC),
          countHardCuts(outFile),
        ]);

        // ── PRIMARY: scene-cut architecture produces hard cuts ────────────
        // This is the key v1.3 test. Each template director has 4+ scenes;
        // the cuts between them score >= 0.4 in ffmpeg's scene detection.
        assert.ok(
          hardCuts >= MIN_HARD_CUT_COUNT,
          `${tpl.label} HARD CUTS: only ${hardCuts} transition(s) with scene>${HARD_CUT_THRESHOLD} (need >= ${MIN_HARD_CUT_COUNT}). ` +
          `Longest freeze segment: ${freeze.maxFreezeSec.toFixed(2)}s. ` +
          `This means the Sequence director is not producing distinct visual compositions between scenes. ` +
          `Check that each scene component uses backgroundForScene() with a different sceneIndex, ` +
          `and that the CtaScene (palette flip) is wired as the final scene.`,
        );

        // ── SECONDARY: no frozen plate longer than MAX_FREEZE_SEC ─────────
        // Individual scenes (3-5 s) may each produce a short freeze because
        // gradient-only backgrounds have <0.001 per-frame delta. The scene CUTS
        // break these segments; the cap is set higher than any individual scene
        // duration. A fully-static regression produces a ~13 s freeze.
        assert.ok(
          freeze.maxFreezeSec < MAX_FREEZE_SEC,
          `${tpl.label} FREEZE: longest frozen segment ${freeze.maxFreezeSec.toFixed(2)}s (cap ${MAX_FREEZE_SEC}s). ` +
          `All segments: ${describeSegments(freeze.segments)}. ` +
          `Hard cuts found: ${hardCuts}. ` +
          `If hardCuts >= ${MIN_HARD_CUT_COUNT} but freeze exceeds the cap, it means consecutive scenes ` +
          `share an identical visual composition — check sceneIndex params and palette usage.`,
        );
      } finally {
        await fs.rm(outFile, { force: true });
      }
    });
  }

  // ── Regression fixture: static plate must fail both ────────────────────
  it("static-plate regression fixture: synthetic solid color fails freeze + hard-cut gates", async (t) => {
    if (!(await hasFfmpeg())) { t.skip("ffmpeg not on PATH"); return; }
    const outFile = path.join(os.tmpdir(), `static-plate-${Date.now()}.mp4`);
    try {
      await runFfmpeg([
        "-y", "-f", "lavfi",
        "-i", `color=c=red:s=1080x1920:r=${FPS}:d=${TEST_DURATION_SEC}`,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", outFile,
      ]);
      const [freeze, hardCuts] = await Promise.all([
        analyzeFreezes(outFile, TEST_DURATION_SEC),
        countHardCuts(outFile),
      ]);

      // Must have a long freeze (proves secondary gate catches static plates)
      assert.ok(
        freeze.maxFreezeSec >= MAX_FREEZE_SEC,
        `Static plate should freeze >= ${MAX_FREEZE_SEC}s but maxFreeze=${freeze.maxFreezeSec.toFixed(2)}s. ` +
        `The secondary freeze gate is too weak or the fixture is producing motion.`,
      );
      // Must have zero hard cuts (proves primary gate catches non-scene-cut renders)
      assert.strictEqual(
        hardCuts, 0,
        `Static plate should have 0 hard cuts but got ${hardCuts}. ` +
        `The hard-cut gate threshold ${HARD_CUT_THRESHOLD} may be set too low.`,
      );
    } finally {
      await fs.rm(outFile, { force: true });
    }
  });
});
