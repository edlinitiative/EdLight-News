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
import type { ReelScript } from "./generateReelScript.js";
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

  // Body duration — clamped to MAX_REEL_SEC = 30 (per spec).
  const MAX_REEL_SEC = 30;
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
  };

  // Template-specific props — only fields that template renders.
  const templateProps = buildTemplateProps(input.template, input.script, input.clips);
  const inputProps = { ...baseProps, ...templateProps };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
    ...(chromiumExecutablePath ? { browserExecutable: chromiumExecutablePath } : {}),
  });

  // Override durationInFrames so each render matches the actual voiceover length.
  await renderMedia({
    composition: { ...composition, durationInFrames: bodyFrames },
    serveUrl: bundleLocation,
    codec: "h264",
    audioCodec: "aac",
    outputLocation: outputPath,
    inputProps,
    audioBitrate: "192k",
    ...(chromiumExecutablePath ? { browserExecutable: chromiumExecutablePath } : {}),
    // Mux the voiceover via Remotion's audioFile if supported, otherwise the
    // template <Audio> tag handles it. We pass it via inputProps too as a
    // safety net.
    // @ts-expect-error — `audioFile` is supported but not in older type defs.
    audioFile: input.audioPath,
  });

  const stat = await fs.stat(outputPath);
  return {
    outputPath,
    outputBytes: stat.size,
    durationSec,
    compositionId,
  };
}

/**
 * Map the script onto template-specific props. Field names match the
 * `*TemplateProps` interfaces in `templates/`.
 */
function buildTemplateProps(
  template: ReelTemplate,
  script: ReelScript,
  clips: StockClip[],
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
        bgImageUrl: clips.find((c) => c.kind === "image")?.url ?? clips[0]?.url,
      };
    case "HeadlinePhoto":
      return {
        headline: script.headline,
        heroImageUrl: clips[0]?.url,
      };
    case "NumberedPoints":
      return {
        framing: script.framing,
        points: script.points ?? [],
      };
  }
}
