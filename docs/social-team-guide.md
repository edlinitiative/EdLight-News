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

---

## 6. Reels review

Sandra-voiced Instagram Reels are generated daily by the worker (gated by
`REELS_ENABLED=true`) and queued at
[`/admin/reels-pending`](/admin/reels-pending) for human review **before** they
go live. The full style + voice contract is in
[docs/reels-style-guide.md](./reels-style-guide.md).

### Daily flow

1. **Worker generates** — at most 1 Reel per Haiti-day, capped at $1.00 of
   combined LLM + TTS + STT cost. Picks the top-scoring item from the
   topic preference order
   `scholarship → histoire → opportunity → taux → fact → news`.
2. **You review** at `/admin/reels-pending`:
   - Watch the embedded MP4 (1080×1920, ≤ 30 s).
   - Read Sandra's voiceover script — verify no invented stats, correct
     dates, no editorializing.
   - Read the IG caption — copy with the **Copy** button if you'll paste it
     unchanged, or rewrite it before posting.
   - If anything is off, click **Reject** and enter a reason. The slot
     re-opens for tomorrow.
   - If it's good, click **Approve**. Status flips to `approved` and the
     download link unlocks.
3. **You post manually** from the Instagram app:
   - Download the MP4 from the dashboard.
   - Open IG → Create → Reel → upload the MP4.
   - **Pick a trending audio track** (this is the whole reason we don't
     auto-publish in v1 — Reels reach is dominated by trending audio).
   - Paste the caption.
   - Publish, then copy the post URL.
4. **You paste the URL back** into the dashboard's "Mark posted" form. The
   shortcode is parsed and stored as `igMediaId`; the metrics worker takes
   over from there.
5. **Metrics auto-sync**: every 2 h for the first 24 h, then every 12 h
   through day 7, then daily through day 60. Watch-completion rate appears
   in the **Leaderboard** section, and high performers feed
   `reelEngagementBoost` back into the editorial scorer.

### Common rejection reasons

- "Invented a stat the source didn't have" — re-prompt issue, file a ticket.
- "Wrong template for the topic" — `pickTemplate` heuristics may need a
  tune (deterministic per source-item id, so re-running won't change it).
- "Sandra's voiceover ran > 28 s" — script length cap drift; check
  `generateReelScript` word-count.
- "Footage didn't match" — Pexels query needs better keywords; falls back
  to brand stock if no good match.

### Where things live

| What | Where |
|---|---|
| Reels worker job | [apps/worker/src/jobs/buildReelsQueue.ts](../apps/worker/src/jobs/buildReelsQueue.ts) |
| Reels generation | [packages/reels-generator](../packages/reels-generator) |
| Sandra voice | [packages/sandra-voice](../packages/sandra-voice) |
| Pending repo | [packages/firebase/src/repositories/reels-pending.ts](../packages/firebase/src/repositories/reels-pending.ts) |
| Admin UI | [apps/web/src/app/admin/reels-pending/page.tsx](../apps/web/src/app/admin/reels-pending/page.tsx) |
| Metrics sync | [apps/worker/src/jobs/pullSocialMetrics.ts](../apps/worker/src/jobs/pullSocialMetrics.ts) (Reels section) |
| Performance alert | [apps/worker/src/jobs/monitorSocial.ts](../apps/worker/src/jobs/monitorSocial.ts) (`reelPerformanceDecline`) |
