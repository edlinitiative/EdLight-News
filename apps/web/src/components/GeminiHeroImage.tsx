"use client";

import { useState, useEffect, useRef, memo } from "react";
import { useTheme } from "@/lib/theme-context";

interface GeminiHeroImageProps {
  /** The subject prompt (e.g. "scholarship awards ceremony") */
  prompt: string;
  /** Tailwind gradient classes for the fallback/loading state */
  fallbackGradient?: string;
  /** Additional CSS classes */
  className?: string;
  /** When true, regenerate the image when the theme changes. Default false. */
  themeAware?: boolean;
  /** Pre-fetched image data URL from server (skips client-side fetch entirely) */
  preloadedSrc?: string | null;
}

export const GeminiHeroImage = memo(function GeminiHeroImage({
  prompt,
  fallbackGradient = "from-brand-600 via-blue-700 to-indigo-800",
  className = "",
  themeAware = false,
  preloadedSrc,
}: GeminiHeroImageProps) {
  const { theme } = useTheme();
  const [imageUrl, setImageUrl] = useState<string | null>(preloadedSrc ?? null);
  const [loading, setLoading] = useState(!preloadedSrc);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // When themeAware is false, use a fixed key so the same image persists across theme toggles
  const effectiveTheme = themeAware ? theme : "universal";

  useEffect(() => {
    // Skip client fetch entirely if we have a preloaded image
    if (preloadedSrc) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(false);

    // Check sessionStorage cache first
    const cacheKey = `gemini_img_${prompt}_${effectiveTheme}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setImageUrl(cached);
        setLoading(false);
        return;
      }
    } catch {}

    fetch("/api/gemini-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, theme: effectiveTheme }),
      signal: ctrl.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("API error");
        return res.json();
      })
      .then((data) => {
        if (data.image) {
          setImageUrl(data.image);
          try {
            sessionStorage.setItem(cacheKey, data.image);
          } catch {}
        } else {
          setError(true);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(true);
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [prompt, effectiveTheme, preloadedSrc]);

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${fallbackGradient} ${className}`}
      >
        {/* Shimmer overlay */}
        <div className="absolute inset-0 animate-pulse bg-white/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]" />
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-white/30 border-t-white/80 animate-spin" />
        </div>
      </div>
    );
  }

  // ── Error / no image → gradient fallback ───────────────────────────────
  if (error || !imageUrl) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${fallbackGradient} ${className}`}
      >

      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────
  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
      {/* Subtle bottom gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  );
});

GeminiHeroImage.displayName = "GeminiHeroImage";
