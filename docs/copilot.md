# EdLight News Monorepo — Source of Truth (April 2026)

Goal: Automated content factory for Haitian students. Outputs in French + Haitian Creole. Feeds Website + Instagram + WhatsApp.

## App Architecture

- **apps/web**: Next.js 14 (App Router), TypeScript, Tailwind, deployed on Vercel @ news.edlight.org
- **apps/worker**: Node.js TypeScript service deployed on Cloud Run (scale-to-zero). Triggered by Cloud Scheduler every 15 min. GHA pipeline.yml kept as manual fallback.

## Packages

- **packages/types**: TypeScript interfaces + zod schemas for Firestore docs
- **packages/firebase**: Firebase Admin init + typed repositories
- **packages/scraper**: RSS + HTML scraping + dedupe
- **packages/generator**: LLM prompts + FR/HT generation
- **packages/renderer**: Playwright HTML→image (IG carousel)
- **packages/publisher**: queue publishing (IG + WhatsApp)

## Firestore Collections

| Collection | Purpose |
|---|---|
| sources | RSS/HTML source definitions |
| raw_items | Scraped raw content (deduped by hash) |
| items | Normalized, classified articles |
| content_versions | FR + HT + web + ig + wa versions |
| assets | Generated image assets |
| publish_queue | IG publishing queue (legacy) |
| ig_queue | Active IG pipeline queue |
| metrics | Analytics |
| newsletter_signups | Email subscriber list |

## Worker Pipeline (/tick)

1. Ingest sources (RSS + HTML)
2. Store raw_items (dedupe by hash)
3. Normalize + classify into items
4. Generate content_versions for web/ig/wa in FR+HT
5. Generate IG assets (Playwright screenshot templates)
6. Enqueue ig_queue entries
7. Process scheduled IG posts

## Quality Gates

- No source URL → never auto-publish (draft only)
- Opportunities require deadline OR mark as evergreen; if missing/unclear → draft only
- Low confidence → draft only
- Always store citations (source name + URL) in content_versions

## Website Pages (all live)

| Route | Status | Description |
|---|---|---|
| / | ✅ Live | Homepage: Hero + Latest + Opportunities + Category blocks + Editor's Picks + Newsletter |
| /news | ✅ Live | Full news feed with category filters + search |
| /news/[id] | ✅ Live | Article detail: hero, meta, body, share, source, related, next/prev, author block |
| /opportunites | ✅ Live | Opportunities feed with filters |
| /bourses | ✅ Live | Full scholarship DB with filter bar, deadline board, parcours |
| /haiti | ✅ Live | Haiti-specific news category |
| /world | ✅ Live | World news category |
| /education | ✅ Live | Education news category |
| /business | ✅ Live | Business/economy news category |
| /technology | ✅ Live | Technology news category |
| /explainers | ✅ Live | Explainers + analysis category |
| /histoire | ✅ Live | Aujourd'hui dans l'histoire d'Haïti |
| /calendrier | ✅ Live | Scholarship deadline calendar |
| /calendrier-haiti | ✅ Live | Haiti academic calendar |
| /closing-soon | ✅ Live | Opportunities closing soon |
| /parcours | ✅ Live | Country path explorer |
| /universites | ✅ Live | University browser |
| /ressources | ✅ Live | Resources hub |
| /succes | ✅ Live | Success stories |
| /search | ✅ Live | Full-text + category search page |
| /about | ✅ Live | About page |
| /editorial-standards | ✅ Live | Editorial standards |
| /contact | ✅ Live | Contact page (also used for partner inquiries) |
| /privacy | ✅ Live | Privacy policy |
| /terms | ✅ Live | Terms of use |
| /admin | ✅ Live | Admin panel (protected) |
| /admin/ig-queue | ✅ Live | IG queue management UI |

## Navigation Structure

Primary nav: Actualités · Opportunités · Haïti · Monde · Éducation · Business · Techno
Secondary nav: Explainers · Bourses · À propos
Footer: Coverage links · Opportunity links · Company links (+ Partenariats)
Mobile: Bottom nav bar

## Instagram Pipeline

ig_queue status flow: queued → scheduled → rendering → posted

Daily schedule (Haiti time, America/Port-au-Prince):
- 06:30 — taux du jour (pinned staple)
- 06:50 — fait du jour / utility (pinned staple)
- 07:00 — histoire (pinned staple)
- 08:30, 10:00, 11:30, 14:00, 16:00, 18:00, 20:00 — regular slots

Daily cap: 8 posts (10 if urgent score ≥ 90). Per-type caps: scholarship 2, opportunity 2, taux 1.
Quiet hours: 23:00–05:29 Haiti time — no scheduling.
Morning briefing IG Story: 05:30–09:59 window.

