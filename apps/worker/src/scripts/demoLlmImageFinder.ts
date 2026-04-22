/**
 * Demo: run the LLM image finder against real items and produce a visual
 * trace so a human can sanity-check the model.
 *
 * Usage:
 *   # By item ID(s):
 *   cd apps/worker && npx tsx src/scripts/demoLlmImageFinder.ts <itemId> [<itemId>...]
 *
 *   # Or against the most recent N source items:
 *   cd apps/worker && npx tsx src/scripts/demoLlmImageFinder.ts --recent 8
 *
 * Output:
 *   - A pretty terminal log per item (queries, candidates, validations, decision).
 *   - An HTML report at /tmp/llm-image-finder-demo.html with thumbnails so you can
 *     SEE every candidate image and the LLM's verdict next to it. Open with:
 *       "$BROWSER" /tmp/llm-image-finder-demo.html
 */

import path from "node:path";
import { writeFileSync } from "node:fs";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { itemsRepo } from "@edlight-news/firebase";
import type { Item } from "@edlight-news/types";
import { findImageWithLlm, type LlmImageFinderResult } from "../services/llmImageFinder.js";
import { validatePublisherImage } from "../services/llmPublisherImageValidator.js";

interface ItemReport {
  item: Item;
  publisherValidation: Awaited<ReturnType<typeof validatePublisherImage>>;
  finder: LlmImageFinderResult;
  elapsedMs: number;
}

