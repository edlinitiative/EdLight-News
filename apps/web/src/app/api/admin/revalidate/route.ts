/**
 * POST /api/admin/revalidate — On-demand ISR cache purge.
 *
 * Usage:  POST /api/admin/revalidate?tag=almanac
 *         POST /api/admin/revalidate?path=/histoire
 *
 * Requires the REVALIDATE_SECRET env var as a Bearer token.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const tag = req.nextUrl.searchParams.get("tag");
  const path = req.nextUrl.searchParams.get("path");

  if (!tag && !path) {
    return NextResponse.json(
      { error: "Provide ?tag=<cache-tag> or ?path=<route-path>" },
      { status: 400 },
    );
  }

  const purged: string[] = [];

  if (tag) {
    revalidateTag(tag);
    purged.push(`tag:${tag}`);
  }
  if (path) {
    revalidatePath(path);
    purged.push(`path:${path}`);
  }

  return NextResponse.json({ revalidated: true, purged, now: Date.now() });
}
