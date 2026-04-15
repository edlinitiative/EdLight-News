"use client";

/**
 * HistoryPageHeader — ceremonial sticky header for /histoire.
 *
 * Features:
 * - Burgundy accent bar + "Éphéméride haïtienne" title
 * - Inline anchor navigation (desktop)
 * - Calendar + bookmark action buttons
 * - Frosted glass backdrop
 */

import { Calendar, Bookmark } from "lucide-react";

interface NavLink {
  readonly href: string;
  readonly label: string;
}

interface HistoryPageHeaderProps {
  links: readonly NavLink[];
}

export function HistoryPageHeader({ links }: HistoryPageHeaderProps) {
  return (
    <header className="fixed top-0 z-50 w-full border-b border-black/5 bg-[#fff8f5]/85 backdrop-blur-xl dark:border-stone-700/40 dark:bg-stone-950/85">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-6 px-6 py-4 md:px-8">
        {/* Left: accent bar + title */}
        <div className="flex min-w-0 items-center gap-4">
          <div className="h-8 w-1.5 rounded-full bg-[#6f2438]" />
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold tracking-tight md:text-xl">
              Éphéméride haïtienne
            </p>
            <p className="hidden text-[11px] uppercase tracking-[0.22em] text-[#464555]/70 dark:text-stone-500 md:block">
              EdLight News Archive
            </p>
          </div>
        </div>

        {/* Center: navigation links (desktop only) */}
        <nav className="hidden items-center gap-8 text-sm font-medium text-[#464555] lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-[#3525cd] focus-visible:text-[#3525cd] focus-visible:outline-none dark:text-stone-400 dark:hover:text-indigo-400"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2 md:gap-4">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/5 bg-white transition-colors hover:bg-[#f3ecea] dark:border-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700"
            aria-label="Calendrier"
          >
            <Calendar className="h-5 w-5 text-[#464555] dark:text-stone-400" />
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-full border border-black/5 bg-white transition-colors hover:bg-[#f3ecea] dark:border-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700"
            aria-label="Enregistrer"
          >
            <Bookmark className="h-5 w-5 fill-current text-[#464555] dark:text-stone-400" />
          </button>
        </div>
      </div>
    </header>
  );
}