async function loadItems(args: string[]): Promise<Item[]> {
  const recentIdx = args.indexOf("--recent");
  if (recentIdx >= 0) {
    const n = parseInt(args[recentIdx + 1] ?? "5", 10);
    const items = await itemsRepo.listRecentSourceItems(n);
    return items.filter((it) => (it.title ?? "").length > 5);
  }
  if (args.length === 0) {
    console.error("Provide at least one item id, or pass --recent N");
    process.exit(1);
  }
  const items: Item[] = [];
  for (const id of args) {
    const it = await itemsRepo.getItem(id);
    if (it) items.push(it);
    else console.warn(`item ${id} not found, skipping`);
  }
  return items;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function reportToHtml(reports: ItemReport[]): string {
  const totalCost = reports.reduce((sum, r) => sum + r.finder.estCostUsd, 0);
  const sections = reports
    .map((r) => {
      const it = r.item;
      const finder = r.finder;
      const pubVal = r.publisherValidation;
      const pubBadge = !it.imageUrl
        ? `<span class="badge none">no publisher image</span>`
        : pubVal
          ? `<span class="badge ${pubVal.match ? "ok" : "bad"}">publisher LLM ${
              pubVal.match ? "✓" : "✗"
            } ${pubVal.confidence.toFixed(2)} — ${escapeHtml(pubVal.reason)}</span>`
          : `<span class="badge unknown">publisher unchecked</span>`;
      const decisionBadge = finder.url
        ? `<span class="badge ok">FINDER PICKED ✓</span>`
        : `<span class="badge bad">FINDER REJECTED</span>`;

      const candidateRows = finder.candidates
        .map((c) => {
          const v = c.validation;
          const verdict = !v
            ? `<span class="badge unknown">not validated</span>`
            : v.match
              ? `<span class="badge ok">match ✓ ${v.confidence.toFixed(2)}</span>`
              : `<span class="badge bad">no ✗ ${v.confidence.toFixed(2)}</span>`;
          const picked = c.url === finder.url ? "🎯 " : "";
          return `<tr>
            <td><img src="${escapeHtml(c.thumbnail)}" alt="" loading="lazy" /></td>
            <td>
              <div class="src">${picked}<a href="${escapeHtml(c.pageUrl)}" target="_blank">${escapeHtml(c.source || "?")}</a></div>
              <div class="meta">${c.width}×${c.height} · query: <em>${escapeHtml(c.fromQuery)}</em></div>
              <div class="verdict">${verdict}</div>
              <div class="reason">${escapeHtml(v?.reason ?? "")}</div>
            </td>
          </tr>`;
        })
        .join("");

      const publisherBlock = it.imageUrl
        ? `<div class="publisher">
            <h4>Publisher og:image</h4>
            <img src="${escapeHtml(it.imageUrl)}" alt="" loading="lazy" />
            <div class="meta">${it.imageMeta?.width ?? "?"}×${it.imageMeta?.height ?? "?"}</div>
          </div>`
        : "";

      return `<section class="item">
        <h2>${escapeHtml(it.title ?? "(no title)")}</h2>
        <div class="meta">id=${escapeHtml(it.id)} · category=${it.category} · entity=${escapeHtml(
          it.entity?.personName ?? "—",
        )}</div>
        <div class="badges">${pubBadge} ${decisionBadge} <span class="badge">cost ≈ $${finder.estCostUsd.toFixed(5)} · ${r.elapsedMs}ms</span></div>
        <div class="row">
          ${publisherBlock}
          <div class="finder">
            <h4>LLM finder decision</h4>
            <div class="decision">${escapeHtml(finder.reason)}</div>
            <div class="queries"><strong>queries:</strong> ${finder.queries
              .map((q) => `<code>${escapeHtml(q)}</code>`)
              .join(" ")}</div>
          </div>
        </div>
        <h4>Candidates (${finder.candidates.length})</h4>
        <table class="candidates">${candidateRows || "<tr><td>none</td></tr>"}</table>
      </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>EdLight LLM image finder demo</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 1100px; margin: 2rem auto; color: #111; }
  h1 { border-bottom: 2px solid #111; padding-bottom: .5rem; }
  section.item { border: 1px solid #ddd; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 2rem; }
  section.item h2 { margin: 0; font-size: 1.15rem; }
  .meta { color: #666; font-size: .85rem; margin: .25rem 0; }
  .badges { display: flex; gap: .5rem; margin: .5rem 0 1rem; flex-wrap: wrap; }
  .badge { padding: 2px 8px; border-radius: 4px; font-size: .8rem; background: #eee; }
  .badge.ok { background: #d4edda; color: #155724; }
  .badge.bad { background: #f8d7da; color: #721c24; }
  .badge.unknown { background: #fff3cd; color: #856404; }
  .badge.none { background: #e2e3e5; color: #383d41; }
  .row { display: flex; gap: 1.5rem; }
  .publisher img, .candidates img { max-width: 220px; max-height: 220px; border: 1px solid #ccc; }
  .finder { flex: 1; }
  .decision { font-style: italic; margin-bottom: .5rem; }
  .queries code { background: #eef; padding: 1px 6px; border-radius: 3px; margin-right: 4px; font-size: .85rem; }
  table.candidates { border-collapse: collapse; margin-top: .5rem; width: 100%; }
  table.candidates td { vertical-align: top; padding: .5rem; border-top: 1px solid #eee; }
  .src { font-weight: 600; }
  .verdict { margin: .25rem 0; }
  .reason { color: #555; font-size: .85rem; }
  summary, footer { color: #666; }
</style>
</head><body>
<h1>LLM image finder demo</h1>
<p>Generated ${new Date().toISOString()} · ${reports.length} items · est total cost ≈ <strong>$${totalCost.toFixed(4)}</strong></p>
${sections}
<footer><small>🎯 = the candidate that was selected as the final image. Verdicts are from gemini-2.5-flash-lite.</small></footer>
</body></html>`;
}

function logTerminal(r: ItemReport) {
  const it = r.item;
  console.log("\n" + "═".repeat(80));
  console.log(`📰 ${it.title}`);
  console.log(`   id=${it.id}  category=${it.category}  entity=${it.entity?.personName ?? "—"}`);
  if (it.imageUrl) {
    const v = r.publisherValidation;
    console.log(`   publisher image: ${it.imageUrl}`);
    if (v) {
      const tag = v.match ? "✅" : "❌";
      console.log(`   publisher LLM verdict: ${tag} confidence=${v.confidence.toFixed(2)} — ${v.reason}`);
    } else {
      console.log(`   publisher LLM verdict: (could not run)`);
    }
  } else {
    console.log(`   publisher image: (none)`);
  }
  console.log(`   queries: ${r.finder.queries.map((q) => `"${q}"`).join("  ")}`);
  console.log(`   candidates: ${r.finder.candidates.length}`);
  for (const c of r.finder.candidates) {
    const v = c.validation;
    const tag = !v ? "·" : v.match ? "✅" : "❌";
    const star = c.url === r.finder.url ? "🎯" : "  ";
    console.log(
      `     ${star} ${tag} ${c.source.padEnd(30)} ${c.width}×${c.height}  ` +
        `${v ? `conf=${v.confidence.toFixed(2)} ` : ""}${(v?.reason ?? "").slice(0, 70)}`,
    );
  }
  console.log(`   decision: ${r.finder.url ? "PICKED " + r.finder.url : "REJECTED — fall back to gradient"}`);
  console.log(`   reason:   ${r.finder.reason}`);
  console.log(`   cost ≈ $${r.finder.estCostUsd.toFixed(5)}  elapsed=${r.elapsedMs}ms`);
}

async function main() {
  const args = process.argv.slice(2);
  const items = await loadItems(args);
  if (items.length === 0) {
    console.error("No items loaded.");
    process.exit(1);
  }
  console.log(`Running LLM image finder on ${items.length} item(s)…\n`);

  const reports: ItemReport[] = [];
  for (const it of items) {
    const t0 = Date.now();
    try {
      const [publisherValidation, finder] = await Promise.all([
        it.imageUrl ? validatePublisherImage(it) : Promise.resolve(null),
        findImageWithLlm(it),
      ]);
      const elapsedMs = Date.now() - t0;
      const r: ItemReport = { item: it, publisherValidation, finder, elapsedMs };
      reports.push(r);
      logTerminal(r);
    } catch (err) {
      console.error(`item ${it.id} threw:`, err instanceof Error ? err.message : err);
    }
  }

  const html = reportToHtml(reports);
  const outPath = "/tmp/llm-image-finder-demo.html";
  writeFileSync(outPath, html, "utf8");
  const totalCost = reports.reduce((s, r) => s + r.finder.estCostUsd, 0);
  console.log("\n" + "═".repeat(80));
  console.log(`✅ Demo complete. Total est cost ≈ $${totalCost.toFixed(4)} for ${reports.length} item(s).`);
  console.log(`📄 HTML report: ${outPath}`);
  console.log(`   Open with:  "$BROWSER" ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
