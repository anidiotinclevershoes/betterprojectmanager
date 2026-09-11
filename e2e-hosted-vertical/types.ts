export const VERTICAL_BOUNDARIES = [
  "AUTH",
  "VERCEL_PROTECTION",
  "UI_INPUT",
  "HOSTED_API",
  "OPENAI",
  "NEW_PROJECT_ADAPTER",
  "VALIDATION",
  "IDENTITY",
  "PLANNER",
  "REVIEW_UI",
  "APPLY",
  "PERSISTENCE",
  "PROJECTION_RELOAD",
  "UNKNOWN",
] as const;

export type VerticalBoundary = (typeof VERTICAL_BOUNDARIES)[number];

export type MatrixCell = "PASS" | "FAIL" | "BLOCKED" | "n/a";

export type Provenance = {
  provider?: string;
  requestedModel?: string;
  responseModel?: string;
  fallback?: boolean;
  path?: string;
};

export type HostedApiCall = {
  url: string;
  method: string;
  status: number;
  body?: unknown;
  provenance?: Provenance;
  requestPreview?: unknown;
};

export type JourneyMatrixRow = {
  journey: string;
  vercelAccess: MatrixCell;
  lumeAuth: MatrixCell;
  hostedApi: MatrixCell;
  liveOpenAi: MatrixCell;
  uiInterpretation: MatrixCell;
  review: MatrixCell;
  apply: MatrixCell;
  reload: MatrixCell;
  result: "PASS" | "FAIL" | "BLOCKED";
  earliestBoundary?: VerticalBoundary;
  notes?: string;
};
