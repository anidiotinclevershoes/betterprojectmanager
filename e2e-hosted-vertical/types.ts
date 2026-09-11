export const VERTICAL_BOUNDARIES = [
  "AUTH",
  "UI INPUT",
  "HOSTED API",
  "OPENAI",
  "NEW PROJECT ADAPTER",
  "VALIDATION",
  "IDENTITY",
  "PLANNER",
  "REVIEW UI",
  "APPLY",
  "PERSISTENCE",
  "PROJECTION/RELOAD",
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
