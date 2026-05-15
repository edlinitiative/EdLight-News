# Social Growth Changelog

All P1–P4 social-distribution sprints, plus the post-P4 followup, with the
feature flags they introduce. **Every new flag defaults to `false` on first
deploy** — set it explicitly on Cloud Run to opt in.

## P1 — Format parity (PR #62)

| Capability | Default | Flag(s) |
|---|---|---|
| FB photo + first-comment link | always on | — |
| Threads self-reply with article link | on | `TH_LINK_REPLY` (set to `false` to revert to inline link) |
| X media upload (image attached to tweet) | always on | — |

## P2 — Engagement metrics pull (PR #63)

| Capability | Default | Flag(s) |
|---|---|---|
| Pull FB / Threads / X engagement metrics into Firestore | off | `SOCIAL_METRICS_FEEDBACK=true` |

## P3 — Hashtag rotation, cadence, retries (PR #63)

| Capability | Default | Flag(s) |
|---|---|---|
| Rotating per-topic hashtag pools (FB / Th / X / WA) | off | `HASHTAG_ROTATION=true` |
| Diaspora-aware IG posting hours | off | `IG_DIASPORA_HOURS=true` |
| X → Threads cross-platform CTA in tweet body | off | `X_THREADS_CTA=true`, `THREADS_HANDLE=@handle` |

## P4 — Engagement loop & A/B (PR #64)

| Capability | Default | Flag(s) |
|---|---|---|
| Feedback loop: high-performing posts boost related items' priority score | always on (no-op until metrics exist) | uses `SOCIAL_METRICS_FEEDBACK` data |
| FB hook A/B variants captured per post | always on | — |
| Admin dashboard `/admin/social-metrics` (FB hook table) | always on | — |

## P4 followup (this PR)

| Capability | Default | Flag(s) |
|---|---|---|
| `hookVariant` captured on Threads & X posts | always on | — |
| Per-platform A/B hook tables on the admin dashboard (min 5 posts/variant) | always on | — |
| Cross-platform `socialEngagementBoostMulti` (FB+Th+X consistency bonus, capped at 20) | always on | — |
| Instagram caption hashtag rotation (6 deterministic tags) | off | `HASHTAG_ROTATION=true` (same flag as P3) |
| WhatsApp → Instagram CTA (`📸 Plis sou Instagram : @handle`) | off | `WA_IG_CTA=true`, `IG_HANDLE=@handle` |
| Facebook → WhatsApp channel CTA (50% rotation by `dedupeGroupId`) | off | `FB_WA_CTA=true`, `WA_CHANNEL_URL=https://chat.whatsapp.com/...` |
| IG Stories link sticker + poll sticker overlay (best-effort) | off | `IG_STORY_FEATURES=true` |

### IG Stories sticker behaviour

When `IG_STORY_FEATURES=true`, [buildIgStory.ts](../apps/worker/src/jobs/buildIgStory.ts)
populates `IGStoryQueueItem.storyFeatures` based on the morning briefing's
contents:

- Always: `linkUrl` → `https://news.edlight.org`, `ctaText` → "Lire toutes les nouvelles"
- If briefing contains a scholarship item: poll "Tu postules à une bourse cette année ?" / "Oui 🎓" vs "Pas encore"
- Else if briefing contains an opportunity item: poll "Quelle opportunité t'intéresse le plus ?" / "Emploi" vs "Formation"

[publishIgStory](../packages/publisher/src/index.ts) attempts the stickered
container first; on rejection it logs `igStoryFeatureSkipped: <reason>` and
retries without stickers so the underlying story still publishes.

## Operational notes

- All flags can be flipped without a redeploy (Cloud Run env vars are read at
  request time by every job).
- The smoke test ([scripts/smoke-social.ts](../scripts/smoke-social.ts))
  enforces that publishers stay in dry-run mode when no credentials are set —
  CI runs it on every PR that touches social code paths.

---

## Reels Pipeline v1 (`feat/reels-pipeline-v1`)

Adds a Sandra-voiced, brand-disciplined Instagram Reels generation pipeline
with a daily cap of 1 Reel and a $1.00/day cost ceiling. **All behavior is
gated by `REELS_ENABLED=true` (default false).** No Reel is ever auto-published
in v1 — the worker writes to a `reels_pending_review` queue, a human reviews +
approves at [`/admin/reels-pending`](../apps/web/src/app/admin/reels-pending/page.tsx),
downloads the MP4, and posts manually from the IG app (so trending audio can
be picked at post time).

See [docs/reels-style-guide.md](./reels-style-guide.md) for Sandra's voice
rules, the brand palette, the four templates (BigStatistic / PullQuote /
HeadlinePhoto / NumberedPoints), and the cost / metrics / alert loop.

### New env vars

