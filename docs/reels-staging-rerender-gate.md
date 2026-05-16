# Reels Staging Re-Render Gate

> **Audience.** Anyone about to flip `REELS_ENABLED=true` on production for
> the first time after a Reels-impacting code change (templates, scoring,
> caption alignment, render config, `composeReel` orchestrator).
>
> **Promise.** If you complete every step below and every assertion passes,
> the next reel the worker generates in production will not regress against
> the v1 "static plates / wrong color / robotic captions" failure modes.
>
> **Reading time.** ~5 min. Total run time: ~20 min including the manual
> visual review.

---

## When to run this gate

Run **before** flipping `REELS_ENABLED=true` whenever any of these have
changed since the last successful production reel:

- Anything under `packages/reels-generator/src/templates/**`.
- `packages/reels-generator/src/composeReel.ts` (orchestration, ffprobe
  gate, render config).
- `packages/reels-generator/src/alignCaptions.ts` (Whisper / Google STT
  pipeline).
- `packages/reels-generator/src/extractHeroNumber.ts` (downgrade logic).
- `packages/reels-generator/src/pickTemplate.ts` (template selection).
- `apps/worker/src/jobs/buildReelsQueue.ts` (queueing rules).

Skipping the gate when the diff is "tiny and obviously safe" is exactly
how the v1.0 "static plates" regression shipped. **Always run the gate.**

---

## Prerequisites

| Tool / access | Why |
|---|---|
| `gcloud` authed to `edlight-news` GCP project | run jobs, read env, flip flag |
| `ffprobe` on PATH (ffmpeg ≥ 5.x) | invariant assertions in Step 3 |
| `ffmpeg` on PATH | frame extraction in Step 4 |
| Read access to the staging Cloud Run worker | trigger generation |
| Read access to GCS bucket `edlight-news-reels-staging` | download rendered MP4 |
| Slack `#reels-review` channel | sign-off |

Smoke check:

```bash
gcloud auth list
ffprobe -version | head -1
ffmpeg -version | head -1
```

---

## Step 1 — Identify the gating item

We always re-render the **same** reference item so renders are comparable
across runs and you can eyeball "is this better or worse than last time?"
against archived frames.

```text
REFERENCE_GATING_ITEM_ID = sourceItemId of the news doc that backed
                           reel id `reels_2026-05-15_reel_1778893702614_ed2bdd80`
```

Look it up via the admin UI or directly in Firestore:

```bash
gcloud firestore documents describe \
  "projects/edlight-news/databases/(default)/documents/reels/reels_2026-05-15_reel_1778893702614_ed2bdd80" \
  --format='value(fields.sourceItemId.stringValue)'
```

Why this item: it triggers all four interesting code paths in one render —
a salient hero number (BigStatistic), a quote (PullQuote candidate), a
photo with an attribution requirement (HeadlinePhoto credit overlay), and
a 4-bullet body that fits NumberedPoints. If the item gets archived,
update the constant above and the new reference's id in this doc.

Export for the rest of the steps:

```bash
export REFERENCE_GATING_ITEM_ID="<sourceItemId from above>"
export STAGING_SERVICE="edlight-news-worker-staging"
export STAGING_REGION="us-central1"
```

---

## Step 2 — Trigger generation in staging

The staging worker has `REELS_ENABLED=true` permanently. Force a fresh
generation by POSTing to `/tick` with a one-shot override that targets
the reference item:

```bash
TICK_URL=$(gcloud run services describe "$STAGING_SERVICE" \
  --region "$STAGING_REGION" --format='value(status.url)')

curl -fsS -X POST "$TICK_URL/tick" \
  -H "x-tick-secret: $(gcloud secrets versions access latest --secret=tick-secret)" \
  -H "content-type: application/json" \
  -d "{\"forceReelsForItemId\":\"$REFERENCE_GATING_ITEM_ID\"}"
```

If the worker doesn't expose `forceReelsForItemId` yet, fall back to
running the Cloud Run job manually:

```bash
gcloud run jobs execute reels-generator-staging \
  --region "$STAGING_REGION" \
  --update-env-vars "FORCE_REEL_ITEM_ID=$REFERENCE_GATING_ITEM_ID" \
  --wait
```

