import { NextResponse } from "next/server";
import { getDb } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();

    const [
      itemsTotal,
      itemsWithImages,
      cvsTotal,
      cvsPublished,
      cvsDraft,
      sourcesActive,
    ] = await Promise.all([
      db.collection("items").count().get(),
      db.collection("items").where("imageSource", "in", ["publisher", "generated"]).count().get(),
      db.collection("content_versions").count().get(),
      db.collection("content_versions").where("status", "==", "published").count().get(),
      db.collection("content_versions").where("status", "==", "draft").count().get(),
      db.collection("sources").where("active", "==", true).count().get(),
    ]);

    return NextResponse.json({
      items: {
        total: itemsTotal.data().count,
        withImages: itemsWithImages.data().count,
      },
      contentVersions: {
        total: cvsTotal.data().count,
        published: cvsPublished.data().count,
        draft: cvsDraft.data().count,
      },
      sources: {
        active: sourcesActive.data().count,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
