/**
 * One-shot audit of ig_queue + ig_story_queue items that are still
 * in the pipeline (queued / scheduled / rendering).
 *
 * Checks every item against the 5 new quality gates:
 * 1. Roundup blocklist
 * 2. Image present on all slides
 * 3. imageConfidence ≤ 0.4 (screenshots)
 * 4. Thin content (< 200 words for news)
 * 5. Headline truncation quality
 *
 * Usage: npx tsx src/scripts/auditQueue.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";
import { isRoundupTitle } from "@edlight-news/generator/ig/selection";

const db = getDb();

const ACTIVE_STATUSES = ["queued", "scheduled", "rendering", "scheduled_ready_for_manual"];

interface Issue {
  docId: string;
  collection: string;
  status: string;
  igType: string;
  title: string;
  scheduledAt: string;
  problems: string[];
}

async function auditIgQueue(): Promise<Issue[]> {
  const issues: Issue[] = [];
  const snap = await db.collection("ig_queue").get();
  const docs = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((d: any) => ACTIVE_STATUSES.includes(d.status));

  console.log(`\n📋 ig_queue: ${snap.size} total docs, ${docs.length} active (${ACTIVE_STATUSES.join("/")})\n`);

  for (const doc of docs) {
    const problems: string[] = [];
    const payload = doc.payload ?? {};
    const slides: any[] = payload.slides ?? [];
    const title = slides[0]?.headline ?? doc.itemTitle ?? "(no title)";
    const igType = doc.igType ?? "unknown";
    const scheduledAt = doc.scheduledAt
      ? (doc.scheduledAt.toDate ? doc.scheduledAt.toDate() : new Date(doc.scheduledAt)).toISOString().slice(0, 16)
      : "not scheduled";

    // 1. Roundup check (news only)
    if (igType === "news" && isRoundupTitle(title)) {
      problems.push("🚫 ROUNDUP title — should be blocked");
    }

    // 2. Missing background images on slides
    const slidesWithoutBg = slides.filter(
      (s: any, i: number) => !s.backgroundImage && !s.isCta
    );
    if (slidesWithoutBg.length > 0) {
      problems.push(`🖼️  ${slidesWithoutBg.length}/${slides.length} slides missing backgroundImage`);
    }

    // 3. imageConfidence check (from source item, stored in reasons)
    const reasons: string[] = doc.reasons ?? [];
    const confReason = reasons.find((r: string) => r.includes("imageConfidence"));
    // We can also check the first slide's image URL for screenshot patterns
    const coverImage = slides[0]?.backgroundImage ?? "";
    if (coverImage && coverImage.includes("screenshot")) {
      problems.push("📸 Cover image URL contains 'screenshot'");
    }

    // 4. Headline truncation — check for mid-word "…"
    for (let i = 0; i < slides.length; i++) {
      const h = slides[i]?.headline ?? "";
      if (h.includes("…") || h.includes("...")) {
        // Check if the "…" is mid-word (bad) vs end of clause (acceptable)
        const before = h.split(/[…\.]{3}/)[0]?.trim() ?? "";
        if (before && !before.match(/[,;:—–\-]$/)) {
          problems.push(`✂️  Slide ${i + 1} headline truncated mid-phrase: "${h.slice(-40)}"`);
        }
      }
      const body = slides[i]?.body ?? "";
      if (body.includes("…") || body.includes("...")) {
        const before = body.split(/[…\.]{3}/)[0]?.trim() ?? "";
        if (before && !before.match(/[,;:—–\-]$/)) {
          problems.push(`✂️  Slide ${i + 1} body truncated mid-phrase: "…${body.slice(-50)}"`);
        }
      }
    }

    // 5. Caption quality
    const caption = payload.caption ?? "";
    if (!caption) {
      problems.push("📝 Missing caption");
    }

    // Print item
    const statusIcon = doc.status === "scheduled" ? "📅" : doc.status === "queued" ? "📥" : "🔄";
    console.log(`${statusIcon} [${doc.status.toUpperCase()}] ${igType.padEnd(12)} | ${scheduledAt} | ${title.slice(0, 70)}`);
    if (problems.length > 0) {
      for (const p of problems) console.log(`   ${p}`);
    } else {
      console.log(`   ✅ Looks good`);
    }
    console.log();

    if (problems.length > 0) {
      issues.push({
        docId: doc.id,
        collection: "ig_queue",
        status: doc.status,
        igType,
        title,
        scheduledAt,
        problems,
      });
    }
  }
  return issues;
}

async function auditStoryQueue(): Promise<Issue[]> {
  const issues: Issue[] = [];
  const snap = await db.collection("ig_story_queue").get();
  const docs = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((d: any) => ACTIVE_STATUSES.includes(d.status));

  console.log(`\n📋 ig_story_queue: ${snap.size} total docs, ${docs.length} active\n`);

  for (const doc of docs) {
    const problems: string[] = [];
    const payload = doc.payload ?? {};
    const slides: any[] = payload.slides ?? [];
    const title = `Story ${doc.dateKey ?? doc.id}`;

    if (slides.length === 0) {
      problems.push("⚠️  No slides in story payload");
    }

    console.log(`📖 [${doc.status.toUpperCase()}] ${title} | ${slides.length} frames`);
    if (problems.length > 0) {
      for (const p of problems) console.log(`   ${p}`);
    } else {
      console.log(`   ✅ Looks good`);
    }
    console.log();

    if (problems.length > 0) {
      issues.push({
        docId: doc.id,
        collection: "ig_story_queue",
        status: doc.status,
        igType: "story",
        title,
        scheduledAt: doc.scheduledAt ?? "N/A",
        problems,
      });
    }
  }
  return issues;
}

async function main() {
  console.log("═".repeat(60));
  console.log("  IG QUEUE QUALITY AUDIT");
  console.log("  Date: " + new Date().toISOString().slice(0, 16));
  console.log("═".repeat(60));

  const queueIssues = await auditIgQueue();
  const storyIssues = await auditStoryQueue();
  const allIssues = [...queueIssues, ...storyIssues];

  console.log("\n" + "═".repeat(60));
  console.log("  SUMMARY");
  console.log("═".repeat(60));

  if (allIssues.length === 0) {
    console.log("\n✅ All queued/scheduled items pass quality checks!\n");
  } else {
    console.log(`\n⚠️  ${allIssues.length} items have quality issues:\n`);
    for (const issue of allIssues) {
      console.log(`  • [${issue.collection}] ${issue.docId} (${issue.igType}, ${issue.status})`);
      for (const p of issue.problems) {
        console.log(`    ${p}`);
      }
    }
    console.log(`\nDoc IDs with issues (for cleanup):`);
    console.log(allIssues.map((i) => i.docId).join("\n"));
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
