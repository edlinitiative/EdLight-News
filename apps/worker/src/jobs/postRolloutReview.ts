/**
 * Worker job: postRolloutReview
 *
 * Runs once at T+14 days (via Cloud Scheduler → POST /review). Collects
 * 14-day observability data from Firestore, asks Gemini to write the
 * "## Outcomes" section, then opens a GitHub PR against main with the
 * updated docs/rollout-followup.md.
 *
 * Environment variables required:
 *   GITHUB_PAT   — fine-grained or classic PAT with repo + contents + PRs
 *   GEMINI_API_KEY — already required by the worker at large
 *
 * Optional (already on Cloud Run):
 *   GITHUB_REPO   — defaults to "edlinitiative/EdLight-News"
 *   GITHUB_DEFAULT_BRANCH — defaults to "main"
 */

import {
  socialBoostLogRepo,
  waChannelSnapshotsRepo,
  igStoryQueueRepo,
} from "@edlight-news/firebase";
import { callLLM } from "@edlight-news/generator";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// From apps/worker/src/jobs → monorepo root is 4 levels up
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const RUNBOOK_PATH = path.join(REPO_ROOT, "docs/rollout-followup.md");

const GITHUB_REPO =
  process.env.GITHUB_REPO ?? "edlinitiative/EdLight-News";
const GITHUB_DEFAULT_BRANCH =
  process.env.GITHUB_DEFAULT_BRANCH ?? "main";
const REVIEW_BRANCH = "chore/post-rollout-review-t14";

export interface PostRolloutReviewResult {
  ok: boolean;
  prUrl?: string;
  branch?: string;
  error?: string;
  dataSummary?: Record<string, unknown>;
}

// ── Data collection ─────────────────────────────────────────────────────────

async function collectData() {
  const HOURS_14 = 14 * 24;

  // 1. Boost metrics (14-day rollup)
  const boostRollup = await socialBoostLogRepo.rollup(HOURS_14).catch((e) => ({
    error: String(e),
    itemsBoosted: 0,
    boostedAtCap: 0,
    avgBoost: 0,
  }));

  // 2. WA Channel snapshots (last 30)
  const waSnapshots = await waChannelSnapshotsRepo.listRecent(30).catch(() => []);
  const waSummary = await waChannelSnapshotsRepo.summarize().catch(() => null);

  // 3. Sticker attempt aggregation over last 14 days
  const recentStories = await igStoryQueueRepo
    .listByStatus("posted", 200)
    .catch(() => [] as Awaited<ReturnType<typeof igStoryQueueRepo.listByStatus>>);
  const cutoffMs = Date.now() - HOURS_14 * 3600 * 1000;
  let stickerAttached = 0;
  let stickerSkipped = 0;
  const stickerSkipReasons: Record<string, number> = {};
  for (const story of recentStories) {
    const ts = (story as any).updatedAt;
    const ms =
      ts && typeof ts.toDate === "function"
        ? ts.toDate().getTime()
        : ts?._seconds != null
          ? ts._seconds * 1000
          : Date.now();
    if (ms < cutoffMs) continue;
    if (!story.stickerAttempt) continue;
    for (const a of story.stickerAttempt) {
      if (a.feature !== "linkSticker") continue;
      if (a.status === "attached") {
        stickerAttached++;
      } else {
        stickerSkipped++;
        const reason = a.reason ?? "unknown";
        stickerSkipReasons[reason] = (stickerSkipReasons[reason] ?? 0) + 1;
      }
    }
  }
  const stickerTotal = stickerAttached + stickerSkipped;
  const stickerSuccessRate =
    stickerTotal > 0 ? Math.round((stickerAttached / stickerTotal) * 1000) / 10 : null;

  // 4. WA growth computation
  let waNetGrowth: number | null = null;
  let waStartCount: number | null = null;
  let waLatestCount: number | null = null;
  if (waSnapshots.length >= 2) {
    const sorted = [...waSnapshots].sort(
      (a, b) =>
        new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime(),
    );
    waStartCount = sorted[0]!.followerCount;
    waLatestCount = sorted[sorted.length - 1]!.followerCount;
    waNetGrowth = waLatestCount - waStartCount;
  }

  return {
    boostRollup,
    waNetGrowth,
    waStartCount,
    waLatestCount,
    waDelta7d: waSummary?.delta7d ?? null,
    waDelta7dPct: waSummary?.delta7dPct ?? null,
    waSnapshotCount: waSnapshots.length,
    stickerAttached,
    stickerSkipped,
    stickerTotal,
    stickerSuccessRate,
    stickerSkipReasons,
  };
}

