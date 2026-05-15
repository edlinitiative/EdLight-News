# Cold-Start Content Calendar

> **Audience:** EdLight social team, on-call operator.
> **Status:** v1 — accompanies the `feat/cold-start-mode` PR.

EdLight runs in two cadence modes. Which one is active is controlled by a
single env flag on the Cloud Run worker:

| Flag                         | Cold-start | Scale |
| ---------------------------- | :--------: | :---: |
| `COLD_START_MODE`            | `true`     | `false` _(default)_ |
| `HASHTAG_ROTATION`           | `false`    | `true` |
| `WA_IG_CTA`                  | `false`    | `true` |
| `FB_WA_CTA`                  | `false`    | `true` |
| `IG_STORY_FEATURES`          | `false`    | `true` |
| `SOCIAL_METRICS_FEEDBACK`    | `false`    | `true` |
| `FB_LINK_IN_COMMENT`         | `true`     | `true` |
| `TH_LINK_REPLY`              | `true`     | `true` |
| `X_MEDIA_UPLOAD`             | `true`     | `true` |
| `IG_DIASPORA_HOURS`          | `true`     | `true` |

The four "universal" flags at the bottom stay on in **both** modes — they
are platform-format choices, not growth experiments. Use the helper script
to flip everything atomically:

```bash
scripts/rollout-followup.sh --mode=cold-start    # engage
scripts/rollout-followup.sh --mode=scale         # exit
```

---

## Why cold-start?

When IG follower count is low (< ~500), the algorithmic surface (Reels,
Explore, hashtag pages) returns near-zero discovery. Posting 10×/day in
that environment burns editorial calories with no measurable lift while
training the audience to expect filler. Cold-start cuts cadence to the
**bare minimum that builds a daily habit**:

- Same morning anchor every day (the **taux du jour**).
- Same evening rhythm by weekday (rotating high-signal categories).
- No filler, no FOMO posts, no cross-platform CTAs that lead to empty
  channels.

The goal during cold-start is to **earn the first 500 followers**, after
which we re-enable the growth flags and resume the day-1/2/3 rollout.

---

## Per-platform cadence

| Platform | Scale cap (per day) | Cold-start cap | Cold-start slots (Haiti time) |
| -------- | ------------------: | -------------: | ----------------------------- |
| IG carousel | 8 (10 urgent) | **2**         | 07:00 (taux), 18:00 (weekday) |
| IG Story    | summary only (1)   | **5**         | 07:30 echo, 12:00 poll, 15:00 quiz, 18:30 echo, 20:30 recap |
| Facebook    | 13                | **1**         | 12:00                         |
| Threads     | 12                | **4**         | 08:00, 12:00, 16:00, 20:00    |
| X (Twitter) | 15                | **2**         | 09:00, 18:00                  |
| WhatsApp    | 8                 | **1**         | 10:00                         |

### IG Story strategy (cold-start, 5 frames/day)

IG Stories are the highest-leverage surface for follower growth: poll
sticker taps and story replies feed directly into the Reach Accounts →
Followers loop. Cold-start ships **5 frames/day** assembled from three
sources:

| Slot (Haiti) | Frame type      | Source job                          | Sticker     |
| ------------ | --------------- | ----------------------------------- | ----------- |
| 07:30        | morning echo    | `processIgScheduled` (per-post)     | link        |
| **12:00**    | midday poll     | `scheduleIgStoryFrames` → `buildPollStoryFromTopic("taux")`     | poll (A/B)  |
| **15:00**    | afternoon quiz  | `scheduleIgStoryFrames` → `buildPollStoryFromTopic("general")`  | poll (A/B)  |
| 18:30        | evening echo    | `processIgScheduled` (per-post)     | link        |
| **20:30**    | summary recap   | `scheduleIgStoryFrames` → `buildIgStory` | question |

