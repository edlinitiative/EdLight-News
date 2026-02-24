"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme-context";
import { Sparkles } from "lucide-react";

interface GeminiHeroImageProps {
  /** The subject prompt (e.g. "scholarship awards ceremony") */
  prompt: string;
  /** Tailwind gradient classes for the fallback/loading state */
  fallbackGradient?: string;
  /** Additional CSS classes */
  className?: string;
}

export function GeminiHeroImage({
  prompt,
  fallbackGradient = "from-brand-600 via-blue-700 to-indigo-800",
  className = "",
}: GeminiHeroImageProps) {
  const { theme } = useTheme();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(false);

    // Check sessionStorage cache first
    const cacheKey = `gemini_img_${prompt}_${theme}`;
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
      body: JSON.stringify({ prompt, theme }),
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
  }, [prompt, theme]);

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
          <div className="flex flex-col items-center gap-2.5">
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-white/20" />
              <Sparkles className="h-5 w-5 text-white/80" />
            </div>
            <span className="text-xs font-medium text-white/60 tracking-wide">
              AI generating image…
            </span>
          </div>
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
        className="h-full w-full object-cover"
      />
      {/* Subtle bottom gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  );
}
