#!/usr/bin/env bash
# scripts/rollout-followup.sh — staged rollout for the social-growth followup PR.
#
# Usage:
#   scripts/rollout-followup.sh --day=1
#   scripts/rollout-followup.sh --day=2
#   scripts/rollout-followup.sh --day=3
#   scripts/rollout-followup.sh --day=all      # runs 1, 2, 3 sequentially
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
# Each step prints the env var(s) it is about to mutate, runs the
# `gcloud run services update` (idempotent), then echoes a "watch dashboard
# 24h" reminder. Every step is reversible with the same command and the
# value `false`.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-edlight-news}"
REGION="${REGION:-us-central1}"
SERVICE="${SERVICE:-edlight-news-worker}"

usage() {
  sed -n '2,30p' "$0"
  exit 1
}

DAY=""
for arg in "$@"; do
  case "$arg" in
    --day=*) DAY="${arg#*=}" ;;
    -h|--help) usage ;;
    *) echo "unknown arg: $arg" >&2; usage ;;
  esac
done
[[ -z "$DAY" ]] && usage

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
      https://edlight.news/admin/social-metrics
      https://edlight.news/admin/wa-channel

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

case "$DAY" in
  1)   day1 ;;
  2)   day2 ;;
  3)   day3 ;;
  all) day1; day2; day3 ;;
  *)   echo "✘ unknown --day=$DAY" >&2; usage ;;
esac

echo "✓ rollout step ${DAY} complete"
