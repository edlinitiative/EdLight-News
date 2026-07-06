/**
 * POST /api/events — In-house analytics ingest.
 *
 * Stores a thin event document in Firestore (`analytics_events` collection).
 * No PII: we keep event name, sparse props, session id (per-tab, not per-user),
 * timestamp, page path, and the truncated user-agent. IPs are NOT stored.
 *
 * Designed to be called via `navigator.sendBeacon` from the client tracker
 * in `apps/web/src/lib/analytics.ts`.
 */

import { NextResponse } from "next/server";

const MAX_PROPS_BYTES = 2_000;
const MAX_UA = 200;

interface IncomingEvent {
  event?: unknown;
  props?: unknown;
  ts?: unknown;
  sid?: unknown;
  path?: unknown;
  ref?: unknown;
}

function clampString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  return v.slice(0, max);
}

/**
 * Event names we ALWAYS persist, ignoring sampling. These are low-volume,
 * high-value signals (conversions / signups) we can't afford to lose.
 */
const ALWAYS_KEEP = new Set(["newsletter_signup"]);

function isHighValue(eventName: string): boolean {
  if (ALWAYS_KEEP.has(eventName)) return true;
  // Defensive: also keep anything that looks like a conversion/signup, so new
  // high-value event names aren't silently sampled away before this list is
  // updated. High-volume events (clicks, nav, pageview/scroll/impression) fall
  // through to sampling below.
  return /signup|subscribe|conversion|purchase|checkout/i.test(eventName);
}

/**
 * Server-side sampling to protect the Firestore free-tier write budget.
 *
 * Firestore's free tier allows ~20K writes/day. Each analytics event is one
 * `.add()` write, and the client fires several per pageview via sendBeacon, so
 * at ~10K pageviews/day we would blow the cap and writes scale with traffic.
 * To stay under it we persist only a random fraction of high-volume events
 * while always keeping conversions/signups (see isHighValue). Sampled-out
 * events are acknowledged with 200 so the client never sees an error.
 *
 * Tunable via EVENTS_SAMPLE_RATE (0..1); default 0.2 keeps ~20% of sampled
 * events. Note: Math.random() is fine here — this is a Vercel serverless
 * route, not a worker context where it's disallowed.
 */
function getSampleRate(): number {
  const raw = process.env.EVENTS_SAMPLE_RATE;
  const n = raw == null || raw === "" ? NaN : Number(raw);
  if (!Number.isFinite(n)) return 0.2;
  return Math.min(1, Math.max(0, n));
}

export async function POST(req: Request) {
  let body: IncomingEvent;
  try {
    body = (await req.json()) as IncomingEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = clampString(body.event, 64);
  if (!eventName) {
    return NextResponse.json({ error: "Missing event" }, { status: 400 });
  }

  // Apply write-budget sampling BEFORE touching Firestore (see getSampleRate).
  // High-value events always persist; everything else is kept only a random
  // fraction of the time. Dropped events still return 200 (no client error).
  if (!isHighValue(eventName) && Math.random() >= getSampleRate()) {
    return NextResponse.json({ ok: true, sampled: true });
  }

  // Cap props payload size — never trust the client.
  let props: Record<string, unknown> = {};
  if (body.props && typeof body.props === "object") {
    const json = JSON.stringify(body.props);
    if (json.length <= MAX_PROPS_BYTES) {
      props = body.props as Record<string, unknown>;
    }
  }

  const doc = {
    event: eventName,
    props,
    sid: clampString(body.sid, 64),
    path: clampString(body.path, 512),
    ref: clampString(body.ref, 512),
    ua: clampString(req.headers.get("user-agent"), MAX_UA),
    clientTs:
      typeof body.ts === "number" && Number.isFinite(body.ts) ? body.ts : null,
    serverTs: new Date().toISOString(),
  };

  try {
    const { getDb } = await import("@edlight-news/firebase");
    const db = getDb();
    await db.collection("analytics_events").add(doc);
  } catch (err) {
    console.error("[events] write failed:", err);
    // Don't surface — analytics must never break the user experience.
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
