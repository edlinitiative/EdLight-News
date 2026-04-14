/**
 * Admin — Contributor Profiles management.
 *
 * Lists all contributors with their profile info, role, and verification status.
 * Allows creating new contributors via a form.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  CheckCircle,
  XCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface Contributor {
  id: string;
  slug: string;
  displayName: string;
  name: string;
  email?: string;
  role: string;
  verified: boolean;
  bio?: string;
  photoUrl?: string;
  socialLinks?: { twitter?: string; linkedin?: string; website?: string };
}

const ROLE_LABELS: Record<string, string> = {
  intern: "Stagiaire",
  editor: "Rédacteur",
  admin: "Admin",
};

const ROLE_COLORS: Record<string, string> = {
  intern: "bg-amber-100 text-amber-800",
  editor: "bg-blue-100 text-blue-800",
  admin: "bg-purple-100 text-purple-800",
};

export default function ContributorsPage() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("intern");
  const [formBio, setFormBio] = useState("");
  const [formPhotoUrl, setFormPhotoUrl] = useState("");

  const fetchContributors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/contributors");
      const data = await res.json();
      setContributors(data.contributors ?? []);
    } catch {
      setError("Failed to load contributors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContributors();
  }, [fetchContributors]);

  // Auto-generate slug from display name
  useEffect(() => {
    if (formDisplayName && !formSlug) {
      setFormSlug(
        formDisplayName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      );
    }
  }, [formDisplayName, formSlug]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/contributors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName || formDisplayName,
          displayName: formDisplayName,
          slug: formSlug,
          email: formEmail || undefined,
          role: formRole,
          verified: false,
          bio: formBio || undefined,
          photoUrl: formPhotoUrl || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Create failed");
      }
      // Reset form
      setFormName("");
      setFormDisplayName("");
      setFormSlug("");
      setFormEmail("");
      setFormRole("intern");
      setFormBio("");
      setFormPhotoUrl("");
      setShowForm(false);
      await fetchContributors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleVerified(c: Contributor) {
    try {
      await fetch("/api/admin/contributors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, verified: !c.verified }),
      });
      await fetchContributors();
    } catch {
      setError("Failed to update verification");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold text-stone-900 dark:text-white">
          <Users className="h-5 w-5" />
          Contributors
        </h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "New Contributor"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-5 dark:border-stone-700 dark:bg-stone-800"
        >
          <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-200">
            New Contributor
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400">
                Display Name *
              </label>
              <input
                type="text"
                required
                value={formDisplayName}
                onChange={(e) => setFormDisplayName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900 dark:text-white"
                placeholder="Jean-Marc Paul"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400">
                Slug *
              </label>
              <input
                type="text"
                required
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900 dark:text-white"
                placeholder="jean-marc-paul"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400">
                Internal Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900 dark:text-white"
                placeholder="Same as display name if blank"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400">
                Email
              </label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900 dark:text-white"
                placeholder="contributor@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400">
                Role
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900 dark:text-white"
              >
                <option value="intern">Stagiaire</option>
                <option value="editor">Rédacteur</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400">
                Photo URL
              </label>
              <input
                type="url"
                value={formPhotoUrl}
                onChange={(e) => setFormPhotoUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900 dark:text-white"
                placeholder="https://..."
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-stone-400">
              Bio
            </label>
            <textarea
              value={formBio}
              onChange={(e) => setFormBio(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900 dark:text-white"
              placeholder="Short public bio (1-3 sentences)"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create
          </button>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      ) : contributors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-10 text-center dark:border-stone-700">
          <Users className="mx-auto h-8 w-8 text-stone-300 dark:text-stone-600" />
          <p className="mt-3 text-sm text-stone-500">No contributors yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contributors.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-800"
            >
              {/* Avatar */}
              {c.photoUrl ? (
                <img
                  src={c.photoUrl}
                  alt={c.displayName}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {c.displayName.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-900 dark:text-white">
                    {c.displayName}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ROLE_COLORS[c.role] ?? "bg-stone-100 text-stone-600"}`}
                  >
                    {ROLE_LABELS[c.role] ?? c.role}
                  </span>
                  {c.verified ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-stone-300" />
                  )}
                </div>
                <p className="text-xs text-stone-400 dark:text-stone-500">
                  /{c.slug}
                  {c.email && <span className="ml-2">· {c.email}</span>}
                </p>
                {c.bio && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-stone-500 dark:text-stone-400">
                    {c.bio}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleVerified(c)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    c.verified
                      ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-700 dark:text-stone-300"
                  }`}
                >
                  {c.verified ? "Verified ✓" : "Verify"}
                </button>
                <a
                  href={`/auteur/${c.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-stone-100 p-1.5 text-stone-500 transition hover:bg-stone-200 dark:bg-stone-700 dark:text-stone-400 dark:hover:bg-stone-600"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
