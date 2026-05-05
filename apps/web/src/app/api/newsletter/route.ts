/**
 * POST /api/newsletter — Newsletter signup (dual-stream).
 *
 * Accepts:
 *   { email: string, lang: "fr" | "ht",
 *     streams?: ("bourses" | "news")[],   // defaults to both for legacy callers
 *     source?: "hero" | "footer" | "sticky" | "exit_intent" | "inline" }
 *
 * Stores a single document per email (keyed by base64url(email)) in the
 * `newsletter_signups` Firestore collection. Stream preferences are stored
 * as boolean tags so the eventual digest job can query
 *   .where("streams.bourses", "==", true)
 * without requiring a separate collection per stream.
 *
 * Re-submitting an existing email merges new stream selections (does not
 * unsubscribe a stream the user previously opted in to).
 */

import { NextResponse } from "next/server";

type Stream = "bourses" | "news";
const ALL_STREAMS: Stream[] = ["bourses", "news"];
const ALL_SOURCES = new Set([
  "hero",
  "footer",
  "sticky",
  "exit_intent",
  "inline",
]);

// Lazy import to avoid edge runtime issues
async function getAdminFirestore() {
  const { getDb } = await import("@edlight-news/firebase");
  return getDb();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body?.email ?? "").trim().toLowerCase();
    const lang = body?.lang === "ht" ? "ht" : "fr";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Streams: filter to known values; default to both for legacy callers.
    const requested: unknown = body?.streams;
    let streams: Stream[];
    if (Array.isArray(requested)) {
      streams = requested.filter((s): s is Stream =>
        ALL_STREAMS.includes(s as Stream),
      );
      if (streams.length === 0) streams = ["bourses"];
    } else {
      streams = ["bourses", "news"];
    }

    const source =
      typeof body?.source === "string" && ALL_SOURCES.has(body.source)
        ? (body.source as string)
        : "unknown";

    const db = await getAdminFirestore();
    const ref = db
      .collection("newsletter_signups")
      .doc(Buffer.from(email).toString("base64url"));

    const nowISO = new Date().toISOString();

    // Build the stream-tag map merging-friendly: only set true for streams
    // the user just opted into. We never explicitly set false here, so a
    // prior opt-in survives a later signup that selected only one stream.
    const streamTags: Record<string, boolean> = {};
    for (const s of streams) streamTags[s] = true;

    await ref.set(
      {
        email,
        lang,
        active: true,
        subscribedAt: nowISO,
        lastSignupAt: nowISO,
        lastSource: source,
        // streams.bourses / streams.news — mergeable boolean tags
        streams: streamTags,
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true, streams });
  } catch (err) {
    console.error("[newsletter] signup failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
