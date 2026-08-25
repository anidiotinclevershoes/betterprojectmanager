/**
 * Capture V2 simplified-layout experiment.
 * Presentation-only dual path. Default remains Classic.
 * Intelligence, review-before-write, and applyOne are unchanged.
 */

export const CAPTURE_LAYOUT_STORAGE_KEY = "lume-capture-layout-experiment-v1";

export type CaptureLayoutExperiment = "classic" | "simplified";

export const CAPTURE_LAYOUT_DEFAULT: CaptureLayoutExperiment = "classic";

export function parseCaptureLayout(
  raw: string | null | undefined,
): CaptureLayoutExperiment {
  return raw === "simplified" ? "simplified" : "classic";
}
