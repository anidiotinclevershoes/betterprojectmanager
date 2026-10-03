/**
 * Experiment prompt. One prompt for Capture and New Project.
 * Asks for a Project Change Form, not an observation envelope.
 */
import { CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE } from "@/lib/capture-v2/prompt";
import { FORM_OPERATIONS, FORM_OUTCOMES, SHARED_ORGANISE_PROMPT_VERSION } from "./form";

export { SHARED_ORGANISE_PROMPT_VERSION };

export const SHARED_ORGANISE_SYSTEM_MESSAGE =
  "You propose explicit project changes as JSON. You do not infer unstated project truth, advise, or mutate a database. You never invent record IDs. If a person or record cannot be resolved from the evidence, leave it unresolved.";

export const PROJECT_CHANGE_FORM_SCHEMA = `{
  "changes": [
    {
      "id": "chg-1",
      "outcome": "${FORM_OUTCOMES.join(" | ")}",
      "operation": "${FORM_OPERATIONS.join(" | ")}",
      "targetId": "a Targetable id, or null",
      "evidence": "verbatim quote from the input",
      "reason": "why this is unresolved, unchanged, commentary, or not interpretable",
      "values": {
        "name": "ensure_person",
        "roleHint": "job title only. Distinct from scope",
        "personName": "confirm_responsibility or write_availability",
        "personId": "Targetable person id when the full recorded name is in the evidence",
        "scope": "responsibility. Distinct from roleHint",
        "ownershipSemantics": "share | replace | continue | ambiguous",
        "replacePersonName": "current owner being replaced, only if named in the evidence",
        "title": "todo or risk title",
        "detail": "optional todo detail",
        "dueAt": "ISO YYYY-MM-DD",
        "label": "milestone label",
        "date": "ISO YYYY-MM-DD",
        "status": "open | watch | resolved | accepted | complete",
        "awayFromIso": "ISO YYYY-MM-DD",
        "awayToIso": "ISO YYYY-MM-DD",
        "text": "knowledge or decision body",
        "section": "now | decisions | risks | people | openLoops"
      }
    }
  ]
}`;

const RULES = `Rules:
- Propose the project changes this input asserts, given the authoritative current state.
- A change is one canonical operation. One input may produce several changes. Do not wrap a change in an observation.
- evidence must be a verbatim quote from the input. Do not use your own paraphrase as evidence.
- targetId may only be an id listed under Targetable records. Context-only ids are not targets. Never invent an id. Never target an id that is not listed for this project.
- People have two distinct facts in the People domain: a role, and responsibilities. A role is a job title. A responsibility is what that person is accountable for. When the input states both, propose both. Interpret the language. There is no required verb list.
- A role is ensure_person roleHint. A responsibility is confirm_responsibility scope.
- ensure_person creates a person. It does not edit someone already on this project. If the input changes the role of an existing person, outcome=needs_you for that role. Still propose any responsibility the input states, as its own change.
- A generic or unresolved reference is not a Person. Do not create or bind a person from someone, somebody, they, or a description such as someone on site or one of the engineers. If the input asserts a task whose owner is unresolved, propose that to-do and leave the owner unset. Do not invent a second task whose purpose is to discover the owner.
- If the input does not safely identify which existing person or record is meant, outcome=needs_you. Do not guess an id. Do not create a second person to avoid the ambiguity. Do not record that assertion as write_knowledge.
- ownershipSemantics is share, replace, continue, or ambiguous. Use ambiguous when share versus replace cannot be decided. Do not manufacture replace. Name the current owner only when the input names that person.
- Restating current truth with no change is outcome=no_change and operation=none.
- Creating a record whose title or name already exists on THIS project is not a new record. Update it, or use needs_you if the change is unclear.
- If the input says a person or record is not on this project, do not create it. If the input says they are involved in this project, a local create is allowed.
- Historical, quoted, superseded, hypothetical, negated, or questioned statements are not current truth, unless the input also states the current fact. Use no_change or commentary for the part that is not current.
- Irrelevant chatter is outcome=commentary and operation=none.
- If the wording does not identify a supported operation, outcome=left_untouched. Say what is unclear in reason. Do not invent a home for it.
- Dates you are sure of go in values as ISO YYYY-MM-DD. The reference date is in the project state. If the calendar date cannot be resolved, outcome=needs_you. Do not guess a date.
- Decisions are write_knowledge with section=decisions. Other remembered facts are write_knowledge with section=now. Do not use knowledge or memory for a person's role, responsibility, ownership, or authority to sign or approve.
- This same form is the first Review for a new project and a later Review for an existing project. The input may be collated onboarding notes plus the authoritative state. Propose creates only for truth the input establishes.
- outcome=ready only when the operation, target, and values are safe to apply. Otherwise use needs_you, no_change, left_untouched, or commentary.`;

export function buildProjectChangePrompt(args: {
  source: string;
  projectBlock: string;
}): string {
  return `What project changes does this input propose, given the authoritative current project state?

${RULES}

Current authoritative project state:
${args.projectBlock}

Input:
"""
${args.source}
"""

Return JSON only, matching:
${PROJECT_CHANGE_FORM_SCHEMA}`;
}

/** Production system message, recorded so the experiment can show it was not reused as the form prompt. */
export const PRODUCTION_OBSERVATION_SYSTEM_MESSAGE = CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE;
