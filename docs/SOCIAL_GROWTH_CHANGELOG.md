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
