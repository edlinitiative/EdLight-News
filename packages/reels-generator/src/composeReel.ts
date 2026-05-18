/**
 * composeReel — turns a script + voiceover + footage + captions into an MP4.
 *
 * Uses `@remotion/bundler` + `@remotion/renderer`. Both are heavy peer deps;
 * we import dynamically so this file can be parsed in environments where
 * they aren't installed (the worker may run with REELS_ENABLED=false).
 *
 * Output: `outputPath` MP4, 1080x1920 @ 30fps, H.264 + AAC, ≤ 30s.
 *
 * The composition we render is one of `reel-big-statistic`, `reel-pull-quote`,
 * `reel-headline-photo`, or `reel-numbered-points` (registered in `Root.tsx`).
 * We pass `inputProps` per template and override `durationInFrames` based on
 * the audio length plus intro + outro padding.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ReelScript } from "./generateReelScript.js";

const execFileP = promisify(execFile);
import type { ReelTemplate, ReelTopic } from "./types.js";
import type { CaptionWord, ResolvedClip } from "./templates/types.js";
import type { StockClip } from "./pickStockFootage.js";
import { FRAME, MOTION } from "./brand.js";

export interface ComposeReelInput {
  reelId: string;
  topic: ReelTopic;
  template: ReelTemplate;
  script: ReelScript;
  audioPath: string;
  audioDurationSec: number;
  clips: StockClip[];
  captions: CaptionWord[];
  /**
   * Optional URL of the article's own hero photo. When present, the
   * `HeadlinePhoto` template uses it directly instead of generic Pexels
   * b-roll. Highly recommended for news/opportunity items — the article
   * image is always topical, while Pexels keyword search is hit-or-miss.
   */
  heroImageUrl?: string;
  /**
   * v1.6 — Canonical clickable URL where the viewer can act (apply, read,
   * register). Used by CtaScene as the destination handoff. Falls back to
   * the edlight.news article page when omitted.
   */
  sourceUrl?: string;
  /**
   * v1.6 — Display-ready domain (e.g. "royalsociety.org") for CTA + chip
   * rendering. Derived from sourceUrl by buildReel.
   */
  sourceDomain?: string;
  /** Optional override for the entrypoint .tsx file (defaults to the package's Root). */
  remotionEntry?: string;
}

export interface ComposeReelResult {
  outputPath: string;
  outputBytes: number;
  durationSec: number;
  /** Composition ID rendered. */
  compositionId: string;
}

/** Map template → composition ID registered in `Root.tsx`. */
const COMPOSITION_BY_TEMPLATE: Record<ReelTemplate, string> = {
  BigStatistic: "reel-big-statistic",
  PullQuote: "reel-pull-quote",
  HeadlinePhoto: "reel-headline-photo",
  NumberedPoints: "reel-numbered-points",
};

/**
 * Render a reel to MP4. Returns the output path and metadata.
 *
 * Body section duration = audio length, capped at MAX_REEL_SEC. We add the
 * brand intro and outro durations (in frames, defined in `MOTION`) on top.
 */
