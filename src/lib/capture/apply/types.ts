/**
 * Phase 3B — Capture mutation boundary types.
 *
 * A typed finding may mutate only its own legal authoritative domain.
 * There is no generic fallback write.
 */

import type { KnowledgeSectionId, TodoKind } from "@/lib/types";
import type { RiskStatus } from "@/types/database";
import type { PendingSuggestion } from "@/lib/capture/suggestions";

export const CAPTURE_LEGAL_DOMAINS = [
  "todo",
  "risk",
  "milestone",
  "person",
  "responsibility",
  "availability",
  "knowledge",
  "memory",
  "unsupported",
] as const;

export type CaptureLegalDomain = (typeof CAPTURE_LEGAL_DOMAINS)[number];

export const OWNERSHIP_SEMANTICS = [
  "share",
  "replace",
  "continue",
  "ambiguous",
] as const;

export type OwnershipSemantics = (typeof OWNERSHIP_SEMANTICS)[number];

export function isOwnershipSemantics(value: unknown): value is OwnershipSemantics {
  return (
    typeof value === "string" &&
    (OWNERSHIP_SEMANTICS as readonly string[]).includes(value)
  );
}

/** Present but not a legal enum — fail closed; do not discard into another domain. */
export function hasInvalidOwnershipSemantics(value: unknown): boolean {
  if (value == null || value === "") return false;
  return !isOwnershipSemantics(value);
}

export type CaptureLegalOperation =
  | {
      type: "create_todo";
      projectId: string;
      title: string;
      detail?: string;
      dueAt?: string;
      todoKind?: TodoKind;
      waitingOn?: string;
      /** Approved Review/Apply operation identity. Retry-safe; not a title. */
      applyOperationId?: string;
    }
  | {
      type: "update_todo";
      projectId: string;
      todoId: string;
      title?: string;
      detail?: string;
      dueAt?: string;
    }
  | {
      type: "complete_todo";
      projectId: string;
      todoId: string;
    }
  | {
      type: "delete_todo";
      projectId: string;
      todoId: string;
    }
  | {
      type: "create_risk";
      projectId: string;
      title: string;
      applyOperationId?: string;
    }
  | {
      type: "update_risk_status";
      projectId: string;
      riskId: string;
      status: RiskStatus;
    }
  | {
      type: "create_milestone";
      projectId: string;
      label: string;
      startAt?: string;
      endAt?: string;
      notes?: string;
      applyOperationId?: string;
    }
  | {
      type: "update_milestone";
      projectId: string;
      milestoneId: string;
      label?: string;
      startAt?: string;
      endAt?: string;
      notes?: string;
    }
  | {
      type: "ensure_person";
      projectId: string;
      name: string;
      personId?: string;
      roleHint?: string;
    }
  | {
      type: "confirm_responsibility";
      projectId: string;
      scope: string;
      personName: string;
      personId?: string | null;
      replacePersonId?: string | null;
    }
  | {
      type: "write_availability";
      projectId: string;
      personId: string;
      personName: string;
      awayFromIso: string;
      awayToIso: string;
      label?: string;
    }
  | {
      type: "write_knowledge";
      projectId: string;
      section: KnowledgeSectionId;
      text: string;
    }
  | {
      type: "write_memory";
      projectId: string;
      title: string;
    };

export type CaptureConfirmOwnerRequest = {
  projectId: string;
  scope: string;
  personName: string;
  personId?: string | null;
};

export type CaptureApplyDecision =
  | {
      kind: "write";
      domain: Exclude<CaptureLegalDomain, "unsupported">;
      operation: CaptureLegalOperation;
    }
  | {
      kind: "needs_you";
      domain: CaptureLegalDomain;
      reason: string;
      confirmOwner?: CaptureConfirmOwnerRequest;
    }
  | {
      kind: "no_change";
      domain: CaptureLegalDomain;
      reason: string;
    };

export type CaptureApplyWorld = {
  projectIds: Set<string>;
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
  }>;
  timeline: Array<{
    id: string;
    projectId: string;
    label: string;
    startAt?: string;
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
      meta?: {
        personId?: string;
        responsibility?: {
          personId?: string | null;
          personName?: string | null;
          scope?: string;
          ownerConfirmed?: boolean;
        } | null;
        availability?: {
          personId?: string | null;
          personName?: string | null;
          awayFromIso?: string | null;
          awayToIso?: string | null;
        } | null;
      } | null;
    }>;
  }>;
};

export type PlanCaptureApplyInput = {
  item: PendingSuggestion;
  text: string;
  world: CaptureApplyWorld;
  /** Project the user entered Capture from — used only when the finding is not unresolved. */
  captureEntryProjectId?: string | null;
};

export function isCaptureLegalDomain(value: unknown): value is CaptureLegalDomain {
  return (
    typeof value === "string" &&
    (CAPTURE_LEGAL_DOMAINS as readonly string[]).includes(value)
  );
}

export function assertNever(value: never, message: string): never {
  throw new Error(`${message}: ${String(value)}`);
}
