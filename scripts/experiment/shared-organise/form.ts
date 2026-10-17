/**
 * Experimental Project Change Form.
 * Operation names are the existing CaptureLegalOperation types.
 * Decisions are write_knowledge with section "decisions".
 * This file is not a production schema.
 */
import type { CaptureLegalOperation } from "@/lib/capture/apply";

export const SHARED_ORGANISE_PROMPT_VERSION = "shared-organise-form-v4";

export const FORM_OPERATIONS = [
  "ensure_person",
  "confirm_responsibility",
  "create_todo",
  "update_todo",
  "complete_todo",
  "delete_todo",
  "create_risk",
  "update_risk_status",
  "create_milestone",
  "update_milestone",
  "write_availability",
  "write_knowledge",
  "write_memory",
  "none",
] as const;

export type FormOperationName = (typeof FORM_OPERATIONS)[number];

export const FORM_OUTCOMES = [
  "ready",
  "needs_you",
  "no_change",
  "left_untouched",
  "commentary",
] as const;

export type FormOutcome = (typeof FORM_OUTCOMES)[number];

export type ProjectChange = {
  id: string;
  outcome: FormOutcome;
  operation: FormOperationName;
  targetId: string | null;
  evidence: string;
  reason: string | null;
  /**
   * Unresolved assumptions that would make this operation unsafe to apply.
   * Presence blocks Ready. The strings are not interpreted.
   */
  materialUncertainty: string[];
  values: Record<string, unknown>;
};

export type ProjectChangeForm = {
  changes: ProjectChange[];
};

export function isFormOperation(value: string): value is FormOperationName {
  return (FORM_OPERATIONS as readonly string[]).includes(value);
}

export function isFormOutcome(value: string): value is FormOutcome {
  return (FORM_OUTCOMES as readonly string[]).includes(value);
}

/** Operation types the form can emit that already exist on CaptureLegalOperation. */
export type SupportedWriteType = CaptureLegalOperation["type"];
