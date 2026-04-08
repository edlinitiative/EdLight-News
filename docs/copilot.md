# EdLight News Monorepo — Source of Truth (April 2026)

Goal: Automated content factory for Haitian students. Outputs in French + Haitian Creole. Feeds Website + Instagram + WhatsApp.

## App Architecture

- **apps/web**: Next.js 14 (App Router), TypeScript, Tailwind, deployed on Vercel @ news.edlight.org
- **apps/worker**: Node.js TypeScript service deployed on Cloud Run (24/7 automation)

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

## Dry-run test

```bash
pnpm --filter @edlight-news/worker ig:dry-run
pnpm --filter @edlight-news/worker ig:dry-run -- --type scholarship
```
