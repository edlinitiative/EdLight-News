"use client";

import { useEffect, useRef } from "react";

/**
 * Client component that fires a single POST /api/views on mount.
 * Debounced per itemId per session via sessionStorage to avoid
 * inflating counts on back-nav or fast-refresh.
 */
export function ViewTracker({ itemId }: { itemId: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !itemId) return;

    // Dedupe within same browser session
    const key = `edlight_viewed_${itemId}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* private browsing — proceed anyway */
    }

    fired.current = true;

    fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    })
      .then(() => {
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          /* noop */
        }
      })
      .catch(() => {
        /* non-critical — silently ignore */
      });
  }, [itemId]);

  return null;
}
