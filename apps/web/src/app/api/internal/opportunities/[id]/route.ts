/**
 * GET /api/internal/opportunities/[id] — Read-only single-record fetch.
 *
 * Auth: `Authorization: Bearer <ED_LIGHT_INTERNAL_API_KEY>`.
 *
 * The Scholarship model does not currently have a `slug` field, so [id] is
 * the Firestore document id. If/when slugs are added upstream, the lookup
 * below should be extended to fall back to a slug query.
 *
 * Response: { data: ApplyOpportunityDTO } | 404
 */

import { NextResponse } from "next/server";
import { scholarshipsRepo } from "@edlight-news/firebase";
import { requireInternalApiKey } from "@/lib/internalApiAuth";
import { serializeOpportunityForApply } from "@/lib/serializeOpportunityForApply";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> } | { params: { id: string } },
) {
  const unauthorized = requireInternalApiKey(req);
  if (unauthorized) return unauthorized;

  // Next.js 15 makes `params` a Promise; older versions pass it sync.
  const resolved =
    "then" in (ctx.params as object)
      ? await (ctx.params as Promise<{ id: string }>)
      : (ctx.params as { id: string });

  const id = resolved?.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Firestore rejects doc IDs that are empty, contain "/", or match the
  // reserved __.*__ pattern. Treat any such input as "not found" rather
  // than letting the SDK throw a 500.
  if (id.length === 0 || id.length > 1500 || id.includes("/") || /^__.*__$/.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const doc = await scholarshipsRepo.get(id);
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const dto = serializeOpportunityForApply(doc);

    // Treat unverified records (no verifiedAt) as not-yet-public.
    if (dto.verificationStatus !== "verified") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: dto });
  } catch (err) {
    console.error("[api/internal/opportunities/[id]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
