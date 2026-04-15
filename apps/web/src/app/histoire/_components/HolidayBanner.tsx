"use client";

/**
 * HolidayBanner — elegant holiday ribbon for /histoire.
 *
 * Displays a Haitian holiday with a star icon, serif italic name,
 * and optional "National" badge. Uses burgundy/gold accent palette.
 */

import { Star } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { SerializableHoliday } from "./shared";

interface HolidayBannerProps {
  holiday: SerializableHoliday;
  lang: ContentLanguage;
}

export function HolidayBanner({ holiday, lang }: HolidayBannerProps) {
  const fr = lang === "fr";

  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-[#9a7a2f]/15 bg-[#9a7a2f]/5 px-4 py-2.5 transition-colors hover:bg-[#9a7a2f]/8 dark:border-amber-400/15 dark:bg-amber-400/5 dark:hover:bg-amber-400/8">
      <Star className="h-4 w-4 text-[#9a7a2f] dark:text-amber-400" />
      <span className="font-serif text-sm italic text-[#6f2438] dark:text-rose-300">
        {fr ? holiday.name_fr : holiday.name_ht}
      </span>
      {holiday.isNationalHoliday && (
        <span className="rounded-full bg-[#6f2438]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6f2438] dark:bg-rose-400/10 dark:text-rose-400">
          {fr ? "National" : "Nasyonal"}
        </span>
      )}
    </div>
  );
}
