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
