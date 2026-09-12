/** Production long-run dogfood — shared types. Not used by npm test. */

export const LONGRUN_SUITE_ID = "hosted-longrun-v1";
export const LONGRUN_SEED = "lume-longrun-v1-20260912-a3db";
export const LONGRUN_PRODUCTION_ORIGIN = "https://betterprojectmanager.vercel.app";

export type CaptureSize = "single" | "mixed" | "heavy" | "ambiguous";
export type CaptureClass = "safe" | "ambiguous" | "mixed_safe_ambiguous";

export type Domain =
  | "person"
  | "responsibility"
  | "todo"
  | "risk"
  | "milestone"
  | "knowledge"
  | "availability"
  | "issue";

export type ExpectedOpKind =
  | "create"
  | "update"
  | "complete"
  | "remove"
  | "needs_you"
  | "no_change"
  | "exclude_no_write"
  | "product_model_gap_needs_you";

export type ExpectedOp = {
  op: ExpectedOpKind;
  domain: Domain;
  title: string;
  note?: string;
  ymd?: string;
};

export type ReviewStep =
  | { kind: "exclude"; match: string }
  | { kind: "exclude_then_reinclude"; match: string }
  | { kind: "needs_you_resolve"; match: string; resolve: "use_this" | "create_new" | "resolve" | "share" | "replace" | "date"; date?: string; chooseName?: string }
  | { kind: "needs_you_exclude"; match: string }
  | { kind: "edit_date"; match: string; date: string }
  | { kind: "edit_entity_kind"; match: string; entity: string }
  | { kind: "choose_target"; match: string; target: string };

export type Checkpoint = "reload" | "nav" | "restart" | "signin" | "search";

export type CaptureSpec = {
  n: number;
  week: string;
  size: CaptureSize;
  classification: CaptureClass;
  source: string;
  summary: string;
  expected: ExpectedOp[];
  review: ReviewStep[];
  checkpoint?: Checkpoint[];
  highRisk?: boolean;
};

export type FailureBoundary =
  | "AI_EXTRACT"
  | "IDENTITY"
  | "VALIDATE"
  | "RESOLVE"
  | "REVIEW_UI"
  | "REVIEW_EDIT"
  | "REVIEW_EXCLUDE"
  | "REVIEW_RESOLVE"
  | "APPLY"
  | "PERSIST"
  | "RECEIPT/IDEMPOTENCY"
  | "HYDRATE"
  | "CACHE/FIRST_PAINT"
  | "PROJECTION"
  | "CROSS_PROJECT_ISOLATION"
  | "PRODUCT_MODEL_GAP"
  | "TEST_EXPECTATION"
  | "INFRASTRUCTURE"
  | "AUTH"
  | "STOP";

export type CaptureResultRow = {
  n: number;
  summary: string;
  expectedOps: string;
  review: string;
  result: "PASS" | "FAIL" | "BLOCKED" | "STOP" | "SKIPPED";
  earliestBoundary?: FailureBoundary;
  notes?: string;
  applyCountBefore?: number;
  applyCountAfterExclude?: number;
  applyHttp?: number;
  unexpectedCreates?: string[];
  unexpectedUpdates?: string[];
  unexpectedRemoves?: string[];
  missingWrites?: string[];
  needsYouObserved?: string[];
  projectionMismatches?: string[];
};

export type PersonRow = { id: string; name: string };
export type TodoRow = { id: string; title: string; done: boolean; dueAt?: string; kind?: string };
export type RiskRow = { id: string; title: string; status: string };
export type MilestoneRow = { id: string; label: string; startAt: string; endAt?: string };
export type KnowledgeRow = { id?: string; body: string; kind?: string; section?: string };
export type ResponsibilityRow = { id?: string; personName?: string; personId?: string; scope: string };

export type CanonicalSlice = {
  capturedAt: string;
  workspaceId?: string;
  userId?: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  people: PersonRow[];
  todos: TodoRow[];
  risks: RiskRow[];
  milestones: MilestoneRow[];
  knowledge: KnowledgeRow[];
  responsibilities: ResponsibilityRow[];
  otherProjectNames: string[];
};

export type SliceDelta = {
  createdPeople: PersonRow[];
  createdTodos: TodoRow[];
  createdRisks: RiskRow[];
  createdMilestones: MilestoneRow[];
  createdKnowledge: KnowledgeRow[];
  createdResponsibilities: ResponsibilityRow[];
  updatedTodos: Array<{ before: TodoRow; after: TodoRow }>;
  updatedRisks: Array<{ before: RiskRow; after: RiskRow }>;
  updatedMilestones: Array<{ before: MilestoneRow; after: MilestoneRow }>;
  removedPeople: PersonRow[];
  removedTodos: TodoRow[];
  removedRisks: RiskRow[];
  removedMilestones: MilestoneRow[];
  removedKnowledge: KnowledgeRow[];
  removedResponsibilities: ResponsibilityRow[];
  idReplacements: string[];
  duplicatePeople: string[];
};