When it returns, find the generated MP4:

```bash
RENDERED_MP4=$(gsutil ls -l "gs://edlight-news-reels-staging/${REFERENCE_GATING_ITEM_ID}/*.mp4" \
  | sort -k2 | tail -2 | head -1 | awk '{print $3}')
gsutil cp "$RENDERED_MP4" /tmp/staging-reel.mp4
echo "Downloaded: /tmp/staging-reel.mp4 ($(stat -c%s /tmp/staging-reel.mp4) bytes)"
```

If size is < 1 MB, generation almost certainly failed silently — go check
the worker logs before continuing:

```bash
gcloud logging read "resource.labels.service_name=$STAGING_SERVICE \
  AND severity>=WARNING AND timestamp>=\"$(date -u -d '15 min ago' +%Y-%m-%dT%H:%M:%SZ)\"" \
  --limit 50 --format='value(textPayload)'
```

---

## Step 3 — ffprobe invariants (5 hard checks)

These are the same five gates that production code (`assertRenderQuality`
in `packages/reels-generator/src/composeReel.ts`) enforces post-render.
We replay them by hand here so you confirm the binary you just produced
would have passed if it had hit production.

If any one of these fails, STOP — do not proceed to Step 4. The render
pipeline is broken; flipping `REELS_ENABLED=true` will only generate more
broken renders.

```bash
PROBE=$(ffprobe -v error -print_format json -show_streams -show_format /tmp/staging-reel.mp4)
echo "$PROBE" | jq '.streams[] | {codec_type, codec_name, width, height, pix_fmt, color_space, color_primaries, sample_rate, bit_rate}'
echo "$PROBE" | jq '.format | {bit_rate, duration, size}'
```

Then assert:

| # | Invariant | Expected | jq one-liner |
|---|---|---|---|
| 1 | Both video AND audio streams present | exactly one of each | `echo "$PROBE" \| jq '[.streams[].codec_type] \| sort'` should print `["audio","video"]` |
| 2 | Video bitrate ≥ 6 Mbps | ≥ `6000000` bps | `echo "$PROBE" \| jq '.format.bit_rate \| tonumber >= 6000000'` should print `true` |
| 3 | Audio sample rate = 48 kHz | exactly `"48000"` | `echo "$PROBE" \| jq -r '.streams[] \| select(.codec_type=="audio") \| .sample_rate'` should print `48000` |
| 4 | Audio bitrate ≥ 160 kbps | ≥ `160000` bps | `echo "$PROBE" \| jq '.streams[] \| select(.codec_type=="audio") \| .bit_rate \| tonumber >= 160000'` should print `true` (or `null` if not tagged — manually inspect) |
| 5 | Pixel format = `yuv420p` (NOT `yuvj420p`) | `"yuv420p"` | `echo "$PROBE" \| jq -r '.streams[] \| select(.codec_type=="video") \| .pix_fmt'` |

