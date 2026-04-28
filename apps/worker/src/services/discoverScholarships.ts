/**
 * Scholarship auto-discovery service.
 *
 * Promotes items from the news pipeline (vertical=opportunites) into the
 * structured `scholarships` collection that backs /bourses.
 *
 * Why this exists:
 *  - /bourses reads from the `scholarships` Firestore collection
 *  - Until now, that collection was hand-seeded once and never grew
 *  - Meanwhile, the ingest → classify → generate pipeline produces a steady
 *    stream of items tagged `vertical=opportunites` with full extracted text
 *  - This service uses Gemini to extract a structured scholarship record from
 *    each opportunites item, then upserts it by name (idempotent)
 *
 * Cost control:
 *  - MAX_DISCOVER_PER_TICK caps LLM calls per worker tick
 *  - Each item is flagged after evaluation (`scholarshipPromotion` = promoted
 *    | rejected | failed) so we never re-evaluate the same item twice
 *  - Failed items get up to MAX_PROMOTION_ATTEMPTS retries, then are skipped
 *
 * Edge cases handled:
 *  - Article is a round-up / news commentary → LLM returns isScholarship=false
 *    → we mark "rejected" and never try again
 *  - LLM fails / network error → we increment attempts and retry next tick
 *  - LLM returns invalid country / level → caught by Zod parse → "failed"
 *  - LLM returns no officialUrl → we fall back to canonicalUrl as the source
 *    citation, but we still need ONE valid HTTPS URL or we skip
 *  - Existing scholarship with the same name → upsertByName updates it
 *    (null-safe — never overwrites good data with null)
 */

import { itemsRepo, scholarshipsRepo } from "@edlight-news/firebase";
import {
  extractScholarshipFromArticle,
  VERIFY_CONFIDENCE_THRESHOLD,
} from "@edlight-news/generator";
import type {
  CreateScholarship,
  DatasetCountry,
  AcademicLevel,
  Item,
} from "@edlight-news/types";

/** Maximum LLM extraction calls per tick. */
const MAX_DISCOVER_PER_TICK = 5;

/** Maximum number of times to retry a failing extraction before giving up. */
const MAX_PROMOTION_ATTEMPTS = 2;

const VALID_COUNTRIES: ReadonlySet<DatasetCountry> = new Set([
  "US", "CA", "FR", "UK", "DO", "MX", "CN", "RU", "HT", "Global",
]);

const VALID_LEVELS: ReadonlySet<AcademicLevel> = new Set([
  "bachelor", "master", "phd", "short_programs",
]);

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export interface DiscoverScholarshipsResult {
  evaluated: number;
  promoted: number;
  rejected: number;
  failed: number;
}

