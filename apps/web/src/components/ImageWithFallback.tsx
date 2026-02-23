"use client";

import { useState } from "react";

interface ImageWithFallbackProps {
  src: string;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
  /** Content to render when the image fails to load */
  fallback?: React.ReactNode;
}

/**
 * Thin wrapper around <img> that hides the element (or shows a fallback)
 * when the resource fails to load (404, wrong content-type, etc.).
 */
export function ImageWithFallback({
  src,
  alt = "",
  className,
  loading,
  fallback,
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
