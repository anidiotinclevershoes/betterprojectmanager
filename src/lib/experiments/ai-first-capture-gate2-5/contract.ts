/**
 * Gate 2.5 contract. Gate 1 v2 schema is unchanged.
 * Adds only: current-project write scope, and the atomic
 * confirm_responsibility shape for new person + explicit responsibility.
 */
import { buildGate1V2Contract, GATE1_V2_JSON_SCHEMA, GATE1_V2_SYSTEM } from "@/lib/experiments/ai-first-capture-gate1-v2/contract";

export { GATE1_V2_JSON_SCHEMA, GATE1_V2_SYSTEM };

export function buildGate25Contract(): string {
  return [
    buildGate1V2Contract(),
    "",
    "CURRENT PROJECT",
    "Only propose canonical changes belonging to the CURRENT project identified in the snapshot header.",
    "If the Capture attributes a person or record to another project, that is not a write for this project. Use left_untouched.",
    "",
    "PERSON + RESPONSIBILITY",
    "A new person who is also given an explicit responsibility is ONE create on domain responsibility (personName + scope).",
    "That is Lume's existing confirm_responsibility write; Apply ensures the person.",
    "Do not also emit a person create for the same name.",
    "create person is only for a new person with no responsibility stated.",
  ].join("\n");
}