// ── Gemini prompt ────────────────────────────────────────────────────────────

function buildPrompt(data: Awaited<ReturnType<typeof collectData>>): string {
  const {
    boostRollup,
    waNetGrowth,
    waStartCount,
    waLatestCount,
    waDelta7d,
    waDelta7dPct,
    waSnapshotCount,
    stickerAttached,
    stickerSkipped,
    stickerTotal,
    stickerSuccessRate,
    stickerSkipReasons,
  } = data;

  const today = new Date().toISOString().slice(0, 10);

  return `You are a technical writer for EdLight News, a Haitian education news platform.
You must write the "## Outcomes" section for a production rollout post-mortem document.
Today is ${today}. The rollout went live on 2026-05-13, so this is T+14.

Write concise, honest bullet-point prose in English. 3–5 paragraphs maximum.
Do NOT invent numbers — only use the exact figures provided below.
Use "N/A" for any metric where the data is missing or count is 0.

--- OBSERVABILITY DATA (14-day window) ---

BOOST METRICS:
- Items boosted: ${(boostRollup as any).itemsBoosted ?? 0}
- Average boost: ${typeof (boostRollup as any).avgBoost === "number" ? ((boostRollup as any).avgBoost as number).toFixed(2) : "N/A"}
- Items that hit the cap (+20): ${(boostRollup as any).boostedAtCap ?? 0}
- Unique items boosted: ${(boostRollup as any).uniqueItems ?? "N/A"}
${(boostRollup as any).error ? `- Note: rollup failed with error "${(boostRollup as any).error}" — data may be incomplete` : ""}

IG STORY STICKER ATTEMPTS:
- Link-sticker attached: ${stickerAttached}
- Link-sticker skipped: ${stickerSkipped}
- Total attempts: ${stickerTotal}
- Success rate: ${stickerSuccessRate !== null ? `${stickerSuccessRate}%` : "N/A (no stories)"}
- Skip reasons: ${Object.keys(stickerSkipReasons).length > 0 ? JSON.stringify(stickerSkipReasons) : "none"}

WHATSAPP CHANNEL GROWTH:
- Snapshots logged: ${waSnapshotCount}
- Starting follower count (oldest snapshot): ${waStartCount ?? "N/A"}
- Latest follower count: ${waLatestCount ?? "N/A"}
- Net change over 14 days: ${waNetGrowth !== null ? (waNetGrowth >= 0 ? `+${waNetGrowth}` : String(waNetGrowth)) : "N/A"}
- Latest 7-day delta: ${waDelta7d !== null ? (waDelta7d >= 0 ? `+${waDelta7d}` : String(waDelta7d)) : "N/A"} (${waDelta7dPct !== null ? `${waDelta7dPct}%` : "N/A"})

--- FLAGS DEPLOYED ---
HASHTAG_ROTATION=true (rotates IG hashtag pool)
WA_IG_CTA=true (WhatsApp posts append Instagram follow CTA)
FB_WA_CTA=true (Facebook posts append WhatsApp Channel link)
IG_STORY_FEATURES=true (IG Stories use 6-topic feature picker + link/poll stickers)

--- FORMAT ---
Write ONLY the content that goes inside the "## Outcomes" section.
Start directly with text (no "## Outcomes" heading — it is already in the file).
End with a "### Flag decisions" sub-section with keep / revert / iterate per flag,
based strictly on the data above.
`;
}

// ── GitHub API helpers ───────────────────────────────────────────────────────

interface GhHeaders extends Record<string, string> {
  Authorization: string;
  Accept: string;
  "Content-Type": string;
  "X-GitHub-Api-Version": string;
}

