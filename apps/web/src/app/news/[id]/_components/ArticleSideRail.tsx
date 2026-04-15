"use client";

import { useState, useEffect } from "react";
import { Bookmark, Share2, Check, Link2, ExternalLink, ArrowUp } from "lucide-react";
import { isBookmarked, toggleBookmark } from "@/lib/bookmarks";
import type { ContentLanguage } from "@edlight-news/types";

/* ── Social icons (inline SVG) ──────────────────────────────────────────── */

const WHATSAPP_ICON = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const FACEBOOK_ICON = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const TWITTER_ICON = (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/* ── Props ───────────────────────────────────────────────────────────────── */

interface ArticleSideRailProps {
  articleId: string;
  shareUrl: string;
  shareTitle: string;
  sourceUrl?: string | null;
  sourceDomain?: string | null;
  lang: ContentLanguage;
}

/**
 * Sticky desktop side rail — visible on xl+ screens.
 * Contains: reading progress, share, bookmark, source, back-to-top.
 */
export function ArticleSideRail({
  articleId,
  shareUrl,
  shareTitle,
  sourceUrl,
  sourceDomain,
  lang,
}: ArticleSideRailProps) {
  const fr = lang === "fr";
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setMounted(true);
    setSaved(isBookmarked(articleId));
  }, [articleId]);

  /* ── Reading progress ─────────────────────────────────────────────────── */
  useEffect(() => {
    const handleScroll = () => {
      const el = document.getElementById("article-body");
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.scrollHeight;
      const visible = window.innerHeight;
      // How far through the article body have we scrolled?
      const scrolled = Math.max(0, -rect.top);
      const pct = Math.min(100, Math.max(0, (scrolled / (total - visible)) * 100));
      setProgress(pct);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleToggleBookmark = () => {
    const result = toggleBookmark(articleId);
    setSaved(result.bookmarked);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* no clipboard API */ }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!mounted) return null;

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(shareTitle);

  return (
    <aside className="hidden xl:flex flex-col items-center gap-3 sticky top-28 self-start">
      {/* Reading progress ring */}
      <div className="relative flex items-center justify-center" title={`${Math.round(progress)}%`}>
        <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
          <circle
            cx="18" cy="18" r="15.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-stone-200 dark:text-stone-700"
          />
          <circle
            cx="18" cy="18" r="15.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray={`${progress} ${100 - progress}`}
            strokeLinecap="round"
            className="text-primary transition-all duration-300"
          />
        </svg>
        <span className="absolute text-[9px] font-bold text-stone-500 dark:text-stone-400">
          {Math.round(progress)}%
        </span>
      </div>

      <div className="h-px w-6 bg-stone-200 dark:bg-stone-700" />

      {/* Share — WhatsApp */}
      <a
        href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex h-9 w-9 items-center justify-center rounded-xl bg-stone-50 text-stone-500 dark:text-stone-400 transition-all hover:bg-[#25D366]/10 hover:text-[#25D366] hover:shadow-sm dark:bg-stone-800 dark:hover:bg-[#25D366]/20"
        aria-label={fr ? "Partager sur WhatsApp" : "Pataje sou WhatsApp"}
        title="WhatsApp"
      >
        {WHATSAPP_ICON}
      </a>

      {/* Share — Facebook */}
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex h-9 w-9 items-center justify-center rounded-xl bg-stone-50 text-stone-500 dark:text-stone-400 transition-all hover:bg-[#1877F2]/10 hover:text-[#1877F2] hover:shadow-sm dark:bg-stone-800 dark:hover:bg-[#1877F2]/20"
        aria-label={fr ? "Partager sur Facebook" : "Pataje sou Facebook"}
        title="Facebook"
      >
        {FACEBOOK_ICON}
      </a>

      {/* Share — X */}
      <a
        href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex h-9 w-9 items-center justify-center rounded-xl bg-stone-50 text-stone-500 dark:text-stone-400 transition-all hover:bg-stone-200 hover:text-stone-800 hover:shadow-sm dark:bg-stone-800 dark:hover:bg-stone-700 dark:hover:text-stone-200"
        aria-label={fr ? "Partager sur X" : "Pataje sou X"}
        title="X"
      >
        {TWITTER_ICON}
      </a>

      {/* Copy link */}
      <button
        onClick={copyLink}
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:shadow-sm ${
          copied
            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
            : "bg-stone-50 text-stone-500 dark:text-stone-400 hover:bg-stone-200 hover:text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:hover:text-stone-300"
        }`}
        aria-label={fr ? "Copier le lien" : "Kopye lyen"}
        title={copied ? (fr ? "Copié !" : "Kopye !") : (fr ? "Copier le lien" : "Kopye lyen")}
      >
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      </button>

      <div className="h-px w-6 bg-stone-200 dark:bg-stone-700" />

      {/* Bookmark */}
      <button
        onClick={handleToggleBookmark}
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:shadow-sm ${
          saved
            ? "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
            : "bg-stone-50 text-stone-500 dark:text-stone-400 hover:bg-blue-50 hover:text-blue-600 dark:bg-stone-800 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
        }`}
        aria-label={saved ? (fr ? "Retirer des favoris" : "Retire nan favori") : (fr ? "Sauvegarder" : "Sove")}
        title={saved ? (fr ? "Sauvegardé" : "Sove") : (fr ? "Sauvegarder" : "Sove")}
      >
        <Bookmark className={`h-4 w-4 transition-all duration-300 ${saved ? "fill-blue-600 dark:fill-blue-400" : ""}`} />
      </button>

      {/* Source link */}
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-50 text-stone-500 dark:text-stone-400 transition-all hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm dark:bg-stone-800 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
          aria-label={fr ? "Source officielle" : "Sous ofisyèl"}
          title={sourceDomain ?? (fr ? "Source" : "Sous")}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      )}

      <div className="h-px w-6 bg-stone-200 dark:bg-stone-700" />

      {/* Back to top */}
      <button
        onClick={scrollToTop}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-50 text-stone-400 dark:text-stone-400 transition-all hover:bg-stone-200 hover:text-stone-600 hover:shadow-sm dark:bg-stone-800 dark:hover:bg-stone-700 dark:hover:text-stone-300"
        aria-label={fr ? "Retour en haut" : "Retounen anlè"}
        title={fr ? "Retour en haut" : "Retounen anlè"}
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </aside>
  );
}
