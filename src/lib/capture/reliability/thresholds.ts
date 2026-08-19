/**
 * Capture reliability thresholds — initial defaults.
 *
 * These are starting points, not validated production SLOs. Tune via this
 * object; do not hard-code magic numbers in UI or evaluators.
 *
 * Provenance notes:
 * - warningTokenCount (4_000): ~ typical long note / short meeting dump.
 *   Chosen as “larger than usual” for review prompting, not a model limit.
 * - criticalTokenCount (12_000): unusually large single Capture. Still does
 *   NOT force `limited` by length alone (length → review_recommended).
 * - clarificationRatioWarning (0.4): if ≥40% of findings need clarification,
 *   suggestions need careful review.
 * - ambiguityRatioWarning (0.35): AMBIGUOUS / clarification-heavy findings.
 * - invalidTargetWarningCount (1): any unmatched target is worth surfacing.
 * - materialTruncationExcludedCount (8): many context records dropped →
 *   analysis may be incomplete (can contribute to `limited` with truncation).
 * - Client pre-check uses characters ≈ tokens × 4 (cl100k rough average).
 */

export type CaptureReliabilityThresholds = {
  warningTokenCount: number;
  criticalTokenCount: number;
  clarificationRatioWarning: number;
  ambiguityRatioWarning: number;
  invalidTargetWarningCount: number;
  materialTruncationExcludedCount: number;
};

export const DEFAULT_CAPTURE_RELIABILITY_THRESHOLDS: CaptureReliabilityThresholds =
  {
    warningTokenCount: 4000,
    criticalTokenCount: 12000,
    clarificationRatioWarning: 0.4,
    ambiguityRatioWarning: 0.35,
    invalidTargetWarningCount: 1,
    materialTruncationExcludedCount: 8,
  };

/** Rough client-side character proxy for pre-analysis length warnings. */
export function tokenCountToCharacterProxy(tokens: number): number {
  return tokens * 4;
}