/** Coerce a possibly-bad URL into a valid https URL string, or null. */
function safeUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Map LLM output to a CreateScholarship payload, or return null if unusable. */
function buildCreatePayload(
  item: Item,
  data: Awaited<ReturnType<typeof extractScholarshipFromArticle>> extends infer R
    ? R extends { ok: true; data: infer D } ? D : never
    : never,
): CreateScholarship | null {
  const name = data.name?.trim();
  if (!name || name.length < 3) return null;

  // Prefer the LLM-extracted official URL; fall back to the article URL.
  const officialUrl = safeUrl(data.officialUrl) ?? safeUrl(item.canonicalUrl);
  if (!officialUrl) return null;

  const country: DatasetCountry =
    data.country && VALID_COUNTRIES.has(data.country as DatasetCountry)
      ? (data.country as DatasetCountry)
      : "Global";

  const level: AcademicLevel[] = (data.level ?? [])
    .filter((l): l is AcademicLevel => VALID_LEVELS.has(l as AcademicLevel));
  if (level.length === 0) level.push("master"); // safe default; most scholarships are masters

  const fundingType = data.fundingType ?? "unknown";

  // Eligibility: explicit list takes priority; otherwise infer from haitianEligible flag.
  // If neither the LLM nor the flag supplies countries, default to ["HT"] so the
  // IG pipeline's hasRealOpportunityFields() gate sees a non-empty eligibility array
  // and routes the item to the opportunity/scholarship formatter instead of silently
  // downgrading it to "news" (where thin-content gates reject it).
  let eligibleCountries: string[] | undefined = data.eligibleCountries?.filter(Boolean);
  if (!eligibleCountries || eligibleCountries.length === 0) {
    if (data.haitianEligible === true) eligibleCountries = ["HT"];
    else eligibleCountries = ["HT"]; // default: Haiti-focused audience
  } else if (data.haitianEligible === true && !eligibleCountries.includes("HT")) {
    eligibleCountries = [...eligibleCountries, "HT"];
  }

  const howToApplyUrl = safeUrl(data.howToApplyUrl) ?? undefined;

  // Deadline block — only include if we have at least dateISO or month or notes
  let deadline: CreateScholarship["deadline"] | undefined;
  if (data.deadlineDateISO || data.deadlineMonth || data.deadlineNotes) {
    deadline = {
      sourceUrl: officialUrl,
      ...(data.deadlineDateISO ? { dateISO: data.deadlineDateISO } : {}),
      ...(data.deadlineMonth ? { month: data.deadlineMonth } : {}),
      ...(data.deadlineNotes ? { notes: data.deadlineNotes } : {}),
    };
  }

  const sources: CreateScholarship["sources"] = [
    { label: item.title.slice(0, 100) || "Source", url: item.canonicalUrl },
  ];
  if (officialUrl !== item.canonicalUrl) {
    sources.push({ label: name, url: officialUrl });
  }

  const payload: CreateScholarship = {
    name,
    country,
    level,
    fundingType,
    relatedPagePath: `/bourses/guides/${slugify(name)}`,
    officialUrl,
    sources,
    ...(eligibleCountries ? { eligibleCountries } : {}),
    ...(howToApplyUrl ? { howToApplyUrl } : {}),
    ...(deadline ? { deadline } : {}),
    ...(data.eligibilitySummary ? { eligibilitySummary: data.eligibilitySummary } : {}),
    ...(data.requirements && data.requirements.length > 0 ? { requirements: data.requirements } : {}),
    ...(data.eligibilitySummary
      ? { programDescription: `${data.eligibilitySummary}\n\nCe guide est généré automatiquement depuis les derniers contenus ingérés par EdLight.` }
      : {}),
    ...(data.howToApplyUrl || officialUrl
      ? {
          applicationSteps: [
            {
              title: "Vérifier l'éligibilité",
              description:
                data.eligibilitySummary ??
                "Vérifier les critères de pays, niveau et domaine sur la source officielle.",
            },
            {
              title: "Préparer les documents",
              description:
                data.requirements?.length
                  ? `Documents clés: ${data.requirements.slice(0, 4).join(" · ")}`
                  : "Préparer relevés, recommandations et preuve de langue si exigée.",
            },
            {
              title: "Soumettre la candidature",
              description: "Finaliser la soumission sur le portail officiel du programme.",
              url: howToApplyUrl ?? officialUrl,
            },
          ],
        }
      : {}),
    ...(data.deadlineDateISO || data.deadlineNotes
      ? {
          keyDates: [
            {
              label: "Deadline",
              ...(data.deadlineDateISO ? { dateISO: data.deadlineDateISO } : {}),
              ...(data.deadlineNotes ? { notes: data.deadlineNotes } : {}),
            },
          ],
        }
      : {}),
    ...(data.recurring !== undefined ? { recurring: data.recurring } : {}),
    ...(data.tags && data.tags.length > 0 ? { tags: data.tags } : {}),
  };

  return payload;
}

