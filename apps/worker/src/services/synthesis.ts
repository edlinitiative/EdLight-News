/**
 * Synthesis service — orchestrates multi-source "living article" creation.
 *
 * Runs as an optional step in the tick pipeline, after generate + publish.
 * Safety bounds: max 3 synthesis per tick, max 6 sources per synthesis.
 */

import { FieldValue } from "firebase-admin/firestore";
import {
  itemsRepo,
  contentVersionsRepo,
} from "@edlight-news/firebase";
import {
  generateSynthesisFromPacket,
  validateSynthesisGrounding,
  SYNTHESIS_PROMPT_VERSION,
  formatContentVersion,
} from "@edlight-news/generator";
import type {
  Item,
  SynthesisMeta,
  SynthesisSourceRef,
  QualityFlags,
  ItemCategory,
  ContentChannel,
  ContentLanguage,
  ContentStatus,
} from "@edlight-news/types";
import type { SynthesisSource, SynthesisPacket } from "@edlight-news/generator";
import { extractDomain, isAggregatorUrl } from "./scoring.js";
import { isBotProtectionPage } from "@edlight-news/scraper";

// ── Constants (Part I — safety bounds) ──────────────────────────────────────

const MAX_SYNTHESIS_PER_TICK = 3;
const MAX_SOURCES_PER_SYNTHESIS = 6;
const MIN_CLUSTER_SIZE = 3;
const MIN_DISTINCT_PUBLISHERS = 2;
const MIN_AUDIENCE_SCORE = 0.75;
const CLUSTER_WINDOW_DAYS = 3; // 72 hours

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Resolve the effective publisher identity for an item.
 * For items sourced through Google News / aggregators, the canonicalUrl
 * may still be news.google.com, so we fall back to the source name.
 */
function itemPublisher(item: Item): string {
  const domain = extractDomain(item.canonicalUrl);
  if (!isAggregatorUrl(item.canonicalUrl)) return domain;
  // Use source.name as publisher identity for aggregator-sourced items
  return item.source?.name?.toLowerCase().replace(/\s+/g, "-") ?? domain;
}

interface ClusterCandidate {
  dedupeGroupId: string;
  items: Item[];
  maxAudienceScore: number;
  distinctPublishers: string[];
}

export interface SynthesisResult {
  synthesized: number;
  updated: number;
  skipped: number;
  errors: number;
}

// ── Cluster selection (Part B) ──────────────────────────────────────────────

/**
 * Select eligible clusters for synthesis.
 * Criteria:
 *  - >= 3 source items in the cluster
 *  - >= 2 distinct publisher domains
 *  - max audienceFitScore among items >= 0.75
 */
async function selectClusters(): Promise<ClusterCandidate[]> {
  // Reduced from 500 to 150 — saves ~350 Firestore reads per tick
  const recentItems = await itemsRepo.listRecentSourceItems(
    CLUSTER_WINDOW_DAYS,
    150,
  );

  // Group by dedupeGroupId
  const groups = new Map<string, Item[]>();
  for (const item of recentItems) {
    if (!item.dedupeGroupId) continue;
    const list = groups.get(item.dedupeGroupId) ?? [];
    list.push(item);
    groups.set(item.dedupeGroupId, list);
  }

  // Filter eligible clusters
  const candidates: ClusterCandidate[] = [];
  for (const [dedupeGroupId, clusterItems] of groups) {
    if (clusterItems.length < MIN_CLUSTER_SIZE) continue;

    const publishers = [
      ...new Set(clusterItems.map((i) => itemPublisher(i))),
    ];
    if (publishers.length < MIN_DISTINCT_PUBLISHERS) continue;

    const maxScore = Math.max(
      ...clusterItems.map((i) => i.audienceFitScore ?? 0),
    );
    if (maxScore < MIN_AUDIENCE_SCORE) continue;

    candidates.push({
      dedupeGroupId,
      items: clusterItems,
      maxAudienceScore: maxScore,
      distinctPublishers: publishers,
    });
  }

  // Sort by max audience score desc, take top MAX_SYNTHESIS_PER_TICK
  candidates.sort((a, b) => b.maxAudienceScore - a.maxAudienceScore);
  return candidates.slice(0, MAX_SYNTHESIS_PER_TICK);
}

// ── Source packet building (Part C) ─────────────────────────────────────────

