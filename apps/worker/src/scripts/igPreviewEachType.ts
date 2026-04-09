/**
 * IG Preview Each Type — render 1 post from each igType in the queue
 *
 * Picks the top item per igType from the existing queue, renders PNGs
 * via the IG Engine, and builds an HTML gallery at /tmp/ig-preview/index.html.
 * If the top item fails rendering (overflow), tries the next item of that type.
 *
 * Usage:  cd apps/worker && npx tsx src/scripts/igPreviewEachType.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { igQueueRepo } from "@edlight-news/firebase";
import { renderWithIgEngine } from "@edlight-news/renderer/ig-engine-render.js";
import type { IGQueueItem } from "@edlight-news/types";

const OUT = "/tmp/ig-preview";

interface PreviewSection {
  igType: string;
  itemId: string;
  title: string;
  slideCount: number;
  slidePaths: string[];
  caption: string;
}

async function main() {
  console.log("=== IG Preview Each Type ===\n");

  // Fetch all queued items
  const allQueued = await igQueueRepo.listQueuedByScore(80);
  console.log(`Found ${allQueued.length} total queued items`);

  // Group by igType
  const byType = new Map<string, IGQueueItem[]>();
  for (const item of allQueued) {
    const list = byType.get(item.igType) ?? [];
    list.push(item);
    byType.set(item.igType, list);
  }
  console.log(`Types: ${[...byType.keys()].join(", ")}\n`);

  if (byType.size === 0) {
    console.log("No items in queue.");
    process.exit(0);
  }

  mkdirSync(OUT, { recursive: true });
  const sections: PreviewSection[] = [];

  for (const [igType, candidates] of byType) {
    console.log(`\n▶  ${igType} (${candidates.length} candidates)`);

    let rendered = false;
    for (const queueItem of candidates.slice(0, 5)) {
      if (!queueItem.payload) continue;

      try {
        console.log(`  Trying ${queueItem.id}...`);
        const assets = await renderWithIgEngine(queueItem, queueItem.payload);
        console.log(`  ✓ ${assets.slidePaths.length} slides`);

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
          caption: queueItem.payload.caption.slice(0, 300),
        });
        rendered = true;
        break;
      } catch (err) {
        console.log(`  ✗ ${err instanceof Error ? err.message.slice(0, 120) : err}`);
      }
    }
    if (!rendered) {
      console.log(`  ⚠ No renderable item for ${igType}`);
    }
  }

  // Build HTML gallery
  const ACCENT: Record<string, string> = {
    news: "#3b82f6", histoire: "#f59e0b", opportunity: "#10b981",
    scholarship: "#60a5fa", utility: "#a855f7", breaking: "#ef4444",
  };

  const body = sections.map((sec) => {
    const accent = ACCENT[sec.igType] ?? "#94a3b8";
    const imgs = sec.slidePaths.map((p, i) => {
      const b64 = readFileSync(p).toString("base64");
      return `<div style="flex-shrink:0;text-align:center">
        <p style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">Slide ${i + 1}</p>
        <img src="data:image/png;base64,${b64}" width="324" height="405" style="border-radius:8px;display:block" />
      </div>`;
    }).join("");

    return `<section style="margin-bottom:56px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div style="width:12px;height:12px;border-radius:50%;background:${accent}"></div>
        <h2 style="font-size:18px;font-weight:700;text-transform:uppercase">${sec.igType}</h2>
        <span style="font-size:11px;color:#475569;font-family:monospace">${sec.itemId}</span>
        <span style="margin-left:auto;font-size:13px;color:#94a3b8">${sec.slideCount} slides</span>
      </div>
      <p style="font-size:14px;color:#cbd5e1;margin-bottom:14px">${sec.title}</p>
      <div style="display:flex;gap:14px;overflow-x:auto;padding-bottom:10px">${imgs}</div>
    </section>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>EdLight News — IG Preview</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0a1628;color:#e2e8f0;padding:40px 36px}
h1{font-size:22px;font-weight:700;margin-bottom:6px}.meta{font-size:13px;color:#475569;margin-bottom:36px}</style>
</head><body>
<h1>EdLight News — IG Preview (1 per type)</h1>
<p class="meta">${sections.length} types — ${new Date().toLocaleString("fr-FR",{dateStyle:"long",timeStyle:"short",timeZone:"America/Port-au-Prince"})}</p>
${body}
</body></html>`;

  writeFileSync(join(OUT, "index.html"), html, "utf-8");
  console.log(`\n✅  Gallery → /tmp/ig-preview/index.html`);
  console.log(`   ${sections.length} types: ${sections.map(s => s.igType).join(", ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
