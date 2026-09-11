/**
 * Capture convergence-gate types.
 * Diagnostic only. Does not change Capture production behaviour.
 */

export const PIPELINE_STAGES = [
  "PARSE",
  "VALIDATE",
  "PRESERVE",
  "IDENTITY",
  "PLANNER",
  "REVIEW",
  "WRITE_ELIGIBILITY",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const FAMILIES = [
  "historical_regression",
  "information_preservation",
  "cross_observation_contamination",
  "order_invariance",
  "irrelevant_context",
  "ambiguity_isolation",
  "malformed_isolation",
  "identity_matrix",
  "composition",
  "duplication",
  "contradiction",
  "product_model_gap",
  "held_out",
] as const;

export type FamilyId = (typeof FAMILIES)[number];

export const FAILURE_CLASSES = [
  "MODEL/EXTRACTOR",
  "VALIDATION",
  "INFORMATION LOSS",
  "IDENTITY RESOLUTION",
  "PLANNER",
  "PRODUCT MODEL GAP",
  "UNKNOWN",
] as const;

export type FailureClass = (typeof FAILURE_CLASSES)[number];

export type SemanticAtom = {
  observationId: string;
  domain: string;
  disposition: string;
  truthIntent: string;
  decisionKind: string;
  writeType: string | null;
  legalDomain: string | null;
  targetId: string | null;
  personName: string | null;
  scope: string | null;
  date: string | null;
  rejected: boolean;
  reviewReadiness: string | null;
  /** Coarse plan/identity reason. Meaningful for contamination; not UI copy. */
  reasonClass: string;
};

export type SemanticSnapshot = {
  atoms: SemanticAtom[];
  rejectedCodes: string[];
  parseMalformed: boolean;
};

export type StageTrace = {
  parseMalformed: boolean;
  parseIssueCodes: string[];
  keptIds: string[];
  rejectedIds: string[];
  rejectedCodes: string[];
  preserved: Array<{
    id: string;
    statement: boolean;
    evidence: boolean;
    name: boolean;
    scope: boolean;
    date: boolean;
  }>;
  identity: Array<{
    id: string;
    targetId: string | null;
    personName: string | null;
    bound: boolean;
  }>;
  plan: Array<{
    id: string;
    kind: string;
    writeType: string | null;
    reason: string | null;
  }>;
  review: Array<{
    id: string;
    readiness: string | null;
  }>;
};

export type WorldKind = "experimental" | "aurora";

export type ConvergenceCase = {
  id: string;
  family: FamilyId;
  seed: number;
  baseScenario: string;
  perturbation: string;
  expectedInvariant: string;
  transcript: string;
  rawModelJson: unknown;
  world: WorldKind;
  projectId: string;
  surface?: "capture" | "new_project";
  /** Observation ids whose semantics are compared to the solo/base run. */
  focusIds: string[];
  /** When set, compare focus atoms against this case's run. */
  compareToId?: string;
  /** Absolute checks for historical / gap / identity cases. */
  expect?: {
    decisionById?: Record<string, string>;
    writeTypeById?: Record<string, string | null>;
    reasonClassById?: Record<string, string>;
    reasonIncludesById?: Record<string, string>;
    needsYouLocal?: boolean;
    productModelGap?: boolean;
    /** Fields that must survive parse → plan. */
    preserve?: Array<{
      id: string;
      fields: Array<"name" | "scope" | "date" | "statement" | "evidence">;
    }>;
    np?: {
      needsYouCount?: number;
      responsibilitiesByName?: Record<string, string[]>;
    };
  };
  heldOut?: boolean;
};

export type CaseResult = {
  id: string;
  family: FamilyId;
  seed: number;
  baseScenario: string;
  perturbation: string;
  expectedInvariant: string;
  ok: boolean;
  expected: string;
  actual: string;
  earliestStage: PipelineStage | null;
  classification: FailureClass | null;
  productModelGap: boolean;
  heldOut: boolean;
  snapshot: SemanticSnapshot;
};

export type FamilyTotals = Record<FamilyId, { pass: number; fail: number; total: number }>;

export type FailureCluster = {
  id: string;
  label: string;
  classification: FailureClass;
  earliestStage: PipelineStage;
  caseIds: string[];
  note: string;
};

export type ArchitectureJudgement = "A" | "B" | "C";

export type ConvergenceReport = {
  sourceSha: string;
  experimentSha: string;
  generatedAt: string;
  elapsedMs: number;
  total: number;
  pass: number;
  fail: number;
  families: FamilyTotals;
  clusters: FailureCluster[];
  failures: CaseResult[];
  historicalScenarioCount: number;
  historicalCaptureBehaviours: number;
  historicalNewProjectBehaviours: number;
  perturbationCaseCount: number;
  heldOutCount: number;
  uniqueFailureFamilies: number;
  combinedOnlyBreaks: string[];
  orderChangesSemantics: string[];
  unrelatedContextChanges: string[];
  informationLossCases: string[];
  productModelGapCases: string[];
  architectureJudgement: ArchitectureJudgement;
  architectureNote: string;
  reproduce: string[];
};