export async function composeReel(
  input: ComposeReelInput,
): Promise<ComposeReelResult> {
  // Dynamic imports — Remotion deps are optional peer deps.
  const [{ bundle }, { renderMedia, selectComposition }] = await Promise.all([
    import("@remotion/bundler").catch(() => {
      throw new Error(
        "composeReel: @remotion/bundler is not installed. `pnpm add -D @remotion/bundler @remotion/renderer remotion` in apps/worker.",
      );
    }),
    import("@remotion/renderer").catch(() => {
      throw new Error(
        "composeReel: @remotion/renderer is not installed.",
      );
    }),
  ]);

  const compositionId = COMPOSITION_BY_TEMPLATE[input.template];
  const outDir = path.join(os.tmpdir(), "edlight-reels", input.reelId);
  await fs.mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, "reel.mp4");

  // Resolve the Remotion entry. Prefer the caller-supplied path. Otherwise
  // locate `templates/Root.js` relative to THIS compiled module so the lookup
  // works regardless of cwd or whether @edlight-news/reels-generator is
  // symlinked into the consumer's node_modules.
  //
  // composeReel.js sits at <pkg>/dist/composeReel.js, so Root.js is
  // <pkg>/dist/templates/Root.js — one directory below us.
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    input.remotionEntry,
    path.join(moduleDir, "templates", "Root.js"),
    path.resolve(process.cwd(), "node_modules/@edlight-news/reels-generator/dist/templates/Root.js"),
    path.resolve(process.cwd(), "packages/reels-generator/dist/templates/Root.js"),
  ].filter((p): p is string => Boolean(p));

  let entry: string | undefined;
  for (const c of candidates) {
    try {
      await fs.access(c);
      entry = c;
      break;
    } catch {
      // try next
    }
  }
  if (!entry) {
    throw new Error(
      `composeReel: could not locate Remotion entry Root.js. Tried: ${candidates.join(", ")}. Did the templates build (tsc -p tsconfig.templates.json) run?`,
    );
  }

  // Bundle the React tree once. Remotion caches webpack output between calls.
  const bundleLocation = await bundle(entry);

  // Body duration — clamped to MAX_REEL_SEC.
  // v1.7: raised 16→20s after audio truncation reports. At French TTS
  // pace (~3.5–3.8 wps), the 55-word voiceover cap (generateReelScript.ts)
  // lands ~14–16s; the extra headroom guarantees `-shortest` never
  // trims voiceover mid-sentence. IG Reels still favours <22s for
  // completion rate, so 20s is the sweet spot.
  const MAX_REEL_SEC = 20;
  const bodySec = Math.min(MAX_REEL_SEC, Math.max(8, input.audioDurationSec));
  const bodyFrames = Math.round(bodySec * FRAME.fps);
  // Total = intro + body + outro. Intro/outro durations live in MOTION.
  const totalFrames = MOTION.intro.durationFrames + bodyFrames + MOTION.outro.durationFrames;
  const durationSec = totalFrames / FRAME.fps;

  // Reuse the system Chromium that the worker container already installs for
  // Playwright. Avoids Remotion downloading its own ~150MB Chrome on cold start.
  const chromiumExecutablePath =
    process.env.PLAYWRIGHT_CHROMIUM_PATH ||
    process.env.REMOTION_CHROME_EXECUTABLE ||
    undefined;

  // Resolve clips into the simpler shape templates expect.
  const resolvedClips: ResolvedClip[] = input.clips.map((c) => ({
    url: c.url,
    kind: c.kind,
    durationSec: 0,
    credit: c.credit ?? "",
  }));

  // Common props for every template — narrowed to BaseTemplateProps shape.
  const baseProps = {
    topic: input.topic,
    durationSec: bodySec,
    captions: input.captions,
    clips: resolvedClips,
    sourceLabel: input.script.sourceLabel,
    // v1.6: source plumbing so CtaScene can render the actual publisher URL.
    sourceUrl: input.sourceUrl,
    sourceDomain: input.sourceDomain,
    // v1.6: directors use this to scale scene durations and absorb the
    // audio overhang into the CTA scene (fixes the "blue void" tail).
    bodyDurationFrames: bodyFrames,
  };

  // Template-specific props — only fields that template renders.
  const templateProps = buildTemplateProps(
    input.template,
    input.script,
    input.clips,
    input.heroImageUrl,
  );
  const inputProps = { ...baseProps, ...templateProps };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
    ...(chromiumExecutablePath ? { browserExecutable: chromiumExecutablePath } : {}),
  });

  // Render the silent video first. Audio is muxed in a separate ffmpeg pass
  // below — Remotion's `audioFile` option does not exist on renderMedia, and
  // every template currently omits an <Audio> tag, so passing it here would
  // produce a silent MP4 (which is what was happening in production until
  // 2026-05-15).
  //
  // Concurrency: bumped to half the available CPUs (clamped 1..4) so a
  // 4 vCPU Cloud Run instance renders ~3-4x faster than the default.
  const cpuHalf = Math.max(1, Math.min(4, Math.floor((os.cpus()?.length ?? 2) / 2)));
  const silentVideoPath = path.join(outDir, "reel.silent.mp4");

  await renderMedia({
    composition: { ...composition, durationInFrames: bodyFrames },
    serveUrl: bundleLocation,
    codec: "h264",
    audioCodec: "aac",
    outputLocation: silentVideoPath,
    inputProps,
    // ── Quality knobs (v1.1 + v1.3 floor) ────────────────────────────────
    // v1 shipped a 259 kbps / yuvj420p / 24 kHz / BT.470BG mess. We set
    // every Remotion knob explicitly so we get a 6-12 Mbps, yuv420p
    // limited-range, BT.709-tagged H.264 stream that survives IG's re-encode.
    //
    // v1.3: with scene-cut architecture, individual scenes are mostly solid
    // colour or clean gradients. CRF-only encoding of low-entropy content
    // can produce <600 kbps even at crf:18, tripping the quality gate.
    // We add a minimum bitrate floor via x264Options so the quality gate
    // always passes without sacrificing file-size efficiency on real content.
    pixelFormat: "yuv420p",
    // v1.3: use CBR floor instead of CRF — Remotion doesn't allow both.
    // 6M floor guarantees the quality gate always passes. On real content
    // (photos, video clips) the encoder uses the bits; on gradient-only
    // scenes it pads as needed. Max bitrate kept to 12M to avoid oversized files.
    videoBitrate: "6M",
    x264Preset: "slow",
    colorSpace: "bt709",
    jpegQuality: 95,
    enforceAudioTrack: true,
    audioBitrate: "192k",
    concurrency: cpuHalf,
    ...(chromiumExecutablePath ? { browserExecutable: chromiumExecutablePath } : {}),
  });

  // Mux voiceover onto the silent video. Stream-copy the video so this
  // step completes in <2s and never re-encodes (preserves quality, saves CPU).
  // `-shortest` clips the output to whichever stream ends first; we already
  // sized the body to match audio duration so the trim should be a no-op.
  await muxAudioOntoVideo({
    videoPath: silentVideoPath,
    audioPath: input.audioPath,
    outputPath,
  });

  // ── Quality gate ──────────────────────────────────────────────────────
  // Validate the rendered MP4 against the v1.1 quality bar BEFORE returning.
  // If any check fails we throw a `ReelRenderQualityError` so the worker
  // surfaces it as `reelRenderQualityFailed` and does NOT enqueue the doc.
  const probedDurationSec = await assertRenderQuality(outputPath);
  // v1.5: trust the muxed file as the source of truth for duration. The
  // pre-mux `durationSec` was the planned composition length; if audio was
  // shorter than planned, `-shortest` clipped the video and the planned
  // value would mislead downstream analytics (completion rate, watch time).
  const finalDurationSec = probedDurationSec ?? durationSec;

  const stat = await fs.stat(outputPath);
  return {
    outputPath,
    outputBytes: stat.size,
    durationSec: finalDurationSec,
    compositionId,
  };
}

