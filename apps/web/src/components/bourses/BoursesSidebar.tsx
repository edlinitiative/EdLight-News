"use client";

/**
 * BoursesSidebar — interactive filter panel for the /bourses catalogue.
 *
 * Collapsible groups (Niveau, Financement, Pays, Éligibilité) with a checkbox
 * row per option and a live result count. Multi-select for level / funding /
 * country; single-select for Haiti-eligibility. Reset clears everything.
 */

import type { ContentLanguage, DatasetCountry, AcademicLevel } from "@edlight-news/types";
import type { ScholarshipFundingType } from "@edlight-news/types";
import { useState, type ReactNode } from "react";
import type { BourseFilters as BourseFiltersType } from "@/components/bourses/BoursesEditorial";
import { GraduationCap, Banknote, Globe, ShieldCheck, ChevronDown } from "lucide-react";
import { FUNDING_LABELS, LEVEL_LABELS, COUNTRY_LABELS } from "@/lib/bourses/labels";

export interface SidebarCounts {
  levels: Partial<Record<AcademicLevel, number>>;
  funding: Partial<Record<string, number>>;
  countries: Partial<Record<string, number>>;
  eligibility: { all: number; yes: number };
}

interface BoursesSidebarProps {
  lang: ContentLanguage;
  countries: DatasetCountry[];
  levels: AcademicLevel[];
  filters: BourseFiltersType;
  onFiltersChange: (filters: BourseFiltersType) => void;
  counts: SidebarCounts;
  /** Drop the card chrome (border/shadow/sticky) — used inside the mobile drawer. */
  bare?: boolean;
}

type GroupKey = "level" | "funding" | "country" | "eligibility";

const FUNDING_KEYS: ScholarshipFundingType[] = ["full", "partial", "stipend", "tuition-only"];

