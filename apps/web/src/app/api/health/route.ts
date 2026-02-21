import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const errors: string[] = [];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  errors.push(`env: projectId=${projectId ? "ok" : "MISSING"} email=${clientEmail ? "ok" : "MISSING"} key=${privateKey ? `${privateKey.length}chars` : "MISSING"}`);

  if (!projectId || !clientEmail || !privateKey) {
    return NextResponse.json({ errors }, { status: 500 });
  }

  privateKey = privateKey.replace(/\\n/g, "\n");
  privateKey = privateKey.replace(/^["']|["']$/g, "");
  errors.push(`key starts with: ${privateKey.substring(0, 30)}`);
  errors.push(`key ends with: ${privateKey.substring(privateKey.length - 30)}`);

  try {
    const { initializeApp, cert, getApps } = await import("firebase-admin/app");
    const { initializeFirestore } = await import("firebase-admin/firestore");

    let app;
    if (getApps().length === 0) {
      app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    } else {
      app = getApps()[0]!;
    }
    errors.push(`app: ok`);

    const db = initializeFirestore(app, { preferRest: true });
    errors.push(`db: ok, preferRest applied`);

    const snap = await db.collection("content_versions").limit(1).get();
    errors.push(`query: ok, docs=${snap.size}`);
  } catch (e: any) {
    errors.push(`ERROR: ${e.message}`);
    errors.push(`stack: ${e.stack?.split("\n").slice(0, 3).join(" | ")}`);
  }

  return NextResponse.json({ steps: errors });
}