Selection scores:
- scholarship=70, opportunity=65, utility=55, histoire=50, news=45
- Bonuses: deadline urgency (+8–25), audience fit (up to +15), official source (+5)
- Penalties: weak source (-10), dedupe group recently posted (-20)

5 templates: scholarship, opportunity, news, histoire, utility

IG env vars:
- IG_ACCESS_TOKEN: Meta Graph API long-lived token
- IG_USER_ID: Instagram Business Account ID
- Without these → dry-run mode

## Website Feature Status

### Shipped (April 2026)

- Bilingual FR/HT toggle
- Dark mode
- Premium homepage with editorial hierarchy
- Full article page with reading time, share buttons, next/prev nav, author attribution
- Opportunities hub with advanced filtering (/bourses)
- Scholarship deadline calendar
- /histoire — Haitian history feature
- Admin IG queue UI
- SEO: OG tags, JSON-LD NewsArticle, sitemap, robots.txt
- TauxDuJourWidget (BRH exchange rate)
- Newsletter email signup (stores to Firestore newsletter_signups)
- Full search page (/search) with text + category filters
- "Partner With Us" contact link in footer

### Planned / Nice-to-Have

- User bookmarks
- Trending / most-read (view count tracking)
- Push notifications
- Personalized feeds
- Reading time analytics
- Contributor profiles
- Community submissions
- Opinion / Insights section

---

## Roadmap — Next Steps (April 2026)

Prioritized backlog. None of the below has been implemented yet.

---

### 1. Trending / Most-Read Module

**Priority:** High
**Effort:** Low
**Impact:** Homepage engagement, repeat visits

**What:**
Track page views per article and surface the top-performing posts in a "Trending" block on the homepage and `/news` feed.

**How:**
- On each article page load, increment a Firestore counter on `items/{id}` using a lightweight server action or API route (not a full analytics SDK — keep it simple)
- Add a `viewCount: number` field to the `Item` type in `packages/types/src/models.ts`
- In `apps/web/src/lib/content.ts`, add a `fetchTrending(lang, limit)` function that queries Firestore ordered by `viewCount` descending
- Render a `<TrendingSection>` server component on the homepage (below Latest News, above Opportunities) and in the `/news` sidebar
- No auth required — anonymous increment is fine for v1

**Files to touch:**
- `packages/types/src/models.ts` — add `viewCount` field
- `apps/web/src/app/news/[id]/page.tsx` — fire increment on load
- `apps/web/src/lib/content.ts` — add `fetchTrending()`
- `apps/web/src/app/page.tsx` — add `<TrendingSection>`
- `apps/web/src/components/TrendingSection.tsx` — new component

---

### 2. User Bookmarks

**Priority:** High
**Effort:** Low–Medium
**Impact:** Repeat visits, session depth, user retention

**What:**
Allow users to save articles to a personal reading list, persisted in `localStorage`. No login required for v1.

**How:**
- Store an array of article IDs in `localStorage` under key `edlight_bookmarks`
- Add a `<BookmarkButton>` client component (heart/bookmark icon) to article cards and the article detail page header
- Add a `/saved` page (`apps/web/src/app/saved/page.tsx`) that reads from localStorage and fetches the matching articles from Firestore
- Hydration-safe: render nothing on SSR, populate on mount

**Files to touch:**
- `apps/web/src/components/BookmarkButton.tsx` — new client component
- `apps/web/src/app/news/[id]/page.tsx` — add `<BookmarkButton>` to header
- `apps/web/src/components/ArticleCard.tsx` — add bookmark toggle
- `apps/web/src/app/saved/page.tsx` — new page
- `apps/web/src/lib/bookmarks.ts` — localStorage helpers (getBookmarks, addBookmark, removeBookmark, isBookmarked)

---

### 3. ~~Dry-Run Script~~ — Deleted ✅

`apps/worker/src/scripts/igDryRun.ts` was deleted (commit after 1706024). It pre-dated the ig-engine rewrite, produced HTML stubs instead of real PNGs, and never called `renderWithIgEngine`. The full production path is already testable via:

```bash
pnpm --filter @edlight-news/worker ig:test-publish
```

`igTestPublish.ts` calls `renderWithIgEngine` → Playwright PNGs → Storage → IG publish. That's the real test.

---

### 4. WhatsApp Publishing

**Priority:** Medium
**Effort:** Medium
**Impact:** Opens a new distribution channel for the same content already being generated

**What:**
The architecture doc (`docs/copilot.md`) lists WhatsApp as a target output channel alongside Instagram. `packages/publisher` exists but WhatsApp output has not been wired end-to-end or validated.

