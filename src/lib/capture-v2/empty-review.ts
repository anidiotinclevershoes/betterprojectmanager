/**
 * Family B — meaningful Capture must not become a silent empty Review.
 *
 * A non-trivial user Capture ends in one of:
 *   executable candidate | Needs You | explicit unsupported | extraction failure
 *
 * Never manufacture a write. Fail loud and safe.
 */

import type { ObservationAccount } from "./account";

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
    return "Lume cannot cancel or remove a dated item yet. Nothing was changed. This needs a product decision, not a silent skip.";
  }
  if (RETIRE_KNOWLEDGE.test(text)) {
    return "Lume cannot retire or supersede Knowledge yet. The historical note stays. This needs a product decision, not a silent skip.";
  }
  return null;
}

export function emptyReviewNeedsYouReason(transcript: string): string {
  return (
    unsupportedProductGapReason(transcript) ??
    "Lume could not extract a safe, executable change from this Capture. Nothing was written. Try a more specific statement, or Lume will keep this as Needs You rather than guessing."
  );
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
  return true;
}
