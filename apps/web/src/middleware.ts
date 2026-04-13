/**
 * Next.js Middleware — Admin authentication gate.
 *
 * Checks for the admin session cookie on all /admin/* routes
 * (except /admin/login). Redirects unauthenticated users to the login page.
 *
 * Also protects /api/admin/* routes (except /api/admin/auth) by returning 401.
 *
 * Uses the Web Crypto API (not Node.js crypto) for Edge Runtime compatibility.
 */

import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "edlight-admin-token";
const ENCODER = new TextEncoder();

/** HMAC-SHA256 using Web Crypto API (Edge-compatible). */
async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, ENCODER.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Recreate the expected token (must match admin-auth.ts logic). */
async function expectedToken(password: string): Promise<string> {
  return hmacSha256Hex(password, "edlight-admin-session");
}

async function isValidToken(token: string, password: string): Promise<boolean> {
  const expected = await expectedToken(password);
  if (token.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip auth for the login page and the auth API endpoint
  if (pathname === "/admin/login" || pathname === "/api/admin/auth") {
    // Forward the pathname as a **request** header so the shared admin
    // layout can read it via `headers()` and skip its own auth check
    // for the login page (avoiding a redirect loop).
    // NOTE: `res.headers.set(...)` sets a *response* header — invisible
    // to Server Components. We must use `request.headers` instead.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-admin-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
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
  const authenticated = !!token && await isValidToken(token, password);

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