The two echoes (07:30, 18:30) are published inline by `processIgScheduled`
the moment the matching carousel goes out. The three bold rows are filled
by the new `scheduleIgStoryFrames` job, which is a **no-op in scale mode**
and runs every tick (every 5 min) in cold-start.

**Idempotency** — each slot is gated by `igStoryQueueRepo.existsForSlot`,
and a hard `STORY_DAILY_CAP_COLD_START = 5` cap is enforced across the
union of all `ig_story_queue` rows for the day, so a misfire or overlap
between echo + summary can never overshoot.

**Poll templates** — `buildPollStoryFromTopic` deterministically rotates
through 9 templates (3 topics × 3 templates) keyed by `(topic, dateKey)`.
Same date + same topic = same template, so re-runs of the same tick are
safe and the operator can preview tomorrow's question by bumping the
date.

### Story Highlights — daily "Today" reel

Every cold-start story row carries `addToHighlight: true`. After
`processIgStory` publishes the frame, it calls
`addStoryToHighlight(mediaId, dateKey)` which emits a structured
`igStoryHighlightCandidate` log line. The operator picks these up each
evening (or via a future Cloud Logging sink) and hand-adds them to the
day's "Today" Highlights reel via the IG mobile app.

> **Why manual?** Meta's public Instagram Graph API does **not** expose a
> highlight-add endpoint for business accounts. The
> [`addStoryToHighlight`](../packages/publisher/src/index.ts) helper is
> wired so the moment Meta ships the endpoint we can flip the body
> without touching callers.

The pending-candidate log shape:

```json
{
  "event": "igStoryHighlightCandidate",
  "mediaId": "17900000000000000",
  "highlightLabel": "2026-05-14",
  "storyId": "abc123",
  "slot": "midday_poll",
  "apiUnsupported": true
}
```

Filter Cloud Logging with `jsonPayload.event="igStoryHighlightCandidate"`
to get the day's add-to-highlight queue.
| **Daily total** | **~57** | **10**       | — |

> **Why the asymmetry?** Threads and X are still in growth mode for
> EdLight too, but their algorithms reward _consistency over volume_, so
> we keep 2-4 slots/day there. IG and FB collapse hardest because that's
> where the follower-zero penalty bites hardest.

---

## IG weekly evening rotation

The 18:00 slot is **pinned by Haiti-local weekday**. Order is preference
order — if the first category has nothing in queue, the scheduler falls
through. Final fallback is `scholarship` (the cold-start growth driver),
then top-scoring item of any type.

| Day | First choice | Second choice |
| --- | ------------ | ------------- |
| Sun | news (weekly recap) | histoire |
| Mon | scholarship  | — |
| Tue | utility (daily fact) | — |
| Wed | scholarship  | — |
| Thu | histoire     | — |
| Fri | scholarship  | — |
| Sat | histoire     | utility (fact) |

Three Mon/Wed/Fri scholarship slots is intentional: scholarships are the
single highest-converting content type for follower acquisition in Haiti.

Each evening pick logs an `igSlotSelection` event with the chosen weekday,
preference list, and final type — search Cloud Logging for that to verify
the calendar is firing as expected.

---

## IG Story plan

In cold-start mode IG Stories piggyback on each carousel publish (the
existing per-post story system in `processIgScheduled`). With only 2
carousels per day, the realistic story volume is **2–4 frames/day**.

The `buildPollStoryFromTopic` module (added in this PR) provides 9
ready-made poll templates across `taux`, `scholarship`, and `general`
topics for a future per-slot story scheduler. It rotates deterministically
by Haiti dateKey — same date always picks the same template, so operators
can preview tomorrow's poll by querying with the future date.

> **Future work:** A dedicated per-slot story scheduler with 5 distinct
> times (07:30, 10:00, 13:00, 17:00, 19:30) is planned for the post-500
> phase. The poll builder above is the v1 building block.

---

## What NOT to post during cold-start

