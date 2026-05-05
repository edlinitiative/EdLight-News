/**
 * Lightweight in-house analytics tracker.
 *
 * Posts events to /api/events via `navigator.sendBeacon` when available,
 * falling back to a fire-and-forget `fetch`. No third-party vendor, no
 * cookies, no PII — just an event name + a small props bag.
 *
 * Events used (see docs/PRD.md):
 *   • hero_bourse_click   — user clicked a scholarship in the homepage hero
 *   • newsletter_signup   — { stream: "bourses" | "news", source: "hero" | "footer" | "sticky" | "exit_intent" }
 *   • nav_click           — { destination: "/bourses" }
 *
 * Server-rendered components must not import this module — it relies on
 * the browser. Use it from client components only.
 */

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

const ENDPOINT = "/api/events";

/** Generate / reuse a per-tab session id (sessionStorage). */
function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const KEY = "edl_sid";
    let sid = window.sessionStorage.getItem(KEY);
    if (!sid) {
      sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(KEY, sid);
    }
    return sid;
  } catch {
    return "no-storage";
  }
}

/**
 * Fire an analytics event. Safe to call from anywhere — silently no-ops on
 * the server and swallows network errors.
 */
export function track(eventName: string, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;

  const payload = {
    event: eventName,
    props,
    ts: Date.now(),
    sid: sessionId(),
    path: window.location.pathname + window.location.search,
    ref: document.referrer || null,
  };

  const body = JSON.stringify(payload);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
    }
  } catch {
    /* fall through to fetch */
  }

  // Fallback — fire & forget
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* silently drop */
  }
}
