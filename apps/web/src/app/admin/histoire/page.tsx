/**
 * /admin/histoire — Read-only admin view of Haiti History Almanac data.
 *
 * Shows all almanac entries and holidays with their status,
 * recent publish logs, and quick stats.
 */

import Link from "next/link";
import { BookOpen, Calendar, Star, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import {
  fetchAllAlmanacEntries,
  fetchAllHolidays,
  fetchRecentHistoryLogs,
} from "@/lib/datasets";
import type { HistoryPublishLog } from "@edlight-news/types";

export const dynamic = "force-dynamic"; // admin: must stay dynamic

function StatusBadge({ status }: { status: HistoryPublishLog["status"] }) {
  switch (status) {
    case "done":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
          <CheckCircle className="h-3 w-3" /> Published
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
          <XCircle className="h-3 w-3" /> Failed
        </span>
      );
    case "skipped":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-700">
          <AlertCircle className="h-3 w-3" /> Skipped
        </span>
      );
  }
}

export default async function AdminHistoirePage() {
  const [entries, holidays, recentLogs] = await Promise.all([
    fetchAllAlmanacEntries(),
    fetchAllHolidays(),
    fetchRecentHistoryLogs(14),
  ]);

  // Stats
  const highConfidence = entries.filter((e) => e.confidence === "high").length;
  const monthCoverage = new Set(entries.map((e) => e.monthDay.split("-")[0])).size;
  const uniqueDays = new Set(entries.map((e) => e.monthDay)).size;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-amber-600" />
          Admin — Histoire & Fèt
        </h1>
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Retour admin
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border p-5 bg-white">
          <p className="text-sm text-gray-500">Almanac entries</p>
          <p className="mt-1 text-3xl font-bold">{entries.length}</p>
          <p className="text-xs text-gray-400">{highConfidence} high confidence</p>
        </div>
        <div className="rounded-xl border p-5 bg-white">
          <p className="text-sm text-gray-500">Holidays</p>
          <p className="mt-1 text-3xl font-bold">{holidays.length}</p>
          <p className="text-xs text-gray-400">{holidays.filter((h) => h.isNationalHoliday).length} national</p>
        </div>
        <div className="rounded-xl border p-5 bg-white">
          <p className="text-sm text-gray-500">Month coverage</p>
          <p className="mt-1 text-3xl font-bold">{monthCoverage}/12</p>
          <p className="text-xs text-gray-400">{uniqueDays} unique days</p>
        </div>
        <div className="rounded-xl border p-5 bg-white">
          <p className="text-sm text-gray-500">Recent publishes</p>
          <p className="mt-1 text-3xl font-bold">
            {recentLogs.filter((l) => l.status === "done").length}
          </p>
          <p className="text-xs text-gray-400">Last 14 days</p>
        </div>
      </div>

      {/* Recent publish log */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Recent Publish Log</h2>
        {recentLogs.length > 0 ? (
          <div className="overflow-hidden rounded-lg border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Entries</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Item ID</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{log.dateISO}</td>
                    <td className="px-4 py-2"><StatusBadge status={log.status} /></td>
                    <td className="px-4 py-2 text-xs text-gray-600">{log.almanacEntryIds.length}</td>
                    <td className="px-4 py-2 text-xs text-gray-400 font-mono">
                      {log.publishedItemId?.slice(0, 12) ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-red-500 max-w-[200px] truncate">
                      {log.error ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No publish logs yet.</p>
        )}
      </section>

      {/* Holidays list */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          Holidays ({holidays.length})
        </h2>
        <div className="overflow-hidden rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Name (FR)</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Name (HT)</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">National</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {holidays
                .sort((a, b) => a.monthDay.localeCompare(b.monthDay))
                .map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{h.monthDay}</td>
                    <td className="px-4 py-2 font-medium">{h.name_fr}</td>
                    <td className="px-4 py-2 text-gray-600">{h.name_ht}</td>
                    <td className="px-4 py-2">
                      {h.isNationalHoliday ? "🇭🇹 Oui" : "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Almanac entries */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand-600" />
          Almanac Entries ({entries.length})
        </h2>
        <div className="overflow-hidden rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Year</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Title</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Tags</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Confidence</th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">Sources</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries
                .sort((a, b) => a.monthDay.localeCompare(b.monthDay))
                .map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{e.monthDay}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{e.year ?? "—"}</td>
                    <td className="px-4 py-2 font-medium text-sm max-w-[300px] truncate">
                      {e.title_fr}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {e.tags?.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          e.confidence === "high"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {e.confidence}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">{e.sources.length}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
