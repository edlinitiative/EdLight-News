import { NextResponse } from "next/server";
import { buildSlideHTML } from "@edlight-news/renderer/ig-carousel.js";
import type { IGSlide } from "@edlight-news/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/ig-slide-html
 *
 * Accepts { igType, slides, totalSlides } and returns { htmls: string[] }
 * using the exact same renderer that produces the final Instagram images.
 * Used by the admin IG-queue modal for pixel-perfect slide preview.
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

    const htmls: string[] = slides.map((slide, i) =>
      buildSlideHTML(slide, igType, i, totalSlides),
    );

    return NextResponse.json({ htmls });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to render slides" },
      { status: 500 },
    );
  }
}
