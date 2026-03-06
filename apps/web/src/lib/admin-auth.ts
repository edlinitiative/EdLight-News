/**
 * Lightweight admin authentication.
 *
 * Strategy: Compare a password against `ADMIN_PASSWORD` env var,
 * then set a signed cookie. All admin pages/API routes check the cookie.
 *
 * This is NOT a full auth system — it's a simple password gate to keep
 * the admin section private. The Firebase Admin SDK credentials are the
 * real security boundary (server-side only, never exposed to the client).
 */

import { cookies } from "next/headers";
import { createHmac } from "crypto";

const COOKIE_NAME = "edlight-admin-token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Derive a signing key from ADMIN_PASSWORD so the cookie can't be forged
 * without knowing the password.
 */
function getSigningKey(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return "dev-fallback-key";
  return password;
}

/** Create a signed token from the password. */
export function createAdminToken(): string {
  const key = getSigningKey();
  return createHmac("sha256", key).update("edlight-admin-session").digest("hex");
}

/** Verify that a token matches the expected signature. */
function verifyToken(token: string): boolean {
  const expected = createAdminToken();
  // Constant-time comparison
  if (token.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Check if the current request is authenticated as admin.
 * Call from Server Components or Route Handlers.
 */
export async function isAdminAuthenticated(): Promise<boolean> {
  // Skip auth in development if no ADMIN_PASSWORD is set
  if (!process.env.ADMIN_PASSWORD && process.env.NODE_ENV === "development") {
    return true;
  }
  // If no ADMIN_PASSWORD is configured in production, deny access
  if (!process.env.ADMIN_PASSWORD) {
    return false;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyToken(token);
}

/** Verify the password and return a Set-Cookie header value on success. */
export function loginAdmin(password: string): { ok: boolean; cookie?: string } {
  const expected = process.env.ADMIN_PASSWORD;

  // No password configured
  if (!expected) {
    return { ok: false };
  }

  if (password !== expected) {
    return { ok: false };
  }

  const token = createAdminToken();
  const cookie = [
    `${COOKIE_NAME}=${token}`,
    `Path=/admin`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  return { ok: true, cookie };
}

/** Return a Set-Cookie header value that clears the admin cookie. */
export function logoutCookie(): string {
  return `${COOKIE_NAME}=; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=0`;
}
