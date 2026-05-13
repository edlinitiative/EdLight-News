/**
 * LLM-powered backfill: set `kind` and `haitianEligibility` on existing
 * `scholarships` Firestore docs that are missing those fields.
 *
 * Why: the internal /api/internal/opportunities API exposes these fields,
 * but most older docs lack them. Rather than guess from keywords, we ask
 * DeepSeek to read each doc's name + description + eligibility text and
 * return a structured JSON answer.
 *
 * Provider: DeepSeek (OpenAI-compatible chat-completions API).
 *   Env vars:
 *     DEEPSEEK_API_KEY                       (required)
 *     DEEPSEEK_API_BASE  default https://api.deepseek.com
 *     DEEPSEEK_MODEL     default "deepseek-chat"
 *
 * Usage (from repo root):
 *   pnpm --filter @edlight-news/worker backfill:apply-fields
 *   BACKFILL_DRY_RUN=true   pnpm --filter @edlight-news/worker backfill:apply-fields
 *   BACKFILL_FORCE=true     pnpm --filter @edlight-news/worker backfill:apply-fields
 *   BACKFILL_LIMIT=10       pnpm --filter @edlight-news/worker backfill:apply-fields
 *
 * - DRY_RUN  → log decisions only, no writes
 * - FORCE    → also re-classify docs that already have one of the fields set
 *              (default: only docs missing both kind and haitianEligibility,
 *               OR with haitianEligibility="unknown")
 * - LIMIT    → process at most N docs (default: all)
 *
 * Safe to re-run. Touches only `kind`, `haitianEligibility`, and `updatedAt`.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@edlight-news/firebase";
import type { Scholarship } from "@edlight-news/types";

// ── Load .env from monorepo root and apps/web ──────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });
dotenv.config({ path: path.resolve(monorepoRoot, "apps/web/.env") });

// ── Config ─────────────────────────────────────────────────────────────────
const DRY_RUN = process.env.BACKFILL_DRY_RUN === "true";
const FORCE = process.env.BACKFILL_FORCE === "true";
const LIMIT = process.env.BACKFILL_LIMIT
  ? Number.parseInt(process.env.BACKFILL_LIMIT, 10)
  : Number.POSITIVE_INFINITY;

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_BASE =
  process.env.DEEPSEEK_API_BASE ?? "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

const REQUEST_DELAY_MS = 400;
const MAX_RETRIES = 3;

const COLLECTION = "scholarships";

type Kind = "program" | "directory";
type HaitianEligibility = "yes" | "no" | "unknown";

interface ClassificationResult {
  kind: Kind;
  haitianEligibility: HaitianEligibility;
  reason: string;
}

// ── DeepSeek call (OpenAI-compatible chat completions, JSON mode) ──────────
async function callDeepSeek(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is not set in the environment");
  }

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          max_tokens: 400,
          response_format: { type: "json_object" },
        }),
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`DeepSeek HTTP ${resp.status}: ${body.slice(0, 300)}`);
      }

      const json = (await resp.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("DeepSeek returned empty content");
      return content;
    } catch (err) {
      lastErr = err;
      const wait = 500 * attempt * attempt;
      console.warn(`  ↻ DeepSeek attempt ${attempt} failed: ${(err as Error).message}; retrying in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr ?? new Error("DeepSeek call failed after retries");
}

// ── Prompt ─────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT =
  `You are a careful classifier for a Haitian student scholarships database. ` +
  `You read one scholarship record and return strict JSON. Never guess; when ` +
  `the record gives no clear evidence, return "unknown" for haitianEligibility.`;

function buildUserPrompt(s: Scholarship): string {
  const eligibleList =
    Array.isArray(s.eligibleCountries) && s.eligibleCountries.length > 0
      ? s.eligibleCountries.join(", ")
      : "(not specified)";

  return [
    "Classify this scholarship record.",
    "",
    `Name: ${s.name ?? ""}`,
    `Host country: ${s.country ?? ""}`,
    `Eligible countries listed: ${eligibleList}`,
    `Funding type: ${s.fundingType ?? "unknown"}`,
    `Eligibility summary: ${s.eligibilitySummary ?? "(none)"}`,
    `Programme description: ${(s.programDescription ?? "").slice(0, 1500)}`,
    `Tags: ${(s.tags ?? []).join(", ") || "(none)"}`,
    `Official URL: ${s.officialUrl ?? ""}`,
    "",
    "Return STRICT JSON with these fields and no others:",
    `{`,
    `  "kind": "program" | "directory",`,
    `    // "program" = a single, directly-applicable scholarship/programme.`,
    `    // "directory" = a listing/catalog of multiple opportunities.`,
    `  "haitianEligibility": "yes" | "no" | "unknown",`,
    `    // "yes"     = Haitian nationals are clearly eligible to apply.`,
    `    // "no"      = the eligible-country list explicitly excludes Haiti.`,
    `    // "unknown" = the record gives no clear evidence either way.`,
    `  "reason": "<one short sentence justifying your answer>"`,
    `}`,
  ].join("\n");
}

function parseClassification(raw: string): ClassificationResult | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ClassificationResult>;
    const kind = parsed.kind === "directory" ? "directory" : "program";
    const he =
      parsed.haitianEligibility === "yes"
        ? "yes"
        : parsed.haitianEligibility === "no"
          ? "no"
          : "unknown";
    return {
      kind,
      haitianEligibility: he,
      reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : "",
    };
  } catch (err) {
    console.warn(`  ⚠ failed to parse LLM JSON: ${(err as Error).message}`);
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log("─".repeat(70));
  console.log(`Backfill scholarships: kind + haitianEligibility (DeepSeek)`);
  console.log(`  model     : ${DEEPSEEK_MODEL}`);
  console.log(`  base url  : ${DEEPSEEK_API_BASE}`);
  console.log(`  dry-run   : ${DRY_RUN}`);
  console.log(`  force     : ${FORCE}`);
  console.log(`  limit     : ${LIMIT === Number.POSITIVE_INFINITY ? "∞" : LIMIT}`);
  console.log("─".repeat(70));

  if (!DEEPSEEK_API_KEY) {
    console.error("✗ DEEPSEEK_API_KEY is missing — aborting.");
    process.exit(1);
  }

  const db = getDb();
  const snap = await db.collection(COLLECTION).get();
  console.log(`Loaded ${snap.size} scholarship docs.\n`);

  const candidates: Scholarship[] = [];
  for (const doc of snap.docs) {
    const data = { id: doc.id, ...doc.data() } as Scholarship;
    const needsKind = !data.kind;
    const needsHE = !data.haitianEligibility || data.haitianEligibility === "unknown";
    if (FORCE || needsKind || needsHE) candidates.push(data);
  }
  console.log(`${candidates.length} docs need classification.\n`);

  let touched = 0;
  let skipped = 0;
  let errors = 0;

  for (const s of candidates) {
    if (touched + skipped + errors >= LIMIT) break;

    const label = `${s.id}  "${(s.name ?? "").slice(0, 60)}"`;
    try {
      const raw = await callDeepSeek(SYSTEM_PROMPT, buildUserPrompt(s));
      const result = parseClassification(raw);
      if (!result) {
        errors++;
        console.warn(`  ✗ ${label} → parse failed`);
        continue;
      }

      // Decide which fields to actually write (don't overwrite a confident
      // pre-existing value unless --force).
      const update: Record<string, unknown> = {};
      if (FORCE || !s.kind) update.kind = result.kind;
      if (FORCE || !s.haitianEligibility || s.haitianEligibility === "unknown") {
        update.haitianEligibility = result.haitianEligibility;
      }

      if (Object.keys(update).length === 0) {
        skipped++;
        console.log(`  – ${label} → no fields to update`);
        continue;
      }

      const summary = `kind=${update.kind ?? s.kind} | haitian=${update.haitianEligibility ?? s.haitianEligibility} | ${result.reason}`;
      if (DRY_RUN) {
        console.log(`  ⓘ ${label}\n      would set: ${summary}`);
      } else {
        update.updatedAt = FieldValue.serverTimestamp();
        await db.collection(COLLECTION).doc(s.id).update(update);
        console.log(`  ✓ ${label}\n      set: ${summary}`);
      }
      touched++;
    } catch (err) {
      errors++;
      console.error(`  ✗ ${label} → ${(err as Error).message}`);
    }

    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }

  console.log("\n─".repeat(70));
  console.log(`Done. ${DRY_RUN ? "(dry-run) " : ""}touched=${touched}  skipped=${skipped}  errors=${errors}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
