/**
 * Next.js Middleware — Admin authentication gate.
 *
 * Checks for the admin session cookie on all /admin/* routes
 * (except /admin/login). Redirects unauthenticated users to the login page.
 *
 * Also protects /api/admin/* routes (except /api/admin/auth) by returning 401.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const COOKIE_NAME = "edlight-admin-token";

/** Recreate the expected token (must match admin-auth.ts logic). */
function expectedToken(password: string): string {
  return createHmac("sha256", password)
    .update("edlight-admin-session")
    .digest("hex");
}

function isValidToken(token: string, password: string): boolean {
  const expected = expectedToken(password);
  if (token.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip auth for the login page and the auth API endpoint
  if (pathname === "/admin/login" || pathname === "/api/admin/auth") {
    return NextResponse.next();
  }

  const password = process.env.ADMIN_PASSWORD;

  // In development with no ADMIN_PASSWORD set, allow all access
  if (!password && process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  // No ADMIN_PASSWORD configured in production — block everything
  if (!password) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Admin not configured" }, { status: 503 });
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Check the cookie
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const authenticated = !!token && isValidToken(token, password);

  if (authenticated) {
    return NextResponse.next();
  }

  // Not authenticated — handle differently for API vs pages
  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Redirect to login for admin pages
  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
