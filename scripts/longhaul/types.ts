/**
 * Long-haul 100-capture types. Test-only. No production Capture engine.
 */

import type { ObservationDomain, ObservationDisposition } from "../../src/lib/capture-v2/types";

export type FixtureKey = string;

export type WriteOp = "create" | "update" | "complete" | "resolve" | "leave";

export type ExpectedWrite = {
  key: FixtureKey;
  op: WriteOp;
  domain: ObservationDomain;
  /** Human title/name/label used to bind identity after create. */
  title: string;
  values?: Record<string, unknown>;
  /** Responsibility scope, e.g. "UAT". */
  scope?: string;
};

export type ExpectedNeedYou = {
  about: string;
  note: string;
};

export type ExpectedNoChange = {
  key?: FixtureKey;
  note: string;
};

export type CaptureSpec = {
  n: number;
  phase:
    | "settle"
    | "delivery"
    | "change"
    | "messy"
    | "lifecycle"
    | "stale"
    | "release";
  input: string;
  curveBalls?: string[];
  expectedWrites?: ExpectedWrite[];
  expectedNeedsYou?: ExpectedNeedYou[];
  expectedNoChange?: ExpectedNoChange[];
  /** Analyse-only probe — never Apply. */
  analyseOnly?: boolean;
};

export type IdentityMap = Map<FixtureKey, string>;

export type ExpectedWorld = {
  people: Map<FixtureKey, { name: string; role?: string; present: boolean }>;
  todos: Map<FixtureKey, { title: string; done: boolean; dueAt?: string }>;
  risks: Map<FixtureKey, { title: string; status: "open" | "watch" | "resolved" | "accepted" }>;
  milestones: Map<FixtureKey, { label: string; date: string }>;
  knowledge: Map<FixtureKey, { text: string; current: boolean }>;
  responsibilities: Map<string, FixtureKey>;
  availability: Map<FixtureKey, string | null>;
};

export type TruthDiff = {
  path: string;
  expected: string;
  actual: string;
};

export type CallRow = {
  capture: number;
  requestType: "capture_extract" | "capture_context" | "ask" | "ask_context" | "analyse_probe";
  model: string;
  live: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedTokens: number | null;
  latencyMs: number;
  requestChars: number;
  /** API usage when live; otherwise null. */
  estimatedInputTokens: number | null;
  canonicalTruthChars: number;
  currentTruthObjects: number;
  historyCount: number;
  projectBlockChars: number;
  captureContextChars: number;
  captureContextHistoryChars: number;
};

export type CaptureOutcome = {
  n: number;
  input: string;
  expectedReview: "apply" | "needs_you" | "no_change" | "mixed" | "analyse_only";
  actualReview: string;
  writeCount: number;
  needsYouCount: number;
  noChangeCount: number;
  applied: number;
  historyBefore: number;
  historyAfter: number;
  diffs: TruthDiff[];
  stop?: string;
  divergence?: string;
};

/** One Resolve-Ready item and what Apply did with it. */
export type ReadyApplyAttempt = {
  capture: number;
  domain: string;
  statement: string;
  observationId: string | null;
  suggestionId: string | null;
  suggestionContent: string | null;
  executedKind: "wrote" | "needs_you" | "no_change" | "failed" | "thrown" | "blocked_wrong_project";
  executedReason: string | null;
  decisionKind: string | null;
};
