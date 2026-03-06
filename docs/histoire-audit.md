# `/histoire` Page Audit — March 2026

## ✅ Strengths
- Editorial hero/secondary split with `pickHeroEntry` scoring
- Full bilingual FR/HT infrastructure (month/day names, labels, tags)
- Sticky WeekStrip with entry-count dots
- Wikipedia image fallback via `useWikiImage` hook
- Holiday banners with cultural context
- "Pourquoi c'est important" student takeaway callout
- ISR + client hydration (revalidate 900 + `getHaitiMonthDayClient`)

---

## 🟡 UX / Interaction Issues
1. **No deep-linking / URL state** — date selection not reflected in URL; can't share/bookmark a specific date
2. **Cards not expandable/tappable** — secondary HistoryCard items are display-only; 2-line clamp hides content with no way to reveal
3. **WeekStrip only ±3 days** — no arrow nav to shift; gap between day-by-day and month-jump (ExplorePanel)
4. **ExplorePanel buried at bottom** — easy to miss; first-time visitors may never discover month exploration
5. **No "jump to today" button** in single-date mode when navigating away
6. **HistoryTabs exported but unused** — "Faits / Personnalités / Fêtes" tabs never rendered

## 🟠 Performance
7. **Wikipedia API waterfall** — every card fires independent fetch to fr.wikipedia.org; module-level cache is per-session only
8. **Month data fetching unbounded** — `ensureMonthLoaded` useCallback depends on `entriesByMonth`, risks unnecessary re-renders
9. **No Suspense boundaries** — failed fetch silently returns empty arrays
10. **revalidate = 900 too aggressive** — content changes only daily (~07:10); 3600+ would suffice

## 🔴 Content / Accessibility
11. **Creole content not rendered** — components hardcode `entry.title_fr` / `entry.summary_fr` even when `lang=ht`
12. **No keyboard/ARIA on WeekStrip** — no role="tablist", no aria-selected, no arrow-key support
13. **Wikipedia images lack descriptive alt text** — just uses `entry.title_fr`
14. **Wiki fallback uses raw `<img>`** — bypasses Next.js Image optimization
15. **No `<time>` semantic elements** — dates are plain text spans

## 🟣 Feature Opportunities
16. Share button per entry/day for organic traffic
17. Timeline / year-axis / era view for deeper educational exploration
18. Text search across historical events
19. Orphaned `HistoireArchive.tsx` (663 lines) — dead code, duplicates logic
20. No progressive enhancement — JS failure = header + initial hero only
21. Verified badge not surfaced to users (only used internally for hero scoring)

---

## Priority Matrix

| Priority | Issue | Impact |
|----------|-------|--------|
| High | No deep-linking / URL state for dates | Shareability, SEO, UX |
| High | Cards not tappable / no detail view | Content hidden behind clamps |
| High | Creole content not actually rendered | Bilingual promise broken |
| Medium | Wikipedia image fetch waterfall | Performance on slower connections |
| Medium | No keyboard/ARIA on WeekStrip | Accessibility compliance |
| Medium | ExplorePanel buried at bottom | Discoverability |
| Medium | No "back to today" in single-date mode | Navigation dead-end |
| Low | Orphaned HistoireArchive component | Code hygiene |
| Low | Missing `<time>` semantic elements | SEO |
| Low | revalidate too aggressive | Edge compute cost |
