/**
 * Authentication helper for the internal read-only API
 * (consumed by EdLight Apply, etc.).
 *
 * Validates `Authorization: Bearer <key>` against the
 * `ED_LIGHT_INTERNAL_API_KEY` environment variable.
 *
 * The key MUST be server-side only — never exposed to the browser.
 */

import { NextResponse } from "next/server";

const HEADER = "authorization";
const PREFIX = "Bearer ";

/**
 * Returns null when the request is authorized; otherwise returns a
 * ready-to-return 401 NextResponse.
 *
 * Usage in a route handler:
 *
 *   const unauthorized = requireInternalApiKey(req);
 *   if (unauthorized) return unauthorized;
 */
export function requireInternalApiKey(req: Request): NextResponse | null {
  const expected = process.env.ED_LIGHT_INTERNAL_API_KEY;

  // Fail closed: if the server is misconfigured, deny all calls rather than
  // letting them through unauthenticated.
  if (!expected || expected.length < 16) {
    console.error(
      "[internalApiAuth] ED_LIGHT_INTERNAL_API_KEY is not set or too short; denying request",
    );
    return NextResponse.json(
      { error: "Internal API not configured" },
      { status: 401 },
    );
  }

  const header = req.headers.get(HEADER) ?? req.headers.get("Authorization");
  if (!header || !header.startsWith(PREFIX)) {
    return NextResponse.json(
      { error: "Missing or malformed Authorization header" },
      { status: 401 },
    );
  }

  const provided = header.slice(PREFIX.length).trim();
  if (provided.length === 0 || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  return null;
}

/** Constant-time string comparison to avoid timing oracles. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
