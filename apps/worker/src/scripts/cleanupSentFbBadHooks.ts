#!/usr/bin/env npx tsx
/**
 * Delete already-sent Facebook posts whose payload uses an opportunity
 * hook ("Bourse à surveiller" / "Opportunité à saisir") on an item that
 * is no longer classified as an opportunity.
 *
 * Why this exists
 * ───────────────
 * The composer freezes `payload.text` at queue time. A handful of posts
 * went out with the bad bourse hook before the classifier fix
 * (commit 7680c81) landed. The underlying items have since been
 * re-classified to their correct category, but the published Facebook
 * posts still carry the misleading hook. The Graph API does not allow
 * editing `message` on link posts, so the only remediation is delete.
 *
 * What it does
 * ────────────
 *  1. Scan all fb_queue rows with status="sent".
 *  2. For each row whose payload.text starts with an opportunity hook
 *     AND whose underlying item is no longer an opportunity, call
 *     DELETE https://graph.facebook.com/v21.0/{fbPostId}.
 *  3. On success, patch the fb_queue row:
 *       status        → "skipped"
 *       skipReason    → "fb_cleanup_bad_hook_deleted"
 *       cleanedUpAt   → server timestamp
 *
 * Usage
 * ─────
 *   pnpm tsx src/scripts/cleanupSentFbBadHooks.ts             # dry run
 *   pnpm tsx src/scripts/cleanupSentFbBadHooks.ts --confirm   # actually delete
 *
 * Required env
 * ────────────
 *   FB_PAGE_ACCESS_TOKEN   — page token with manage_pages / pages_manage_posts
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@edlight-news/firebase";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const BAD_HOOK_PREFIXES = [
  "Bourse à surveiller",
  "Opportunité à saisir",
];

const OPPORTUNITY_CATEGORIES = new Set(["bourses", "scholarship"]);
const OPPORTUNITY_VERTICAL = "opportunites";

interface Candidate {
  fbId: string;
  fbPostId: string;
  queuedDate?: string;
  itemId: string;
  itemTitle: string;
  itemCategory: string | undefined;
  payloadHook: string;
}

async function findCandidates(): Promise<Candidate[]> {
  const db = getDb();
  const snap = await db.collection("fb_queue").where("status", "==", "sent").get();
  const out: Candidate[] = [];

  for (const doc of snap.docs) {
    const data = doc.data() as any;
    const text = String(data.payload?.text ?? "");
    const hook = BAD_HOOK_PREFIXES.find((h) => text.startsWith(h));
    if (!hook) continue;

    const fbPostId = String(data.fbPostId ?? "");
    if (!fbPostId) {
      console.warn(`[skip] ${doc.id} has bad hook but no fbPostId — cannot delete`);
      continue;
    }

    const itemId = String(data.sourceContentId ?? "");
    if (!itemId) continue;

    const itemSnap = await db.collection("items").doc(itemId).get();
    if (!itemSnap.exists) {
      console.warn(`[skip] ${doc.id}: item ${itemId} not found`);
      continue;
    }
    const item = itemSnap.data() as any;
    const category = item?.category;
    const vertical = item?.vertical;

    // Only target rows where item is NO LONGER an opportunity.
    if (OPPORTUNITY_CATEGORIES.has(category) || vertical === OPPORTUNITY_VERTICAL) {
      continue;
    }

    out.push({
      fbId: doc.id,
      fbPostId,
      queuedDate: data.queuedDate,
      itemId,
      itemTitle: String(item?.title ?? "").slice(0, 100),
      itemCategory: category,
      payloadHook: hook,
    });
  }

  return out;
}

async function deleteFbPost(
  fbPostId: string,
  accessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(fbPostId)}?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { method: "DELETE" });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: { message: string; code: number; error_subcode?: number };
  };
  if (body.error) {
    return { ok: false, error: `(${body.error.code}/${body.error.error_subcode ?? "-"}) ${body.error.message}` };
  }
  if (body.success === true || res.ok) return { ok: true };
  return { ok: false, error: `HTTP ${res.status}` };
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!accessToken) {
    console.error("FB_PAGE_ACCESS_TOKEN not set in env");
    process.exit(1);
  }

  console.log(`[cleanup] mode: ${confirm ? "LIVE (will delete on Facebook)" : "DRY RUN"}`);
  const candidates = await findCandidates();
  console.log(`[cleanup] found ${candidates.length} sent rows with bad hook on non-opportunity items\n`);

  for (const c of candidates) {
    console.log(`  • ${c.fbId}`);
    console.log(`      hook         : ${c.payloadHook}`);
    console.log(`      item         : ${c.itemId} (now category=${c.itemCategory ?? "—"})`);
    console.log(`      title        : ${c.itemTitle}`);
    console.log(`      fbPostId     : ${c.fbPostId}`);
    console.log(`      queuedDate   : ${c.queuedDate ?? "—"}`);
  }

  if (!confirm) {
    console.log("\n[cleanup] dry run only — pass --confirm to actually delete");
    process.exit(0);
  }
  if (candidates.length === 0) {
    console.log("\n[cleanup] nothing to do");
    process.exit(0);
  }

  const db = getDb();
  let ok = 0;
  let failed = 0;

  for (const c of candidates) {
    process.stdout.write(`  deleting ${c.fbPostId} … `);
    const result = await deleteFbPost(c.fbPostId, accessToken);
    if (!result.ok) {
      console.log(`FAIL ${result.error}`);
      failed++;
      continue;
    }
    await db.collection("fb_queue").doc(c.fbId).update({
      status: "skipped",
      skipReason: "fb_cleanup_bad_hook_deleted",
      cleanedUpAt: FieldValue.serverTimestamp(),
    });
    console.log("ok");
    ok++;
  }

  console.log(`\n[cleanup] deleted=${ok} failed=${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
