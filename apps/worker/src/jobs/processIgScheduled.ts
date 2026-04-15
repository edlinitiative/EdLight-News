/**
 * Worker job: processIgScheduled
 *
 * Picks up scheduled IG posts that are due, renders assets, and publishes.
 * Runs as part of the /tick pipeline.
 */

import { igQueueRepo, itemsRepo, uploadCarouselSlides, deleteCarouselSlides, uploadStorySlide } from "@edlight-news/firebase";
import { renderWithIgEngine } from "@edlight-news/renderer/ig-engine-render.js";
import { generateStoryAssets } from "@edlight-news/renderer/ig-story.js";
import { publishIgPost, publishIgStory } from "@edlight-news/publisher";
import type { IGQueueItem, IGPostType, IGStoryPayload } from "@edlight-news/types";
import {
  validatePayloadForPublishing,
  type IGPublishIssue,
} from "../services/igPublishValidation.js";
import { generateContextualImage } from "../services/geminiImageGen.js";
import { STALENESS_TTL_HOURS, isStale } from "./igStaleness.js";
import {
  buildStorySlideForPost,
  type StoryItemInput,
  type StoryTauxInput,
  type StoryFactsInput,
} from "@edlight-news/generator/ig/index.js";
import { contentVersionsRepo } from "@edlight-news/firebase";

/** Post types whose Storage slides should be deleted after posting (ephemeral). */
const EPHEMERAL_IG_TYPES = new Set<IGPostType>(["news", "taux", "histoire", "breaking"]);

/**
 * Maximum number of rendering/publish attempts before an item is parked for
 * manual review.  Prevents broken items (e.g. persistently unreachable image
 * URL, renderer crashes) from cycling in an infinite retry loop every tick.
 */
const MAX_RENDER_RETRIES = 3;
const HAITI_TIMEZONE = "America/Port-au-Prince";
const ACTIVE_SCHEDULED_STATUSES = new Set<IGQueueItem["status"]>([
  "scheduled",
  "scheduled_ready_for_manual",
  "rendering",
]);

export interface ProcessIgScheduledResult {
  processed: number;
  posted: number;
  dryRun: number;
  errors: number;
  /** Per-post story frames published alongside carousel posts */
  storiesPublished: number;
  storiesFailed: number;
}

function toHaitiDayKey(value?: string | Date): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HAITI_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function isLastScheduledPostOfDay(
  current: IGQueueItem,
  allScheduled: IGQueueItem[],
): boolean {
  if (!current.scheduledFor) return true;

  const currentDayKey = toHaitiDayKey(current.scheduledFor);
  const currentTime = new Date(current.scheduledFor).getTime();
  if (!currentDayKey || Number.isNaN(currentTime)) return true;

  for (const candidate of allScheduled) {
    if (candidate.id === current.id) continue;
    if (!ACTIVE_SCHEDULED_STATUSES.has(candidate.status)) continue;
    if (!candidate.scheduledFor) continue;

    const candidateDayKey = toHaitiDayKey(candidate.scheduledFor);
    if (candidateDayKey !== currentDayKey) continue;

    const candidateTime = new Date(candidate.scheduledFor).getTime();
    if (!Number.isNaN(candidateTime) && candidateTime > currentTime) {
      return false;
    }
  }

  return true;
}

function isItemImageUsableForIG(item: Awaited<ReturnType<typeof itemsRepo.getItem>>): boolean {
  if (!item?.imageUrl) return false;

  const width = item.imageMeta?.width;
  const height = item.imageMeta?.height;

  if (item.imageSource === "branded" && (!width || !height)) {
    return false;
  }

  // Unknown dimensions → reject. Accepting unknown-dimension images let
  // blurry / undersized publisher images slip through as IG backgrounds.
  if (!width || !height) return false;
  if (Math.min(width, height) < 1080) return false;
  if (width / Math.max(height, 1) > 2.1) return false;

  return true;
}

