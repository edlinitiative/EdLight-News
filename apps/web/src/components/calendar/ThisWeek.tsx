/**
 * ThisWeek — vertical timeline for events in the next 7 days.
 *
 * Items are grouped by date with a circular date bubble on the left.
 * Each group gets an id="cal-day-YYYY-MM-DD" anchor for MiniMonthGrid scroll.
 */

import type { ContentLanguage, CalendarEventType } from "@edlight-news/types";
import {
  FileText,
  GraduationCap,
  ClipboardList,
  BarChart3,
  School,
  Lock,
  Pin,
  Globe,
} from "lucide-react";
import type { CalendarItem } from "./types";
import { getItemTitle, getItemDateISO } from "./types";
import { parseISODateSafe } from "@/lib/deadlines";

// ─── Icon map ─────────────────────────────────────────────────────────────────

const EVENT_ICON: Record<CalendarEventType, React.ReactNode> = {
  exam: <FileText className="h-3.5 w-3.5 text-brand-600" />,
  admissions: <GraduationCap className="h-3.5 w-3.5 text-brand-600" />,
  registration: <ClipboardList className="h-3.5 w-3.5 text-brand-600" />,
  results: <BarChart3 className="h-3.5 w-3.5 text-green-600" />,
  rentree: <School className="h-3.5 w-3.5 text-purple-600" />,
  closure: <Lock className="h-3.5 w-3.5 text-gray-400" />,
};

function itemCategoryLabel(item: CalendarItem, fr: boolean): string {
  if (item.kind === "international") return fr ? "Bourse" : "Bous";
  const map: Record<CalendarEventType, string> = {
    exam: fr ? "Examen" : "Egzamen",
    admissions: fr ? "Admissions" : "Admisyon",
    registration: fr ? "Inscription" : "Enskripsyon",
    results: fr ? "Résultats" : "Rezilta",
    rentree: fr ? "Rentrée" : "Rantre",
    closure: fr ? "Clôture" : "Fèmti",
  };
  return map[item.eventType];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DateGroup {
  dateISO: string;
  date: Date;
  items: CalendarItem[];
}

interface Props {
  items: CalendarItem[];
  lang: ContentLanguage;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ThisWeek({ items, lang }: Props) {
  const fr = lang === "fr";

  if (items.length === 0) return null;

  // Group by date
  const groupMap = new Map<string, DateGroup>();
  for (const item of items) {
    const dateISO = getItemDateISO(item);
    if (!dateISO) continue;
    const date = parseISODateSafe(dateISO);
    if (!date) continue;
    const existing = groupMap.get(dateISO);
    if (existing) {
      existing.items.push(item);
    } else {
      groupMap.set(dateISO, { dateISO, date, items: [item] });
    }
  }

  const groups = [...groupMap.values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  if (groups.length === 0) return null;

  return (
    <section
      aria-label={fr ? "Cette semaine" : "Semèn sa a"}
      className="space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-gray-900">
          {fr ? "Cette semaine" : "Semèn sa a"}
        </h2>
        <span className="rounded-full bg-brand-100 px-2 py-px text-xs font-semibold text-brand-700">
          {items.length}
        </span>
      </div>

      {/* Vertical timeline */}
      <div className="relative pl-14">
        {/* Connecting line */}
        <div
          aria-hidden
          className="absolute left-5 top-0 h-full w-px bg-gray-200"
        />

        <div className="space-y-2">
          {groups.map((group) => {
            const dayStr = group.date
              .toLocaleDateString(fr ? "fr-FR" : "fr-HT", { weekday: "short" })
              .slice(0, 3);
            const dayNum = group.date.getDate();
            const monStr = group.date
              .toLocaleDateString(fr ? "fr-FR" : "fr-HT", { month: "short" })
              .slice(0, 3);

            return (
              <div
                key={group.dateISO}
                id={`cal-day-${group.dateISO}`}
                className="relative"
              >
                {/* Date bubble */}
                <div
                  aria-hidden
                  className="absolute -left-14 top-1 flex h-11 w-11 flex-col items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"
                >
                  <span className="text-[9px] uppercase leading-none">
                    {dayStr}
                  </span>
                  <span className="text-sm font-bold leading-tight">
                    {dayNum}
                  </span>
                  <span className="text-[8px] uppercase leading-none opacity-75">
                    {monStr}
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-1.5">
                  {group.items.map((item) => {
                    const title = getItemTitle(item);
                    const isHaiti = item.geo === "Haiti";
                    const isHaitianAudience =
                      item.audience === "HaitianStudents";
                    const icon =
                      item.kind === "haiti"
                        ? (EVENT_ICON[item.eventType] ?? (
                            <Pin className="h-3.5 w-3.5 text-gray-400" />
                          ))
                        : (
                            <Globe className="h-3.5 w-3.5 text-emerald-600" />
                          );

                    return (
                      <div
                        key={item.id}
                        className="rounded-md border border-gray-100 bg-white px-3 py-2 transition-colors hover:border-gray-200 hover:bg-gray-50"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 flex shrink-0">{icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">
                              {title}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-gray-400">
                                {itemCategoryLabel(item, fr)}
                              </span>
                              <span
                                className={[
                                  "rounded-full px-1.5 py-px text-[10px] font-medium",
                                  isHaiti
                                    ? "bg-brand-50 text-brand-600"
                                    : "bg-emerald-50 text-emerald-700",
                                ].join(" ")}
                              >
                                {isHaiti ? (fr ? "Haïti" : "Ayiti") : "Intl"}
                              </span>
                              {isHaitianAudience && !isHaiti && (
                                <span className="rounded-full bg-violet-50 px-1.5 py-px text-[10px] font-medium text-violet-600">
                                  {fr ? "Pour Haïti" : "Pou Ayiti"}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
