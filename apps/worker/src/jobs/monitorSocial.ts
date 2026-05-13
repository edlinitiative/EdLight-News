/**
 * Worker job: monitorSocial — lightweight rollout alerts (Task 6).
 *
 * Runs hourly and emits at most three structured warnings per tick:
 *
 *   1. boostCapSaturation     — > 10 items hit the +20 boost cap in 24h
 *   2. stickerCollapse        — link-sticker success rate < 40 % over
 *                               ≥ 5 attempts in 24h
 *   3. waChannelChurn         — last two WA snapshots both have a
 *                               negative 7-day delta vs their baselines
 *
 * Emits `socialBoostAlert` (single-line JSON) per fired alert. Optionally
 * forwards a one-line summary to `ALERT_WEBHOOK_URL` (Slack/Discord
 * incoming webhook) when set. Never throws — alerts are advisory.
 */
import {
  socialBoostLogRepo,
  igStoryQueueRepo,
  waChannelSnapshotsRepo,
} from "@edlight-news/firebase";

export interface MonitorSocialResult {
  alerts: string[];
  details: Record<string, unknown>;
}

export async function monitorSocial(): Promise<MonitorSocialResult> {
  const alerts: string[] = [];
  const details: Record<string, unknown> = {};

  // ── 1. Boost cap saturation ───────────────────────────────────────────
  try {
    const recent = await socialBoostLogRepo.listRecent(24);
    const cappedCount = recent.filter((e) => e.capped).length;
    details.boost = { window: "24h", capped: cappedCount, total: recent.length };
    if (cappedCount > 10) {
      alerts.push("boostCapSaturation");
      emit("socialBoostAlert", {
        kind: "boostCapSaturation",
        capped: cappedCount,
        windowHours: 24,
        message: `${cappedCount} items hit the +20 boost cap in the last 24h — consider raising the ceiling.`,
      });
    }
  } catch (err) {
    console.warn("[monitorSocial] boost check failed:", err);
  }

  // ── 2. Sticker collapse ──────────────────────────────────────────────
  try {
    const recentStories = await igStoryQueueRepo.listByStatus("posted", 50);
    const cutoffMs = Date.now() - 24 * 3600 * 1000;
    let attached = 0;
    let skipped = 0;
    for (const s of recentStories) {
      const ts =
        (s as { updatedAt?: { toDate?: () => Date; _seconds?: number } }).updatedAt;
      const ms =
        ts && typeof ts.toDate === "function"
          ? ts.toDate().getTime()
          : ts && typeof ts._seconds === "number"
            ? ts._seconds * 1000
            : Date.now();
      if (ms < cutoffMs) continue;
      if (!s.stickerAttempt) continue;
      for (const a of s.stickerAttempt) {
        if (a.feature !== "linkSticker") continue;
        if (a.status === "attached") attached++;
        else skipped++;
      }
    }
    const total = attached + skipped;
    const rate = total > 0 ? attached / total : null;
    details.stickers = { window: "24h", attached, skipped, rate };
    if (total >= 5 && rate !== null && rate < 0.4) {
      alerts.push("stickerCollapse");
      emit("socialBoostAlert", {
        kind: "stickerCollapse",
        rate,
        attached,
        skipped,
        windowHours: 24,
        message: `Link-sticker success rate ${(rate * 100).toFixed(1)}% over ${total} attempts — IG may have changed sticker permissions.`,
      });
    }
  } catch (err) {
    console.warn("[monitorSocial] sticker check failed:", err);
  }

  // ── 3. WA channel churn (2 consecutive negative 7-day deltas) ────────
  try {
    const churn = await waChannelSnapshotsRepo.detectChurnAlert();
    details.waChannel = churn;
    if (churn.alert) {
      alerts.push("waChannelChurn");
      emit("socialBoostAlert", {
        kind: "waChannelChurn",
        recent: churn.recent,
        message: `WhatsApp Channel shrunk in 2 consecutive 7-day windows — investigate content cadence.`,
      });
    }
  } catch (err) {
    console.warn("[monitorSocial] wa-channel check failed:", err);
  }

  // Forward to webhook if configured.
  if (alerts.length > 0 && process.env.ALERT_WEBHOOK_URL) {
    try {
      await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 EdLight social-rollout alerts (${alerts.length}): ${alerts.join(", ")}`,
        }),
      });
    } catch (err) {
      console.warn("[monitorSocial] webhook post failed:", err);
    }
  }

  return { alerts, details };
}

function emit(event: string, payload: Record<string, unknown>): void {
  console.warn(JSON.stringify({ event, ...payload }));
}