Plus one soft check (production's 6th gate):

| 6 | Color space NOT in {bt470bg, bt470m, smpte170m, bt601, bt601-7} | bt709 or unknown | `echo "$PROBE" \| jq -r '.streams[] \| select(.codec_type=="video") \| .color_space'` |

If `color_space` is `unknown` that is benign — the production gate accepts
unknown. The v1 regression was `bt470bg` (PAL-era SD).

---

## Step 4 — Frame extraction (visual diff anchor)

Extract four reference frames so you can do an A/B against the last good
render archived in Drive (`Reels QA Archive/<date>/`). Filenames embed
the timestamp so you can keep multiple gate runs side-by-side.

```bash
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "/tmp/staging-reel-frames-$STAMP"
for sec in 1 5 10 15; do
  ffmpeg -hide_banner -loglevel error \
    -ss "$sec" -i /tmp/staging-reel.mp4 \
    -frames:v 1 \
    "/tmp/staging-reel-frames-$STAMP/frame-${sec}s.png"
done
ls -la "/tmp/staging-reel-frames-$STAMP/"
```

You should see four PNGs at ~1.5–2.5 MB each. If one is < 200 KB it
probably caught a black frame between intro and body — go re-shoot at
`-ss 2`, `-ss 6`, etc.

---

## Step 5 — Visual checklist (six items, sign each off)

Open the four PNGs side-by-side with the corresponding frames from the
last archived good render. For each, confirm:

- [ ] **Hook caption is exactly the script line** (no Whisper substitutions
      like "Public Health" → "public house" or "Mastercard" → "master card";
      Haitian/French diacritics intact).
- [ ] **Hero number rendered correctly** (no `BigStatistic` showing only a
      year — extractHeroNumber should have downgraded; if a year is the
      hero, downgrade is broken).
- [ ] **Caption bar inside the safe area** (text doesn't run under the IG
      bottom UI / over the top header — should sit between ~ y=240 and
      y=1680 on the 1080×1920 canvas).
- [ ] **Visible motion in first 1 s** (compare frame-1s to frame-5s — they
      should NOT be pixel-identical; at minimum the intro animation should
      have completed). The `scene-change` integration test guards the
      "fully static for the entire body" extreme; this checklist catches
      "intro animation never fired".
- [ ] **Brand colors load** (gradient is the topic-specific one, not a
      grey fallback).
- [ ] **Photo credit visible on HeadlinePhoto** (when the template is in
      use; small text at bottom-left).

Paste the PNGs into `#reels-review` with checkboxes. **Two engineers must
sign off before Step 6.**

---

## Step 6 — Decision: flip the flag

Only after every box in Step 5 is checked AND every assertion in Step 3
passed, run:

```bash
PROJECT_ID=edlight-news \
REGION=us-central1 \
SERVICE=edlight-news-worker \
  scripts/rollout-followup.sh --mode=reels-on
```

The script:

1. Reads current `REELS_ENABLED` value (refuses to proceed if it is set
   to anything other than `true`/`false`/unset).
2. Runs `gcloud run services update … --update-env-vars REELS_ENABLED=true`
   (idempotent — safe to re-run).
3. Prints the post-flip watch list.

If you need to revert at any point:

```bash
gcloud run services update edlight-news-worker \
  --project=edlight-news --region=us-central1 \
  --update-env-vars REELS_ENABLED=false
```

---

## Step 7 — Post-flip monitoring (48 h)

For the next 48 hours, keep these dashboards / queries open:

- **`/admin/reels-pending`** — every newly generated reel lands here for
  one human approval before it can be queued for IG. Review the first
  three end-to-end before declaring success.

- **`#reels-review` Slack channel** — the worker posts one message per
  generated reel with a thumbnail and the pending-approval URL.

- **Cloud Logging — render quality failures.** Any `reelRenderQualityFailed`
  event means `assertRenderQuality` rejected a render. One-off failures are
  fine (the worker reschedules); a sustained rate (≥ 2 in any 6 h window)
  means a regression slipped past the gate — flip back to false.

  ```bash
  gcloud logging read 'resource.labels.service_name="edlight-news-worker"
    AND textPayload:"reelRenderQualityFailed"
    AND timestamp>="'$(date -u -d '6 hours ago' +%Y-%m-%dT%H:%M:%SZ)'"' \
    --limit 50 --format='value(timestamp,textPayload)'
  ```

- **Cloud Logging — caption fallback rate.** alignCaptions logs a
  structured `captionAlignment` event with `method ∈ {stt-prompt,
  proportional-fallback}`. The fallback path skips real STT and just
  splits the script proportionally over the audio — captions will look
  ok but timing will drift. A fallback rate > 10 % in 24 h means our
  Google STT key is exhausted, the API is down, or the audio uploads
  are failing — investigate before it becomes the new normal.

  ```bash
  gcloud logging read 'resource.labels.service_name="edlight-news-worker"
    AND textPayload:"captionAlignment"
    AND timestamp>="'$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)'"' \
    --limit 200 --format='value(textPayload)' \
    | grep -oE '"method":"[^"]+"' | sort | uniq -c
  ```

- **`reelRenderQualityFailed` and `proportional-fallback` are linked.** A
  spike in either is a leading indicator the other will follow within a
  few hours. Don't wait for both before paging.

If any of the above breach their thresholds in the 48 h window, revert
with the gcloud command at the end of Step 6 and open a follow-up issue
referencing this runbook, the gate run timestamp, and the offending
reel doc id.
