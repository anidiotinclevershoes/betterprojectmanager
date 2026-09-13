/**
 * Disposable Gate 1 types. Not a production Capture contract.
 */

export const GATE1_ASTRA_MODEL = "gpt-6-astra" as const;

export const GATE1_DOMAINS = [
  "person",
  "responsibility",
  "risk",
  "milestone",
  "todo",
  "availability",
  "knowledge",
  "decision",
  "commentary",
  "unknown",
] as const;

export type Gate1Domain = (typeof GATE1_DOMAINS)[number];

export const GATE1_REFERENCE_KINDS = [
  "existing",
  "new",
  "ambiguous",
  "none",
] as const;

export type Gate1ReferenceKind = (typeof GATE1_REFERENCE_KINDS)[number];

export type Gate1Observation = {
  domain: Gate1Domain;
  subject: string;
  referencedCanonicalId: string | null;
  referenceKind: Gate1ReferenceKind;
  assertion: string;
  proposedValue: string | null;
  evidence: string;
  ambiguity: string | null;
};

export type Gate1Interpretation = {
  observations: Gate1Observation[];
  overallUncertainty: string | null;
};

export type ExpectedFact = {
  id: string;
  meaning: string;
  tokens: string[];
  /** If set, a correct existing-entity bind should use this id. */
  expectedCanonicalId?: string | null;
  expectedReferenceKind?: Gate1ReferenceKind;
  /** Observation must leave genuine ambiguity rather than guess. */
  mustSurfaceAmbiguity?: boolean;
  /** Tokens that would indicate an invented / unsafe fact. */
  unsafeIfPresent?: string[];
};

export type CaseKind =
  | "create_new"
  | "change_existing"
  | "messy_multi_fact"
  | "ambiguous_identity"
  | "longhaul_regression";

export type SnapshotSizes = {
  characters: number;
  approxTokensCl100k: number;
};

export type ExistingLumeSummary = {
  source: string;
  label: string;
  text: string;
};

export type ComparisonRow = {
  materialFactsExpected: string[];
  materialFactsFound: string[];
  materialFactsMissed: string[];
  unsupportedOrInvented: string[];
  existingEntityReferences: string;
  ambiguityHandling: string;
  evidenceGrounding: string;
};
