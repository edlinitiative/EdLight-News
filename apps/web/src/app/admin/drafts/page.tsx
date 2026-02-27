/**
 * Admin — Draft management (Contributor Program).
 *
 * Gated behind FEATURE_CONTRIBUTORS env var.
 * When disabled (default), shows a "Coming soon" placeholder.
 * When enabled, lists drafts with status management.
 */

import Link from "next/link";
import { FileEdit, Clock, CheckCircle, XCircle, Eye } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { Draft, DraftStatus } from "@edlight-news/types";

export const dynamic = "force-dynamic"; // admin: must stay dynamic

const FEATURE_ENABLED = process.env.FEATURE_CONTRIBUTORS === "true";

// ── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  DraftStatus,
  { label: { fr: string; ht: string }; color: string; icon: typeof Clock }
> = {
  draft: {
    label: { fr: "Brouillon", ht: "Bouyon" },
    color: "bg-stone-100 text-stone-800",
    icon: Clock,
  },
  submitted: {
    label: { fr: "Soumis", ht: "Soumèt" },
    color: "bg-blue-100 text-blue-800",
    icon: Eye,
  },
  approved: {
    label: { fr: "Approuvé", ht: "Apwouve" },
    color: "bg-green-100 text-green-800",
    icon: CheckCircle,
  },
  rejected: {
    label: { fr: "Rejeté", ht: "Rejte" },
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
};

// ── Coming-soon placeholder ──────────────────────────────────────────────────

function ComingSoon({ fr }: { fr: boolean }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-20 text-center">
      <FileEdit className="mx-auto h-16 w-16 text-stone-300" />
      <h1 className="text-3xl font-bold text-stone-800">
        {fr ? "Programme Contributeur" : "Pwogram Kontribitè"}
      </h1>
      <p className="text-lg text-stone-500">
        {fr
          ? "Bientôt, vous pourrez soumettre des articles, guides et fiches pour aider les étudiants haïtiens. Revenez vite !"
          : "Byento, w ap kapab soumèt atik, gid ak fich pou ede elèv ayisyen yo. Tounen vit !"}
      </p>
      <Link
        href={fr ? "/" : "/?lang=ht"}
        className="inline-block rounded-lg bg-stone-900 px-6 py-3 font-medium text-white transition hover:bg-stone-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
      >
        {fr ? "← Retour à l'accueil" : "← Retounen lakay"}
      </Link>
    </div>
  );
}

// ── Draft list (when feature is enabled) ─────────────────────────────────────

async function DraftList({ fr }: { fr: boolean }) {
  // Dynamic import to avoid bundling firebase admin when feature is off
  const { draftsRepo } = await import("@edlight-news/firebase");
  const allDrafts = await draftsRepo.listAll();

  // Group by status
  const grouped: Record<DraftStatus, Draft[]> = {
    draft: [],
    submitted: [],
    approved: [],
    rejected: [],
  };
  for (const d of allDrafts) {
    if (grouped[d.status]) grouped[d.status]!.push(d);
  }

  const statusOrder: DraftStatus[] = [
    "draft",
    "submitted",
    "approved",
    "rejected",
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          <FileEdit className="mr-2 inline h-6 w-6 text-blue-600" />
          {fr ? "Gestion des brouillons" : "Jesyon bouyon yo"}
        </h1>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-600">
          {allDrafts.length} {fr ? "brouillons" : "bouyon"}
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        {statusOrder.map((status) => {
          const cfg = STATUS_CONFIG[status];
          const count = grouped[status]?.length ?? 0;
          return (
            <div
              key={status}
              className={`rounded-lg border p-3 text-center ${cfg.color}`}
            >
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs font-medium">
                {fr ? cfg.label.fr : cfg.label.ht}
              </p>
            </div>
          );
        })}
      </div>

      {/* Draft tables by status */}
      {statusOrder.map((status) => {
        const drafts = grouped[status] ?? [];
        if (drafts.length === 0) return null;
        const cfg = STATUS_CONFIG[status];

        return (
          <section key={status} className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <cfg.icon className="h-4 w-4" />
              {fr ? cfg.label.fr : cfg.label.ht}
              <span className="text-sm font-normal text-stone-400">
                ({drafts.length})
              </span>
            </h2>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-stone-50 text-xs text-stone-500">
                  <tr>
                    <th className="px-4 py-2">{fr ? "Titre" : "Tit"}</th>
                    <th className="px-4 py-2">{fr ? "Auteur" : "Otè"}</th>
                    <th className="px-4 py-2">{fr ? "Type" : "Tip"}</th>
                    <th className="px-4 py-2">{fr ? "Créé le" : "Kreye"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {drafts.map((d) => (
                    <tr key={d.id} className="hover:bg-stone-50">
                      <td className="px-4 py-2 font-medium text-stone-900">
                        {d.title_fr}
                      </td>
                      <td className="px-4 py-2 text-stone-600">
                        {d.authorId}
                      </td>
                      <td className="px-4 py-2">
                        <span className="rounded bg-stone-100 px-2 py-0.5 text-xs">
                          {d.series ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-stone-500 text-xs">
                        {d.createdAt
                          ? new Date(
                              typeof d.createdAt === "string"
                                ? d.createdAt
                                : (d.createdAt as any)._seconds
                                  ? (d.createdAt as any)._seconds * 1000
                                  : Date.now(),
                            ).toLocaleDateString(fr ? "fr-FR" : "fr-HT", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {allDrafts.length === 0 && (
        <div className="rounded-lg border-2 border-dashed py-12 text-center text-stone-400">
          <FileEdit className="mx-auto mb-3 h-10 w-10" />
          <p>{fr ? "Aucun brouillon pour le moment." : "Pa gen bouyon pou kounye a."}</p>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminDraftsPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";
  const fr = lang === "fr";

  if (!FEATURE_ENABLED) {
    return <ComingSoon fr={fr} />;
  }

  return <DraftList fr={fr} />;
}
