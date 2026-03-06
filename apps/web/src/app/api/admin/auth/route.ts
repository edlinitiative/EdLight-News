/**
 * POST /api/admin/auth — Admin login endpoint.
 *
 * Body: { password: string }
 * Sets an HttpOnly cookie on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { loginAdmin, logoutCookie } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password = body?.password;

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { ok: false, error: "Password is required" },
        { status: 400 },
      );
    }

    const result = await loginAdmin(password);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "Invalid password" },
        { status: 401 },
      );
    }

    const res = NextResponse.json({ ok: true });
    res.headers.set("Set-Cookie", result.cookie!);
    return res;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 },
    );
  }
}

/** DELETE /api/admin/auth — Logout (clear cookie). */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", logoutCookie());
  return res;
}
