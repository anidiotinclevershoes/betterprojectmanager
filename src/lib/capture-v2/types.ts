/**
 * Capture V2 atomic observations.
 * The model proposes observations. Lume validates, resolves, then Phase 3B gates writes.
 * Confidence is informational — never Apply Ready by itself.
 */

export const OBSERVATION_DOMAINS = [
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

export type ObservationDomain = (typeof OBSERVATION_DOMAINS)[number];

export const OBSERVATION_DISPOSITIONS = [
  "update_existing",
  "create_new",
  "no_change",
  "ambiguous",
  "merge",
  "commentary",
  "ignore",
] as const;

export type ObservationDisposition = (typeof OBSERVATION_DISPOSITIONS)[number];

export type CaptureObservationV2 = {
  id: string;
  statement: string;
  evidence: string;
  domain: ObservationDomain;
  disposition: ObservationDisposition;
  projectId?: string | null;
  candidateTargetId?: string | null;
  candidateTargetTitle?: string | null;
  mergeWithObservationId?: string | null;
  proposedValues?: Record<string, unknown> | null;
  commentary?: string | null;
  /** Informational only. Never makes a write Apply Ready. */
  modelConfidence?: number | null;
};

export type ObservationContextRecord = {
  id: string;
  projectId: string;
  entityType: ObservationDomain;
  title: string;
};

export type ObservationValidationIssue = {
  observationId?: string;
  code:
    | "malformed"
    | "unknown_domain"
    | "unknown_disposition"
    | "foreign_id"
    | "missing_evidence"
    | "missing_statement"
    | "cross_project_id";
  message: string;
};

export type ObservationValidationResult = {
  ok: boolean;
  observations: CaptureObservationV2[];
  rejected: CaptureObservationV2[];
  issues: ObservationValidationIssue[];
};

export function isObservationDomain(value: unknown): value is ObservationDomain {
  return (
    typeof value === "string" &&
    (OBSERVATION_DOMAINS as readonly string[]).includes(value)
  );
}

export function isObservationDisposition(
  value: unknown,
): value is ObservationDisposition {
  return (
    typeof value === "string" &&
    (OBSERVATION_DISPOSITIONS as readonly string[]).includes(value)
  );
}
