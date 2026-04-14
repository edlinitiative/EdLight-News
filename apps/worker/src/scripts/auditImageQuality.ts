#!/usr/bin/env npx tsx
/**
 * Deep audit of IG queue: stale-story carry-over + image quality/accuracy.
 *
 * Checks:
 *  1. Items posted today that were actually queued on a DIFFERENT day (stale carry-over)
 *  2. Background image URLs on all posted/scheduled slides: resolution, relevance, broken
 *  3. Items still sitting in "queued" status from previous days
 *  4. Image source breakdown (Wikimedia, Unsplash, Gemini, publisher, etc.)
 *  5. Fetches actual image dimensions for a sample of background images
 *
 * Usage:
 *   cd apps/worker && npx tsx src/scripts/auditImageQuality.ts
 */

import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";
import { Timestamp } from "firebase-admin/firestore";

const db = getDb();
const HAITI_TZ = "America/Port-au-Prince";

// ── Helpers ─────────────────────────────────────────────────────────────────

function getHaitiDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HAITI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function tsToDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

function fmtDate(ts: any): string {
  const d = tsToDate(ts);
  if (!d) return "N/A";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function ageHours(ts: any): number {
  const d = tsToDate(ts);
  if (!d) return -1;
  return Math.round((Date.now() - d.getTime()) / 3600_000);
}

function classifyImageSource(url: string | undefined): string {
  if (!url) return "NONE";
  if (url.includes("firebasestorage.googleapis.com") && url.includes("ig/generated")) return "gemini-ai";
  if (url.includes("firebasestorage.googleapis.com") && url.includes("ig/assets")) return "branded-asset";
  if (url.includes("firebasestorage.googleapis.com")) return "firebase-other";
  if (url.includes("upload.wikimedia.org")) return "wikimedia";
  if (url.includes("images.unsplash.com")) return "unsplash";
  if (url.includes("flickr.com") || url.includes("staticflickr.com")) return "flickr";
  if (url.includes("loc.gov")) return "loc-archive";
  if (url.includes("edlight")) return "edlight-internal";
  return "publisher/external";
}

async function probeImageDimensions(url: string): Promise<{ width: number; height: number; sizeKb: number; ok: boolean } | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "EdLight-Audit/1.0" },
    });
    if (!res.ok) return { width: 0, height: 0, sizeKb: 0, ok: false };

    const contentLength = res.headers.get("content-length");
    const sizeKb = contentLength ? Math.round(parseInt(contentLength, 10) / 1024) : 0;
    const contentType = res.headers.get("content-type") ?? "";

    // For PNG/JPEG we can read dimensions from the header bytes
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const actualSizeKb = Math.round(bytes.length / 1024);

    let width = 0;
    let height = 0;

    // PNG signature: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      // IHDR chunk starts at byte 16: width (4 bytes) + height (4 bytes)
      width = (bytes[16]! << 24) | (bytes[17]! << 16) | (bytes[18]! << 8) | bytes[19]!;
      height = (bytes[20]! << 24) | (bytes[21]! << 16) | (bytes[22]! << 8) | bytes[23]!;
    }
    // JPEG signature: FF D8
    else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      // Scan SOF markers for dimensions
      let i = 2;
      while (i < bytes.length - 8) {
        if (bytes[i] === 0xff) {
          const marker = bytes[i + 1]!;
          // SOF markers: C0, C1, C2
          if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
            height = (bytes[i + 5]! << 8) | bytes[i + 6]!;
            width = (bytes[i + 7]! << 8) | bytes[i + 8]!;
            break;
          }
          // Skip to next marker
          const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
          i += 2 + len;
        } else {
          i++;
        }
      }
    }

    return { width, height, sizeKb: actualSizeKb, ok: true };
  } catch {
    return null;
  }
}

// ── Main audit ──────────────────────────────────────────────────────────────

