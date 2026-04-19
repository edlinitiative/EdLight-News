import Link from "next/link";
import { getDb } from "@edlight-news/firebase";
import { PipelineControl } from "./_PipelineControl";
import type { AdminStats } from "@/types/admin";

export const dynamic = "force-dynamic";

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = "bg-white dark:bg-stone-800",
  href,
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
  href?: string;
}) {
  const content = (
    <div className={`rounded-xl border border-stone-200 p-5 dark:border-stone-700 ${color}`}>
      <p className="text-sm text-stone-500 dark:text-stone-400">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums dark:text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">{sub}</p>}
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block transition hover:-translate-y-0.5 hover:shadow-sm">
      {content}
    </Link>
  );
}

// ── Stats fetcher ─────────────────────────────────────────────────────────────

async function fetchStats(): Promise<AdminStats> {
  const db = getDb();
  const [
    itemsTotal,
    itemsWithImages,
    cvsTotal,
    cvsPublished,
    cvsDraft,
    sourcesActive,
    fbQueued,
    fbScheduled,
    fbSending,
    fbFailed,
    thQueued,
    thScheduled,
    thSending,
    thFailed,
    xQueued,
    xScheduled,
    xSending,
    xFailed,
  ] = await Promise.all([
    db.collection("items").count().get(),
    db.collection("items").where("imageSource", "in", ["publisher", "wikidata", "branded", "screenshot"]).count().get(),
    db.collection("content_versions").count().get(),
    db.collection("content_versions").where("status", "==", "published").count().get(),
    db.collection("content_versions").where("status", "==", "draft").count().get(),
    db.collection("sources").where("active", "==", true).count().get(),
    db.collection("fb_queue").where("status", "==", "queued").count().get(),
    db.collection("fb_queue").where("status", "==", "scheduled").count().get(),
    db.collection("fb_queue").where("status", "==", "sending").count().get(),
    db.collection("fb_queue").where("status", "==", "failed").count().get(),
    db.collection("th_queue").where("status", "==", "queued").count().get(),
    db.collection("th_queue").where("status", "==", "scheduled").count().get(),
    db.collection("th_queue").where("status", "==", "sending").count().get(),
    db.collection("th_queue").where("status", "==", "failed").count().get(),
    db.collection("x_queue").where("status", "==", "queued").count().get(),
    db.collection("x_queue").where("status", "==", "scheduled").count().get(),
    db.collection("x_queue").where("status", "==", "sending").count().get(),
    db.collection("x_queue").where("status", "==", "failed").count().get(),
  ]);

  return {
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
    facebookQueue: {
      queued: fbQueued.data().count,
      scheduled: fbScheduled.data().count,
      sending: fbSending.data().count,
      failed: fbFailed.data().count,
    },
    threadsQueue: {
      queued: thQueued.data().count,
      scheduled: thScheduled.data().count,
      sending: thSending.data().count,
      failed: thFailed.data().count,
    },
    xQueue: {
      queued: xQueued.data().count,
      scheduled: xScheduled.data().count,
      sending: xSending.data().count,
      failed: xFailed.data().count,
    },
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminPage() {
  const stats = await fetchStats();

  const imagesPct =
    stats.items.total > 0
      ? Math.round((stats.items.withImages / stats.items.total) * 100)
      : 0;

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold dark:text-white">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Pipeline status and controls for EdLight News.
        </p>
      </div>

      {/* Stats grid */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
          Overview
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
          <StatCard label="Active sources" value={stats.sources.active} />
          <StatCard label="Items" value={stats.items.total} />
          <StatCard
            label="Published articles"
            value={stats.contentVersions.published}
            sub="FR + HT combined"
            color="bg-green-50 dark:bg-green-950/30"
          />
          <StatCard
            label="Drafts"
            value={stats.contentVersions.draft}
            sub="awaiting review"
            color={stats.contentVersions.draft > 0 ? "bg-yellow-50 dark:bg-yellow-950/30" : "bg-white dark:bg-stone-800"}
          />
          <StatCard
            label="With images"
            value={`${stats.items.withImages} (${imagesPct}%)`}
            sub={`of ${stats.items.total} items`}
          />
          <StatCard
            label="Facebook queue"
            value={stats.facebookQueue.queued}
            sub={`${stats.facebookQueue.scheduled} scheduled · ${stats.facebookQueue.failed} failed`}
            color={
              stats.facebookQueue.queued > 0 || stats.facebookQueue.scheduled > 0
                ? "bg-blue-50 dark:bg-blue-950/30"
                : "bg-white dark:bg-stone-800"
            }
            href="/admin/fb-queue"
          />
          <StatCard
            label="Threads queue"
            value={stats.threadsQueue.queued}
            sub={`${stats.threadsQueue.scheduled} scheduled · ${stats.threadsQueue.failed} failed`}
            color={
              stats.threadsQueue.queued > 0 || stats.threadsQueue.scheduled > 0
                ? "bg-purple-50 dark:bg-purple-950/30"
                : "bg-white dark:bg-stone-800"
            }
            href="/admin/th-queue"
          />
          <StatCard
            label="X queue"
            value={stats.xQueue.queued}
            sub={`${stats.xQueue.scheduled} scheduled · ${stats.xQueue.failed} failed`}
            color={
              stats.xQueue.queued > 0 || stats.xQueue.scheduled > 0
                ? "bg-stone-100 dark:bg-stone-700/30"
                : "bg-white dark:bg-stone-800"
            }
            href="/admin/x-queue"
          />
        </div>
      </div>

      {/* Pipeline trigger (client island) */}
      <PipelineControl />
    </section>
  );
}
