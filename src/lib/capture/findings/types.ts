import type { AIEntityType, AIOperation } from "@/ai/domain/types";

export type FindingType =
  | "ENTITY_COMPLETED"
  | "ENTITY_UPDATED"
  | "ENTITY_BLOCKED"
  | "ENTITY_REOPENED"
  | "NEW_INFORMATION"
  | "NO_CHANGE"
  | "AMBIGUOUS";

export const FINDING_TYPES: FindingType[] = [
  "ENTITY_COMPLETED",
  "ENTITY_UPDATED",
  "ENTITY_BLOCKED",
  "ENTITY_REOPENED",
  "NEW_INFORMATION",
  "NO_CHANGE",
  "AMBIGUOUS",
];

export type FindingTarget = {
  entityType: AIEntityType;
  /** Omitted for explicit CREATE / NEW_INFORMATION (no existing record). */
  entityId?: string;
  title: string;
};

export type CaptureFinding = {
  id: string;
  fact: string;
  evidence: string;
  findingType: FindingType;
  target?: FindingTarget;
  changes?: Record<
    string,
    {
      previous?: unknown;
      proposed: unknown;
    }
  >;
  confidence: number;
  requiresClarification: boolean;
  clarificationQuestion?: string;
  reasoningSummary: string;
  /** Set by validation when the AI returned a bad target ID. */
  invalidTarget?: boolean;
  validationWarning?: string;
};

export type ProposedOperation = {
  id: string;
  sourceFindingId: string;
  operation: AIOperation;
  entityType: AIEntityType;
  targetId?: string;
  targetTitle?: string;
  proposedValues?: Record<string, unknown>;
  reason: string;
  evidence: string;
  confidence: number;
  destructive: boolean;
  requiresClarification: boolean;
};

/** Indexed context record for ID validation and mapping. */
export type IndexedContextRecord = {
  entityType: AIEntityType;
  id: string;
  title: string;
  status?: string;
  summary?: string;
  rawType: string;
};

export type FindingsValidationReport = {
  ok: boolean;
  findings: CaptureFinding[];
  errors: string[];
  warnings: string[];
  invalidTargetCount: number;
};
