/**
 * Experiment-only comparison types.
 * Mechanical normalization only — do not reinterpret English.
 */

export const CONTENDERS = ["current", "simplification", "ai-first"] as const;
export type ContenderId = (typeof CONTENDERS)[number];

export const BAKEOFF_CATEGORIES = [
  "clear_ordinary",
  "no_change_restatement",
  "identity",
  "uncertainty",
  "unsupported_unplaceable",
  "messy_realistic",
  "historical_failure",
] as const;
export type BakeoffCategory = (typeof BAKEOFF_CATEGORIES)[number];

export const EXPECTED_SOURCES = [
  "eval-corpus",
  "holdout",
  "longhaul-regression",
  "simplification-observe",
  "gate1-v2-fixture",
  "gate2-fixture",
  "harbourline-stress",
  "manual-for-experiment",
] as const;
export type ExpectedSource = (typeof EXPECTED_SOURCES)[number];

export const DISPOSITIONS = [
  "create",
  "update",
  "remove",
  "needs_you",
  "left_untouched",
  "no_change",
  "unsupported",
  "omitted",
] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export type SerializedWorld = {
  projectIds: string[];
  projects: Array<{
    id: string;
    name: string;
    code?: string;
    stakeholders: Array<{ id: string; name: string; role?: string }>;
  }>;
  risks: Array<{
    id: string;
    projectId: string;
    title: string;
    status: string;
  }>;
  todos: Array<{
    id: string;
    projectId?: string | null;
    title: string;
    done?: boolean;
    dueAt?: string;
    detail?: string;
  }>;
  timeline: Array<{
    id: string;
    projectId: string;
    label: string;
    startAt?: string;
    endAt?: string;
    notes?: string;
  }>;
  knowledge: Array<{
    projectId: string;
    sections: { people?: string[]; risks?: string[] };
    structured?: Array<{
      id: string;
      kind: string;
      lifecycle: string;
      body: string;
      meta?: unknown;
    }>;
  }>;
};

export type ExpectedFact = {
  id: string;
  meaning: string;
  tokens: string[];
  domain: string | string[] | null;
  existingVsNew: "existing" | "new" | "ambiguous" | "none";
  targetId: string | null;
  acceptedTargetIds?: string[];
  forbiddenTargetIds?: string[];
  expectedDisposition: Disposition[];
  changedValue: string | null;
  evidencePhrase: string | null;
  genuineAmbiguity: boolean;
  automaticActionSafe: boolean;
  humanClarificationAppropriate: boolean;
  noCanonicalOperation: boolean;
};

export type FrozenCase = {
  id: string;
  title: string;
  category: BakeoffCategory;
  source: string;
  expectedSource: ExpectedSource;
  captureText: string;
  projectId: string;
  world: SerializedWorld;
  expected: ExpectedFact[];
  stage2: boolean;
  stage3: boolean;
  historical: boolean;
};

export type FrozenManifest = {
  frozenAt: string;
  note: string;
  pins: {
    current: string;
    simplification: string;
    aiFirst: string;
  };
  cases: FrozenCase[];
  stage2Ids: string[];
  stage3Ids: string[];
  blindIds: string[];
};

export type NormalizedItem = {
  domain: string | "omitted" | "unsupported";
  subject: string | "omitted";
  referencedCanonicalId: string | "omitted";
  assertedValue: unknown | "omitted";
  evidence: string | "omitted";
  ambiguity: string | "omitted";
  disposition: Disposition;
  writeProposed: boolean;
};

export type ContenderRun = {
  caseId: string;
  contender: ContenderId;
  repeatIndex: number;
  ok: boolean;
  error: string | null;
  requestedModel: string | null;
  responseModel: string | null;
  latencyMs: number | null;
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
  } | null;
  raw: unknown;
  normalized: NormalizedItem[];
  apply: {
    writesAttempted: number;
    writesExecuted: number;
    before: unknown;
    after: unknown;
  } | null;
};

export type FactJudgement = {
  factId: string;
  meaning: string;
  recalled: boolean;
  falseMaterialFact: boolean;
  falseUnsafeWrite: boolean;
  wrongIdentity: boolean;
  silentOmission: boolean;
  evidenceGrounded: boolean | null;
  ambiguitySafe: boolean | null;
  clearAutomationOk: boolean | null;
  justifiedIntervention: boolean;
  unnecessaryIntervention: boolean;
  note: string;
};

export type CaseJudgement = {
  caseId: string;
  contender: ContenderId;
  repeatIndex: number;
  facts: FactJudgement[];
  extraWrites: string[];
  malformed: boolean;
};
