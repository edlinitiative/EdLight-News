"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Retour en haut"
      className="fixed bottom-20 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white shadow-md transition-all hover:bg-stone-50 hover:shadow-lg dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800 lg:bottom-8"
    >
      <ArrowUp className="h-4 w-4 text-stone-600 dark:text-stone-300" />
    </button>
  );
}
