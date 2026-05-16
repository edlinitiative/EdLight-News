# Reels Style Guide — Sandra v1

> Authoritative source for **how** an EdLight News Reel looks, sounds, and reads.
> Pipeline code: [packages/reels-generator](../packages/reels-generator), worker
> job [apps/worker/src/jobs/buildReelsQueue.ts](../apps/worker/src/jobs/buildReelsQueue.ts),
> review UI [apps/web/src/app/admin/reels-pending/page.tsx](../apps/web/src/app/admin/reels-pending/page.tsx).

---

## 1. Sandra's voice

Sandra is EdLight's editorial host. Every Reel is voiced by her TTS persona
defined in [`@edlight-news/sandra-voice`](../packages/sandra-voice).

**Voice rules** — enforced in
[`generateReelScript.ts`](../packages/reels-generator/src/generateReelScript.ts)
prompt:

- Warm, factual, intelligent. **Never sensational.**
- Haitian-French register. Code-switch to Kreyòl **only** for one short phrase
  (≤ 5 words) when it adds emotional resonance.
- **Never invent statistics.** If the source doesn't have a number, omit it.
- 35–80 words per voiceover (≈ 22 s at Sandra's cadence). Hard cap: 30 s of
  audio.
- End on a forward-looking note: *"on suit ça"*, *"à demain"*, *"rete branche"*.
- No SSML. No stage directions. Plain text — the TTS layer adds prosody.

**Forbidden registers**
- Outrage / clickbait ("VOUS NE CROIREZ PAS…").
- Editorializing on politics. Sandra reports, she doesn't take sides.
- English code-switching (the Reel pipeline is FR-first; HT and EN come later).

---

## 2. Topics

Defined in [`packages/reels-generator/src/types.ts`](../packages/reels-generator/src/types.ts)
as `ReelTopic`. Worker preference order is
`scholarship → histoire → opportunity → taux → fact → news`
([buildReelsQueue.ts](../apps/worker/src/jobs/buildReelsQueue.ts#L48-L56)).

| Topic | When to use | Sandra angle |
|---|---|---|
| `scholarship` | New bourse, deadline approaching | Who, when, montant — precision over hype |
| `opportunity` | Job, internship, formation | Always quote the deadline + how to apply |
| `taux` | Daily exchange-rate move | One sentence of context, no daily drama |
| `histoire` | Anniversary / heritage / civic memory | Year, fact, one line on present relevance |
| `fact` | "Le saviez-vous?" educational fact | Lead with the surprise, accurate |
| `news` | Breaking but factual | Report only. Never frame, never opine. |
| `education` | Practical study tip | Always end with one actionable suggestion |

---

## 3. Templates

Four Remotion templates live in
[`packages/reels-generator/src/templates`](../packages/reels-generator/src/templates).
Mapping is decided by
[`pickTemplate.ts`](../packages/reels-generator/src/pickTemplate.ts) using the
topic + a deterministic hash of the source-item id (so the same article never
gets re-rendered as a different template across reruns).

| Template | Strong fit | Required script fields |
|---|---|---|
| `BigStatistic` | taux, scholarship deadline countdowns, numeric facts | `hero`, `hook`, `context` |
| `PullQuote` | histoire, news commentary, scholarship testimonials | `quote`, `attribution` |
| `HeadlinePhoto` | breaking news, opportunity alerts | `headline` (+ stock image) |
| `NumberedPoints` | fact-of-the-day, scholarship requirements, education | `framing` (e.g. "3 choses à savoir"), `points[]` |

A render is **rejected by `assertScriptForTemplate()`** if a required field is
missing — this is intentional; the LLM must respect the template contract.

---

## 4. Brand discipline

Every visual constant comes from
[`packages/reels-generator/src/brand.ts`](../packages/reels-generator/src/brand.ts).
**Do not hard-code colors, fonts, or motion durations in templates.**

- **Frame**: 1080×1920, 30 fps, ≤ 30 s body + 1.2 s intro + 1.5 s outro.
- **Palette**: per-topic accent on top of the EdLight ink/cream base
  (`getPalette(topic)`).
- **Type**: heading = display weight, body = regular, captions = bold (karaoke
  highlight uses `palette.secondary`).
- **Motion**: cubic-bezier easings in `MOTION.ease`. Use `MOTION.duration.quick`
  / `normal` / `slow` for transitions (8 / 14 / 22 frames). See §4a for the
  v1.1 motion language every template must implement.
- **Captions**: Google STT timestamps + ground-truth script tokens
  (`alignCaptions`), ≤ 4-word window, anchored 280 px above the frame
  bottom, max 86 % width, ink-tinted background at 88 % opacity. Body 56 px;
  active word 60 px in `palette.secondary`. Captions never display a token
  that wasn't in `script.voiceover`.
- **Intro / Outro**: rendered from `IntroCard` / `OutroCard`. Always include the
  EdLight logo + Sandra avatar; never override their durations per-render.
- **Footage**: stock image/video credits rendered in the corner via
  `clips[].credit`; missing credits fall back to `"EdLight News"`.

---

## 4a. Motion language (v1.1)

Every template must move on every frame — scene-change between any two
consecutive frames must register `> 0.001` so the IG algorithm classifies
the post as video, not slideshow. Templates compose these primitives:

| Primitive               | Where it applies                       | Spec                                                  |
| ----------------------- | -------------------------------------- | ----------------------------------------------------- |
| Animated background     | All templates                          | Gradient angle / Ken Burns over 4–5 s loop            |
| Hero entrance           | BigStatistic, HeadlinePhoto headline   | Scale 1.4 → 1.0 / 60 → 0 px translate over 12–14 f    |
| Counter morph           | BigStatistic when hero is numeric      | 0 → final over 18 f, ease-out cubic                   |
| Pulse                   | BigStatistic hero                      | 1.0 ↔ 1.04, period ≈ 1.7 s                            |
| Word-by-word reveal     | PullQuote, captions                    | Word at a time across 5 s for quotes; per-word fade   |
| Slide-in cards          | NumberedPoints                         | Translate 40 → 0 px + fade over 10 f, dwell, crossfade |
| Particle drift          | BigStatistic background                | 24 particles @ 8 % opacity, vertical drift            |
| **Outro decay (every body template)** | Last 12 frames before transition  | scale 1 → 0.92–0.96, opacity 1 → 0.6                  |

Render-config invariants (enforced post-render by `assertRenderQuality`):
crf 18, x264 preset `slow`, pixel format `yuv420p`, color space `bt709`,
audio 48 kHz / 192 kbps stereo, video bitrate ≥ 6 Mbps. Failing any of
these throws `ReelRenderQualityError` and the orchestrator reschedules.

### Hero number selection

`pickTemplateWithDowngrade` runs `extractHeroNumber` on each item's
title + summary + structured fields and downgrades off `BigStatistic`
when the only salient number is a bare year. Salience hierarchy:

| Kind       | Salience | Example                                  |
| ---------- | -------- | ---------------------------------------- |
| currency   | 100      | `$5,000 USD`, `5K HTG`, `2 millions`     |
| deadline   | 90       | `15 mars 2026`, `15/03/2026`             |
| count      | 75       | `200 lauréats`, `25 places`              |
| percentage | 60       | `87 %`                                   |
| year       | 5        | `2026` (intentionally low — rarely hero) |

Structured hints (`amount_usd`, `deadline`, `count`) get a `+5` salience
boost so they win when both free text and structured data are present.

---

## 5. Cost discipline

Per-Reel cost ledger lives in `ReelsPendingItem.costBreakdown` and is summed
daily by [`reelsPendingRepo.sumCostForDay()`](../packages/firebase/src/repositories/reels-pending.ts).

- **Daily ceiling**: `REELS_DAILY_COST_CEILING_USD` (default **$1.00**). When
  the next planned generation would push past it, the worker emits
  `reelsCostCeilingHit` and skips the slot.
- **One Reel per Haiti-day max** during cold-start. Enforced by
  `listOpenSlotsForDay(haitiDateKey)`; the queue refuses to generate a second
  Reel if a `pending` or `approved` Reel already exists for the day.
- Stock footage is free (Pexels / Wikimedia / brand fallback). Render compute
  is amortized to $0 (worker CPU only).
- LLM (Gemini) + TTS (Google) + STT (Google) are the only metered costs; full breakdown is logged in
  `cost.totalUsd` per artifact.

---

## 6. Approval workflow

See [docs/social-team-guide.md § Reels review](./social-team-guide.md#reels-review)
for the full reviewer playbook. Quick reference:

1. Worker generates → status `pending`.
2. Reviewer opens `/admin/reels-pending`, watches the MP4, reads the script and
   IG caption, then clicks **Approve** (status → `approved`) or **Reject** with
   a reason.
3. Reviewer downloads the MP4, posts it manually from the IG app (so trending
   audio can be picked at post time), pastes the IG URL back in the dashboard.
4. Status → `posted`. `pullSocialMetrics` then begins syncing IG insights on
   the cadence below.

**Why manual posting in v1?** Direct Graph API publish for Reels has
unpredictable container-failure modes and removes the human's ability to pick a
trending audio track. We'll switch to automated publish at IG ≥ 5k followers.

---

## 7. Metrics & boost loop

Posted Reels are polled via the IG Graph API by
[`pullSocialMetrics`](../apps/worker/src/jobs/pullSocialMetrics.ts) on this
cadence:

| Reel age | Refresh interval |
|---|---|
| < 24 h | every 2 h |
| 2 – 7 d | every 12 h |
| 8 – 60 d | once per day |
| > 60 d | not refreshed |

`watchCompletionRate = min(avgWatchTimeSec / durationSec, 1)` is computed
locally — IG doesn't return it directly.

The
[`reelEngagementBoost()`](../packages/generator/src/opportunityScoring.ts)
helper feeds these metrics back into editorial scoring: articles whose Reel
performed well get +4 to +12 on their next opportunity score, capped at +12 so
social signal can never dominate editorial judgment.

---

## 8. Alerts

`monitorSocial` emits `reelPerformanceDecline` when avg
`watchCompletionRate` over 7 days falls below
`REEL_COMPLETION_ALERT_THRESHOLD` (default **0.30**) **and** ≥ 5 Reels with
metrics have been posted. The alert forwards to `ALERT_WEBHOOK_URL` with the
sample size and observed rate so the editorial team can review the
template / Sandra script before continuing the cadence.
