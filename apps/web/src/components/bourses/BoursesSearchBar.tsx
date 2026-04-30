"use client";

/**
 * BoursesSearchBar — Mobile-first premium search bar.
 *
 * Key improvements:
 *   - Full-width on mobile with generous tap target
 *   - Clear button always accessible
 *   - Smooth focus animation with subtle glow
 *   - Premium glass-morphism (light) / dark inset styling
 *   - Accessible label and proper ARIA attributes
 */

import type { ContentLanguage } from "@edlight-news/types";
import { Search, X } from "lucide-react";
import { useRef } from "react";

interface BoursesSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  lang: ContentLanguage;
}

export function BoursesSearchBar({ value, onChange, lang }: BoursesSearchBarProps) {
  const fr = lang === "fr";
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <label htmlFor="bourses-search" className="sr-only">
        {fr ? "Rechercher une bourse" : "Chèche yon bous"}
      </label>

      <div className="
        group
        relative
        flex items-center
        bg-white dark:bg-stone-900/95
        rounded-2xl sm:rounded-2xl
        border border-[#f3ecea]/60 dark:border-stone-700/40
        shadow-[0_1px_3px_rgba(29,27,26,0.04)] dark:shadow-none
        transition-all duration-300
        focus-within:border-[#3525cd] dark:focus-within:border-[#c3c0ff]
        focus-within:shadow-[0_0_0_3px_rgba(53,37,205,0.08)] dark:focus-within:shadow-[0_0_0_3px_rgba(195,192,255,0.08)]
        overflow-hidden
      ">
        {/* Search icon */}
        <div className="pl-4 sm:pl-4 flex-shrink-0">
          <Search className="h-5 w-5 sm:h-4.5 sm:w-4.5 text-[#c7c4d8] dark:text-stone-500 transition-colors duration-300 group-focus-within:text-[#3525cd] dark:group-focus-within:text-[#c3c0ff]" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          id="bourses-search"
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fr ? "Chercher une bourse..." : "Chèche yon bous..."}
          className="
            flex-1
            bg-transparent
            border-none
            outline-none
            text-[15px] sm:text-sm
            text-[#1d1b1a] dark:text-white
            placeholder:text-[#c7c4d8] dark:placeholder:text-stone-600
            font-medium
            py-3.5 sm:py-3
            px-3 sm:px-3
            min-h-[48px] sm:min-h-[44px]
            /* Remove default search styles */
            [-webkit-appearance:none] [&::-webkit-search-decoration]:hidden
            [&::-webkit-search-cancel-button]:hidden
            [&::-webkit-search-results-button]:hidden
            [&::-webkit-search-results-decoration]:hidden
          "
        />

        {/* Clear button */}
        {value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="
              flex-shrink-0
              mr-3 sm:mr-3
              p-1.5 sm:p-1.5
              rounded-xl sm:rounded-lg
              hover:bg-[#f5f0ee] dark:hover:bg-stone-800
              transition-colors duration-200
              min-h-[44px] sm:min-h-[36px]
              min-w-[44px] sm:min-w-[36px]
              flex items-center justify-center
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd]
            "
            aria-label={fr ? "Effacer la recherche" : "Efase rechèch la"}
          >
            <X className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#6b6563] dark:text-stone-400" />
          </button>
        )}
      </div>
    </div>
  );
}