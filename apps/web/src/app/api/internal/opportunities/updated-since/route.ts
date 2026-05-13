/**
 * GET /api/internal/opportunities/updated-since?since=ISO_DATE
 *
 * Returns verified opportunities whose `updatedAt` is strictly greater than
 * the supplied timestamp. Intended as a cheap incremental sync endpoint for
 * EdLight Apply.
 *
 * Auth: `Authorization: Bearer <ED_LIGHT_INTERNAL_API_KEY>`.
 *
 * Errors:
 *   - 400 if `since` is missing or not a valid ISO timestamp
 *   - 401 if API key is missing/invalid
 *   - 500 on unexpected errors
 *
 * Response: { data: ApplyOpportunityDTO[], count: number }
 */

import { NextResponse } from "next/server";
import { scholarshipsRepo } from "@edlight-news/firebase";
import { requireInternalApiKey } from "@/lib/internalApiAuth";
import { serializeOpportunityForApply } from "@/lib/serializeOpportunityForApply";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_RESULTS = 500;

export async function GET(req: Request) {
  const unauthorized = requireInternalApiKey(req);
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const since = url.searchParams.get("since");

  if (!since) {
    return NextResponse.json(
      { error: "Missing required query param: since (ISO date)" },
      { status: 400 },
    );
  }

  const sinceMs = Date.parse(since);
  if (!Number.isFinite(sinceMs)) {
    return NextResponse.json(
      { error: "Invalid `since`: expected an ISO date string" },
      { status: 400 },
    );
  }

  try {
    // The collection is small (low thousands at most) so a full scan +
    // in-memory filter avoids the need for a new (verifiedAt, updatedAt)
    // composite index. Switch to a Firestore range query if it grows.
    const all = await scholarshipsRepo.listAll();

    const data = all
      .map(serializeOpportunityForApply)
      .filter((o) => {
        if (o.verificationStatus !== "verified") return false;
        if (!o.updatedAt) return false;
        const u = Date.parse(o.updatedAt);
        return Number.isFinite(u) && u > sinceMs;
      })
      .sort((a, b) => {
        // Oldest-updated first so consumers can checkpoint linearly.
        const ad = a.updatedAt ? Date.parse(a.updatedAt) : 0;
        const bd = b.updatedAt ? Date.parse(b.updatedAt) : 0;
        return ad - bd;
      })
      .slice(0, MAX_RESULTS);

    return NextResponse.json({ data, count: data.length });
  } catch (err) {
    console.error("[api/internal/opportunities/updated-since] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
