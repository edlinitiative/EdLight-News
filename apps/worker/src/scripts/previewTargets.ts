/**
 * previewTargets.ts — render a specific set of igTypes from today's queue
 * and produce an HTML gallery at /tmp/ig-preview-targets/index.html.
 *
 * Searches both queued AND scheduled statuses for each requested type so
 * taux (which is typically pre-scheduled) is always included.
 *
 * Usage:
 *   cd apps/worker && npx tsx src/scripts/previewTargets.ts
 *   npx tsx src/scripts/previewTargets.ts news histoire taux opportunity
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "@edlight-news/firebase";
import { renderWithIgEngine } from "@edlight-news/renderer/ig-engine-render.js";
import type { IGQueueItem } from "@edlight-news/types";

const OUT = "/tmp/ig-preview-targets";

// Types to preview — can be overridden via CLI args
const DEFAULT_TARGETS = ["news", "histoire", "taux", "opportunity"];
const targets: string[] = process.argv.slice(2).length
  ? process.argv.slice(2)
  : DEFAULT_TARGETS;

const ACCENT: Record<string, string> = {
  news: "#3b82f6",
  histoire: "#f59e0b",
  taux: "#22c55e",
  opportunity: "#10b981",
  scholarship: "#60a5fa",
  utility: "#a855f7",
};

async function fetchCandidates(igType: string): Promise<IGQueueItem[]> {
  const db = getDb();
  // Query by igType only (avoids composite index requirement), filter status in-memory.
  const snap = await db
    .collection("ig_queue")
    .where("igType", "==", igType)
    .get();
  const active = new Set(["queued", "scheduled", "scheduled_ready_for_manual"]);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as IGQueueItem))
    .filter((i) => active.has(i.status))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5);
}

interface Section {
  igType: string;
  itemId: string;
  title: string;
  slideCount: number;
  slidePaths: string[];
  caption: string;
  status: string;
}

async function main() {
  console.log(`=== IG Preview — ${targets.join(", ")} ===\n`);
  mkdirSync(OUT, { recursive: true });

  const sections: Section[] = [];
  const missing: string[] = [];

  for (const igType of targets) {
    console.log(`\n▶  ${igType}`);

    const candidates = await fetchCandidates(igType);
    if (candidates.length === 0) {
      console.log(`   ⚠ No items found for type "${igType}" (queued or scheduled)`);
      missing.push(igType);
      continue;
    }

    let rendered = false;
    for (const queueItem of candidates) {
      if (!queueItem.payload) {
        console.log(`   skip ${queueItem.id} — no payload`);
        continue;
      }
      console.log(`   Trying ${queueItem.id} (status=${queueItem.status})…`);

      try {
        const assets = await renderWithIgEngine(queueItem, queueItem.payload);
        console.log(`   ✓ ${assets.slidePaths.length} slides rendered`);

        const localPaths: string[] = [];
        for (let i = 0; i < assets.slidePaths.length; i++) {
          const dest = join(OUT, `${igType}-slide-${i + 1}.png`);
          writeFileSync(dest, readFileSync(assets.slidePaths[i]!));
          localPaths.push(dest);
        }

        sections.push({
          igType,
          itemId: queueItem.id,
          title: queueItem.payload.slides[0]?.heading ?? "(no heading)",
          slideCount: assets.slidePaths.length,
          slidePaths: localPaths,
          caption: queueItem.payload.caption.slice(0, 350),
          status: queueItem.status,
        });
        rendered = true;
        break;
      } catch (err) {
        console.log(`   ✗ ${err instanceof Error ? err.message.slice(0, 160) : err}`);
      }
    }
    if (!rendered && !missing.includes(igType)) {
      console.log(`   ⚠ All candidates failed rendering for ${igType}`);
      missing.push(igType);
    }
  }

  // ── HTML gallery ─────────────────────────────────────────────────────────────
  const body = sections.map((sec) => {
    const accent = ACCENT[sec.igType] ?? "#94a3b8";
    const badge = sec.status === "scheduled"
      ? `<span style="font-size:10px;background:#1e3a5f;color:#93c5fd;padding:2px 7px;border-radius:4px;margin-left:8px">SCHEDULED</span>`
      : `<span style="font-size:10px;background:#1a3323;color:#86efac;padding:2px 7px;border-radius:4px;margin-left:8px">QUEUED</span>`;

    const imgs = sec.slidePaths.map((p, i) => {
      const b64 = readFileSync(p).toString("base64");
      return `<div style="flex-shrink:0;text-align:center">
        <p style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Slide ${i + 1}</p>
        <img src="data:image/png;base64,${b64}" width="270" height="338"
             style="border-radius:10px;display:block;box-shadow:0 4px 16px rgba(0,0,0,.5)" />
      </div>`;
    }).join("");

    return `<section style="margin-bottom:64px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="width:10px;height:10px;border-radius:50%;background:${accent};flex-shrink:0"></div>
        <h2 style="font-size:17px;font-weight:700;text-transform:uppercase;letter-spacing:1px">${sec.igType}</h2>
        ${badge}
        <span style="font-size:11px;color:#475569;font-family:monospace;margin-left:8px">${sec.itemId}</span>
        <span style="margin-left:auto;font-size:13px;color:#64748b">${sec.slideCount} slides</span>
      </div>
      <p style="font-size:13px;color:#94a3b8;margin-bottom:4px;font-weight:600">${sec.title}</p>
      <p style="font-size:11px;color:#475569;margin-bottom:16px;font-style:italic;max-width:800px">${sec.caption}…</p>
      <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px">${imgs}</div>
    </section>`;
  }).join("");

  const missingHtml = missing.length
    ? `<div style="background:#1c0a0a;border:1px solid #7f1d1d;border-radius:8px;padding:16px;margin-bottom:32px">
        <p style="color:#fca5a5;font-size:13px">⚠ No items found for: <strong>${missing.join(", ")}</strong></p>
      </div>`
    : "";

  const haitian = new Date().toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Port-au-Prince",
  });

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>EdLight News — IG Preview (${targets.join(", ")})</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:system-ui,sans-serif;background:#080f1e;color:#e2e8f0;padding:44px 40px}
  h1{font-size:20px;font-weight:700;margin-bottom:4px}
  .meta{font-size:12px;color:#475569;margin-bottom:40px}
</style>
</head>
<body>
<h1>EdLight News — IG Preview</h1>
<p class="meta">${haitian} · ${sections.length}/${targets.length} types rendered</p>
${missingHtml}
${body}
</body>
</html>`;

  const htmlPath = join(OUT, "index.html");
  writeFileSync(htmlPath, html, "utf-8");

  console.log(`\n✅  Gallery → ${htmlPath}`);
  if (missing.length) console.log(`⚠  Missing types: ${missing.join(", ")}`);
  console.log(`   Rendered: ${sections.map((s) => s.igType).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
