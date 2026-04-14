/**
 * Admin API — Contributor Profiles management.
 *
 * GET  /api/admin/contributors       → list all contributors
 * POST /api/admin/contributors       → create new contributor
 * PATCH /api/admin/contributors      → update contributor (body.id required)
 */

import { NextRequest, NextResponse } from "next/server";
import { contributorProfilesRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const contributors = await contributorProfilesRepo.listAll();
    const total = contributors.length;
    return NextResponse.json({ contributors, total });
  } catch (err) {
    console.error("[admin/contributors] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch contributors" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const contributor = await contributorProfilesRepo.create(body);
    return NextResponse.json({ contributor }, { status: 201 });
  } catch (err) {
    console.error("[admin/contributors] POST error:", err);
    const message = err instanceof Error ? err.message : "Failed to create contributor";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing contributor id" }, { status: 400 });
    }
    await contributorProfilesRepo.update(id, data);
    const updated = await contributorProfilesRepo.get(id);
    return NextResponse.json({ contributor: updated });
  } catch (err) {
    console.error("[admin/contributors] PATCH error:", err);
    const message = err instanceof Error ? err.message : "Failed to update contributor";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