async function main() {
  const haitiToday = getHaitiDateKey();
  const now = new Date();
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  IG QUEUE IMAGE & STALENESS AUDIT`);
  console.log(`  Haiti date: ${haitiToday}   UTC: ${now.toISOString().slice(0, 16)}`);
  console.log(`${"═".repeat(70)}\n`);

  // ── 1. Fetch all ig_queue items from the last 5 days ──────────────────
  const since = Timestamp.fromDate(new Date(Date.now() - 5 * 86_400_000));
  const snap = await db.collection("ig_queue")
    .where("createdAt", ">=", since)
    .orderBy("createdAt", "desc")
    .get();

  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  console.log(`📊 Total ig_queue items (last 5 days): ${items.length}\n`);

  // ── 2. Status breakdown ───────────────────────────────────────────────
  const statusCounts: Record<string, number> = {};
  for (const item of items) {
    statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
  }
  console.log("── Status breakdown ──");
  for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(30)} ${count}`);
  }

  // ── 3. STALE CARRY-OVER ANALYSIS ─────────────────────────────────────
  console.log(`\n${"─".repeat(70)}`);
  console.log("  STALE CARRY-OVER ANALYSIS (items posted/scheduled today)");
  console.log(`${"─".repeat(70)}\n`);

  const todayItems = items.filter((item) => {
    if (item.status !== "posted" && item.status !== "scheduled" && item.status !== "rendering") return false;
    // Check if updated/scheduled today
    const updatedDate = tsToDate(item.updatedAt);
    if (updatedDate) {
      const updateDay = getHaitiDateKey(updatedDate);
      if (updateDay === haitiToday) return true;
    }
    if (item.scheduledFor) {
      const schedDay = getHaitiDateKey(new Date(item.scheduledFor));
      if (schedDay === haitiToday) return true;
    }
    return false;
  });

  console.log(`Items posted/scheduled today: ${todayItems.length}\n`);

  let staleCount = 0;
  for (const item of todayItems) {
    const createdDate = tsToDate(item.createdAt);
    const createdDay = createdDate ? getHaitiDateKey(createdDate) : "unknown";
    const queuedDate = item.queuedDate ?? "NOT SET";
    const isCarryOver = createdDay !== haitiToday;
    const age = ageHours(item.createdAt);
    const targetPostDate = item.targetPostDate ?? "none";

    if (isCarryOver) staleCount++;

    const marker = isCarryOver ? "⚠️  CARRY-OVER" : "✅ SAME DAY";
    const title = item.payload?.slides?.[0]?.heading?.slice(0, 50) ?? "(no title)";
    console.log(`  ${marker}  [${item.igType}] ${title}`);
    console.log(`    id: ${item.id}`);
    console.log(`    created: ${fmtDate(item.createdAt)} (${createdDay})  age: ${age}h`);
    console.log(`    queuedDate: ${queuedDate}   targetPostDate: ${targetPostDate}`);
    console.log(`    status: ${item.status}   score: ${item.score}`);
    console.log();
  }

  if (staleCount > 0) {
    console.log(`  🔴 ${staleCount}/${todayItems.length} items were CARRY-OVERS from previous days!\n`);
  } else {
    console.log(`  🟢 All ${todayItems.length} items were queued today — no carry-overs.\n`);
  }

  // ── 4. STALE QUEUED ITEMS (still waiting from previous days) ──────────
  console.log(`${"─".repeat(70)}`);
  console.log("  STALE QUEUED ITEMS (still in 'queued' status from previous days)");
  console.log(`${"─".repeat(70)}\n`);

  const staleQueued = items.filter((item) => {
    if (item.status !== "queued") return false;
    const createdDate = tsToDate(item.createdAt);
    if (!createdDate) return false;
    return getHaitiDateKey(createdDate) !== haitiToday;
  });

  if (staleQueued.length === 0) {
    console.log("  🟢 No stale queued items.\n");
  } else {
    console.log(`  🔴 ${staleQueued.length} items still 'queued' from previous days:\n`);
    for (const item of staleQueued.slice(0, 15)) {
      const title = item.payload?.slides?.[0]?.heading?.slice(0, 50) ?? "(no title)";
      const age = ageHours(item.createdAt);
      console.log(`    [${item.igType}] age=${age}h  score=${item.score}  "${title}"`);
    }
    if (staleQueued.length > 15) console.log(`    ... and ${staleQueued.length - 15} more`);
    console.log();
  }

  // ── 5. IMAGE QUALITY ANALYSIS ─────────────────────────────────────────
  console.log(`${"─".repeat(70)}`);
  console.log("  IMAGE QUALITY ANALYSIS (all posted items, last 3 days)");
  console.log(`${"─".repeat(70)}\n`);

  const recentPosted = items.filter((item) => {
    if (item.status !== "posted") return false;
    return ageHours(item.createdAt) <= 72;
  });

  console.log(`Recently posted items to analyze: ${recentPosted.length}\n`);

  // Collect all unique background image URLs across all slides
  const imageStats = {
    totalSlides: 0,
    slidesWithImage: 0,
    slidesWithoutImage: 0,
    uniqueImages: new Set<string>(),
    sourceCounts: {} as Record<string, number>,
    allSlidesByPost: [] as Array<{
      postId: string;
      igType: string;
      title: string;
      slideIndex: number;
      imageUrl: string | undefined;
      imageSource: string;
    }>,
  };

  for (const item of recentPosted) {
    const slides = item.payload?.slides ?? [];
    const title = slides[0]?.heading?.slice(0, 50) ?? "(no title)";
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const bgImage = slide?.backgroundImage;
      const source = classifyImageSource(bgImage);
      imageStats.totalSlides++;
      if (bgImage) {
        imageStats.slidesWithImage++;
        imageStats.uniqueImages.add(bgImage);
      } else {
        imageStats.slidesWithoutImage++;
      }
      imageStats.sourceCounts[source] = (imageStats.sourceCounts[source] ?? 0) + 1;
      imageStats.allSlidesByPost.push({
        postId: item.id,
        igType: item.igType,
        title,
        slideIndex: i,
        imageUrl: bgImage,
        imageSource: source,
      });
    }
  }

  console.log(`  Total slides: ${imageStats.totalSlides}`);
  console.log(`  With image:   ${imageStats.slidesWithImage} (${((imageStats.slidesWithImage / imageStats.totalSlides) * 100).toFixed(1)}%)`);
  console.log(`  Without image: ${imageStats.slidesWithoutImage} (${((imageStats.slidesWithoutImage / imageStats.totalSlides) * 100).toFixed(1)}%)`);
  console.log(`  Unique images: ${imageStats.uniqueImages.size}\n`);

  console.log("  Image source breakdown:");
  for (const [source, count] of Object.entries(imageStats.sourceCounts).sort((a, b) => b[1] - a[1])) {
    const pctStr = ((count / imageStats.totalSlides) * 100).toFixed(1);
    console.log(`    ${source.padEnd(25)} ${String(count).padStart(4)}  (${pctStr}%)`);
  }

  // ── 6. SLIDES WITHOUT IMAGES (potential rendering issues) ─────────────
  const missingImagePosts = imageStats.allSlidesByPost.filter((s) => !s.imageUrl);
  if (missingImagePosts.length > 0) {
    console.log(`\n  🔴 Slides MISSING background images:`);
    for (const s of missingImagePosts.slice(0, 20)) {
      console.log(`    Post ${s.postId} [${s.igType}] slide ${s.slideIndex}: "${s.title}"`);
    }
    if (missingImagePosts.length > 20) console.log(`    ... and ${missingImagePosts.length - 20} more`);
  }

  // ── 7. ALL-SAME-IMAGE CHECK (every slide has identical image) ─────────
  console.log(`\n── Per-post image variety check ──\n`);
  const postImageGroups = new Map<string, { images: Set<string>; igType: string; title: string }>();
  for (const s of imageStats.allSlidesByPost) {
    if (!postImageGroups.has(s.postId)) {
      postImageGroups.set(s.postId, { images: new Set(), igType: s.igType, title: s.title });
    }
    if (s.imageUrl) postImageGroups.get(s.postId)!.images.add(s.imageUrl);
  }

  let allSameCount = 0;
  let diverseCount = 0;
  for (const [postId, { images, igType, title }] of postImageGroups) {
    if (images.size <= 1) {
      allSameCount++;
      // Only print for histoire (where we'd expect different images per slide)
      if (igType === "histoire") {
        console.log(`  ⚠️  [histoire] ALL slides same image: "${title}"  (post ${postId})`);
      }
    } else {
      diverseCount++;
    }
  }
  console.log(`\n  Posts with single image:   ${allSameCount}`);
  console.log(`  Posts with diverse images: ${diverseCount}`);

  // ── 8. PROBE ACTUAL IMAGE DIMENSIONS ──────────────────────────────────
  console.log(`\n${"─".repeat(70)}`);
  console.log("  ACTUAL IMAGE DIMENSION PROBE (sampling up to 15 unique images)");
  console.log(`${"─".repeat(70)}\n`);

  const uniqueUrls = [...imageStats.uniqueImages].slice(0, 15);
  let tooSmallCount = 0;
  let wrongAspectCount = 0;
  let brokenCount = 0;
  let goodCount = 0;

  for (const url of uniqueUrls) {
    const source = classifyImageSource(url);
    const dims = await probeImageDimensions(url);

    if (!dims) {
      console.log(`  ❌ TIMEOUT  ${source.padEnd(20)} ${url.slice(0, 80)}`);
      brokenCount++;
      continue;
    }
    if (!dims.ok) {
      console.log(`  ❌ BROKEN   ${source.padEnd(20)} ${url.slice(0, 80)}`);
      brokenCount++;
      continue;
    }
    if (dims.width === 0 && dims.height === 0) {
      console.log(`  ❓ NO DIMS  ${source.padEnd(20)} size=${dims.sizeKb}KB  ${url.slice(0, 80)}`);
      continue;
    }

    const aspect = dims.width / Math.max(dims.height, 1);
    const idealAspect = 4 / 5; // 0.8
    const aspectOk = Math.abs(aspect - idealAspect) < 0.15;
    const sizeOk = Math.min(dims.width, dims.height) >= 1080;

    let status = "✅ OK    ";
    if (!sizeOk) {
      status = "⚠️  SMALL  ";
      tooSmallCount++;
    } else if (!aspectOk) {
      status = "⚠️  ASPECT ";
      wrongAspectCount++;
    } else {
      goodCount++;
    }

    console.log(
      `  ${status} ${dims.width}×${dims.height} (${aspect.toFixed(2)}) ` +
      `${dims.sizeKb}KB  ${source.padEnd(18)} ${url.slice(0, 60)}`,
    );
  }

  console.log(`\n  Summary: ${goodCount} good, ${tooSmallCount} too small, ${wrongAspectCount} wrong aspect, ${brokenCount} broken`);

  // ── 9. POST-BY-POST DETAIL (today's posts) ───────────────────────────
  console.log(`\n${"─".repeat(70)}`);
  console.log("  POST-BY-POST DETAIL (today's posted/scheduled items)");
  console.log(`${"─".repeat(70)}\n`);

  for (const item of todayItems.slice(0, 20)) {
    const slides = item.payload?.slides ?? [];
    const title = slides[0]?.heading?.slice(0, 60) ?? "(no title)";
    const coverBg = slides[0]?.backgroundImage;
    const coverSource = classifyImageSource(coverBg);
    const createdDay = tsToDate(item.createdAt) ? getHaitiDateKey(tsToDate(item.createdAt)!) : "?";
    const isStale = createdDay !== haitiToday;

    console.log(`  ┌── ${item.igType.toUpperCase()} ${isStale ? "⚠️ STALE" : "✅"} ──────────────────`);
    console.log(`  │ "${title}"`);
    console.log(`  │ id: ${item.id}   score: ${item.score}   status: ${item.status}`);
    console.log(`  │ created: ${createdDay}   queuedDate: ${item.queuedDate ?? "NOT SET"}`);
    console.log(`  │ slides: ${slides.length}   cover image: ${coverSource}`);

    // Check each slide's image
    const slideImageSources = slides.map((s: any) => classifyImageSource(s?.backgroundImage));
    const uniqueSlideImages = new Set(slides.map((s: any) => s?.backgroundImage).filter(Boolean));
    console.log(`  │ unique images: ${uniqueSlideImages.size}   sources: [${[...new Set(slideImageSources)].join(", ")}]`);

    // Probe cover image dimensions
    if (coverBg) {
      const dims = await probeImageDimensions(coverBg);
      if (dims && dims.ok && dims.width > 0) {
        const sizeOk = Math.min(dims.width, dims.height) >= 1080;
        console.log(`  │ cover dims: ${dims.width}×${dims.height} ${dims.sizeKb}KB ${sizeOk ? "✅" : "⚠️ TOO SMALL"}`);
      } else if (dims && !dims.ok) {
        console.log(`  │ cover: ❌ BROKEN URL`);
      }
    }

    // Check if caption exists and is reasonable
    const caption = item.payload?.caption ?? "";
    console.log(`  │ caption: ${caption.length > 0 ? `${caption.length} chars` : "❌ MISSING"}`);
    console.log(`  └${"─".repeat(50)}`);
    console.log();
  }

  // ── 10. SUMMARY ──────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(70)}`);
  console.log("  AUDIT SUMMARY");
  console.log(`${"═".repeat(70)}\n`);

  console.log(`  Haiti today:              ${haitiToday}`);
  console.log(`  Total items (5 days):     ${items.length}`);
  console.log(`  Posted/scheduled today:   ${todayItems.length}`);
  console.log(`  Stale carry-overs today:  ${staleCount}`);
  console.log(`  Stale items still queued: ${staleQueued.length}`);
  console.log(`  Recent posted (3 days):   ${recentPosted.length}`);
  console.log(`  Slides without image:     ${imageStats.slidesWithoutImage}`);
  console.log(`  Images probed:            good=${goodCount} small=${tooSmallCount} wrong-aspect=${wrongAspectCount} broken=${brokenCount}`);
  console.log();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