function buildSourcePacket(
  cluster: ClusterCandidate,
  existingSynthesis: Item | null,
): SynthesisPacket {
  const existingSourceIds = new Set(
    existingSynthesis?.synthesisMeta?.sourceItemIds ?? [],
  );

  // Sort items by audienceFitScore desc
  const sorted = [...cluster.items].sort((a, b) => {
    return (b.audienceFitScore ?? 0) - (a.audienceFitScore ?? 0);
  });

  // Pick up to MAX_SOURCES_PER_SYNTHESIS, preferring publisher diversity
  const selected: Item[] = [];
  const usedPublishers = new Set<string>();

  // First pass: one item per publisher (diversity)
  for (const item of sorted) {
    if (selected.length >= MAX_SOURCES_PER_SYNTHESIS) break;
    const domain = itemPublisher(item);
    if (!usedPublishers.has(domain)) {
      selected.push(item);
      usedPublishers.add(domain);
    }
  }

  // Second pass: fill remaining slots with highest-score items
  for (const item of sorted) {
    if (selected.length >= MAX_SOURCES_PER_SYNTHESIS) break;
    if (!selected.includes(item)) {
      selected.push(item);
    }
  }

  const sources: SynthesisSource[] = selected.map((item) => ({
    itemId: item.id,
    title: item.title,
    text: item.extractedText || `${item.title}\n\n${item.summary}`,
    sourceName: item.source?.name ?? "Unknown",
    publishedAt: toISOString(item.publishedAt),
    isNew: !existingSourceIds.has(item.id),
  }));

  return {
    clusterId: cluster.dedupeGroupId,
    sources,
    existingSynthesisTitle: existingSynthesis?.title,
  };
}

// ── Image selection (Part G) ────────────────────────────────────────────────

/**
 * Select the best image from source items.
 * Priority: publisher (4) > wikidata (3) > branded (2) > screenshot (1)
 */
function selectBestImage(items: Item[]): {
  imageUrl?: string | null;
  imageSource?: Item["imageSource"];
  imageConfidence?: number;
  imageMeta?: Item["imageMeta"];
  imageAttribution?: Item["imageAttribution"];
} {
  const priority: Record<string, number> = {
    publisher: 4,
    wikidata: 3,
    branded: 2,
    screenshot: 1,
  };

  let best: Item | null = null;
  let bestScore = 0;

  for (const item of items) {
    if (!item.imageUrl || !item.imageSource) continue;
    const prio = priority[item.imageSource] ?? 0;
    const confidence = item.imageConfidence ?? 0;
    const composite = prio * 10 + confidence;
    if (composite > bestScore) {
      bestScore = composite;
      best = item;
    }
  }

  if (!best) return {};

  return {
    imageUrl: best.imageUrl,
    imageSource: best.imageSource,
    imageConfidence: best.imageConfidence,
    imageMeta: best.imageMeta,
    imageAttribution: best.imageAttribution,
  };
}

// ── Create / Update synthesis (Parts D, E, F) ───────────────────────────────