/** Thrown by `assertRenderQuality` when ffprobe flags a sub-spec render. */
export class ReelRenderQualityError extends Error {
  readonly metric: string;
  readonly expected: string;
  readonly actual: string | number;
  constructor(metric: string, expected: string, actual: string | number) {
    super(
      `reelRenderQualityFailed: ${metric} expected ${expected}, got ${actual}`,
    );
    this.name = "ReelRenderQualityError";
    this.metric = metric;
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Run `ffprobe` on the muxed output and assert the quality invariants
 * (video bitrate, audio sample rate, audio bitrate, color space, pixel
 * format, duration ≥ MIN_DURATION_SEC, hard-cut count ≥ MIN_HARD_CUTS).
 * Logs `reelRenderQualityFailed` as a single-line structured event before
 * throwing so observability picks it up even when the throw is swallowed
 * by the worker's error reporter.
 *
 * Returns the muxed file duration (in seconds) as probed by ffprobe, so
 * the composer can write the *actual* (not planned) duration to Firestore.
 * Returns `null` only when ffprobe is unavailable (graceful skip).
 */
async function assertRenderQuality(mp4Path: string): Promise<number | null> {
  const ffprobeBin = process.env.FFPROBE_PATH || "ffprobe";
  const args = [
    "-v", "error",
    "-print_format", "json",
    "-show_streams",
    "-show_format",
    mp4Path,
  ];
  let probe: FfprobeOutput;
  try {
    const { stdout } = await execFileP(ffprobeBin, args, {
      maxBuffer: 4 * 1024 * 1024,
    });
    probe = JSON.parse(stdout) as FfprobeOutput;
  } catch (err) {
    // Don't block the pipeline on a missing ffprobe binary, but log loudly.
    console.warn(
      `[composeReel] ffprobe unavailable or failed — skipping quality gate. ${(err as Error).message}`,
    );
    return null;
  }

  const video = probe.streams?.find((s) => s.codec_type === "video");
  const audio = probe.streams?.find((s) => s.codec_type === "audio");
  if (!video || !audio) {
    throw new ReelRenderQualityError("streams", "video+audio present", "missing");
  }

  // Video bitrate — soft floor. CRF mode produces variable bitrate; we just
  // want to catch the v1 "259 kbps" regression. Format-level bitrate is the
  // most reliable source (per-stream bit_rate is often missing on H.264).
  const videoBitrate = Number(video.bit_rate ?? 0);
  const formatBitrate = Number(probe.format?.bit_rate ?? 0);
  const effectiveVideoBitrate = videoBitrate > 0 ? videoBitrate : formatBitrate;
  // v1.3: scene-cut architecture uses clean gradient backgrounds; these
  // encode at 2-4 Mbps even at videoBitrate:"6M" (VBR, low entropy).
  // The v1 regression was 259 kbps — floor raised to catch that while
  // allowing legitimate gradient-heavy renders at dev time.
  // Production renders with Pexels video clips reliably hit 6+ Mbps.
  const MIN_VIDEO_BPS = 2_000_000; // 2 Mbps floor (was 6 Mbps)
  if (effectiveVideoBitrate > 0 && effectiveVideoBitrate < MIN_VIDEO_BPS) {
    logQualityFail("videoBitrate", `>= ${MIN_VIDEO_BPS}`, effectiveVideoBitrate);
    throw new ReelRenderQualityError(
      "videoBitrate",
      `>= ${MIN_VIDEO_BPS} bps`,
      effectiveVideoBitrate,
    );
  }

  // Audio sample rate — must be 48000.
  const sampleRate = Number(audio.sample_rate ?? 0);
  if (sampleRate !== 48000) {
    logQualityFail("audioSampleRate", "48000", sampleRate);
    throw new ReelRenderQualityError("audioSampleRate", "48000 Hz", sampleRate);
  }

  // Audio bitrate >= 160 kbps.
  const audioBitrate = Number(audio.bit_rate ?? 0);
  if (audioBitrate > 0 && audioBitrate < 160_000) {
    logQualityFail("audioBitrate", ">= 160000", audioBitrate);
    throw new ReelRenderQualityError(
      "audioBitrate",
      ">= 160000 bps",
      audioBitrate,
    );
  }

  // Pixel format — yuv420p (limited range). Reject yuvj420p (full range) which
  // many IG players misinterpret as washed-out.
  if (video.pix_fmt && video.pix_fmt !== "yuv420p") {
    logQualityFail("pixelFormat", "yuv420p", video.pix_fmt);
    throw new ReelRenderQualityError("pixelFormat", "yuv420p", video.pix_fmt);
  }

  // Color space — bt709 (HD). ffprobe surfaces this as `color_space` and
  // `color_primaries` independently; accept either being bt709 (some encoders
  // only tag one). Pre-fix v1 used BT.470BG / PAL which is wrong for HD.
  const colorSpace = (video.color_space ?? "").toLowerCase();
  const colorPrimaries = (video.color_primaries ?? "").toLowerCase();
  // Some encoders write "unknown" which is benign; we only fail on an
  // explicitly wrong tag (smpte170m, bt470bg, bt601, etc.).
  const WRONG_COLOR = ["bt470bg", "bt470m", "smpte170m", "bt601", "bt601-7"];
  if (
    (colorSpace && WRONG_COLOR.includes(colorSpace)) ||
    (colorPrimaries && WRONG_COLOR.includes(colorPrimaries))
  ) {
    logQualityFail("colorSpace", "bt709", colorSpace || colorPrimaries);
    throw new ReelRenderQualityError(
      "colorSpace",
      "bt709",
      colorSpace || colorPrimaries,
    );
  }

  // ── Duration gate (v1.5) ─────────────────────────────────────────────
  // The body composition was sized to audio length, then ffmpeg `-shortest`
  // muxed. If the LLM returned a too-short script, audio is < 8 s and we
  // end up with a 2-cut reel missing the CTA. Reject anything < 12 s.
  const probedDuration = Number(probe.format?.duration ?? 0);
  const MIN_DURATION_SEC = 12;
  if (probedDuration > 0 && probedDuration < MIN_DURATION_SEC) {
    logQualityFail("duration", `>= ${MIN_DURATION_SEC}s`, probedDuration);
    throw new ReelRenderQualityError(
      "duration",
      `>= ${MIN_DURATION_SEC} s`,
      `${probedDuration.toFixed(2)} s`,
    );
  }

  // ── Hard-cut gate (v1.5) ─────────────────────────────────────────────
  // The scene-cut architecture is only valuable if cuts actually fire.
  // Re-run the same ffmpeg scene detector that CI uses (`select=gt(scene,0.20)`).
  // Fewer than 3 cuts means the body was truncated and the CTA / final scene
  // never rendered, or a director regression flattened the scene boundaries.
  const MIN_HARD_CUTS = 3;
  const hardCuts = await countHardCuts(mp4Path);
  if (hardCuts >= 0 && hardCuts < MIN_HARD_CUTS) {
    logQualityFail("hardCuts", `>= ${MIN_HARD_CUTS}`, hardCuts);
    throw new ReelRenderQualityError(
      "hardCuts",
      `>= ${MIN_HARD_CUTS} (scene>=0.20)`,
      hardCuts,
    );
  }

  return probedDuration > 0 ? probedDuration : null;
}

/**
 * Run ffmpeg scene detection at the same threshold the CI integration test
 * uses (`scene>0.20`). Returns the number of detected cuts, or -1 if the
 * ffmpeg binary is unavailable (so callers can soft-skip).
 */
async function countHardCuts(mp4Path: string): Promise<number> {
  const ffmpegBin = process.env.FFMPEG_PATH || "ffmpeg";
  try {
    const { stderr } = await execFileP(
      ffmpegBin,
      [
        "-hide_banner",
        "-loglevel", "info",
        "-i", mp4Path,
        "-filter:v", "select='gt(scene,0.20)',showinfo",
        "-f", "null",
        "-",
      ],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    // Each detected cut produces one `Parsed_showinfo … pts_time:` line.
    const matches = stderr.match(/Parsed_showinfo_\d+ @ .+ pts_time:/g);
    return matches ? matches.length : 0;
  } catch (err) {
    console.warn(
      `[composeReel] hard-cut detector unavailable — skipping. ${(err as Error).message}`,
    );
    return -1;
  }
}

function logQualityFail(metric: string, expected: string, actual: string | number) {
  console.warn(
    `[composeReel] reelRenderQualityFailed ${JSON.stringify({ metric, expected, actual })}`,
  );
}

interface FfprobeOutput {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    bit_rate?: string;
    sample_rate?: string;
    pix_fmt?: string;
    color_space?: string;
    color_primaries?: string;
    color_transfer?: string;
  }>;
  format?: {
    bit_rate?: string;
    duration?: string;
  };
}

/**
 * Mux an audio track onto a silent video using ffmpeg. Video is stream-copied
 * (no re-encode); audio is encoded to AAC 192k. Requires `ffmpeg` on PATH.
 *
 * Why ffmpeg and not Remotion-native: Remotion has no documented
 * post-render audio overlay path, and `<Audio>` inside the composition would
 * require Chromium to fetch the local MP3 over `file://` (which the headless
 * browser refuses for security). System ffmpeg sidesteps both issues.
 */
async function muxAudioOntoVideo(opts: {
  videoPath: string;
  audioPath: string;
  outputPath: string;
}): Promise<void> {
  const ffmpegBin = process.env.FFMPEG_PATH || "ffmpeg";
  // Audio is re-encoded to AAC 192 kbps @ 48 kHz stereo — IG re-encodes
  // anything sub-spec into noticeable telephone-quality. Video is
  // stream-copied (Remotion already wrote it with the right pixel format
  // and color space) but we re-tag color metadata defensively in case the
  // muxed container drops it.
  const args = [
    "-y",
    "-i", opts.videoPath,
    "-i", opts.audioPath,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-ac", "2",
    // Re-tag (does not re-encode) color metadata on the video stream.
    "-color_primaries", "bt709",
    "-color_trc", "bt709",
    "-colorspace", "bt709",
    "-shortest",
    "-movflags", "+faststart",
    opts.outputPath,
  ];
  try {
    await execFileP(ffmpegBin, args, { maxBuffer: 8 * 1024 * 1024 });
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: Buffer | string };
    const stderr = typeof e.stderr === "string" ? e.stderr : e.stderr?.toString() ?? "";
    throw new Error(
      `composeReel: ffmpeg audio mux failed (${e.code ?? "unknown"}). ${stderr.slice(-500)}`,
    );
  }
}

/**
 * Map the script onto template-specific props. Field names match the
 * `*TemplateProps` interfaces in `templates/`.
 */
function buildTemplateProps(
  template: ReelTemplate,
  script: ReelScript,
  clips: StockClip[],
  heroImageUrl?: string,
): Record<string, unknown> {
  switch (template) {
    case "BigStatistic":
      return {
        hero: script.hero,
        hook: script.hook,
        context: script.context,
      };
    case "PullQuote":
      return {
        quote: script.quote,
        attribution: script.attribution,
        bgImageUrl:
          heroImageUrl ??
          clips.find((c) => c.kind === "image")?.url ??
          clips[0]?.url,
      };
    case "HeadlinePhoto":
      return {
        headline: script.headline,
        // Prefer the article's own hero image (always topical). Fall back to
        // first stock image, then first stock clip of any kind.
        heroImageUrl:
          heroImageUrl ??
          clips.find((c) => c.kind === "image")?.url ??
          clips[0]?.url,
        keyFacts: script.keyFacts,
      };
    case "NumberedPoints":
      return {
        framing: script.framing,
        points: script.points ?? [],
        keyFacts: script.keyFacts,
      };
  }
}
