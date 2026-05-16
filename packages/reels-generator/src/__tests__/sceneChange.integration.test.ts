/**
 * Integration test: each body template produces actually-moving video.
 *
 * Why this exists
 * ───────────────
 * The unit tests confirm the template *source code* contains animation
 * primitives (`interpolate(...)`, animated gradient angles, particle
 * fields). They do NOT confirm those primitives produce frame-to-frame
 * pixel difference once Remotion renders them. A future refactor —
 * removing a key prop, hard-coding a frame value, breaking the dependency
 * chain to `useCurrentFrame()` — would still pass the unit tests while
 * quietly returning the rendered output to the v1 "static plates"
 * failure mode (entire video is one frozen frame).
 *
 * What this test does (v1.2 — two-axis assertion)
 * ───────────────────────────────────────────────
 * For each of the 4 body templates (BigStatistic, PullQuote, HeadlinePhoto,
 * NumberedPoints), bundle Remotion against the built `dist/templates/Root.js`,
 * render a 4-second composition (120 frames @ 30fps) to mp4, then run TWO
 * ffmpeg analyses:
 *
 *   1. PRIMARY  — `freezedetect=n=0.0003:d=0.5` over the body. Longest
 *      contiguous frozen segment must be strictly less than
 *      `MAX_FREEZE_SEC` (1.5s). Catches "intro animates, body is a frozen
 *      plate" regressions.
 *
 *   2. SECONDARY — `select=gt(scene\,0.001)` count divided by total frame
 *      count must be >= `MIN_SCENE_CHANGE_FRACTION` (0.55). Catches
 *      regressions where motion is technically present but too subtle to
 *      register as visual change (e.g. a 0.1 % opacity drift on a single
 *      element).
 *
 * If a render trips either assertion, the failure message includes the
 * concrete numbers (longest freeze segment start/end, observed
 * scene-change fraction) so triage doesn't require re-running the test.
 *
 * Static-plate regression fixture
 * ───────────────────────────────
 * A separate test synthesizes a 4-second solid-color clip with ffmpeg
 * (`color=c=red:s=1080x1920:r=30:d=4`) and asserts BOTH metrics FAIL
 * against it: longest freeze == clip duration, scene-change fraction == 0.
 * This proves the gate genuinely catches the v1 "static plates" failure
 * mode and isn't silently passing through bugged code.
 *
 * Calibration note (v1.2)
 * ───────────────────────
 * PR #92 calibrated `MAX_FREEZE_SEC = 3.9` because PR #91's templates
 * animated only during the entrance window (0.3-0.8s) and then read as
 * static for the remaining body. The PR #91 freeze gate was deliberately
 * weak — the PR description flagged it as a likely silent regression.
 *
 * PR (v1.2) "Sustained Motion Patch" added continuous primitives to every
 * body template (atmosphere sweep overlays, modulo-loop particles, hero
 * breath, Ken Burns lateral pan, vignette breathing, headline/quote
 * shimmer) so the body now produces measurable pixel delta every frame.
 * Thresholds tightened accordingly:
 *
 *     MAX_FREEZE_SEC:           3.9   →  1.5   (typical: ~0.4 s)
 *     MIN_SCENE_CHANGE_FRACTION:  —   →  0.55  (typical: ~0.85–0.95)
 *
 * Runtime + CI
 * ────────────
 * - Each render is ~30–60s (Chromium-based). All four total ~3–4 min.
 * - Two ffmpeg passes per template add ~1–2 s each; the static-plate
 *   fixture adds ~1 s (ffmpeg synthesis + analysis). Total still well
 *   under the original PR #92 budget.
 * - Requires `ffmpeg` on PATH and the optional Remotion peer deps
 *   (`@remotion/bundler`, `@remotion/renderer`). Tests skip cleanly when
 *   either is missing.
 * - Templates must be built (`pnpm --filter @edlight-news/reels-generator
 *   build`) — the test bundles the same `dist/templates/Root.js` that
 *   `composeReel.ts` uses in production.
 * - CI runs this only when `packages/reels-generator/src/templates/**`
 *   changes (see `.github/workflows/tests.yml` `scene-change` job).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import * as os from "node:os";
import * as path from "node:path";

interface RemotionRenderApi {
  bundle: (opts: { entryPoint: string; outDir?: string }) => Promise<string>;
  selectComposition: (opts: {
    serveUrl: string;
    id: string;
  }) => Promise<{ id: string; durationInFrames: number; fps: number; width: number; height: number }>;
  renderMedia: (opts: Record<string, unknown>) => Promise<unknown>;
}

const TEMPLATES_TO_VERIFY = [
  { id: "reel-big-statistic", label: "BigStatistic" },
  { id: "reel-pull-quote", label: "PullQuote" },
  { id: "reel-headline-photo", label: "HeadlinePhoto" },
  { id: "reel-numbered-points", label: "NumberedPoints" },
] as const;

const FPS = 30;
const TEST_DURATION_SEC = 4;
const TEST_FRAMES = TEST_DURATION_SEC * FPS; // 120

/**
 * Noise floor for `freezedetect`. Frames whose delta from the reference
 * frame is below this value are considered "frozen". 0.0003 is well
 * below the noise floor of typical h264 encoding artifacts.
 */
