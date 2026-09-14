/**
 * Family B — meaningful Capture must not become a silent empty Review.
 *
 * A non-trivial user Capture ends in one of:
 *   executable candidate | Needs You | Left untouched | No change
 *
 * Empty extraction and unsupported product gaps are Left untouched:
 * no bounded answer can produce a legal write. Never manufacture a write.
 * The surface gate still exists so vanished Capture stays visible.
 */

import type { ObservationAccount } from "./account";
import { LEFT_UNTOUCHED_GENERIC_REASON } from "./left-untouched";

export const EMPTY_REVIEW_FACT =
  "Lume could not turn this Capture into a safe change.";

const CANCEL_MILESTONE =
  /\b(cancel|cancelled|canceled|remove|delete|drop|call off)\b[\s\S]{0,80}\b(date|milestone|walk-through|walkthrough|catch-?up|meeting|session)\b/i;
const RETIRE_KNOWLEDGE =
  /\b(retire|supersede|no longer (true|current|relevant)|forget that|strike that)\b/i;

export function isMeaningfulCaptureTranscript(transcript: string): boolean {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (text.length < 16) return false;
  const words = text.split(" ").filter((w) => w.length > 1);
  return words.length >= 4;
}

export function unsupportedProductGapReason(
  transcript: string,
): string | null {
  const text = transcript.replace(/\s+/g, " ").trim();
  if (CANCEL_MILESTONE.test(text)) {
    return "Lume cannot cancel or remove a dated item yet, so it left this alone.";
  }
  if (RETIRE_KNOWLEDGE.test(text)) {
    return "Lume cannot retire or supersede Knowledge yet, so it left this alone.";
  }
  return null;
}

export function emptyReviewNeedsYouReason(transcript: string): string {
  return unsupportedProductGapReason(transcript) ?? LEFT_UNTOUCHED_GENERIC_REASON;
}

/**
 * True when the pipeline produced no write, no Needs You, no reject,
 * and no explicit already-known / merge / commentary account — i.e. the
 * Capture vanished. Accounted commentary is not a silent empty Review.
 */
export function shouldSurfaceEmptyReviewNeedsYou(
  account: ObservationAccount,
  transcript: string,
): boolean {
  if (!isMeaningfulCaptureTranscript(transcript)) return false;
  if (account.proposedChanges > 0) return false;
  if (account.needsYou > 0) return false;
  if (account.rejected > 0) return false;
  if (account.alreadyKnown > 0) return false;
  if (account.merged > 0) return false;
  if (account.commentary > 0) return false;
  if (account.leftUntouched > 0) return false;
  return true;
}
