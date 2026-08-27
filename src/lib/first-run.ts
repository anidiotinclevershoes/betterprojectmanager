/**
 * First-user / first-Capture cue visibility.
 * Presentation only — does not change Capture or project persistence.
 */

export const FIRST_CAPTURE_CUE_KEY = "lume-first-capture-cue-v1";
export const FIRST_PROJECT_GUIDANCE_KEY = "lume-first-project-guidance-v1";

export type FirstCaptureCueInput = {
  dismissed: boolean;
  hasCaptureHistory: boolean;
  composeEmpty: boolean;
  analysing: boolean;
  reviewOpen: boolean;
  projectCount: number;
};

export type FirstProjectGuidanceInput = {
  dismissed: boolean;
  projectCount: number;
  hasCaptureHistory: boolean;
};

/** Quiet Capture cue: first workspace only, never on established Capture users. */
export function shouldShowFirstCaptureCue(
  input: FirstCaptureCueInput,
): boolean {
  if (input.dismissed) return false;
  if (input.hasCaptureHistory) return false;
  if (input.projectCount !== 1) return false;
  if (!input.composeEmpty) return false;
  if (input.analysing) return false;
  if (input.reviewOpen) return false;
  return true;
}

/** Quiet KC banner: only the first project, before any Capture exists. */
export function shouldShowFirstProjectGuidance(
  input: FirstProjectGuidanceInput,
): boolean {
  if (input.dismissed) return false;
  if (input.hasCaptureHistory) return false;
  if (input.projectCount !== 1) return false;
  return true;
}

export function readCueDismissed(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeCueDismissed(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* ignore quota / private mode */
  }
}