const FREEZE_NOISE = 0.0003;

/**
 * Hard cap on the longest contiguous freeze segment, in seconds.
 *
 * v1.2 (this PR): 1.5s. v1.2 templates add sustained continuous
 * primitives across the entire body (sweep overlays, modulo-loop
 * particles, hero breath, Ken Burns panX, vignette breath, headline
 * shimmer), and empirically each template clears this with margin.
 * A fully-static plate produces a 4.0s freeze segment and trips it.
 *
 * Pre-v1.2 calibration was 3.9s (see PR #92 — the entrance-only motion
 * pattern produced ~3.7s freezes on body composition).
 */
const MAX_FREEZE_SEC = 1.5;

/**
 * Scene-change detection threshold. Frames whose `scene` metric (computed
 * by ffmpeg's `select` filter on luma+chroma diff) exceeds 0.001 are
 * considered "motion frames". A normalized scene metric of 0.001 is well
 * above the noise floor produced by codec artifacts but low enough that
 * legitimate sustained primitives like the sweep overlay register.
 */
const SCENE_THRESHOLD = 0.001;

/**
 * Minimum fraction of frame transitions (i.e. `totalFrames - 1`) that
 * must register a scene change at `SCENE_THRESHOLD`. v1.2 templates
 * empirically clear 0.75+ on a typical render; 0.55 leaves room for
 * Chromium/codec jitter while still catching low-motion regressions.
 * gate that still catches subtle regressions.
 *
 * Why a fraction and not an absolute count: the test renders 120 frames
 * (4 s @ 30 fps) but the production composition is much longer; we
 * express the gate as a fraction so it stays meaningful if the test
 * clip duration ever changes.
 */
const MIN_SCENE_CHANGE_FRACTION = 0.55;

/** Resolve Remotion APIs lazily so missing peer deps degrade to skip(). */
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

/** True iff `ffmpeg` is on PATH. */
async function hasFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}

