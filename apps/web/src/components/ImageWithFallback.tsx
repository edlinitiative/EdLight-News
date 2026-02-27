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
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return fallback ? <>{fallback}</> : null;
  }

  // External URLs need unoptimized flag unless configured in next.config.js
  const isExternal = src.startsWith("http");

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setFailed(true)}
      {...(fill
        ? { fill: true, sizes: sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" }
        : { width: width ?? 400, height: height ?? 300 }
      )}
      unoptimized={isExternal}
    />
  );
}
