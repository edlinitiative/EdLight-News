# Social Team Guide

A practical guide for the EdLight social team to read, debug, and tune the
auto-distribution pipeline (FB, Instagram, Threads, X, WhatsApp).

> ⚠️ **Cold-start mode active?** When `COLD_START_MODE=true` on the worker
> the cadences in this doc are overridden by a much smaller schedule
> (2 IG / 1 FB / 4 Threads / 2 X / 1 WhatsApp per day). The growth
> features (hashtag rotation, cross-platform CTAs, story stickers,
> metrics feedback) are also OFF. **Read [docs/content-calendar.md](content-calendar.md)
> first** — it is the source of truth during cold-start. Exit when IG
> followers ≥ 500.

## 1. The dashboard

`/admin/social-metrics` (Next.js admin app) is the single pane of glass.

- **Top row** — three cards (Facebook / Threads / X) showing posts with
  metrics over the last 72 hours, total reach, total engagement, and the
  individual top posts ranked by reach.
- **Bottom section** — three A/B hook performance tables (one per platform).
  Variants need at least 5 posts in the rolling window to appear; we want
  signal, not noise.

A "winner" badge highlights the best-performing variant per platform once at
least 3 posts of that variant exist.

## 2. Reading a hookVariant string

Hook variants are short identifiers stamped on each queued post. Examples:

- `fb-scholarship-question-2-wa` — Facebook, scholarship hook variant
  "question #2", with the WhatsApp-channel CTA appended (50% rotation).
- `th-opportunity-v1-rot` — Threads, opportunity hook v1, with rotating
  hashtag pool (set when `HASHTAG_ROTATION=true`).
- `x-news-v1-cta` — X, news hook v1, with the Threads cross-promotion line
  enabled (`X_THREADS_CTA=true`).

Suffixes you'll see:

| Suffix | Meaning |
|---|---|
| `-rot` | This post used the rotating hashtag pool |
| `-cta` | This post included a cross-platform CTA (X → Threads) |
| `-wa`  | This Facebook post included the WhatsApp channel CTA |

## 3. Feature flags cheat sheet

See [SOCIAL_GROWTH_CHANGELOG.md](./SOCIAL_GROWTH_CHANGELOG.md) for the full
list. The most common knobs:

```bash
# Turn on the metrics feedback loop
SOCIAL_METRICS_FEEDBACK=true

# Turn on hashtag rotation (FB / Th / X / WA / IG all use this single flag)
HASHTAG_ROTATION=true

# Turn on diaspora-aware IG posting hours
IG_DIASPORA_HOURS=true

# Add Threads handle to X posts
X_THREADS_CTA=true
THREADS_HANDLE=@edlightnews

# Add IG handle to WhatsApp posts
WA_IG_CTA=true
IG_HANDLE=@edlightnews

# Add WhatsApp channel link to ~50% of Facebook posts
FB_WA_CTA=true
WA_CHANNEL_URL=https://chat.whatsapp.com/xxxxxxxxxxxxxxxx

# Enable IG Story link + poll stickers (best-effort; degrades gracefully)
IG_STORY_FEATURES=true
```

Update flags via:

```bash
gh secret set HASHTAG_ROTATION --body "true"
# then redeploy the worker (Cloud Run) for the new env to take effect
```

## 4. Common questions

**A new variant isn't appearing on the dashboard.**
The per-platform tables hide variants with fewer than 5 posts in the last 72h.
Wait for more volume or temporarily lower the filter in
[apps/web/src/app/api/admin/social-metrics/route.ts](../apps/web/src/app/api/admin/social-metrics/route.ts).

**An IG Story published without the link sticker.**
Search the worker logs for `igStoryFeatureSkipped`. The IG Graph API quietly
rejects link/poll stickers on some account types; the publisher logs the
reason and falls back to a plain story so we never lose a publish.

**A Facebook post is missing the WhatsApp CTA.**
By design — `FB_WA_CTA` rotates 50/50 deterministically using the post's
`dedupeGroupId`, so we can A/B-test the CTA's lift without spamming readers.

**The smoke test is red on a PR.**
Run it locally:

```bash
pnpm tsx scripts/smoke-social.ts
```

The script blanks out every social token, runs the publishers in dry-run
mode against fake queue items, and asserts that no outbound HTTP calls are
made. A red run almost always means a credential check was accidentally
removed from a publisher.

## 5. Where things live

| What | Where |
|---|---|
| Per-platform queue builders | [apps/worker/src/jobs/build*Queue.ts](../apps/worker/src/jobs/) |
| Per-platform processors (publishers) | [apps/worker/src/jobs/process*.ts](../apps/worker/src/jobs/) |
| Hashtag pools | [apps/worker/src/services/hashtags.ts](../apps/worker/src/services/hashtags.ts) |
| Hook variant generators | [apps/worker/src/jobs/buildFbQueue.ts](../apps/worker/src/jobs/buildFbQueue.ts) (`pickScholarshipHook`, `pickOpportunityHook`) |
| Engagement boost scorer | [packages/generator/src/opportunityScoring.ts](../packages/generator/src/opportunityScoring.ts) |
| IG Story sticker overlay | [packages/publisher/src/index.ts](../packages/publisher/src/index.ts) (`publishIgStory`) |
| Admin dashboard | [apps/web/src/app/admin/social-metrics/page.tsx](../apps/web/src/app/admin/social-metrics/page.tsx) |
