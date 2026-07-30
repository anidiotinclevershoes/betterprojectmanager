import { AI_OPERATIONS, type AIOperation } from "./types";

export { AI_OPERATIONS };

export const OPERATION_GUIDANCE: Record<AIOperation, string> = {
  CREATE: "A new record is genuinely required and no existing record covers it.",
  UPDATE: "An existing record should change (title, date, notes, ownership, etc.).",
  COMPLETE: "An existing open item is finished.",
  ARCHIVE: "Soft-close an item that should leave the active set without hard delete.",
  DELETE: "Hard remove — destructive; require clear evidence and user confirmation.",
  NO_CHANGE: "The fact is already represented; propose nothing.",
};

export function describeOperationsForPrompt(): string {
  return (Object.entries(OPERATION_GUIDANCE) as [AIOperation, string][])
    .map(([op, text]) => `- ${op}: ${text}`)
    .join("\n");
}

/** Alias for modular prompt sections / tests. */
export const formatOperationsForPrompt = describeOperationsForPrompt;