**How:**
- Audit `packages/publisher/src/index.ts` to confirm WhatsApp send logic exists or stub it
- Wire a `wa_queue` Firestore collection (similar to `ig_queue`) with status flow: `queued → scheduled → sending → sent`
- Add a worker job `processWaScheduled` in `apps/worker/src/jobs/`
- WhatsApp Business API (Meta Graph): use the same token infrastructure as IG. Message format: text caption + image URL (from Storage)
- Add admin UI tab for WA queue (mirror of `/admin/ig-queue`)

**Files to touch:**
- `packages/publisher/src/index.ts` — add `publishToWhatsApp()`
- `packages/types/src/models.ts` — add `WaQueueItem` type
- `apps/worker/src/jobs/processWaScheduled.ts` — new job
- `apps/worker/src/index.ts` — register job in `/tick`
- `apps/web/src/app/admin/wa-queue/` — new admin page

---

### 5. Opinion / Insights Section

**Priority:** Medium
**Effort:** Medium
**Impact:** New content type, increases editorial depth and credibility

**What:**
A distinct content category (`/opinion`) for analysis, commentary, and perspective pieces. Visually differentiated from hard news — byline-prominent, pull-quote-forward layout.

**How:**
- Add `post_type: "opinion"` to the `PostType` union in `packages/types/src/models.ts`
- Add `/opinion` route with its own feed page (`apps/web/src/app/opinion/page.tsx`)
- In the article detail page, detect `post_type === "opinion"` and render an alternate header: larger author block, "Opinion" label, pull-quote component
- Add "Opinion" to primary nav (or secondary nav under Explainers)
- Generator: add a new opinion tone/prompt variant in `packages/generator/src/editorial-tone.ts`

**Files to touch:**
- `packages/types/src/models.ts` — add `"opinion"` to `PostType`
- `apps/web/src/app/opinion/page.tsx` — new feed page
- `apps/web/src/app/news/[id]/page.tsx` — opinion-specific layout branch
- `apps/web/src/components/OpinionHeader.tsx` — new component
- `apps/web/src/app/layout.tsx` — add Opinion to nav
- `packages/generator/src/editorial-tone.ts` — opinion tone variant

---

### 6. Contributor Profiles

**Priority:** Low–Medium
**Effort:** Medium
**Impact:** Credibility, trust, author discoverability

**What:**
Author detail pages at `/auteur/[slug]` showing bio, photo, and article history. Author names on article cards and detail pages become clickable links.

**How:**
- Add a `contributors` Firestore collection with fields: `slug`, `name`, `bio`, `photoUrl`, `role`, `socialLinks`
- Add `authorSlug` field to `Item` type in `packages/types`
- Create `apps/web/src/app/auteur/[slug]/page.tsx` — fetch contributor + all their articles
- Update article cards and article detail headers to link author names to `/auteur/[slug]`
- Add contributor management to the admin panel

**Files to touch:**
- `packages/types/src/models.ts` — add `Contributor` type, `authorSlug` to `Item`
- `packages/firebase/src/repositories/` — add `ContributorRepository`
- `apps/web/src/app/auteur/[slug]/page.tsx` — new page
- `apps/web/src/components/AuthorBlock.tsx` — make author name a link
- `apps/web/src/app/admin/contributors/` — new admin section

## Key Code Conventions

- Server components for data fetching (Firestore reads)
- Client components for interactivity (filters, search, language toggle)
- `fetchEnrichedFeed(lang, limit)` → main content feed function (apps/web/src/lib/content.ts)
- `rankFeed(items, options)` → ranking + dedup (apps/web/src/lib/ranking.ts)
- All routes support `?lang=ht` for Haitian Creole
- `withLangParam(href, lang)` utility for language-aware links
- `buildOgMetadata()` for consistent SEO

## Environment Variables (web)

- NEXT_PUBLIC_* — client-side config
- Firebase Admin credentials (server-only)
- GEMINI_API_KEY — for AI image generation

## Pipeline scheduling

Cloud Scheduler → Cloud Run is the PRIMARY runner (every 15 min, reliable).
GitHub Actions (`pipeline.yml`) is kept as a manual-dispatch fallback.

Infra:
- Cloud Run: `edlight-news-worker` in `us-central1`, scale-to-zero, 2Gi, auth-required
- Cloud Scheduler: `edlight-news-pipeline`, `*/15 * * * *` Haiti TZ, OIDC auth
- Deploy workflow: `.github/workflows/deploy-worker.yml` — builds Docker, pushes to Artifact Registry, deploys, upserts scheduler
- GHA fallback: `.github/workflows/pipeline.yml` — manual dispatch only (no cron)

## End-to-end test

```bash
pnpm --filter @edlight-news/worker ig:test-publish
```
