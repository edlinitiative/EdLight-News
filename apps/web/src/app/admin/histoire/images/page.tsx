"use client";

/**
 * /admin/histoire/images — Admin tool to replace illustrations on almanac entries.
 *
 * Flow:
 *  1. Pick a date (defaults to today in Haiti timezone)
 *  2. See all entries for that date with their current images
 *  3. Click "Change Image" on any entry
 *  4. Upload a new JPG/PNG and provide the source URL
 *  5. Submit → uploads to Firebase Storage & patches Firestore
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ImagePlus,
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  Upload,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Illustration {
  imageUrl: string;
  pageUrl: string;
  pageTitle?: string;
  provider?: "wikimedia_commons" | "manual";
  author?: string;
  license?: string;
  confidence?: number;
}

interface AlmanacEntry {
  id: string;
  monthDay: string;
  year?: number | null;
  title_fr: string;
  summary_fr: string;
  tags?: string[];
  illustration?: Illustration;
  confidence: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Get today's date in Haiti timezone as YYYY-MM-DD */
function getHaitiToday(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Port-au-Prince",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // "YYYY-MM-DD"
}

/** Convert YYYY-MM-DD → MM-DD */
function toMonthDay(dateStr: string): string {
  return dateStr.slice(5); // "2026-03-06" → "03-06"
}

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function formatDate(monthDay: string): string {
  const [mm, dd] = monthDay.split("-");
  const monthIdx = parseInt(mm!, 10) - 1;
  return `${parseInt(dd!, 10)} ${MONTH_NAMES[monthIdx]}`;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AdminHistoireImagesPage() {
  const haitiToday = getHaitiToday();
  const [selectedDate, setSelectedDate] = useState(haitiToday);
  const [entries, setEntries] = useState<AlmanacEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which entry is being edited
  const [editingId, setEditingId] = useState<string | null>(null);

  // ── Fetch entries for the selected date ──────────────────────────────
  const fetchEntries = useCallback(async (dateStr: string) => {
    setLoading(true);
    setError(null);
    setEditingId(null);
    try {
      const monthDay = toMonthDay(dateStr);
      const res = await fetch(`/api/admin/histoire/entries?monthDay=${monthDay}`);
      if (res.status === 401) {
        window.location.href = "/admin/login?from=/admin/histoire/images";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch entries");
      setEntries(data.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(selectedDate);
  }, [selectedDate, fetchEntries]);

  const monthDay = toMonthDay(selectedDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ImagePlus className="h-6 w-6 text-blue-600" />
          Histoire — Gestion des Images
        </h1>
        <Link
          href="/admin/histoire"
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          <ArrowLeft className="mr-1 inline h-3 w-3" />
          Retour
        </Link>
      </div>

      <p className="text-sm text-stone-500">
        Sélectionnez une date pour voir les faits historiques, puis remplacez les images incorrectes
        en téléchargeant un nouveau fichier JPG ou PNG et en fournissant la source.
      </p>

      {/* Date Picker */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-stone-400" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-stone-600 dark:bg-stone-800"
          />
        </div>
        <button
          onClick={() => setSelectedDate(haitiToday)}
          className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200 dark:bg-stone-700 dark:text-stone-300"
        >
          Aujourd&apos;hui
        </button>
        <span className="text-lg font-semibold text-stone-700 dark:text-stone-300">
          {formatDate(monthDay)}
        </span>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <XCircle className="mr-1 inline h-4 w-4" />
          {error}
        </div>
      )}

      {/* No entries */}
      {!loading && !error && entries.length === 0 && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-8 text-center text-sm text-stone-500 dark:border-stone-700 dark:bg-stone-800">
          Aucun fait historique pour le {formatDate(monthDay)}.
        </div>
      )}

      {/* Entries List */}
      {!loading && entries.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-stone-600 dark:text-stone-400">
            {entries.length} fait{entries.length > 1 ? "s" : ""} pour le {formatDate(monthDay)}
          </h2>

          {entries.map((entry) => (
            <EntryImageCard
              key={entry.id}
              entry={entry}
              isEditing={editingId === entry.id}
              onEdit={() => setEditingId(editingId === entry.id ? null : entry.id)}
              onUpdated={() => fetchEntries(selectedDate)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Entry Card ───────────────────────────────────────────────────────────────

interface EntryImageCardProps {
  entry: AlmanacEntry;
  isEditing: boolean;
  onEdit: () => void;
  onUpdated: () => void;
}

function EntryImageCard({ entry, isEditing, onEdit, onUpdated }: EntryImageCardProps) {
  const hasIllustration = !!entry.illustration?.imageUrl;

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
      <div className="flex flex-col sm:flex-row">
        {/* Current image */}
        <div className="relative flex h-48 w-full shrink-0 items-center justify-center overflow-hidden bg-stone-100 sm:h-auto sm:w-56 dark:bg-stone-700">
          {hasIllustration ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={entry.illustration!.imageUrl}
              alt={entry.title_fr}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-stone-400">
              <ImageIcon className="h-10 w-10" />
              <span className="text-xs">Pas d&apos;image</span>
            </div>
          )}
          {hasIllustration && entry.illustration?.provider && (
            <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
              {entry.illustration.provider === "manual" ? "📷 Manual" : "🌐 Wikimedia"}
            </span>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 p-4">
          <div className="mb-1 flex items-center gap-2">
            {entry.year != null && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-800">
                {entry.year}
              </span>
            )}
            {entry.tags?.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600 dark:bg-stone-600 dark:text-stone-300"
              >
                {tag}
              </span>
            ))}
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${
                entry.confidence === "high"
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {entry.confidence}
            </span>
          </div>

          <h3 className="mb-1 text-sm font-semibold leading-snug text-stone-900 dark:text-white">
            {entry.title_fr}
          </h3>
          <p className="mb-3 line-clamp-2 text-xs text-stone-500 dark:text-stone-400">
            {entry.summary_fr}
          </p>

          {/* Current source */}
          {hasIllustration && entry.illustration?.pageUrl && (
            <div className="mb-3 text-xs text-stone-400">
              Source actuelle :{" "}
              <a
                href={entry.illustration.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {entry.illustration.pageUrl.slice(0, 60)}…
                <ExternalLink className="ml-0.5 inline h-3 w-3" />
              </a>
            </div>
          )}

          <button
            onClick={onEdit}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              isEditing
                ? "bg-stone-200 text-stone-700 dark:bg-stone-600 dark:text-stone-200"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            <Upload className="h-3 w-3" />
            {isEditing ? "Annuler" : hasIllustration ? "Changer l'image" : "Ajouter une image"}
          </button>
        </div>
      </div>

      {/* Upload form */}
      {isEditing && (
        <ImageUploadForm entryId={entry.id} onSuccess={onUpdated} />
      )}
    </div>
  );
}

// ── Upload Form ──────────────────────────────────────────────────────────────

interface ImageUploadFormProps {
  entryId: string;
  onSuccess: () => void;
}

function ImageUploadForm({ entryId, onSuccess }: ImageUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Generate preview
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !source.trim()) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("entryId", entryId);
      formData.append("image", file);
      formData.append("source", source.trim());

      const res = await fetch("/api/admin/histoire/image", {
        method: "POST",
        body: formData,
      });

      if (res.status === 401) {
        window.location.href = "/admin/login?from=/admin/histoire/images";
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed");
      }

      setResult({ ok: true, message: "Image mise à jour avec succès !" });
      setFile(null);
      setSource("");
      if (fileRef.current) fileRef.current.value = "";

      // Refresh the entries list after a short delay
      setTimeout(onSuccess, 500);
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {/* File input */}
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">
            Image (JPG, PNG, WebP — max 10 Mo)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          {preview && (
            <div className="mt-2 overflow-hidden rounded-lg border border-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Aperçu"
                className="h-32 w-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Source URL */}
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">
            Source / Crédit (URL)
          </label>
          <input
            type="url"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://commons.wikimedia.org/wiki/..."
            required
            className="block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm placeholder:text-stone-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-stone-600 dark:bg-stone-800"
          />
          <p className="mt-1 text-[11px] text-stone-400">
            Lien vers la page source de l&apos;image (Wikimedia, archive, etc.)
          </p>
        </div>
      </div>

      {/* Submit */}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={!file || !source.trim() || uploading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Envoi en cours…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Remplacer l&apos;image
            </>
          )}
        </button>

        {result && (
          <span
            className={`inline-flex items-center gap-1 text-sm ${
              result.ok ? "text-green-600" : "text-red-600"
            }`}
          >
            {result.ok ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
