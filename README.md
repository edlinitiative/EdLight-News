# EdLight-News

Automated content factory for Haitian students — scholarships, news, opportunities, and resources in French + Haitian Creole.

## Architecture

```
apps/
  web/          Next.js 14 (App Router) — Vercel
  worker/       Express API on Cloud Run (scale-to-zero)

packages/
  types/        TypeScript interfaces + Zod schemas
  firebase/     Firebase Admin SDK + typed repositories
  scraper/      RSS + HTML scraping + dedupe
  generator/    Gemini LLM prompts + FR/HT content generation
  renderer/     Playwright branded cards + article screenshots
  publisher/    Queue publishing (IG + WhatsApp)
```

## Pipeline

`POST /tick` runs the full pipeline in 5 steps:

1. **Ingest** — fetch RSS + HTML sources → `raw_items` (deduped by hash)
2. **Process** — classify, extract, normalize → `items` (with publisher image if confidence ≥ 0.6)
3. **Generate** — Gemini creates `content_versions` (FR + HT, web/ig/wa channels)
4. **Publish** — auto-publish drafts that pass all quality gates
5. **Images** — 4-tier fallback pipeline for article images:
   - **Publisher** (og:image / twitter:image / JSON-LD) — set in step 2 if confidence ≥ 0.6
   - **Wikidata** — portrait for public personalities detected in title (P18 image, licensed)
   - **Branded card** — EdLight-styled gradient card (1200×630 landscape)
   - **Screenshot** — smart article element capture (hero img → article container → viewport crop)

## Scheduling (⚠️ READ BEFORE CHANGING)

The pipeline runs every **~15 minutes at zero cost** using two free-tier services staggered together:

```
:00  GitHub Actions    pipeline.yml runs runPipeline.ts directly in GHA runner
:15  Cloud Scheduler   POST /tick → Cloud Run (scale-to-zero, OIDC auth)
:30  GitHub Actions    pipeline.yml again
:45  Cloud Scheduler   POST /tick → Cloud Run again
```

| Trigger | Schedule | Where it runs | Config file |
|---------|----------|---------------|-------------|
| **GitHub Actions** | `0,30 * * * *` | GHA Ubuntu runner (checkout → build → `runPipeline.ts`) | `.github/workflows/pipeline.yml` |
| **Cloud Scheduler** | `15,45 * * * *` | Cloud Run `POST /tick` endpoint | `.github/workflows/deploy-worker.yml` |

### ⚠️ Rules — do not break the scheduling

1. **Cloud Scheduler MUST stay at `15,45 * * * *`** — never `*/15`. Using `*/15` fires at `:00/:15/:30/:45` which overlaps with GitHub Actions at `:00` and `:30`, causing double runs and extra cost.
2. **No internal cron in `index.ts`** — the worker is a passive HTTP server. Cloud Scheduler and GHA are the only triggers. An internal `setInterval` would race with the Scheduler `/tick` when the instance wakes up, processing the same items twice.
3. **Both triggers are needed** — GHA runs at `:00/:30` for free (within the GHA free-tier minutes). Cloud Scheduler runs at `:15/:45` for free (3 free jobs on GCP). Together = 15-min cadence at $0/month.

## Infrastructure

| Service | Details |
|---------|---------|
| **GCP Project** | `edlight-news`, region `us-central1` |
| **Cloud Run** | `edlight-news-worker`, min-instances=0, max=1, 1Gi RAM |
| **Cloud Run SA** | `firebase-adminsdk-fbsvc@edlight-news.iam.gserviceaccount.com` (ADC) |
| **Cloud Scheduler SA** | `cloud-scheduler-invoker@edlight-news.iam.gserviceaccount.com` (OIDC) |
| **Firestore** | Project `edlight-news` |
| **Storage** | Bucket `edlight-news.firebasestorage.app` (uniform bucket-level access) |
| **Web** | Vercel, Next.js 14 |

## Image Pipeline Details

### Image Sources (`ImageSource` type)

| Source | When | Confidence | Attribution |
|--------|------|-----------|-------------|
| `publisher` | og:image / twitter:image / JSON-LD with confidence ≥ 0.6 | 0.6–1.0 | Source name |
| `wikidata` | Public personality detected in title + P18 image found | 0.85 | Artist + license from Wikimedia Commons |
| `branded` | Always available fallback — EdLight gradient card | 1.0 | None |
| `screenshot` | Last resort — Playwright captures article element | 0.4 | Source name |

### Scraper Image Extraction

`extractCandidateImages()` uses 5 strategies ranked by `scoreHint`:

1. **og:image** (0.95–0.91)
2. **twitter:image** (0.90–0.88)
3. **link rel="image_src"** (0.85)
4. **JSON-LD schema.org** (0.87)
5. **Article body images + srcset** (0.55–0.65, boosted by width heuristics)

`pickBestImage()` applies heuristic bonuses (size keywords, srcset width ≥ 800) and penalties (URL length > 500). Junk images (avatars, icons, logos, tracking pixels) are filtered.

### Wikidata Person Detection

`detectPersonName()` matches French/Creole title patterns:
- Triggers: "Le président X", "Le ministre X", "Dr. X", "Prof. X", "Le sénateur X", etc.
- Also detects "First Last" capitalized patterns before punctuation
- Only for categories: `news`, `local_news`, `scholarship`, `event`

`fetchWikidataImage()`: searches Wikidata → verifies P31=Q5 (human) → extracts P18 → fetches Commons license.

## Development

```bash
pnpm install
pnpm turbo build          # build all 8 packages

# Manual tick (local)
cd apps/worker && npx tsx src/scripts/runPipeline.ts

# Trigger Cloud Scheduler manually
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
gcloud scheduler jobs run edlight-news-pipeline --location=us-central1

# Check Cloud Run logs
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="edlight-news-worker"' \
  --project=edlight-news --limit=30 --format="value(textPayload)" --freshness=10m
```

## Environment Variables

### Cloud Run (set in deploy-worker.yml)
- `FIREBASE_PROJECT_ID` — GCP project ID
- `GEMINI_API_KEY` — Google Gemini API key
- `FIREBASE_STORAGE_BUCKET` — Storage bucket name
- `PROCESS_BATCH_LIMIT` — Max items to process per tick (default: 15)
- `IMAGE_BATCH_LIMIT` — Max images to generate per tick (default: 5)

### GitHub Actions pipeline.yml
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — Firebase Admin SA credentials
- `GEMINI_API_KEY`, `FIREBASE_STORAGE_BUCKET`