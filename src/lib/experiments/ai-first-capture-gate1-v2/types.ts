export const GATE1_V2_DEFAULT_MODEL = "gpt-6-astra";

export const GATE1_V2_OPERATIONS = [
  "create",
  "update",
  "remove",
  "needs_you",
  "left_untouched",
  "no_change",
] as const;

export type Gate1V2Operation = (typeof GATE1_V2_OPERATIONS)[number];

export const GATE1_V2_DOMAINS = [
  "person",
  "responsibility",
  "risk",
  "milestone",
  "todo",
  "availability",
  "knowledge",
  "decision",
  "unsupported",
] as const;

export type Gate1V2Domain = (typeof GATE1_V2_DOMAINS)[number];

export type Gate1V2ProposedValues = {
  name: string | null;
  personName: string | null;
  title: string | null;
  date: string | null;
  status: string | null;
  scope: string | null;
  ownershipSemantics: string | null;
  text: string | null;
  awayFromIso: string | null;
  awayToIso: string | null;
};

export type Gate1V2Item = {
  operation: Gate1V2Operation;
  domain: Gate1V2Domain;
  targetCanonicalId: string | null;
  subject: string;
  proposedValues: Gate1V2ProposedValues;
  evidence: string;
  understood: string;
  question: string | null;
  leftUntouchedReason: string | null;
};

export type Gate1V2Envelope = {
  items: Gate1V2Item[];
};

export type InspectIssue = {
  index: number;
  code: "invalid_enum" | "missing_field" | "unknown_id" | "not_object";
  message: string;
};

export type InspectedEnvelope = {
  ok: boolean;
  malformed: boolean;
  items: Gate1V2Item[];
  issues: InspectIssue[];
};

export type SnapshotSizes = {
  characters: number;
  approxTokensCl100k: number;
};

export type ExpectedFact = {
  id: string;
  meaning: string;
  tokens: string[];
  expectedOperation: Gate1V2Operation | Gate1V2Operation[];
  expectedDomain?: Gate1V2Domain | Gate1V2Domain[];
  expectedTargetId?: string | null;
  acceptedTargetIds?: string[];
  /** Extra write against these ids is a wrong-target / invented write. */
  forbiddenTargetIds?: string[];
};

export type ScoreBucket =
  | "correct_explicit_truth"
  | "incorrect_proposed_truth"
  | "wrong_target"
  | "silent_omission"
  | "appropriate_needs_you"
  | "appropriate_left_untouched"
  | "correct_no_change"
  | "unsupported_invented_operation"
  | "malformed_unusable";

export type FactScore = {
  factId: string;
  meaning: string;
  bucket: ScoreBucket;
  note: string;
};

export type CaseScore = {
  facts: FactScore[];
  extraInvented: string[];
  malformed: boolean;
};

export type AggregateScore = {
  correctExplicitFacts: number;
  falseWrites: number;
  wrongTargets: number;
  silentLoss: number;
  appropriateHumanFallback: number;
  correctNoChange: number;
  inventedOperations: number;
  malformedCases: number;
  factsScored: number;
  cases: number;
};
