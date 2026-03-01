# EdLight News Monorepo Spec (source of truth)

Goal: Automated content factory for Haitian students. Outputs in French + Haitian Creole. Feeds Website + Instagram + WhatsApp.

Apps:
- apps/web: Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui, deployed on Vercel
- apps/worker: Node.js TypeScript service deployed on Cloud Run (24/7 automation)

Packages:
- packages/types: TypeScript interfaces + zod schemas for Firestore docs
- packages/firebase: Firebase Admin init + typed repositories
- packages/scraper: RSS + HTML scraping + dedupe
- packages/generator: LLM prompts + FR/HT generation
- packages/renderer: Playwright HTML->image (IG carousel)
- packages/publisher: queue publishing (IG + WhatsApp)

Firestore collections:
sources
raw_items
items
content_versions
assets
publish_queue
metrics

Worker endpoint:
POST /tick
Runs in small batches:
1) ingest sources (RSS + HTML)
2) store raw_items (dedupe by hash)
3) normalize + classify into items
4) generate content_versions for web/ig/wa in FR+HT
5) generate IG assets (Playwright screenshot templates)
6) enqueue publish_queue entries
7) publish due queue entries

Quality gates (must enforce):
- No source URL => never auto-publish (draft only)
- Opportunities require deadline OR mark as evergreen; if missing/unclear => draft only
- Low confidence => draft only
- Always store citations (source name + URL) in content_versions

Frontend:
- /news feed
- /news/[id] detail
- Language toggle: FR | KREYÒL
- SEO metadata (title, description, canonical)

Instagram pipeline:
Step 10 of /tick (non-critical; errors logged, don't fail tick):
1. buildIgQueue – evaluates recent items (72h), runs IG selection logic, inserts to ig_queue
2. scheduleIgPost – picks highest-score queued item, schedules for next slot (12:30 or 19:00 Haiti time)
3. processIgScheduled – renders carousel assets, uploads to Storage, publishes via IG Graph API

IG selection logic (packages/generator/src/ig/selection.ts):
- Pure functions: decideIG(item) → IGDecision, applyDedupePenalty()
- Base scores: scholarship=70, opportunity=65, utility=55, histoire=50, news=45
- Bonuses: deadline urgency (+8 to +25), audience fit (up to +15), official source (+5)
- Penalties: weak source (-10), dedupe group recently posted (-20)
- News requires audienceFitScore ≥ 0.5 or ≥ 2 student-relevance markers

IG formatters (packages/generator/src/ig/formatters/):
- 5 templates: scholarship, opportunity, news, histoire, utility
- Each produces IGFormattedPayload { slides: IGSlide[], caption: string }

Firestore collection: ig_queue
- Status flow: queued → scheduled → rendering → posted (or scheduled_ready_for_manual for dry-run)
- Repository: packages/firebase/src/repositories/ig-queue.ts

Storage: carousel slides uploaded to ig_posts/{queueItemId}/slide_N.png

Admin UI: /admin/ig-queue (count cards, filterable table, expandable detail rows)
API route: /api/admin/ig-queue (GET, returns items + counts)

Environment variables for live IG posting:
- IG_ACCESS_TOKEN: Meta Graph API long-lived token
- IG_USER_ID: Instagram Business Account ID
- Without these, pipeline runs in dry-run mode (saves manifests to /tmp/ig_exports/)

Dry-run test:
  pnpm --filter @edlight-news/worker ig:dry-run
  pnpm --filter @edlight-news/worker ig:dry-run -- --type scholarship

Implementation constraints:
- Clean modular code: services, repositories, models
- Strong typing everywhere; validate with zod at boundaries
- Use Firestore as single source of truth