async function createOrUpdateSynthesis(
  cluster: ClusterCandidate,
  existingSynthesis: Item | null,
): Promise<{ action: "created" | "updated" | "skipped"; error?: string }> {
  // Build source packet
  const packet = buildSourcePacket(cluster, existingSynthesis);

  // Cache gate: skip if no new sources since last synthesis
  if (existingSynthesis) {
    const hasNewSources = packet.sources.some((s) => s.isNew);
    if (!hasNewSources) {
      return { action: "skipped" };
    }
  }

  // Safety: detect and filter bot-protection / CAPTCHA source texts.
  // If ALL sources are CAPTCHA pages, skip this cluster entirely.
  const botSourceCount = packet.sources.filter((s) =>
    isBotProtectionPage(s.text),
  ).length;
  if (botSourceCount === packet.sources.length && packet.sources.length > 0) {
    console.warn(
      `[synthesis] SKIPPED cluster ${cluster.dedupeGroupId} — all ${packet.sources.length} source(s) are bot-protection pages`,
    );
    return {
      action: "skipped",
      error: "All source texts are bot-protection/CAPTCHA pages",
    };
  }

  // Call Gemini to generate synthesis (Part D)
  const result = await generateSynthesisFromPacket(packet);
  if (!result.success) {
    return { action: "skipped", error: result.error };
  }

  const { output, promptVersion } = result;

  // Validate grounding (Part E)
  const sourceTexts = packet.sources.map((s) => s.text);
  const validation = validateSynthesisGrounding(output, sourceTexts, botSourceCount);

  // Determine publication status
  let status: ContentStatus = "published";
  let draftReason: string | undefined;

  if (!validation.passed) {
    status = "draft";
    draftReason = `Validation failed: ${validation.issues.join("; ")}`;
  } else if (output.confidence < 0.6) {
    status = "draft";
    draftReason = `Low synthesis confidence: ${output.confidence}`;
  }

  // Compute synthesis metadata
  const sourceItemIds = packet.sources.map((s) => s.itemId);
  const publisherDomains = cluster.distinctPublishers;
  const now = new Date().toISOString();

  const synthesisMeta: SynthesisMeta = {
    sourceItemIds,
    sourceCount: sourceItemIds.length,
    publisherDomains,
    model: "gemini-2.5-flash-lite",
    promptVersion,
    validationPassed: validation.passed,
    lastSynthesizedAt: now,
  };

  // Build denormalized source list
  const sourceList: SynthesisSourceRef[] = packet.sources.map((s) => ({
    itemId: s.itemId,
    title: s.title,
    sourceName: s.sourceName,
    publishedAt: s.publishedAt,
  }));

  // Compute effective date (latest publishedAt among sources)
  const dates = packet.sources
    .filter((s) => s.publishedAt)
    .map((s) => new Date(s.publishedAt!).getTime());
  const effectiveDate =
    dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : now;

  // Select best image from source items (Part G)
  const image = selectBestImage(cluster.items);

  // Audience-fit score: max of sources + 0.15 boost (capped at 1.0)
  const audienceFitScore = Math.min(1, cluster.maxAudienceScore + 0.15);

  // Determine category: most common among source items
  const categoryCounts = new Map<string, number>();
  for (const item of cluster.items) {
    categoryCounts.set(item.category, (categoryCounts.get(item.category) ?? 0) + 1);
  }
  let bestCategory: ItemCategory = "news";
  let bestCount = 0;
  for (const [cat, count] of categoryCounts) {
    if (count > bestCount) {
      bestCount = count;
      bestCategory = cat as ItemCategory;
    }
  }

  // Aggregate citations from all source items (deduplicated)
  const citations = cluster.items
    .flatMap((item) => item.citations ?? [])
    .filter(
      (c, i, arr) => arr.findIndex((x) => x.sourceUrl === c.sourceUrl) === i,
    );

  // Post-process for consistent house style
  const fmtFr = formatContentVersion({
    lang: "fr",
    title: output.title_fr,
    summary: output.summary_fr,
    sections: output.sections_fr,
    series: "News",
  });
  const fmtHt = formatContentVersion({
    lang: "ht",
    title: output.title_ht,
    summary: output.summary_ht,
    sections: output.sections_ht,
    series: "News",
  });

  // Build body text from formatted sections (backwards-compatible fallback)
  const bodyFr = (fmtFr.sections ?? output.sections_fr)
    .map((s) => `## ${s.heading}\n\n${s.content}`)
    .join("\n\n");
  const bodyHt = (fmtHt.sections ?? output.sections_ht)
    .map((s) => `## ${s.heading}\n\n${s.content}`)
    .join("\n\n");

  // Quality flags for synthesis
  const qualityFlags: QualityFlags = {
    hasSourceUrl: true,
    needsReview: !validation.passed,
    lowConfidence: output.confidence < 0.6,
    reasons: validation.issues,
  };

  // Geo tag: use the most common among sources
  const geoTagCounts = new Map<string, number>();
  for (const item of cluster.items) {
    if (item.geoTag) {
      geoTagCounts.set(item.geoTag, (geoTagCounts.get(item.geoTag) ?? 0) + 1);
    }
  }
  let bestGeoTag: string = cluster.items[0]?.geoTag ?? "Global";
  let bestGeoCount = 0;
  for (const [tag, count] of geoTagCounts) {
    if (count > bestGeoCount) {
      bestGeoCount = count;
      bestGeoTag = tag;
    }
  }

  if (existingSynthesis) {
    // ── UPDATE existing synthesis (living update) ─────────────────────────

    await itemsRepo.updateItem(existingSynthesis.id, {
      title: output.title_fr,
      summary: output.summary_fr,
      synthesisMeta,
      sourceList,
      effectiveDate,
      audienceFitScore,
      qualityFlags,
      confidence: output.confidence,
      ...image,
    });

    // Set lastMajorUpdateAt via server timestamp
    await itemsRepo.setLastMajorUpdate(existingSynthesis.id);

    // Update content_versions
    const existingCVs = await contentVersionsRepo.listByItemId(
      existingSynthesis.id,
    );
    const frCV = existingCVs.find(
      (cv) => cv.language === "fr" && cv.channel === "web",
    );
    const htCV = existingCVs.find(
      (cv) => cv.language === "ht" && cv.channel === "web",
    );

    if (frCV) {
      const updateData: Record<string, unknown> = {
        title: output.title_fr,
        summary: output.summary_fr,
        body: bodyFr,
        sections: output.sections_fr,
        status,
        whatChanged: output.what_changed ?? undefined,
        synthesisTags: output.tags,
      };
      if (draftReason) updateData.draftReason = draftReason;
      // @ts-ignore — ig_narrative may not be in the schema yet
      if ((output as Record<string, unknown>).ig_narrative) {
        updateData.narrative = (output as Record<string, unknown>).ig_narrative;
      }
      await contentVersionsRepo.updateContentVersion(frCV.id, updateData);
    }

    if (htCV) {
      const updateData: Record<string, unknown> = {
        title: output.title_ht,
        summary: output.summary_ht,
        body: bodyHt,
        sections: output.sections_ht,
        status,
        whatChanged: output.what_changed ?? undefined,
        synthesisTags: output.tags,
      };
      if (draftReason) updateData.draftReason = draftReason;
      await contentVersionsRepo.updateContentVersion(htCV.id, updateData);
    }

    console.log(
      `[synthesis] UPDATED synthesis ${existingSynthesis.id} (${sourceItemIds.length} sources, validation=${validation.passed})`,
    );
    return { action: "updated" };
  } else {
    // ── CREATE new synthesis ─────────────────────────────────────────────

    const firstSource = cluster.items[0]!;
    const safeCitations =
      citations.length > 0
        ? citations
        : [{ sourceName: "EdLight Synthesis", sourceUrl: firstSource.canonicalUrl }];

    const synthesisItem = await itemsRepo.createItem({
      rawItemId: "synthesis",
      sourceId: "synthesis",
      title: output.title_fr,
      summary: output.summary_fr,
      canonicalUrl: `https://edlight-news.vercel.app/synthesis/${cluster.dedupeGroupId}`,
      category: bestCategory,
      deadline: null,
      evergreen: false,
      confidence: output.confidence,
      qualityFlags,
      citations: safeCitations,
      // v2 fields
      itemType: "synthesis",
      clusterId: cluster.dedupeGroupId,
      dedupeGroupId: cluster.dedupeGroupId,
      synthesisMeta,
      sourceList,
      effectiveDate,
      audienceFitScore,
      geoTag: bestGeoTag as Item["geoTag"],
      ...image,
    });

    // Create content_versions (FR + HT)
    const narrative = (output as Record<string, unknown>).ig_narrative as string | null | undefined;
    const cvPayloads = [
      {
        channel: "web" as ContentChannel,
        language: "fr" as ContentLanguage,
        title: output.title_fr,
        summary: output.summary_fr,
        body: bodyFr,
        status,
        ...(draftReason ? { draftReason } : {}),
        category: bestCategory,
        qualityFlags,
        citations: safeCitations,
        sections: output.sections_fr,
        whatChanged: output.what_changed ?? undefined,
        synthesisTags: output.tags,
        ...(narrative ? { narrative } : {}),
      },
      {
        channel: "web" as ContentChannel,
        language: "ht" as ContentLanguage,
        title: output.title_ht,
        summary: output.summary_ht,
        body: bodyHt,
        status,
        ...(draftReason ? { draftReason } : {}),
        category: bestCategory,
        qualityFlags,
        citations: safeCitations,
        sections: output.sections_ht,
        whatChanged: output.what_changed ?? undefined,
        synthesisTags: output.tags,
      },
    ];

    await contentVersionsRepo.createDraftVersionsForItem(
      synthesisItem.id,
      cvPayloads,
    );

    console.log(
      `[synthesis] CREATED synthesis ${synthesisItem.id} for cluster ${cluster.dedupeGroupId} (${sourceItemIds.length} sources, validation=${validation.passed})`,
    );
    return { action: "created" };
  }
}

