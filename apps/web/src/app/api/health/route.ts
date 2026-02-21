import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const errors: string[] = [];

  // Step 1: env vars
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  errors.push(`env: projectId=${projectId ? "ok" : "MISSING"} email=${clientEmail ? "ok" : "MISSING"} key=${privateKey ? `${privateKey.length}chars` : "MISSING"}`);

  // Step 2: firebase-admin module load
  try {
    const { getApps } = await import("firebase-admin/app");
    errors.push(`firebase-admin/app: loaded, apps=${getApps().length}`);
  } catch (e) {
    errors.push(`firebase-admin/app LOAD ERROR: ${e}`);
    return NextResponse.json({ errors }, { status: 500 });
  }

  // Step 3: firebase init
  try {
    const { getApp } = await import("@edlight-news/firebase");
    const app = getApp();
    errors.push(`getApp: ok, name=${app.name}`);
  } catch (e) {
    errors.push(`getApp ERROR: ${e}`);
    return NextResponse.json({ errors }, { status: 500 });
  }

  // Step 4: Firestore getDb + settings
  try {
    const { getDb } = await import("@edlight-news/firebase");
    const db = getDb();
    errors.push(`getDb: ok`);

    // Step 5: simple Firestore query
    const snap = await db.collection("content_versions").limit(1).get();
    errors.push(`Firestore query: ok, docs=${snap.size}`);
  } catch (e) {
    errors.push(`Firestore ERROR: ${e}`);
    return NextResponse.json({ errors }, { status: 500 });
  }

  return NextResponse.json({ ok: true, steps: errors });
}
