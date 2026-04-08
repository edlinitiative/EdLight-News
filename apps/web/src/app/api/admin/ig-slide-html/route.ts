import { NextResponse } from "next/server";
import { buildSlideHtml, adaptLegacyPayload } from "@edlight-news/renderer/ig-engine.js";
import type { IGSlide, IGPostType } from "@edlight-news/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ig-slide-html
 *
 * Accepts { igType, slides, totalSlides } and returns { htmls: string[] }
 * using the premium IG Engine renderer — the same one that produces the
 * final Instagram images. Used by the admin IG-queue modal for pixel-
 * perfect slide preview.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      igType: string;
      slides: IGSlide[];
      totalSlides?: number;
    };

    const { igType, slides } = body;
    const totalSlides = body.totalSlides ?? slides.length;

    // Convert old-format IGSlides to the new engine's SlideContent + resolve template
    const { intake, rawSlides, contentType } = adaptLegacyPayload(
      { id: "preview", sourceContentId: "", igType: igType as IGPostType, score: 0, status: "queued", reasons: [] } as any,
      { slides, caption: "" },
    );

    const templateId = intake.contentTypeHint!;

    const htmls: string[] = rawSlides.map((slide, i) =>
      buildSlideHtml(templateId, slide, contentType, i, totalSlides),
    );

    return NextResponse.json({ htmls });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to render slides" },
      { status: 500 },
    );
  }
}