| Env var | Default | Purpose |
|---|---|---|
| `REELS_ENABLED` | `false` | Master gate. When false, the worker logs `reelsDisabled` and the tick step is a no-op. |
| `REELS_DAILY_COST_CEILING_USD` | `1.00` | Hard cap on combined LLM + TTS + STT spend per Haiti-day. Emits `reelsCostCeilingHit` when exceeded. |
| `REELS_STORAGE_BUCKET` | `FIREBASE_STORAGE_BUCKET` | Cloud Storage bucket the rendered MP4 lands in (`reels/{date}/{id}.mp4`). |
| `PEXELS_API_KEY` | _(empty → falls back to brand stock)_ | Stock-footage source for `HeadlinePhoto` / `PullQuote` backgrounds. |
| `WIKIMEDIA_USER_AGENT` | `EdLightNewsBot/1.0` | UA for Wikimedia Commons image fetches (required by their API ToS). |
| `SANDRA_TTS_VOICE` / `SANDRA_TTS_LANGUAGE_CODE` / `SANDRA_TTS_SPEAKING_RATE` / `SANDRA_TTS_PITCH` | `fr-FR-Neural2-C` / `fr-FR` / `1.0` / `0.0` | Sandra's Google Cloud TTS voice configuration (consumed by `@edlight-news/sandra-voice`). |
| `GOOGLE_TTS_API_KEY` (or fallback `GOOGLE_API_KEY` / `GOOGLE_VISION_API_KEY`) | _(reused)_ | Auth for Google Cloud Text-to-Speech (Sandra) and Speech-to-Text (captions). One Google Cloud project, one bill. |
| `IG_USER_ID` | _(reused from publisher)_ | Required for the IG Graph API shortcode→media-id resolve in `pullSocialMetrics`. |
| `IG_ACCESS_TOKEN` / `FB_PAGE_ACCESS_TOKEN` | _(reused)_ | Token used to call `/{ig-user-id}/media` and `/{media-id}/insights`. |
| `REEL_COMPLETION_ALERT_THRESHOLD` | `0.30` | `monitorSocial` fires `reelPerformanceDecline` when 7-day avg `watchCompletionRate` falls below this with ≥ 5 posted Reels. |

### What changed

- **Generation**: new
  [`@edlight-news/reels-generator`](../packages/reels-generator) package
  orchestrates `pickTemplate → generateReelScript → synthesizeVoice →
  transcribeForCaptions → pickStockFootage → composeReel` and returns a
  `ReelArtifact` with full cost ledger.
- **Voice**: new [`@edlight-news/sandra-voice`](../packages/sandra-voice)
  package centralizes Sandra's TTS config + voice profile prompt fragments
  (used by both Reels and any future audio surface).
- **Worker**: new
  [`buildReelsQueue.ts`](../apps/worker/src/jobs/buildReelsQueue.ts) job runs
  as Step 16 of `/tick`. Picks the top-scoring item per topic preference,
  enforces the daily slot + cost ceiling, uploads MP4, writes
  `reels_pending_review` doc.
- **Repo**: new
  [`reelsPendingRepo`](../packages/firebase/src/repositories/reels-pending.ts)
  with `createReelsPendingItem`, `listByStatus`, `listOpenSlotsForDay`,
  `listPostedSince`, `sumCostForDay`, `approve`, `reject`, `markPosted`,
  `patchSocialMetrics`, `findLatestPostedBySourceItemId`, and the IG-URL
  shortcode parser.
- **Admin UI**: new
  [`/admin/reels-pending`](../apps/web/src/app/admin/reels-pending/page.tsx)
  page with cost-ceiling progress bar, 4-section layout (pending / approved /
  leaderboard / posted), MP4 preview, copy-caption, posting checklist, and
  IG-URL paste form.
- **Metrics**: `pullSocialMetrics` now syncs IG Reels insights on a tiered
  cadence (2 h / 12 h / 24 h by age), computes `watchCompletionRate` locally,
  and emits `reelMetricsSynced` per success.
- **Editorial loop**: new
  [`reelEngagementBoost()`](../packages/generator/src/opportunityScoring.ts)
  applies +4…+12 to articles whose Reel performed well — capped to keep social
  signal subordinate to editorial scoring.
- **Alerts**: `monitorSocial` adds `reelPerformanceDecline` (avg completion <
  threshold over 7 d with ≥ 5-Reel sample). Forwards to `ALERT_WEBHOOK_URL`.

### Structured log events

Single-line JSON, scannable in Cloud Logging:

`reelCandidateSelected` · `reelGenerated` · `reelGenerationFailed` ·
`reelsCostCeilingHit` · `reelApproved` · `reelRejected` · `reelPosted` ·
`reelMetricsSynced` · `reelPerformanceDecline` · `reelsDisabled`
