/**
 * GET /api/internal/opportunities — Read-only list of verified opportunities
 * for EdLight Apply.
 *
 * Auth: `Authorization: Bearer <ED_LIGHT_INTERNAL_API_KEY>`.
 *
 * Query params (all optional):
 *   - type: "program" | "directory"
 *   - country: ISO code or "Global" — matches host country OR eligibleCountries
 *   - level: "bachelor" | "master" | "phd" | "short_programs"
 *   - deadlineBefore: ISO date (YYYY-MM-DD) — keep deadlines on/before
 *   - deadlineAfter:  ISO date (YYYY-MM-DD) — keep deadlines on/after
 *   - haitiEligibilityStatus: "yes" | "no" | "unknown"
 *   - verificationStatus: "verified" | "unverified"
 *   - limit: integer (1-500, default 100)
 *
 * Response: { data: ApplyOpportunityDTO[], count: number }
 *
 * The `scholarships` collection is small enough (low thousands at most) that
 * server-side in-memory filtering is acceptable and avoids needing new
 * Firestore composite indexes for every filter combination.
 */

import { NextResponse } from "next/server";
import { scholarshipsRepo } from "@edlight-news/firebase";
import { requireInternalApiKey } from "@/lib/internalApiAuth";
import { serializeOpportunityForApply } from "@/lib/serializeOpportunityForApply";
import type { ApplyOpportunityDTO } from "@/types/applyOpportunity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const VALID_TYPES = new Set(["program", "directory"]);
const VALID_LEVELS = new Set(["bachelor", "master", "phd", "short_programs"]);
const VALID_HAITI = new Set(["yes", "no", "unknown"]);
const VALID_VERIF = new Set(["verified", "unverified"]);

function isIsoDate(s: string): boolean {
  // YYYY-MM-DD or full ISO; Date.parse handles both.
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return false;
  const t = Date.parse(s);
  return Number.isFinite(t);
}

export async function GET(req: Request) {
  const unauthorized = requireInternalApiKey(req);
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const params = url.searchParams;

  // ── Validate params ─────────────────────────────────────────────────────
  const type = params.get("type");
  if (type && !VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: `Invalid type: ${type}` },
      { status: 400 },
    );
  }

  const country = params.get("country");

  const level = params.get("level");
  if (level && !VALID_LEVELS.has(level)) {
    return NextResponse.json(
      { error: `Invalid level: ${level}` },
      { status: 400 },
    );
  }

  const deadlineBefore = params.get("deadlineBefore");
  if (deadlineBefore && !isIsoDate(deadlineBefore)) {
    return NextResponse.json(
      { error: "deadlineBefore must be an ISO date (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const deadlineAfter = params.get("deadlineAfter");
  if (deadlineAfter && !isIsoDate(deadlineAfter)) {
    return NextResponse.json(
      { error: "deadlineAfter must be an ISO date (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const haitiEligibilityStatus = params.get("haitiEligibilityStatus");
  if (haitiEligibilityStatus && !VALID_HAITI.has(haitiEligibilityStatus)) {
    return NextResponse.json(
      { error: `Invalid haitiEligibilityStatus: ${haitiEligibilityStatus}` },
      { status: 400 },
    );
  }

  const verificationStatus = params.get("verificationStatus");
  if (verificationStatus && !VALID_VERIF.has(verificationStatus)) {
    return NextResponse.json(
      { error: `Invalid verificationStatus: ${verificationStatus}` },
      { status: 400 },
    );
  }

  const limitRaw = params.get("limit");
  let limit = DEFAULT_LIMIT;
  if (limitRaw !== null) {
    const parsed = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json(
        { error: "limit must be a positive integer" },
        { status: 400 },
      );
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  // ── Fetch + filter ──────────────────────────────────────────────────────
  try {
    const all = await scholarshipsRepo.listAll();
    const dtos: ApplyOpportunityDTO[] = all.map(serializeOpportunityForApply);

    const beforeMs = deadlineBefore ? Date.parse(deadlineBefore) : null;
    const afterMs = deadlineAfter ? Date.parse(deadlineAfter) : null;

    const filtered = dtos.filter((o) => {
      if (type && o.type !== type) return false;

      if (country) {
        const c = country;
        const inHost = o.countries.includes(c);
        const inElig = o.eligibleNationalities.includes(c);
        if (!inHost && !inElig) return false;
      }

      if (level && !o.degreeLevels.includes(level)) return false;

      if (haitiEligibilityStatus && o.haitiEligibilityStatus !== haitiEligibilityStatus) {
        return false;
      }

      if (verificationStatus && o.verificationStatus !== verificationStatus) {
        return false;
      }

      if (beforeMs !== null) {
        if (!o.deadline) return false;
        const d = Date.parse(o.deadline);
        if (!Number.isFinite(d) || d > beforeMs) return false;
      }

      if (afterMs !== null) {
        if (!o.deadline) return false;
        const d = Date.parse(o.deadline);
        if (!Number.isFinite(d) || d < afterMs) return false;
      }

      return true;
    });

    const data = filtered.slice(0, limit);
    return NextResponse.json({ data, count: data.length });
  } catch (err) {
    console.error("[api/internal/opportunities] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