function ghHeaders(token: string): GhHeaders {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghFetch(
  token: string,
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<unknown> {
  const url = `https://api.github.com/${path}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: ghHeaders(token),
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`GitHub API ${opts.method ?? "GET"} ${path} → ${res.status}: ${txt.slice(0, 300)}`);
  }
  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// ── Main function ────────────────────────────────────────────────────────────

export async function postRolloutReview(): Promise<PostRolloutReviewResult> {
  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    return { ok: false, error: "GITHUB_PAT env var is not set" };
  }

  // 1. Collect data
  let data: Awaited<ReturnType<typeof collectData>>;
  try {
    data = await collectData();
  } catch (err) {
    return {
      ok: false,
      error: `Data collection failed: ${err instanceof Error ? err.message : err}`,
    };
  }

  // 2. Call Gemini
  let outcomeText: string;
  try {
    const prompt = buildPrompt(data);
    const raw = await callLLM(prompt, {
      temperature: 0.4,
      maxOutputTokens: 1200,
      jsonMode: false,
    });
    outcomeText = raw.trim();
  } catch (err) {
    return {
      ok: false,
      error: `Gemini call failed: ${err instanceof Error ? err.message : err}`,
      dataSummary: data as unknown as Record<string, unknown>,
    };
  }

  // 3. Read current runbook from disk (worker has the repo checked out)
  let runbook: string;
  try {
    runbook = await readFile(RUNBOOK_PATH, "utf-8");
  } catch (err) {
    return {
      ok: false,
      error: `Could not read ${RUNBOOK_PATH}: ${err instanceof Error ? err.message : err}`,
    };
  }

  // 4. Replace the placeholder in ## Outcomes
  const PLACEHOLDER = "_To be filled in T + 14 days after rollout._";
  if (!runbook.includes(PLACEHOLDER) && !runbook.includes("## Outcomes")) {
    return {
      ok: false,
      error: "Could not find the ## Outcomes placeholder in rollout-followup.md",
    };
  }
  const updated = runbook.includes(PLACEHOLDER)
    ? runbook.replace(PLACEHOLDER, outcomeText)
    : runbook; // already filled — won't overwrite

  if (updated === runbook) {
    // Outcomes were already filled; nothing to do.
    return { ok: true, error: "Outcomes section already filled — no PR needed." };
  }

  // 5. Get current file SHA on the default branch (required for GitHub API update)
  const [owner, repo] = GITHUB_REPO.split("/");
  const fileInfo = (await ghFetch(
    pat,
    `repos/${owner}/${repo}/contents/docs/rollout-followup.md?ref=${GITHUB_DEFAULT_BRANCH}`,
  )) as { sha: string; content: string };
  const currentSha = fileInfo.sha;

  // 6. Create branch off default branch
  const defaultRef = (await ghFetch(
    pat,
    `repos/${owner}/${repo}/git/ref/heads/${GITHUB_DEFAULT_BRANCH}`,
  )) as { object: { sha: string } };
  const baseSha = defaultRef.object.sha;

  await ghFetch(pat, `repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: {
      ref: `refs/heads/${REVIEW_BRANCH}`,
      sha: baseSha,
    },
  }).catch((err: Error) => {
    // Branch may already exist from a previous attempt — ignore 422
    if (!err.message.includes("422")) throw err;
  });

  // 7. Commit the updated file to the branch
  const encoded = Buffer.from(updated, "utf-8").toString("base64");
  const today = new Date().toISOString().slice(0, 10);
  await ghFetch(pat, `repos/${owner}/${repo}/contents/docs/rollout-followup.md`, {
    method: "PUT",
    body: {
      message: `docs(rollout): T+14 outcomes section (${today})`,
      content: encoded,
      sha: currentSha,
      branch: REVIEW_BRANCH,
    },
  });

  // 8. Open PR
  const pr = (await ghFetch(pat, `repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: {
      title: `docs(rollout): T+14 post-rollout outcomes (${today})`,
      head: REVIEW_BRANCH,
      base: GITHUB_DEFAULT_BRANCH,
      body: `Automated T+14 post-rollout review generated by the worker \`postRolloutReview\` job.

## What this PR does

Fills in the \`## Outcomes\` section of [\`docs/rollout-followup.md\`](docs/rollout-followup.md)
based on 14 days of live Firestore data collected by the worker.

## Data window (2026-05-13 → ${today})

| Metric | Value |
|---|---|
| Items boosted | ${(data.boostRollup as any).itemsBoosted ?? 0} |
| Avg boost | ${typeof (data.boostRollup as any).avgBoost === "number" ? ((data.boostRollup as any).avgBoost as number).toFixed(2) : "N/A"} |
| Boost cap hits | ${(data.boostRollup as any).boostedAtCap ?? 0} |
| Sticker success rate | ${data.stickerSuccessRate !== null ? `${data.stickerSuccessRate}%` : "N/A"} |
| WA net growth | ${data.waNetGrowth !== null ? (data.waNetGrowth >= 0 ? `+${data.waNetGrowth}` : String(data.waNetGrowth)) : "N/A"} |
| WA snapshots logged | ${data.waSnapshotCount} |

Please review the Gemini-written narrative, edit as needed, then merge.`,
    },
  })) as { html_url: string };

  return {
    ok: true,
    prUrl: pr.html_url,
    branch: REVIEW_BRANCH,
    dataSummary: data as unknown as Record<string, unknown>,
  };
}