// ── Main entry point ────────────────────────────────────────────────────────

export async function runSynthesis(): Promise<SynthesisResult> {
  const result: SynthesisResult = {
    synthesized: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    const clusters = await selectClusters();
    console.log(`[synthesis] found ${clusters.length} eligible clusters`);

    for (const cluster of clusters) {
      try {
        // Check for existing synthesis
        const existing = await itemsRepo.findSynthesisByClusterId(
          cluster.dedupeGroupId,
        );

        const outcome = await createOrUpdateSynthesis(cluster, existing);

        switch (outcome.action) {
          case "created":
            result.synthesized++;
            break;
          case "updated":
            result.updated++;
            break;
          case "skipped":
            if (outcome.error) {
              console.warn(
                `[synthesis] skipped cluster ${cluster.dedupeGroupId}: ${outcome.error}`,
              );
              result.errors++;
            } else {
              result.skipped++;
            }
            break;
        }
      } catch (err) {
        console.error(
          `[synthesis] error for cluster ${cluster.dedupeGroupId}:`,
          err instanceof Error ? err.message : err,
        );
        result.errors++;
      }
    }
  } catch (err) {
    console.error(
      "[synthesis] fatal error in selectClusters:",
      err instanceof Error ? err.message : err,
    );
    result.errors++;
  }

  console.log(
    `[synthesis] done: synthesized=${result.synthesized} updated=${result.updated} skipped=${result.skipped} errors=${result.errors}`,
  );
  return result;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toISOString(ts: unknown): string | undefined {
  if (!ts || typeof ts !== "object") return undefined;
  const t = ts as { seconds?: number; _seconds?: number };
  const secs = t.seconds ?? t._seconds;
  if (!secs) return undefined;
  return new Date(secs * 1000).toISOString();
}
