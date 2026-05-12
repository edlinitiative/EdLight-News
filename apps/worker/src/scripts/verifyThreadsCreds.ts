/**
 * Verify Threads credentials in .env actually work against the Threads Graph API.
 *
 * Checks:
 *   1. THREADS_ACCESS_TOKEN  — debug_token + me lookup
 *   2. THREADS_USER_ID       — GET /{user-id}?fields=id,username
 *   3. THREADS_APP_ID        — matches the app_id the token was issued for
 *   4. THREADS_APP_SECRET    — used together with APP_ID for debug_token call
 *   5. Token scopes          — must include threads_basic + threads_content_publish
 *
 * Run:  pnpm --filter @edlight/worker exec tsx src/scripts/verifyThreadsCreds.ts
 */
import "dotenv/config";

type Check = { name: string; ok: boolean; detail: string };
const results: Check[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  const tag = ok ? "✓" : "✗";
  console.log(`${tag} ${name}: ${detail}`);
}

async function main() {
  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  const userId = process.env.THREADS_USER_ID;
  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;

  console.log("─── Presence check ──────────────────────────");
  record("THREADS_ACCESS_TOKEN present", !!accessToken, accessToken ? `${accessToken.slice(0, 8)}…(${accessToken.length} chars)` : "MISSING");
  record("THREADS_USER_ID present", !!userId, userId ?? "MISSING");
  record("THREADS_APP_ID present", !!appId, appId ?? "MISSING");
  record("THREADS_APP_SECRET present", !!appSecret, appSecret ? `${appSecret.slice(0, 4)}…(${appSecret.length} chars)` : "MISSING");

  if (!accessToken || !userId || !appId || !appSecret) {
    console.log("\nMissing required env vars; aborting live checks.");
    process.exit(1);
  }

  const apiBase = "https://graph.threads.net/v1.0";

  console.log("\n─── Live API checks ─────────────────────────");

  // 1. /me lookup with token
  try {
    const r = await fetch(`${apiBase}/me?fields=id,username,threads_profile_picture_url&access_token=${accessToken}`);
    const j: any = await r.json();
    if (j.error) {
      record("GET /me (token valid)", false, `${j.error.message} (code=${j.error.code})`);
    } else {
      record("GET /me (token valid)", true, `id=${j.id} username=${j.username ?? "?"}`);
      if (j.id && j.id !== userId) {
        record("THREADS_USER_ID matches /me.id", false, `env=${userId} but token belongs to ${j.id}`);
      } else if (j.id) {
        record("THREADS_USER_ID matches /me.id", true, `${j.id}`);
      }
    }
  } catch (e: any) {
    record("GET /me (token valid)", false, e.message);
  }

  // 2. GET /{user-id}
  try {
    const r = await fetch(`${apiBase}/${userId}?fields=id,username&access_token=${accessToken}`);
    const j: any = await r.json();
    if (j.error) {
      record(`GET /${userId}`, false, `${j.error.message} (code=${j.error.code})`);
    } else {
      record(`GET /${userId}`, true, `username=${j.username ?? "?"}`);
    }
  } catch (e: any) {
    record(`GET /${userId}`, false, e.message);
  }

  // 3. debug_token — confirms APP_ID / APP_SECRET pair is correct & gets scopes/expiry
  try {
    const appAccessToken = `${appId}|${appSecret}`;
    const url = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appAccessToken)}`;
    const r = await fetch(url);
    const j: any = await r.json();
    if (j.error) {
      record("debug_token (APP_ID/SECRET pair)", false, `${j.error.message}`);
    } else if (j.data?.error) {
      record("debug_token (APP_ID/SECRET pair)", false, `${j.data.error.message}`);
    } else if (j.data) {
      const d = j.data;
      const valid = d.is_valid === true;
      const exp = d.expires_at ? new Date(d.expires_at * 1000).toISOString() : "never";
      const scopes: string[] = d.scopes ?? d.granular_scopes?.flatMap((g: any) => g.scope) ?? [];
      record("debug_token is_valid", valid, `app_id=${d.app_id} expires=${exp}`);
      if (d.app_id && d.app_id !== appId) {
        record("THREADS_APP_ID matches token app_id", false, `env=${appId} but token app_id=${d.app_id}`);
      } else {
        record("THREADS_APP_ID matches token app_id", true, `${appId}`);
      }
      const needed = ["threads_basic", "threads_content_publish"];
      for (const scope of needed) {
        const has = scopes.some((s) => s === scope || s.endsWith(`/${scope}`));
        record(`scope ${scope}`, has, has ? "granted" : `missing — got: ${scopes.join(", ") || "(none)"}`);
      }
    } else {
      record("debug_token (APP_ID/SECRET pair)", false, "unexpected response shape");
    }
  } catch (e: any) {
    record("debug_token (APP_ID/SECRET pair)", false, e.message);
  }

  // 4. Publishing limit endpoint — proves write scope works without actually posting
  try {
    const r = await fetch(`${apiBase}/${userId}/threads_publishing_limit?fields=quota_usage,config&access_token=${accessToken}`);
    const j: any = await r.json();
    if (j.error) {
      record("GET threads_publishing_limit", false, `${j.error.message}`);
    } else {
      const usage = j.data?.[0]?.quota_usage ?? "?";
      const cap = j.data?.[0]?.config?.quota_total ?? "?";
      record("GET threads_publishing_limit", true, `${usage}/${cap} used`);
    }
  } catch (e: any) {
    record("GET threads_publishing_limit", false, e.message);
  }

  console.log("\n─── Summary ─────────────────────────────────");
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) {
    console.log(`✅ All ${results.length} checks passed — Threads creds are good.`);
    process.exit(0);
  } else {
    console.log(`❌ ${failed.length}/${results.length} checks failed:`);
    for (const f of failed) console.log(`   • ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
