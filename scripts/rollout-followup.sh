#!/usr/bin/env bash
# scripts/rollout-followup.sh — staged rollout for the social-growth followup PR.
#
# Usage:
#   scripts/rollout-followup.sh --day=1
#   scripts/rollout-followup.sh --day=2
#   scripts/rollout-followup.sh --day=3
#   scripts/rollout-followup.sh --day=all      # runs 1, 2, 3 sequentially
#   scripts/rollout-followup.sh --mode=cold-start   # flip into cold-start
#   scripts/rollout-followup.sh --mode=scale        # exit cold-start
#   scripts/rollout-followup.sh --mode=reels-on     # flip REELS_ENABLED=true (post-staging gate)
#
# Env required:
#   PROJECT_ID    GCP project (default: edlight-news)
#   REGION        Cloud Run region (default: us-central1)
#   SERVICE       Cloud Run service (default: edlight-news-worker)
#
# What gets flipped, by day:
#   Day 1 — confirms HASHTAG_ROTATION=true (already live in PR #65)
#   Day 2 — verifies IG_HANDLE + WA_CHANNEL_URL exist, then enables
#           WA_IG_CTA=true and FB_WA_CTA=true (cross-platform CTAs)
#   Day 3 — enables IG_STORY_FEATURES=true (Story stickers).
#
# What gets flipped, by --mode:
#   cold-start — sets COLD_START_MODE=true and disables the heavy growth
#                features that need an existing audience to be measured:
#                  WA_IG_CTA=false       FB_WA_CTA=false
#                  IG_STORY_FEATURES=false   HASHTAG_ROTATION=false
#                  SOCIAL_METRICS_FEEDBACK=false
#                Universal flags are KEPT ON: FB_LINK_IN_COMMENT,
#                TH_LINK_REPLY, X_MEDIA_UPLOAD, IG_DIASPORA_HOURS.
#   scale      — sets COLD_START_MODE=false and re-enables the same five
#                growth features so we resume the day-1/2/3 rollout state.
#   reels-on   — flips REELS_ENABLED=true after a successful staging
#                re-render. PREREQ: complete the manual re-render gate in
#                docs/reels-staging-rerender-gate.md — do NOT run this mode
#                until all six visual-checklist boxes are signed off.
#
# Each step prints the env var(s) it is about to mutate, runs the
# `gcloud run services update` (idempotent), then echoes a "watch dashboard
# 24h" reminder. Every step is reversible with the same command and the
# value `false`.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-edlight-news}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-edlight-news-worker}"

usage() {
  sed -n '2,40p' "$0"
  exit 1
}

DAY=""
MODE=""
for arg in "$@"; do
  case "$arg" in
    --day=*)  DAY="${arg#*=}" ;;
    --mode=*) MODE="${arg#*=}" ;;
    -h|--help) usage ;;
    *) echo "unknown arg: $arg" >&2; usage ;;
  esac
done
if [[ -z "$DAY" && -z "$MODE" ]]; then
  usage
fi
if [[ -n "$DAY" && -n "$MODE" ]]; then
  echo "✘ pass either --day or --mode, not both" >&2
  exit 1
fi

# ── helpers ──────────────────────────────────────────────────────────────────
have() { command -v "$1" >/dev/null 2>&1; }
need() { have "$1" || { echo "✘ missing required tool: $1" >&2; exit 1; }; }
need gcloud

current_env_json() {
  gcloud run services describe "$SERVICE" \
    --project="$PROJECT_ID" --region="$REGION" \
    --format=json 2>/dev/null
}

# Returns value of env var, or empty if unset.
get_var() {
  local name="$1"
  current_env_json | python3 -c "
import json, sys
envs = json.load(sys.stdin)['spec']['template']['spec']['containers'][0].get('env', [])
for e in envs:
    if e.get('name') == '$name':
        print(e.get('value', ''))
        break
"
}

assert_var_present() {
  local name="$1"
  local val
  val=$(get_var "$name")
  if [[ -z "$val" ]]; then
    echo "✘ Required env var ${name} is NOT set on ${SERVICE}." >&2
    echo "  Set it first via: gcloud run services update ${SERVICE} \\" >&2
    echo "    --update-env-vars ${name}=<value>" >&2
    exit 1
  fi
  echo "✓ ${name} present"
}

confirm_var_value() {
  local name="$1" expected="$2"
  local current
  current=$(get_var "$name")
  echo "  ${name}=${current:-<unset>}"
  if [[ "$current" != "$expected" ]]; then
    echo "→ updating ${name}=${expected}"
    gcloud run services update "$SERVICE" \
      --project="$PROJECT_ID" --region="$REGION" \
      --update-env-vars "${name}=${expected}" \
      --quiet
  else
    echo "✓ ${name} already = ${expected}"
  fi
}

watch_reminder() {
  cat <<EOF

────────────────────────────────────────────────────────────────────────
  ⏱  Watch the dashboard for the next 24h:
      https://news.edlight.org/admin/social-metrics
      https://news.edlight.org/admin/wa-channel

  Look for:
    • Boost health  → no spike in "At cap (+20)"
    • Story stickers → success-rate stays > 50 %
    • Per-platform reach/engagement holding steady or rising

  To revert this step:
    gcloud run services update ${SERVICE} \\
      --project=${PROJECT_ID} --region=${REGION} \\
      --update-env-vars <FLAG>=false
────────────────────────────────────────────────────────────────────────
EOF
}

