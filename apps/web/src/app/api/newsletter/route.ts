import { NextResponse } from "next/server";

// Lazy import to avoid edge runtime issues
async function getAdminFirestore() {
  const { getDb } = await import("@edlight-news/firebase/admin");
  return getDb();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = (body?.email ?? "").trim().toLowerCase();
    const lang = body?.lang ?? "fr";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const db = await getAdminFirestore();
    const ref = db.collection("newsletter_signups").doc(
      Buffer.from(email).toString("base64url")
    );

    await ref.set(
      {
        email,
        lang,
        subscribedAt: new Date().toISOString(),
        source: "website",
        active: true,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[newsletter] signup failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
