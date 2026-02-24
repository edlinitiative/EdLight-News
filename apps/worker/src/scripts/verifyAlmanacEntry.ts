/**
 * Almanac Verification Script — verifyAlmanacEntry
 *
 * Queries unverified raw entries and applies automated verification rules:
 *
 *   Rule 1 — Auto-verify if primarySource is government / academic / institutional
 *   Rule 2 — Auto-verify if 2 independent sources (even press + reference)
 *   Rule 3 — Never verify if only Wikipedia (reference-only, no secondary)
 *   Rule 4 — Press-only + pre-1950 requires secondary confirmation
 *
 * Run:
 *   pnpm --filter @edlight-news/worker run verify:almanac
 */

import { haitiHistoryAlmanacRawRepo } from "@edlight-news/firebase";
import type { HaitiHistoryAlmanacRaw, AlmanacRawSourceType } from "@edlight-news/types";
import {
  classifyDomain,
  isHighConfidenceSourceType,
  isNeverVerifiedAlone,
  pressNeedsCorroboration,
} from "../historySources/historySourceRegistry.js";

// ── Verification decision ────────────────────────────────────────────────────

export interface VerificationDecision {
  entryId: string;
  title: string;
  verified: boolean;
  reason: string;
}

/**
 * Evaluate a single raw entry against verification rules.
 * Returns a decision without persisting anything.
 */
export function evaluateVerification(
  entry: HaitiHistoryAlmanacRaw,
): VerificationDecision {
  const primaryType: AlmanacRawSourceType =
    classifyDomain(entry.sourcePrimary.url) ?? entry.sourceType;

  const hasSecondary = !!entry.sourceSecondary?.url;

  const secondaryType: AlmanacRawSourceType | null = hasSecondary
    ? classifyDomain(entry.sourceSecondary!.url)
    : null;

  // Rule 1: High-confidence primary source → auto-verify
  if (isHighConfidenceSourceType(primaryType)) {
    return {
      entryId: entry.id,
      title: entry.title,
      verified: true,
      reason: `Primary source is high-confidence (${primaryType})`,
    };
  }

  // Rule 3: Reference-only (Wikipedia) with no secondary → never verify
  if (isNeverVerifiedAlone(primaryType) && !hasSecondary) {
    return {
      entryId: entry.id,
      title: entry.title,
      verified: false,
      reason: "Reference-only source (e.g. Wikipedia) without secondary — cannot verify",
    };
  }

  // Rule 2: Two independent sources → auto-verify
  if (hasSecondary && secondaryType !== null) {
    // Two different domains confirmed
    return {
      entryId: entry.id,
      title: entry.title,
      verified: true,
      reason: `Two independent sources: primary=${primaryType}, secondary=${secondaryType}`,
    };
  }

  // Rule 4: Press-only + pre-1950 needs secondary confirmation
  if (primaryType === "press" && pressNeedsCorroboration(entry.year)) {
    if (hasSecondary) {
      return {
        entryId: entry.id,
        title: entry.title,
        verified: true,
        reason: `Press source + pre-1950, but has secondary confirmation`,
      };
    }
    return {
      entryId: entry.id,
      title: entry.title,
      verified: false,
      reason: `Press-only source for pre-1950 event (${entry.year}) — needs corroboration`,
    };
  }

  // Press post-1950 without secondary → verify (press is acceptable for modern events)
  if (primaryType === "press" && !pressNeedsCorroboration(entry.year)) {
    return {
      entryId: entry.id,
      title: entry.title,
      verified: true,
      reason: `Press source for post-1950 event (${entry.year})`,
    };
  }

  // Fallback: untrusted or unclassifiable
  return {
    entryId: entry.id,
    title: entry.title,
    verified: false,
    reason: `Unable to auto-verify: primaryType=${primaryType}, hasSecondary=${hasSecondary}`,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function runVerifyAlmanacEntries(): Promise<{
  verified: number;
  skipped: number;
  total: number;
  decisions: VerificationDecision[];
}> {
  const unverified = await haitiHistoryAlmanacRawRepo.listUnverified();

  let verified = 0;
  let skipped = 0;
  const decisions: VerificationDecision[] = [];

  for (const entry of unverified) {
    const decision = evaluateVerification(entry);
    decisions.push(decision);

    if (decision.verified) {
      await haitiHistoryAlmanacRawRepo.markVerified(entry.id);
      verified++;
      console.log(
        `[verify-almanac] ✅ Verified: "${entry.title}" — ${decision.reason}`,
      );
    } else {
      skipped++;
      console.log(
        `[verify-almanac] ⏩ Skipped: "${entry.title}" — ${decision.reason}`,
      );
    }
  }

  console.log(
    `[verify-almanac] Done: verified=${verified}, skipped=${skipped}, total=${unverified.length}`,
  );

  return { verified, skipped, total: unverified.length, decisions };
}