- ❌ Cross-platform CTAs ("Follow us on WhatsApp / Threads / …"). The
  destination channels are also at low follower counts; the CTA both
  fails to convert AND signals "we're empty over there too".
- ❌ Hashtag-rotation experiments. The rotation service tunes itself
  against engagement signals we don't have yet.
- ❌ Story stickers (polls/links/sliders) on under-watched stories — the
  IG sticker analytics are noisy below ~50 viewers/story.
- ❌ Filler "did you know" posts that aren't part of the locked weekly
  rotation. Every post must earn its slot during cold-start.

---

## Exit criteria

Exit cold-start when **all** of the following hold for ≥ 7 consecutive
days:

1. IG follower count ≥ **500**.
2. Median IG carousel reach ≥ **300** (proxy for algorithmic surfacing).
3. At least one inbound DM or Story reply per day (any platform).
4. No taux / histoire / utility staple has been missed in the last 7
   days (check `STAPLE WATCHDOG` warnings in Cloud Logging — there
   should be zero).

When ready:

```bash
scripts/rollout-followup.sh --mode=scale
```

Then watch the social-metrics dashboard for 24h before running
`--day=1`, `--day=2`, `--day=3` to re-engage the growth features.

---

## Manual seeding playbook

During the first 30 days of cold-start the editorial team should hand-pick
content that the auto-scorer might rank too low to surface on its own:

1. **Mondays:** confirm at least one **scholarship** with a deadline in
   the next 21 days is queued by 09:00 Haiti time. If none, pull a
   high-prestige opportunity from the manual backlog and admin-push it.
2. **Tuesdays:** verify a fresh **fait du jour** (utility) was generated
   overnight. If not, rerun the daily-fact builder.
3. **Sundays:** review the past week's `igSlotSelection` logs for any
   slot that fell through to "any" — that's a queue-thinness signal.

The scheduler will never post junk just to fill a slot — an empty slot is
preferred over a sub-threshold post in cold-start mode. The score floor
is raised by +10 globally in cold-start (see `COLD_START_SCORE_BONUS` in
`apps/worker/src/jobs/buildIgQueue.ts`).

---

## Operational checks

- **Cold Run worker logs** (filter `event=coldStartModeActive`) — should
  emit exactly once per worker boot when the flag is on. If you see this
  event after running `--mode=scale`, the deployment hasn't picked up the
  new env yet; force a new revision.
- **`event=igSlotSelection`** — one per IG tick that schedules the
  evening slot. Verify `chosenType` matches the calendar above.
- **`event=igMorningSelection`** — emitted when the morning taux slot
  has no candidate (taux generator failed). Investigate upstream.
- **`event=coldStartScoreFloor`** — emitted per item rejected by the +10
  cold-start score bump. Healthy: ~30-50/day. If 0, the floor isn't
  doing anything (queue is too thin); if > 200/day, the threshold is too
  aggressive — file a tuning issue.

---

## Reels (gated by `REELS_ENABLED`)

| Cadence | Topic preference | Pick rule |
|---|---|---|
| Up to **1 / day** (Haiti tz) | scholarship → histoire → opportunity → taux → fact → news | Top-scoring open content version of the highest-priority topic available; daily slot enforced by `reelsPendingRepo.listOpenSlotsForDay` |

Hard caps:

- **$1.00 / day** combined LLM + TTS + STT cost (`REELS_DAILY_COST_CEILING_USD`).
- **30 s** body, plus 1.2 s intro + 1.5 s outro.
- **No auto-publish** — every Reel goes through `/admin/reels-pending` for human
  approval and manual posting from the IG app (so trending audio can be picked
  at post time). Switch to API publish targeted at IG ≥ 5k followers.

Full workflow: [docs/social-team-guide.md § 6 Reels review](./social-team-guide.md#6-reels-review).
Style + voice contract: [docs/reels-style-guide.md](./reels-style-guide.md).
