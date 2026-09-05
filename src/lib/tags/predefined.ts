/**
 * Small built-in vocabulary for suggestions only.
 * Not a taxonomy of project truth. Not a settings screen.
 */
export const PREDEFINED_LUME_TAGS = [
  "Release",
  "Mobile",
  "UAT",
  "Go-live",
  "CAB",
  "Security",
  "Finance",
  "Testing",
  "Hypercare",
  "Vendor",
  "Cutover",
  "Regression",
  "Readiness",
  "Stakeholders",
] as const;

export type PredefinedLumeTag = (typeof PREDEFINED_LUME_TAGS)[number];
