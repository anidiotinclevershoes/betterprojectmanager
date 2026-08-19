/**
 * Slice 1 canonical project truth — types.
 * Structured overlay alongside legacy Knowledge section string bullets.
 */

export type EpistemicStatus =
  | "confirmed"
  | "pending"
  | "informal"
  | "suggested"
  | "inferred"
  | "conflicting"
  | "unknown"
  | "legacy";

export type LifecycleStatus = "current" | "superseded" | "historical";

export type CanonicalTruthKind =
  | "fact"
  | "responsibility"
  | "decision"
  | "risk"
  | "date"
  | "dependency"
  | "availability"
  | "open_loop"
  | "ambiguity";

export type ProvenanceEntry = {
  type:
    | "capture"
    | "user_confirmation"
    | "manual_edit"
    | "import"
    | "system"
    | "legacy";
  id?: string | null;
  at?: string | null;
  note?: string | null;
};

export type ResponsibilityMeta = {
  personName?: string | null;
  /** Stable project-scoped stakeholder/person id when known (Slice 1C). */
  personId?: string | null;
  scope: string;
  ownerConfirmed?: boolean;
};

/**
 * Intended structured home for project-relevant availability (Slice 1C).
 * Full calendar/holiday subsystem is out of scope — link via personId.
 */
export type AvailabilityMeta = {
  personId?: string | null;
  personName?: string | null;
  label?: string | null;
  awayFromIso?: string | null;
  awayToIso?: string | null;
};

export type DateMeta = {
  label: string;
  dateIso?: string | null;
  dateType?: string | null;
};

export type CanonicalTruthItem = {
  id: string;
  projectId: string;
  /** Knowledge section affinity when mirrored as a bullet. */
  section?:
    | "now"
    | "decisions"
    | "risks"
    | "people"
    | "openLoops"
    | null;
  body: string;
  kind: CanonicalTruthKind;
  /** null / omitted = legacy — do not pretend confirmed. */
  epistemic: EpistemicStatus | null;
  lifecycle: LifecycleStatus;
  supersedesId?: string | null;
  meta?: {
    responsibility?: ResponsibilityMeta | null;
    date?: DateMeta | null;
    availability?: AvailabilityMeta | null;
    [key: string]: unknown;
  } | null;
  provenance?: ProvenanceEntry[] | null;
};

export type NeedsConfirmationItem = {
  id: string;
  kind: "unknown_owner" | "conflict" | "ambiguity";
  summary: string;
  scope?: string | null;
  truthItemId?: string | null;
};

export type CanonicalTruthBundle = {
  projectId: string;
  /** Compact lines for the model (current by default). */
  promptBlock: string;
  items: CanonicalTruthItem[];
  /** Deterministic ambiguity hints (also sent to the model / UI). */
  needsConfirmationHints: NeedsConfirmationItem[];
  approxChars: number;
  includedHistoryEvidence: boolean;
};
