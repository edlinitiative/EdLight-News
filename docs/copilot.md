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

Implementation constraints:
- Clean modular code: services, repositories, models
- Strong typing everywhere; validate with zod at boundaries
- Use Firestore as single source of truth