export async function discoverScholarships(): Promise<DiscoverScholarshipsResult> {
  const result: DiscoverScholarshipsResult = {
    evaluated: 0, promoted: 0, rejected: 0, failed: 0,
  };

  const candidates = await itemsRepo.listOpportunitiesNeedingScholarshipPromotion(
    MAX_DISCOVER_PER_TICK,
    MAX_PROMOTION_ATTEMPTS,
  );

  if (candidates.length === 0) {
    console.log("[discoverScholarships] no candidates needing promotion");
    return result;
  }

  console.log(`[discoverScholarships] evaluating ${candidates.length} candidate(s)`);

  for (const item of candidates) {
    result.evaluated++;
    const attempts = (item.scholarshipPromotionAttempts ?? 0) + 1;

    try {
      const text = item.extractedText ?? item.summary ?? "";
      const extraction = await extractScholarshipFromArticle({
        title: item.title,
        text,
        url: item.canonicalUrl,
      });

      if (!extraction.ok) {
        console.warn(`[discoverScholarships] extract failed for ${item.id} — ${extraction.error}`);
        await itemsRepo.updateItem(item.id, {
          scholarshipPromotion: "failed",
          scholarshipPromotionAttempts: attempts,
        });
        result.failed++;
        continue;
      }

      const d = extraction.data;

      // Definitive rejection — flag and never retry.
      if (!d.isScholarship || d.confidence < VERIFY_CONFIDENCE_THRESHOLD) {
        const reason = !d.isScholarship ? "not-a-scholarship" : `low-confidence(${d.confidence})`;
        console.log(`[discoverScholarships] rejected ${item.id} (${reason})`);
        await itemsRepo.updateItem(item.id, {
          scholarshipPromotion: "rejected",
          scholarshipPromotionAttempts: attempts,
        });
        result.rejected++;
        continue;
      }

      const payload = buildCreatePayload(item, d);
      if (!payload) {
        console.warn(`[discoverScholarships] insufficient fields for ${item.id} (missing name/url/level)`);
        await itemsRepo.updateItem(item.id, {
          scholarshipPromotion: "rejected",
          scholarshipPromotionAttempts: attempts,
        });
        result.rejected++;
        continue;
      }

      const { scholarship, created } = await scholarshipsRepo.upsertByName(payload);
      console.log(
        `[discoverScholarships] ${created ? "created" : "updated"} scholarship "${scholarship.name}" (id=${scholarship.id}) from item ${item.id}`,
      );

      // ── Write back structured opportunity data to the original item ────────
      // Without this, mapCategoryToIGType → hasRealOpportunityFields() will
      // silently downgrade the item from "scholarship"/"opportunity" to "news",
      // which then fails news-specific gates (thin content, audience fit).
      // This write-back is the bridge between the discoverScholarships pipeline
      // (which writes to the `scholarships` collection for /bourses) and the IG
      // pipeline (which reads item.opportunity to detect real opportunity types).
      //
      // We map from the processed `payload` (not raw `d`) because buildCreatePayload
      // applies fallbacks (e.g. haitianEligible→eligibleCountries=["HT"],
      // officialUrl→canonicalUrl). Using raw `d` would miss those and leave
      // hasRealOpportunityFields() unsatisfied.
      await itemsRepo.updateItem(item.id, {
        scholarshipPromotion: "promoted",
        scholarshipPromotionAttempts: attempts,
        opportunity: {
          eligibility: payload.eligibleCountries ?? [],
          howToApply: payload.howToApplyUrl ?? undefined,
          officialLink: payload.officialUrl,
          coverage: payload.fundingType,
          ...(payload.deadline?.dateISO
            ? { deadline: payload.deadline.dateISO }
            : {}),
        },
      });
      result.promoted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[discoverScholarships] error for ${item.id}: ${msg}`);
      try {
        await itemsRepo.updateItem(item.id, {
          scholarshipPromotion: "failed",
          scholarshipPromotionAttempts: attempts,
        });
      } catch { /* ignore */ }
      result.failed++;
    }
  }

  console.log(
    `[discoverScholarships] done — evaluated=${result.evaluated} promoted=${result.promoted} rejected=${result.rejected} failed=${result.failed}`,
  );
  return result;
}