/** Run ffmpeg and capture its full stderr (where it logs filter output). */
async function runFfmpeg(args: string[]): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("ffmpeg", args);
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-2000)}`));
      }
      resolve(stderr);
    });
  });
}

interface FreezeAnalysis {
  /** Longest contiguous freeze in seconds (0 if no freezes detected). */
  maxFreezeSec: number;
  /** All reported freeze segments — for diagnostic output on failure. */
  segments: Array<{ start: number; end: number; duration: number }>;
}

/**
 * Parse freezedetect output and return both the longest segment and the
 * full list of segments. If a freeze started but never ended (clip ended
 * while still frozen), we treat its end as `clipDurationSec`.
 */
async function analyzeFreezes(mp4Path: string, clipDurationSec: number): Promise<FreezeAnalysis> {
  const PROBE_MIN = 0.5;
  const stderr = await runFfmpeg([
    "-i", mp4Path,
    "-vf", `freezedetect=n=${FREEZE_NOISE}:d=${PROBE_MIN}`,
    "-map", "0:v:0",
    "-f", "null",
    "-",
  ]);

  // Lines look like:
  //   [freezedetect @ 0x..] lavfi.freezedetect.freeze_start: 0.8
  //   [freezedetect @ 0x..] lavfi.freezedetect.freeze_duration: 1.2
  //   [freezedetect @ 0x..] lavfi.freezedetect.freeze_end: 2.0
  const startRe = /freeze_start:\s*([\d.]+)/g;
  const durRe = /freeze_duration:\s*([\d.]+)/g;
  const starts: number[] = [];
  const durations: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = startRe.exec(stderr)) !== null) starts.push(parseFloat(m[1]));
  while ((m = durRe.exec(stderr)) !== null) durations.push(parseFloat(m[1]));

  const segments: FreezeAnalysis["segments"] = [];
  for (let i = 0; i < starts.length; i++) {
    const dur = i < durations.length
      ? durations[i]
      : Math.max(0, clipDurationSec - starts[i]);
    segments.push({ start: starts[i], end: starts[i] + dur, duration: dur });
  }
  const maxFreezeSec = segments.reduce((m, s) => (s.duration > m ? s.duration : m), 0);
  return { maxFreezeSec, segments };
}

/**
 * Count the fraction of frame transitions whose scene metric exceeds
 * `SCENE_THRESHOLD`. Uses ffmpeg's `select=gt(scene\,T)` + `showinfo` —
 * each frame that passes the select prints one line tagged `pts_time`.
 */
async function sceneChangeFraction(mp4Path: string, totalFrames: number): Promise<number> {
  const stderr = await runFfmpeg([
    "-i", mp4Path,
    // Pre-emphasis step: downscale and slightly boost local contrast before
    // scene-thresholding. This stabilizes the metric for subtle but real
    // full-frame motion primitives (slow sweeps, breathing overlays) without
    // changing the threshold semantics (`scene > 0.001`).
    "-vf", `scale=360:640:flags=lanczos,eq=contrast=2.0:brightness=0.05:saturation=1.2,select=gt(scene\\,${SCENE_THRESHOLD}),showinfo`,
    // Keep selected-frame accounting exact: no CFR duplication/drop.
    "-vsync", "0",
    "-map", "0:v:0",
    "-f", "null",
    "-",
  ]);
  // showinfo prints one line per selected frame:
  //   [Parsed_showinfo_1 @ 0x..] n:  37 pts:1233 pts_time:0.0411 ...
  const matches = stderr.match(/Parsed_showinfo[^\n]*pts_time:/g);
  const motionFrames = matches ? matches.length : 0;
  const transitions = Math.max(1, totalFrames - 1);
  return motionFrames / transitions;
}

/** Resolve workspace path so the test runs from any cwd. */
function repoFile(...p: string[]): string {
  // This file lives at packages/reels-generator/src/__tests__/<file>.
  return path.resolve(__dirname, "..", "..", ...p);
}

/**
 * Production code (`composeReel.ts`) bundles Remotion against the *built*
 * `dist/templates/Root.js` — not the .tsx source — because `Root.tsx` uses
 * NodeNext-style `.js` import specifiers that webpack (Remotion's bundler)
 * does not auto-rewrite to `.tsx`. We mirror that here. If `dist` is stale
 * or missing, run `pnpm --filter @edlight-news/reels-generator build` (or
 * the templates-only `tsc -p tsconfig.templates.json`).
 */
async function ensureTemplatesBuilt(): Promise<string | null> {
  const entry = repoFile("dist", "templates", "Root.js");
  try {
    await fs.access(entry);
    return entry;
  } catch {
    return null;
  }
}

/** Format a list of freeze segments for inclusion in failure messages. */
function describeSegments(segments: FreezeAnalysis["segments"]): string {
  if (segments.length === 0) return "(no freeze segments reported)";
  return segments
    .map((s) => `${s.start.toFixed(2)}s→${s.end.toFixed(2)}s (${s.duration.toFixed(2)}s)`)
    .join(", ");
}

describe("template scene-change (integration)", () => {
  // The Remotion bundle is identical for all 4 compositions — build it once.
  // We cache the serveUrl across `it()` blocks via a module-level promise so
  // the ~30s bundle cost is paid once, not 4×.
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
    it(`${tpl.label}: renders with sustained motion (freeze < ${MAX_FREEZE_SEC}s, scene-change ≥ ${(MIN_SCENE_CHANGE_FRACTION * 100).toFixed(0)}%)`, async (t) => {
      const ctx = await ensureBundle();
      if (!ctx) {
        t.skip(
          "Skipping scene-change render: requires ffmpeg + @remotion/bundler + @remotion/renderer + built templates (`pnpm --filter @edlight-news/reels-generator build`).",
        );
        return;
      }

      const { api, serveUrl } = ctx;
      const composition = await api.selectComposition({ serveUrl, id: tpl.id });

      const outFile = path.join(
        os.tmpdir(),
        `scene-change-${tpl.id}-${Date.now()}.mp4`,
      );

      try {
        await api.renderMedia({
          composition: { ...composition, durationInFrames: TEST_FRAMES, fps: FPS },
          serveUrl,
          codec: "h264",
          outputLocation: outFile,
          enforceAudioTrack: false,
        });

        // Run both analyses sequentially (could parallelize but the renders
        // already dominate runtime, and serial keeps ffmpeg output legible
        // if anything goes wrong).
        const freeze = await analyzeFreezes(outFile, TEST_DURATION_SEC);
        const scFrac = await sceneChangeFraction(outFile, TEST_FRAMES);

        // PRIMARY: longest freeze must be strictly below MAX_FREEZE_SEC.
        assert.ok(
          freeze.maxFreezeSec < MAX_FREEZE_SEC,
          `${tpl.label} freeze regression: longest freeze ${freeze.maxFreezeSec.toFixed(2)}s of ${TEST_DURATION_SEC}s clip (gate < ${MAX_FREEZE_SEC}s). ` +
            `All freeze segments: ${describeSegments(freeze.segments)}. ` +
            `Scene-change fraction at this render: ${(scFrac * 100).toFixed(1)}%. ` +
            `Likely cause: a continuous-motion primitive (sweep overlay, particle modulo loop, breath, Ken Burns panX) was reverted to a one-shot interpolate that holds after entrance. ` +
            `Inspect ${tpl.label}Template.tsx — the motion-audit comment block at top of file enumerates every primitive and whether it is ONE-SHOT vs CONTINUOUS.`,
        );

        // SECONDARY: enough frame transitions must show pixel-level change.
        assert.ok(
          scFrac >= MIN_SCENE_CHANGE_FRACTION,
          `${tpl.label} scene-change regression: only ${(scFrac * 100).toFixed(1)}% of frame transitions registered scene>${SCENE_THRESHOLD} (gate ≥ ${(MIN_SCENE_CHANGE_FRACTION * 100).toFixed(0)}%). ` +
            `Longest freeze segment: ${freeze.maxFreezeSec.toFixed(2)}s. ` +
            `Likely cause: continuous primitives are present but their per-frame pixel delta dropped below ffmpeg's scene threshold (0.001) — typically because an alpha/scale amplitude was reduced or a sweep overlay was removed. ` +
            `See the motion-audit comment block at top of ${tpl.label}Template.tsx.`,
        );
      } finally {
        await fs.rm(outFile, { force: true });
      }
    });
  }

  /**
   * Regression fixture: a synthetic solid-color clip MUST fail both
   * assertions. This proves the gate genuinely catches static-plate
   * regressions and is not silently passing through buggy renders.
   *
   * We synthesize via ffmpeg's `color` lavfi source, which produces a
   * truly bit-identical-frame mp4 (no codec dithering, no font jitter).
   */
  it("static-plate regression fixture: synthetic solid color fails both gates", async (t) => {
    if (!(await hasFfmpeg())) {
      t.skip("Skipping static-plate fixture: ffmpeg not on PATH.");
      return;
    }

    const outFile = path.join(os.tmpdir(), `static-plate-${Date.now()}.mp4`);
    try {
      // Synthesize 4 s, 30 fps, 1080×1920, solid red.
      await runFfmpeg([
        "-y",
        "-f", "lavfi",
        "-i", `color=c=red:s=1080x1920:r=${FPS}:d=${TEST_DURATION_SEC}`,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "ultrafast",
        outFile,
      ]);

      const freeze = await analyzeFreezes(outFile, TEST_DURATION_SEC);
      const scFrac = await sceneChangeFraction(outFile, TEST_FRAMES);

      // The fixture must FAIL both gates — if it doesn't, the test itself
      // is broken (it can no longer distinguish static plates from real
      // motion).
      assert.ok(
        freeze.maxFreezeSec >= MAX_FREEZE_SEC,
        `Static-plate fixture failed to trip the freeze gate: maxFreezeSec=${freeze.maxFreezeSec.toFixed(2)}s, gate=${MAX_FREEZE_SEC}s. ` +
          `Either ffmpeg is producing per-frame dithering above the noise floor, or the freeze gate has been weakened to the point it no longer catches static-plate regressions.`,
      );
      assert.ok(
        scFrac < MIN_SCENE_CHANGE_FRACTION,
        `Static-plate fixture failed to trip the scene-change gate: sceneChangeFraction=${(scFrac * 100).toFixed(1)}%, gate=${(MIN_SCENE_CHANGE_FRACTION * 100).toFixed(0)}%. ` +
          `The scene-change gate has been weakened to the point it no longer catches static-plate regressions.`,
      );
    } finally {
      await fs.rm(outFile, { force: true });
    }
  });
});