function stripUnsafeSlideBackgrounds(
  slidePayload: IGQueueItem["payload"],
  itemImageUrl: string | undefined,
): number {
  if (!slidePayload || !itemImageUrl) return 0;

  let stripped = 0;
  for (const slide of slidePayload.slides) {
    if (slide.backgroundImage === itemImageUrl) {
      delete slide.backgroundImage;
      stripped++;
    }
  }

  return stripped;
}

/**
 * After a carousel post is successfully published, immediately render and
 * publish a single-frame IG Story promoting that post.
 *
 * Each post gets its own story frame independently — no waiting for other
 * posts. If one fails, the next post still gets its story.
 */
async function publishStoryForPost(
  item: IGQueueItem,
  sourceItem: Awaited<ReturnType<typeof itemsRepo.getItem>>,
  appendCta: boolean,
): Promise<{ posted: boolean; error?: string }> {
  try {
    // Build a single-slide story payload based on post type
    let storyPayload: IGStoryPayload;

    if (item.igType === "taux" && item.payload?.slides?.[0]) {
      const coverSlide = item.payload.slides[0];
      const tauxInput: StoryTauxInput = {
        rate: coverSlide.heading,
        dateLabel: coverSlide.footer ?? new Date().toLocaleDateString("fr-FR"),
        bullets: coverSlide.bullets.slice(0, 2),
        backgroundImage: coverSlide.backgroundImage,
      };
      storyPayload = buildStorySlideForPost(undefined, tauxInput);
    } else if (item.igType === "utility" || item.igType === "histoire") {
      // Build a facts-style frame for utility/histoire
      const factsInput: StoryFactsInput = {
        facts: sourceItem?.summary
          ? [sourceItem.summary.slice(0, 360)]
          : item.payload?.slides?.[0]?.bullets ?? [],
        backgroundImage:
          item.payload?.slides?.[0]?.backgroundImage ??
          sourceItem?.imageUrl ??
          undefined,
      };
      storyPayload = buildStorySlideForPost(undefined, undefined, factsInput);
    } else {
      // Headline-style story for news, scholarship, opportunity, etc.
      let bi: StoryItemInput["bi"];
      if (sourceItem) {
        try {
          const versions = await contentVersionsRepo.listByItemId(sourceItem.id);
          const fr = versions.find((v) => v.language === "fr");
          const ht = versions.find((v) => v.language === "ht");
          if (fr) {
            bi = {
              frTitle: fr.title,
              frSummary: fr.summary,
              htTitle: ht?.title,
              htSummary: ht?.summary,
            };
          }
        } catch {
          // Content versions unavailable — use raw item
        }
      }

      const bgImage =
        item.payload?.slides?.[0]?.backgroundImage ??
        (sourceItem?.imageUrl || undefined);

      storyPayload = buildStorySlideForPost({
        item: sourceItem!,
        bi,
        igType: item.igType,
        backgroundImage: bgImage,
      });
    }

    if (storyPayload.slides.length === 0) {
      return { posted: false, error: "No story slide generated" };
    }

    // Render the single story frame (1080×1920)
    const fakeStoryQueueItem = {
      id: `post-story-${item.id}`,
      dateKey: "",
      status: "queued" as const,
      sourceItemIds: [item.sourceContentId],
      payload: storyPayload,
      createdAt: null as any,
      updatedAt: null as any,
    };
    const storyAssets = await generateStoryAssets(fakeStoryQueueItem, storyPayload, {
      appendCta,
    });

    if (storyAssets.mode !== "rendered" || storyAssets.slidePaths.length === 0) {
      return { posted: false, error: "Story render dry-run (no Chromium or creds)" };
    }

    // Upload + publish each frame (usually just 1 frame + CTA = 2)
    let lastMediaId: string | undefined;
    let allPosted = true;

    for (let i = 0; i < storyAssets.slidePaths.length; i++) {
      const publicUrl = await uploadStorySlide(
        storyAssets.slidePaths[i]!,
        fakeStoryQueueItem.id,
        i,
      );
      const publishResult = await publishIgStory(publicUrl, fakeStoryQueueItem.id);

      if (publishResult.posted) {
        lastMediaId = publishResult.igMediaId;
      } else if (publishResult.dryRun) {
        return { posted: false, error: "dry-run" };
      } else {
        allPosted = false;
        console.warn(`[processIgScheduled] story frame ${i + 1} failed: ${publishResult.error}`);
      }

      // Brief pause between frames so IG processes them in order
      if (i < storyAssets.slidePaths.length - 1) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    if (allPosted && lastMediaId) {
      console.log(`[processIgScheduled] ✅ story published for ${item.igType} post ${item.id}`);
      return { posted: true };
    }
    return { posted: false, error: "Not all story frames published" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[processIgScheduled] story for ${item.id} failed: ${msg}`);
    return { posted: false, error: msg };
  }
}

export async function processIgScheduled(): Promise<ProcessIgScheduledResult> {
  const result: ProcessIgScheduledResult = {
    processed: 0,
    posted: 0,
    dryRun: 0,
    errors: 0,
    storiesPublished: 0,
    storiesFailed: 0,
  };

  try {
    // Get scheduled items that are due — use listAllScheduled so we also
    // pick up items in "scheduled_ready_for_manual" that are eligible for
    // staple rescue (the rescue block below filters non-staples out).
    // Previously this used listScheduled() which only returns status=="scheduled",
    // making the rescue block dead code and leaving staples stuck forever.
    const scheduled = await igQueueRepo.listAllScheduled(10);
    const now = new Date();

    for (const item of scheduled) {
      if (item.status === "scheduled_ready_for_manual") {
        // Daily staple types must not languish in manual review — let them
        // fall through to the shouldHold check which has the staple override
        // logic to auto-publish.  Without this, a histoire held for a soft
        // quality issue (e.g. heading length) stays stuck forever because
        // the override at L270+ is never reached.
        const STAPLE_RESCUE_TYPES = new Set<IGPostType>(["histoire", "taux", "utility"]);
        if (!STAPLE_RESCUE_TYPES.has(item.igType)) {
          continue;
        }
        console.log(
          `[processIgScheduled] re-processing staple ${item.igType} item ${item.id} from manual-review queue`,
        );
      }

      // Only process items that are due
      if (item.scheduledFor && new Date(item.scheduledFor) > now) {
        continue;
      }

      result.processed++;

      try {
        // ── Final freshness check ────────────────────────────────────────
        // An item may have been queued days ago and only now reached its
        // scheduled slot.  Don't post stale content.
        // Admin-pushed items bypass staleness — the operator chose to publish.
        const isManual = !!(item as any).manuallyScheduled;
        if (!isManual && isStale(item)) {
          console.log(`[processIgScheduled] item ${item.id} (${item.igType}) is stale — expiring instead of posting`);
          await igQueueRepo.updateStatus(item.id, "expired", {
            reasons: [...item.reasons, `Expired at post time: exceeded ${STALENESS_TTL_HOURS[item.igType]}h TTL`],
          });
          continue;
        }

        // Atomically claim the item — prevents double-processing when both
        // GHA and Cloud Run runners hit processIgScheduled at the same time.
        const claimed = await igQueueRepo.claimForProcessing(item.id);
        if (!claimed) {
          console.log(`[processIgScheduled] item ${item.id} already claimed by another runner, skipping`);
          continue;
        }

        // Get the payload (should already exist from buildIgQueue)
        if (!item.payload) {
          console.warn(`[processIgScheduled] item ${item.id} has no payload, skipping`);
          await igQueueRepo.updateStatus(item.id, "skipped", {
            reasons: [...item.reasons, "No payload available at render time"],
          });
          result.errors++;
          continue;
        }

        const validation = validatePayloadForPublishing(item.payload, item.igType);
        const sourceItem = await itemsRepo.getItem(item.sourceContentId);
        const publishPayload = validation.payload;

        if (sourceItem?.imageUrl && !isItemImageUsableForIG(sourceItem)) {
          const strippedSlides = stripUnsafeSlideBackgrounds(publishPayload, sourceItem.imageUrl);
          if (strippedSlides > 0) {
            console.log(
              `[processIgScheduled] stripped ${strippedSlides} low-resolution background(s) for ${item.id}`,
            );
          }
        }

        const slidesNeedingImage = publishPayload.slides.filter((slide) => !slide.backgroundImage);
        if (slidesNeedingImage.length > 0 && sourceItem) {
          const coverImage = publishPayload.slides[0]?.backgroundImage;

          if (coverImage) {
            // Standard path: propagate cover image to any inner slides that need one.
            for (const slide of slidesNeedingImage) {
              slide.backgroundImage = coverImage;
            }
            console.log(
              `[processIgScheduled] propagated cover image to ${slidesNeedingImage.length} slide(s) for ${item.id}`,
            );
          } else {
            // Cover has no image. Check if inner (content) slides already have one.
            // When the formatter intentionally left the cover empty (e.g. histoire,
            // where the cover uses a clean branded gradient while content slides carry
            // the contextual image), propagate the first content slide's image to the
            // cover so all slides stay visually consistent \u2014 "use the rest's picture".
            const firstContentImage = publishPayload.slides
              .slice(1)
              .find((s) => s.backgroundImage)?.backgroundImage;

            if (firstContentImage) {
              // Apply the content image to the cover and any other empty slides.
              for (const slide of slidesNeedingImage) {
                slide.backgroundImage = firstContentImage;
              }
              console.log(
                `[processIgScheduled] propagated content image to cover + ${slidesNeedingImage.length} slide(s) for ${item.id}`,
              );
            } else {
              // No image anywhere \u2014 generate a contextual one for all empty slides.
              try {
                const generated = await generateContextualImage(sourceItem);
                if (generated?.url) {
                  for (const slide of slidesNeedingImage) {
                    slide.backgroundImage = generated.url;
                  }
                  console.log(
                    `[processIgScheduled] filled ${slidesNeedingImage.length} slide background(s) for ${item.id}`,
                  );
                }
              } catch (imageErr) {
                const msg = imageErr instanceof Error ? imageErr.message : String(imageErr);
                console.warn(`[processIgScheduled] contextual image fallback failed for ${item.id}: ${msg}`);
              }
            }
          }
        }

        // ── Pre-render image URL health check ────────────────────────────
        // Verify that background-image URLs are reachable before spending
        // CPU on Playwright rendering.  Broken URLs (429 / 404 / timeout)
        // are cleared so the slide falls through to the gradient background
        // rather than hanging the renderer.
        const uniqueImageUrls = [
          ...new Set(
            publishPayload.slides
              .map((s) => s.backgroundImage)
              .filter((u): u is string => !!u),
          ),
        ];

        const brokenUrls = new Set<string>();
        await Promise.all(
          uniqueImageUrls.map(async (url) => {
            try {
              const ctrl = new AbortController();
              const timer = setTimeout(() => ctrl.abort(), 5_000);
              const resp = await fetch(url, {
                method: "HEAD",
                signal: ctrl.signal,
                redirect: "follow",
              });
              clearTimeout(timer);
              if (!resp.ok) {
                brokenUrls.add(url);
                console.warn(
                  `[processIgScheduled] image URL returned ${resp.status} for ${item.id}: ${url.slice(0, 120)}`,
                );
              }
            } catch {
              brokenUrls.add(url);
              console.warn(
                `[processIgScheduled] image URL unreachable for ${item.id}: ${url.slice(0, 120)}`,
              );
            }
          }),
        );

        if (brokenUrls.size > 0) {
          // Clear broken URLs from slides
          for (const slide of publishPayload.slides) {
            if (slide.backgroundImage && brokenUrls.has(slide.backgroundImage)) {
              delete slide.backgroundImage;
            }
          }

          // Attempt Gemini fallback for newly-emptied slides
          const emptiedSlides = publishPayload.slides.filter((s) => !s.backgroundImage);
          if (emptiedSlides.length > 0 && sourceItem) {
            try {
              const generated = await generateContextualImage(sourceItem);
              if (generated?.url) {
                for (const slide of emptiedSlides) {
                  slide.backgroundImage = generated.url;
                }
                console.log(
                  `[processIgScheduled] replaced ${brokenUrls.size} broken URL(s) with Gemini image for ${item.id}`,
                );
              }
            } catch (genErr) {
              const genMsg = genErr instanceof Error ? genErr.message : String(genErr);
              console.warn(
                `[processIgScheduled] Gemini fallback after broken URL failed for ${item.id}: ${genMsg}`,
              );
            }
          }
        }

        if (validation.shouldHold) {
          // Daily staple types (histoire, taux, utility) must post every day.
          // ALL quality holds are overridable for staples — holding them for
          // manual review causes them to expire unposted while lower-scored
          // non-staple items fill the feed.  The only hard-block for staples is
          // a structurally broken payload (0 slides or completely empty caption).
          const DAILY_STAPLE_TYPES = new Set<IGPostType>(["histoire", "taux", "utility"]);
          const isStapleType = DAILY_STAPLE_TYPES.has(item.igType);
          // Hard errors that mean the post is structurally unpublishable
          const HARD_ERROR_RE = /aucune slide|0 slides/i;
          const hasHardError = validation.issues
            .filter((i: IGPublishIssue) => i.severity === "error")
            .some((i: IGPublishIssue) => HARD_ERROR_RE.test(i.message));

          if (isStapleType && !hasHardError) {
            console.log(
              `[processIgScheduled] staple override: auto-publishing ${item.igType} item ${item.id} ` +
              `despite quality holds: ${validation.issues.map((i: IGPublishIssue) => i.message).join("; ")}`,
            );
            // Fall through to render & publish below
          } else {
            await igQueueRepo.updateStatus(item.id, "scheduled_ready_for_manual", {
              payload: publishPayload,
              reasons: [
                ...item.reasons,
                ...validation.issues.map((issue: IGPublishIssue) => `Quality hold: ${issue.message}`),
              ],
            });
            console.warn(
              `[processIgScheduled] item ${item.id} held for manual review: ${validation.issues
                .map((issue: IGPublishIssue) => issue.message)
                .join("; ")}`,
            );
            continue;
          }
        }

        // Render assets
        const assets = await renderWithIgEngine(item, publishPayload);

        // Upload rendered PNGs to Firebase Storage so the IG API can access them.
        // In dry-run mode (HTML files) we skip the upload and pass local paths.
        let slideUrls = assets.slidePaths;
        if (assets.mode === "rendered") {
          try {
            slideUrls = await uploadCarouselSlides(assets.slidePaths, item.id);
          } catch (uploadErr) {
            const uploadMsg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
            console.warn(`[processIgScheduled] Storage upload failed for ${item.id}: ${uploadMsg}`);
            // Billing-disabled errors won't resolve on retry — hold for manual
            // review instead of cycling back to "scheduled" every tick.
            const isBillingError =
              uploadMsg.includes("billing account") ||
              uploadMsg.includes("delinquent") ||
              uploadMsg.includes("billing is disabled") ||
              uploadMsg.includes("Cloud billing is disabled");
            if (isBillingError) {
              await igQueueRepo.updateStatus(item.id, "scheduled_ready_for_manual", {
                reasons: [...item.reasons, `Storage billing disabled — held for manual: ${uploadMsg}`],
                renderedBy: assets.renderedBy,
              });
            } else {
              await igQueueRepo.updateStatus(item.id, "scheduled", {
                reasons: [...item.reasons, `Storage upload failed: ${uploadMsg}`],
                renderedBy: assets.renderedBy,
              });
            }
            result.errors++;
            continue;
          }
        }

        // Publish (or dry-run)
        const publishResult = await publishIgPost(item, publishPayload, slideUrls);

        if (publishResult.posted) {
          await igQueueRepo.markPosted(item.id, publishResult.igPostId, { renderedBy: assets.renderedBy });
          result.posted++;
          // Delete slide PNGs from Storage for ephemeral post types to keep
          // storage lean. Scholarship/opportunity slides are kept (evergreen).
          if (EPHEMERAL_IG_TYPES.has(item.igType) && assets.mode === "rendered") {
            deleteCarouselSlides(item.id).catch((err) =>
              console.warn(`[processIgScheduled] slide cleanup failed for ${item.id}:`, err),
            );
          }

          // ── Per-post Story: immediately publish a story frame for this post ──
          // Each post gets its own story — no waiting for other posts.
          // If it fails, the carousel is still posted and the next post tries too.
          const appendCta = isLastScheduledPostOfDay(item, scheduled);
          const storyResult = await publishStoryForPost(item, sourceItem, appendCta);
          if (storyResult.posted) {
            result.storiesPublished++;
          } else if (storyResult.error !== "dry-run") {
            result.storiesFailed++;
          }
        } else if (publishResult.dryRun) {
          await igQueueRepo.updateStatus(item.id, "scheduled_ready_for_manual", {
            dryRunPath: publishResult.dryRunPath,
            renderedBy: assets.renderedBy,
          });
          result.dryRun++;
        } else {
          // Publish failed — track retries so the item doesn't cycle forever.
          const publishRetries = (item.renderRetries ?? 0) + 1;
          if (publishRetries >= MAX_RENDER_RETRIES) {
            console.warn(
              `[processIgScheduled] item ${item.id} exceeded ${MAX_RENDER_RETRIES} publish retries — holding for manual review`,
            );
            await igQueueRepo.updateStatus(item.id, "scheduled_ready_for_manual", {
              reasons: [
                ...item.reasons,
                `Publish error: ${publishResult.error}`,
                `Held for manual review after ${MAX_RENDER_RETRIES} failed publish attempts`,
              ],
              renderRetries: publishRetries,
              renderedBy: assets.renderedBy,
            });
          } else {
            await igQueueRepo.updateStatus(item.id, "scheduled", {
              reasons: [...item.reasons, `Publish error: ${publishResult.error}`],
              renderRetries: publishRetries,
              renderedBy: assets.renderedBy,
            });
          }
          result.errors++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[processIgScheduled] error processing ${item.id}:`, msg);

        const retries = (item.renderRetries ?? 0) + 1;
        if (retries >= MAX_RENDER_RETRIES) {
          // Too many failures — park for manual review instead of cycling
          // back to "scheduled" every tick.
          console.warn(
            `[processIgScheduled] item ${item.id} exceeded ${MAX_RENDER_RETRIES} retries — holding for manual review`,
          );
          await igQueueRepo.updateStatus(item.id, "scheduled_ready_for_manual", {
            reasons: [
              ...item.reasons,
              `Processing error (attempt ${retries}/${MAX_RENDER_RETRIES}): ${msg}`,
              `Held for manual review after ${MAX_RENDER_RETRIES} failed attempts`,
            ],
            renderRetries: retries,
          });
        } else {
          await igQueueRepo.updateStatus(item.id, "scheduled", {
            reasons: [...item.reasons, `Processing error (attempt ${retries}/${MAX_RENDER_RETRIES}): ${msg}`],
            renderRetries: retries,
          });
        }
        result.errors++;
      }
    }

    if (result.processed > 0) {
      console.log(
        `[processIgScheduled] processed=${result.processed} posted=${result.posted} dryRun=${result.dryRun} errors=${result.errors}` +
        ` | stories: published=${result.storiesPublished} failed=${result.storiesFailed}`,
      );
    }
  } catch (err) {
    console.error("[processIgScheduled] fatal error:", err);
    result.errors++;
  }

  return result;
}
