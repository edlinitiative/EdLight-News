# Social Growth Changelog

A running log of behavior changes shipped via the social posting worker
(`apps/worker`) and the publisher (`packages/publisher`), and the env
flags that gate each one. All flags default ON unless noted; flip to
`false` to revert without redeploying code.

## Priority 1 (`feat/social-growth-p1`)

### `FB_LINK_IN_COMMENT` — Facebook image-native + comment-with-link

- **Default:** `true` (enabled)
- **Files:** [packages/publisher/src/index.ts](packages/publisher/src/index.ts), [apps/worker/src/jobs/buildFbQueue.ts](apps/worker/src/jobs/buildFbQueue.ts), [apps/worker/src/jobs/processFbScheduled.ts](apps/worker/src/jobs/processFbScheduled.ts)
- **Behavior when ON:** when both `imageUrl` and `linkUrl` are present, the
  publisher uploads the photo natively via `POST /{page}/photos` and
  immediately posts a comment containing the article link via
  `POST /{post_id}/comments`. The persisted `FbQueueItem.fbCommentId`
  records the comment for forensics.
- **Fallbacks (always on, regardless of flag):**
  - `linkUrl` only → text+link `/feed` post (legacy preview card).
  - `imageUrl` only → photo post, no comment step.
  - text only → plain `/feed` post.
- **Hook variant:** `buildFbQueue` now rotates a question-form hook
  (e.g. `"Connaissez-vous quelqu'un qui pourrait postuler? 👇"`) into
  ~30% of scholarship/opportunity posts, deterministically per item id.
- **Why:** Facebook suppresses link posts; native photo + first-comment
  link typically lifts reach 2–4×. Question hooks lift comment rate.
- **Revert:** `FB_LINK_IN_COMMENT=false` → forces the legacy link-feed
  path even when an image is available.

### `TH_LINK_REPLY` — Threads cadence + link as self-reply

- **Default:** `true` (enabled)
- **Files:** [packages/publisher/src/index.ts](packages/publisher/src/index.ts), [apps/worker/src/jobs/buildThQueue.ts](apps/worker/src/jobs/buildThQueue.ts), [apps/worker/src/jobs/scheduleThPost.ts](apps/worker/src/jobs/scheduleThPost.ts), [apps/worker/src/jobs/processThScheduled.ts](apps/worker/src/jobs/processThScheduled.ts)
- **Cadence (always on):** `DAILY_CAP` raised from `6 → 12` and slots
  expanded from 6 → 12 entries (07:30, 09:00, 10:30, 12:00, 13:30, 15:00,
  16:00, 17:30, 18:30, 20:00, 21:00, 22:00 Haiti time). Quiet hours
  `23:00–05:30` enforced with explicit guard in the scheduler.
- **Behavior when ON:** the parent post body no longer embeds the
  article URL — only title, summary, and hashtags fit in 500 chars. The
  publisher then creates a second container with `media_type=TEXT`,
  `reply_to_id=<parent media id>`, `text="🔗 <linkUrl>"` and publishes
  it as a self-reply. The persisted `ThQueueItem.thReplyMediaId` records
  the reply media id.
- **Why:** Threads suppresses outbound links in the parent body;
  self-reply keeps the parent clean while still giving users a tap target.
  The volume bump matches Threads' algorithmic preference for cadence.
- **Revert:** `TH_LINK_REPLY=false` → builder embeds the link inline in
  the parent body and the publisher skips the reply step.

### `X_MEDIA_UPLOAD` — X tweets attach article images

- **Default:** `true` (enabled). Effective only when OAuth1 creds are set.
- **Files:** [packages/publisher/src/index.ts](packages/publisher/src/index.ts), [apps/worker/src/jobs/buildXQueue.ts](apps/worker/src/jobs/buildXQueue.ts), [apps/worker/src/jobs/scheduleXPost.ts](apps/worker/src/jobs/scheduleXPost.ts), [apps/worker/src/jobs/processXScheduled.ts](apps/worker/src/jobs/processXScheduled.ts)
- **Cadence (always on):** `DAILY_CAP` raised from `10 → 15` and slots
  expanded to 15 entries.
- **Behavior when ON and OAuth1 creds are set:** the publisher downloads
  the image (10 s timeout, ≤5 MB), uploads it via
  `POST https://upload.twitter.com/1.1/media/upload.json` signed with
  HMAC-SHA1 OAuth 1.0a (no extra dependency — uses Node `crypto`), then
  attaches `media_ids` to `POST https://api.x.com/2/tweets`. The
  persisted `XQueueItem.xMediaId` records the attached media id.
- **Required env vars for media upload:**
  - `X_CONSUMER_KEY` (a.k.a. `X_API_KEY`)
  - `X_CONSUMER_SECRET` (a.k.a. `X_API_SECRET`)
  - `X_OAUTH1_ACCESS_TOKEN`
  - `X_OAUTH1_ACCESS_SECRET`
- **Graceful fallback (always on):** if any of (a) creds missing,
  (b) image fetch fails, (c) image > 5 MB, (d) upload error, the publisher
  silently falls back to a text-only tweet. A single startup log line
  `X media upload disabled — set X_CONSUMER_KEY...` is emitted on first
  call when creds are missing; per-failure errors are logged as
  `xMediaUploadFailed: <reason>`.
- **Builder change:** `buildXQueue` now puts `imageUrl` on the payload
  and tightens the headline budget by `URL_BUDGET=12` chars (X t.co
  shortens URLs to ~23 chars regardless of source length).
- **Revert:** `X_MEDIA_UPLOAD=false` → publisher skips upload entirely
  and tweets text-only.

## Logging conventions (P1)

All new API calls emit a single structured log line:

```
{"platform":"fb|th|x","action":"...","postId":"...","commentId|replyMediaId|mediaId":"...","ok":true,"durationMs":N}
```

On failure:

```
{"platform":"...","action":"publish","ok":false,"durationMs":N,"error":"..."}
```

## Dry-run safety

All publishers (FB / Threads / X / IG / WA) preserve the existing
contract: when the required tokens are absent, they return
`{ posted: false, dryRun: true }` without making any network call.

---

Future priorities (P2, P3) will be appended to this file as they ship.
