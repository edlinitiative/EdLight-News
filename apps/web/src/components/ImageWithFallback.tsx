"use client";

import { useState } from "react";
import Image from "next/image";

interface ImageWithFallbackProps {
  src: string;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
  /** Width hint for next/image (ignored for fill mode) */
  width?: number;
  /** Height hint for next/image (ignored for fill mode) */
  height?: number;
  /** Use fill mode instead of explicit width/height */
  fill?: boolean;
  /** Custom sizes hint for fill mode (defaults to responsive 3-col grid) */
  sizes?: string;
  /** Content to render when the image fails to load */
  fallback?: React.ReactNode;
  /** Prioritize loading (LCP images). When true, loads eagerly and preloads. */
  priority?: boolean;
}

// Hosts whitelisted in next.config.js remotePatterns — images served from
// these can be optimized by next/image. Everything else stays unoptimized.
const OPTIMIZED_HOSTS = new Set([
  "storage.googleapis.com",
  "firebasestorage.googleapis.com",
  "commons.wikimedia.org",
  "upload.wikimedia.org",
]);

function isOptimizable(src: string): boolean {
  if (!src.startsWith("http")) return true;
  try {
    return OPTIMIZED_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

/**
 * Wrapper around next/image that hides the element (or shows a fallback)
 * when the resource fails to load (404, wrong content-type, etc.).
 */
export function ImageWithFallback({
  src,
  alt = "",
  className,
  loading = "lazy",
  width,
  height,
  fill,
  sizes,
  fallback,
  priority = false,
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return fallback ? <>{fallback}</> : null;
  }

  // Optimize images served from hosts whitelisted in next.config.js; keep
  // genuinely non-whitelisted external hosts unoptimized (Next would 400 them).
  const unoptimized = !isOptimizable(src);

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      priority={priority}
      loading={priority ? "eager" : loading}
      onError={() => setFailed(true)}
      {...(fill
        ? { fill: true, sizes: sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" }
        : { width: width ?? 400, height: height ?? 300 }
      )}
      unoptimized={unoptimized}
    />
  );
}