# ── day 1 ────────────────────────────────────────────────────────────────────
day1() {
  echo "═══ Day 1 — confirm HASHTAG_ROTATION=true (PR #65) ═══"
  confirm_var_value HASHTAG_ROTATION true
  watch_reminder
}

# ── day 2 ────────────────────────────────────────────────────────────────────
day2() {
  echo "═══ Day 2 — enable cross-platform CTAs ═══"
  echo "Verifying handle/URL prerequisites…"
  assert_var_present IG_HANDLE
  assert_var_present WA_CHANNEL_URL
  echo "Flipping flags…"
  confirm_var_value WA_IG_CTA true
  confirm_var_value FB_WA_CTA true
  watch_reminder
}

# ── day 3 ────────────────────────────────────────────────────────────────────
day3() {
  echo "═══ Day 3 — enable IG Story sticker features ═══"
  confirm_var_value IG_STORY_FEATURES true
  watch_reminder
}

# ── mode: cold-start ─────────────────────────────────────────────────────────
mode_cold_start() {
  echo "═══ Mode → COLD-START ═══"
  echo "Engaging cold-start cadence on ${SERVICE} (${PROJECT_ID}/${REGION})."
  confirm_var_value COLD_START_MODE         true
  confirm_var_value WA_IG_CTA                false
  confirm_var_value FB_WA_CTA                false
  confirm_var_value IG_STORY_FEATURES        false
  confirm_var_value HASHTAG_ROTATION         false
  confirm_var_value SOCIAL_METRICS_FEEDBACK  false
  cat <<'EOF'

Universal flags KEPT ON (do NOT flip these in cold-start):
  FB_LINK_IN_COMMENT, TH_LINK_REPLY, X_MEDIA_UPLOAD, IG_DIASPORA_HOURS

Cold-start cadence (per Haiti day):
  IG carousel  : 2/day  (07:00 taux, 18:00 weekday-driven)
  FB           : 1/day  (12:00)
  Threads      : 4/day  (08, 12, 16, 20)
  X (Twitter)  : 2/day  (09, 18)
  WhatsApp     : 1/day  (10:00)

Exit when IG followers ≥ 500 (or per docs/content-calendar.md).
EOF
  watch_reminder
}

# ── mode: scale ─────────────────────────────────────────────────────────────
mode_scale() {
  echo "═══ Mode → SCALE (exit cold-start) ═══"
  echo "Restoring full cadence + growth features on ${SERVICE}."
  confirm_var_value COLD_START_MODE         false
  confirm_var_value WA_IG_CTA                true
  confirm_var_value FB_WA_CTA                true
  confirm_var_value IG_STORY_FEATURES        true
  confirm_var_value HASHTAG_ROTATION         true
  confirm_var_value SOCIAL_METRICS_FEEDBACK  true
  watch_reminder
}

# ── mode: reels-on ────────────────────────────────────────────
# Post-staging-gate flip. By the time you run this, you should have:
#   1. Re-rendered the reference gating item per
#      docs/reels-staging-rerender-gate.md (Step 2).
#   2. Verified all five ffprobe invariants (Step 3).
#   3. Spot-checked the four extracted frames (Step 4).
#   4. Signed off all six items in the visual checklist (Step 5).
# This mode is intentionally a no-op if REELS_ENABLED is already true,
# so it is safe to re-run.
mode_reels_on() {
  echo "═══ Mode → REELS-ON (post-staging gate) ═══"
  local current_reels
  current_reels=$(get_var REELS_ENABLED)
  if [[ "$current_reels" != "false" && "$current_reels" != "" && "$current_reels" != "true" ]]; then
    echo "✘ REELS_ENABLED has unexpected value '${current_reels}' (expected 'true', 'false', or unset)." >&2
    echo "  Inspect the service env before flipping:" >&2
    echo "    gcloud run services describe ${SERVICE} --region ${REGION} --project ${PROJECT_ID}" >&2
    exit 1
  fi
  echo "Current REELS_ENABLED=${current_reels:-<unset>}"
  echo ""
  echo "⚠  Pre-flight: confirm you have completed the staging re-render gate."
  echo "   See: docs/reels-staging-rerender-gate.md"
  echo ""
  confirm_var_value REELS_ENABLED true
  cat <<'EOF'

✅ Reels enabled. Watch /admin/reels-pending and #reels-review for the
   first generation. Per the runbook (Step 7), monitor for 48h:
     • reelRenderQualityFailed events  → ffprobe gate trips
     • captionAlignment.method = "proportional-fallback"  → STT outage
     • First three reels manually reviewed before declaring success

   Revert at any time:
     gcloud run services update ${SERVICE} \
       --project=${PROJECT_ID} --region=${REGION} \
       --update-env-vars REELS_ENABLED=false
EOF
  watch_reminder
}

if [[ -n "$MODE" ]]; then
  case "$MODE" in
    cold-start) mode_cold_start ;;
    scale)      mode_scale ;;
    reels-on)   mode_reels_on ;;
    *) echo "✘ unknown --mode=$MODE (expected cold-start | scale | reels-on)" >&2; exit 1 ;;
  esac
  echo "✓ rollout mode '${MODE}' applied"
  exit 0
fi

case "$DAY" in
  1)   day1 ;;
  2)   day2 ;;
  3)   day3 ;;
  all) day1; day2; day3 ;;
  *)   echo "✘ unknown --day=$DAY" >&2; usage ;;
esac

echo "✓ rollout step ${DAY} complete"
