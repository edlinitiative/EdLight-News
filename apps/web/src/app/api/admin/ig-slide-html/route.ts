import { NextResponse } from "next/server";
import { buildPost, buildSlideHtml, adaptLegacyPayload } from "@edlight-news/renderer/ig-engine.js";
import type { IGSlide, IGPostType } from "@edlight-news/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ig-slide-html
 *
 * Accepts { igType, slides, caption, totalSlides } and returns the validated
 * premium IG Engine HTML — the same post model that production sends to
 * Playwright before publishing. Used by the admin IG-queue modal/cards for
 * pixel-perfect quality review.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      igType: string;
      slides: IGSlide[];
      caption?: string | null;
      totalSlides?: number;
    };

    const { igType, slides } = body;
    const totalSlides = body.totalSlides ?? slides.length;

    // Convert old-format IGSlides to the new engine inputs, then run the same
    // build/validation/rewrite pipeline used by the production renderer.
    const { intake, rawSlides, caption, contentType } = adaptLegacyPayload(
      { id: "preview", sourceContentId: "", igType: igType as IGPostType, score: 0, status: "queued", reasons: [] } as any,
      { slides, caption: body.caption ?? "" },
    );

    const { post, overflowWarnings } = buildPost({
      intake,
      rawSlides,
      caption,
    });

    const htmls: string[] = post.slides.map((slide, i) =>
      buildSlideHtml(post.templateId, slide, contentType, i, totalSlides),
    );

    return NextResponse.json({
      htmls,
      status: post.status,
      overflowWarnings,
      fit: post.slides.map((slide, i) => ({
        slideNumber: i + 1,
        fitPassed: slide.validation.fitPassed,
        overflowRisk: slide.validation.overflowRisk,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to render slides" },
      { status: 500 },
    );
  }
}
