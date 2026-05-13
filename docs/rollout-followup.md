# Social Growth — Rollout Followup Runbook

This runbook drives the staged production rollout of the social-growth
followup features that landed in [PR #65](https://github.com/edlinitiative/EdLight-News/pull/65)
and the observability/safety-net work in this rollout PR.

> **No new flags** are introduced by the rollout PR itself — every behavior
> below is gated by an existing env var on Cloud Run. Each day is fully
> reversible: re-run the same `gcloud run services update` with the value
> `false` to revert.

## Pre-flight (do once)

1. Make sure the worker is healthy and PR #65 is fully deployed.
2. Confirm `HASHTAG_ROTATION=true` on Cloud Run (PR #65 turned this on).
3. Confirm the dashboards load:
   - <https://news.edlight.org/admin/social-metrics>
   - <https://news.edlight.org/admin/wa-channel>
4. Take a baseline WhatsApp snapshot in `/admin/wa-channel`.

## Day-by-day plan

The script `scripts/rollout-followup.sh` automates each day. Run from a
shell with `gcloud` authenticated against the `edlight-news` project.

### Day 1 — confirm hashtag rotation

```bash
scripts/rollout-followup.sh --day=1
```

What it does:
- Confirms `HASHTAG_ROTATION=true` on the worker (no-op if already set).

What to watch (next 24 h):
- Threads / X reach should stay flat or trend up vs the previous week.
- Boost health "Items boosted" should rise gradually (more engagement
  signal returning from FB/Threads/X).

### Day 2 — cross-platform CTAs

```bash
scripts/rollout-followup.sh --day=2
```

What it does:
- Verifies `IG_HANDLE` and `WA_CHANNEL_URL` are set (script aborts if not).
- Sets `WA_IG_CTA=true` (every WA broadcast appends "Suivre @<igHandle>").
- Sets `FB_WA_CTA=true` (every FB post appends a WA Channel link).

What to watch:
- WA Channel snapshot 7-day delta turns positive within ~72 h.
- FB engagement does not drop (CTAs are short and at the end of the post).
- No alert fires for `waChannelChurn`.

### Day 3 — IG Story sticker features

```bash
scripts/rollout-followup.sh --day=3
```

What it does:
- Sets `IG_STORY_FEATURES=true` (link sticker / poll sticker on Stories,
  per-topic via [`pickStoryFeatures`](apps/worker/src/services/storyFeatures.ts)).

What to watch:
- Story stickers panel shows attached / skipped per feature.
- Link-sticker success rate stays ≥ 50 %. If it drops below, the panel
  shows a red **Sticker collapse** badge and the worker emits
  `socialBoostAlert` with `kind=stickerCollapse`.

### Run all three at once

```bash
scripts/rollout-followup.sh --day=all
```

(Useful only if the dashboards have been clean for ≥ 24 h on a previous
attempt — otherwise stagger 1 → 2 → 3 with at least 24 h between.)

## How to revert

Every step is a single `--update-env-vars` call. Replace the value with
`false` to roll back:

```bash
gcloud run services update edlight-news-worker \
  --project=edlight-news --region=us-central1 \
  --update-env-vars WA_IG_CTA=false,FB_WA_CTA=false
```

## Observability checklist (during rollout)

| Signal                    | Where                                           | Healthy        |
| ------------------------- | ----------------------------------------------- | -------------- |
| Boost cap saturation      | `/admin/social-metrics` → Boost health          | "At cap" ≤ 10  |
| Sticker success rate      | `/admin/social-metrics` → Story stickers        | link ≥ 50 %    |
| WA Channel growth         | `/admin/wa-channel` and main dashboard badge    | non-negative   |
| Worker structured logs    | `gcloud logging read 'jsonPayload.event="socialBoostAlert"'` | none in 24 h |

## Post-rollout review (T + 14 days)

After 14 days of all three days at `true`, append a section to this file
under `## Outcomes` with:
- WhatsApp Channel net followers gained
- Per-platform reach / engagement vs the 14 days before Day 1
- Any alert that fired (and how it was resolved)
- A keep / revert / iterate decision for each flag.

## Outcomes

_To be filled in T + 14 days after rollout._