export function BoursesSidebar({
  lang,
  countries,
  levels,
  filters,
  onFiltersChange,
  counts,
  bare = false,
}: BoursesSidebarProps) {
  const fr = lang === "fr";
  const [open, setOpen] = useState<Record<GroupKey, boolean>>({
    level: true,
    funding: false,
    country: false,
    eligibility: true,
  });

  const toggle = (k: GroupKey) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  const activeCount =
    (filters.countries?.length ?? 0) +
    (filters.fundingTypes?.length ?? 0) +
    (filters.levels?.length ?? 0) +
    ((filters.haitianEligibility ?? "all") !== "all" ? 1 : 0);

  // ── Row renderer ──────────────────────────────────────────────────────────
  const Row = ({
    checked,
    label,
    count,
    onChange,
  }: {
    checked: boolean;
    label: ReactNode;
    count?: number;
    onChange: () => void;
  }) => (
    <label className="group flex cursor-pointer items-center justify-between gap-2 py-1.5">
      <span className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="h-4 w-4 rounded border-[#c7c4d8] text-[#3525cd] focus:ring-[#3525cd] dark:border-stone-600"
        />
        <span className={`text-[13px] transition-colors ${checked ? "font-semibold text-[#3525cd] dark:text-[#c3c0ff]" : "text-[#464555] group-hover:text-[#3525cd] dark:text-stone-300 dark:group-hover:text-[#c3c0ff]"}`}>
          {label}
        </span>
      </span>
      {count != null && (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${
            checked
              ? "bg-[#3525cd]/12 text-[#3525cd] dark:bg-[#c3c0ff]/15 dark:text-[#c3c0ff]"
              : "bg-[#f5f0ee] text-[#6b6563] dark:bg-stone-800 dark:text-stone-400"
          }`}
        >
          {count}
        </span>
      )}
    </label>
  );

  const Group = ({
    k,
    icon,
    label,
    highlight,
    children,
  }: {
    k: GroupKey;
    icon: ReactNode;
    label: string;
    highlight?: boolean;
    children: ReactNode;
  }) => (
    <div className="border-t border-[#f3ecea]/70 pt-1.5 first:border-t-0 first:pt-0 dark:border-stone-800/70">
      <button
        type="button"
        onClick={() => toggle(k)}
        className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[13px] font-bold transition-colors ${
          highlight
            ? "bg-[#3525cd]/6 text-[#3525cd] dark:bg-[#c3c0ff]/10 dark:text-[#c3c0ff]"
            : "text-[#1d1b1a] hover:bg-[#f5f0ee] dark:text-stone-200 dark:hover:bg-stone-800"
        }`}
      >
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
        <ChevronDown className={`h-4 w-4 text-[#c7c4d8] transition-transform duration-300 dark:text-stone-500 ${open[k] ? "" : "-rotate-90"}`} />
      </button>
      <div className={`overflow-hidden px-2 transition-all duration-300 ease-out ${open[k] ? "max-h-[600px] pb-2 pt-1 opacity-100" : "max-h-0 opacity-0"}`}>
        {children}
      </div>
    </div>
  );

  return (
    <aside
      className={
        bare
          ? ""
          : "sm:sticky sm:top-24 rounded-2xl border border-[#f3ecea]/60 bg-white p-4 shadow-[0_1px_3px_rgba(29,27,26,0.04)] dark:border-stone-700/40 dark:bg-stone-900/95 dark:shadow-none"
      }
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between border-b border-[#f3ecea]/70 pb-3 dark:border-stone-800/70">
        <div>
          <h3 className="text-[14px] font-bold text-[#1d1b1a] dark:text-white">
            {fr ? "Filtres" : "Filt"}
          </h3>
          <p className="text-[11px] text-[#6b6563] dark:text-stone-400">
            {fr ? "Affinez pour trouver vite" : "Afine pou jwenn vit"}
          </p>
        </div>
        {activeCount > 0 && (
          <button
            onClick={() => onFiltersChange({})}
            className="text-[10px] font-bold uppercase tracking-wide text-[#93000a] hover:underline dark:text-red-400"
          >
            {fr ? "Réinitialiser" : "Reyinisyalize"}
          </button>
        )}
      </div>

      {/* Niveau */}
      <Group k="level" icon={<GraduationCap className="h-4 w-4" />} label={fr ? "Niveau" : "Nivo"}>
        {levels.map((l) => (
          <Row
            key={l}
            checked={(filters.levels ?? []).includes(l)}
            count={counts.levels[l]}
            label={LEVEL_LABELS[l] ? (fr ? LEVEL_LABELS[l].fr : LEVEL_LABELS[l].ht) : l}
            onChange={() => {
              const cur = filters.levels ?? [];
              const next = cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l];
              onFiltersChange({ ...filters, levels: next.length ? next : undefined });
            }}
          />
        ))}
      </Group>

      {/* Financement */}
      <Group k="funding" icon={<Banknote className="h-4 w-4" />} label={fr ? "Financement" : "Finansman"}>
        {FUNDING_KEYS.map((ft) => (
          <Row
            key={ft}
            checked={(filters.fundingTypes ?? []).includes(ft)}
            count={counts.funding[ft]}
            label={fr ? FUNDING_LABELS[ft].fr : FUNDING_LABELS[ft].ht}
            onChange={() => {
              const cur = filters.fundingTypes ?? [];
              const next = cur.includes(ft) ? cur.filter((x) => x !== ft) : [...cur, ft];
              onFiltersChange({ ...filters, fundingTypes: next.length ? next : undefined });
            }}
          />
        ))}
      </Group>

      {/* Pays */}
      <Group k="country" icon={<Globe className="h-4 w-4" />} label={fr ? "Pays" : "Peyi"}>
        {countries.map((c) => {
          const cl = COUNTRY_LABELS[c];
          return (
            <Row
              key={c}
              checked={(filters.countries ?? []).includes(c)}
              count={counts.countries[c]}
              label={cl ? (fr ? cl.fr : cl.ht) : c}
              onChange={() => {
                const cur = filters.countries ?? [];
                const next = cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c];
                onFiltersChange({ ...filters, countries: next.length ? next : undefined });
              }}
            />
          );
        })}
      </Group>

      {/* Éligibilité */}
      <Group k="eligibility" icon={<ShieldCheck className="h-4 w-4" />} label={fr ? "Éligibilité" : "Elijibilite"} highlight>
        <Row
          checked={(filters.haitianEligibility ?? "all") === "all"}
          count={counts.eligibility.all}
          label={fr ? "Toutes" : "Tout"}
          onChange={() => onFiltersChange({ ...filters, haitianEligibility: "all" })}
        />
        <Row
          checked={filters.haitianEligibility === "yes"}
          count={counts.eligibility.yes}
          label={<span className="inline-flex items-center gap-1">🇭🇹 {fr ? "Éligible" : "Elijib"}</span>}
          onChange={() =>
            onFiltersChange({
              ...filters,
              haitianEligibility: filters.haitianEligibility === "yes" ? "all" : "yes",
            })
          }
        />
      </Group>
    </aside>
  );
}
