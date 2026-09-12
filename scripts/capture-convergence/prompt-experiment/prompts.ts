/**
 * Experiment-only prompt variants. Production `src/lib/capture-v2/prompt.ts`
 * is Prompt A and is not imported for B/C/D/E at runtime in the app.
 */
import {
  buildObservationExtractionPrompt,
  CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
  CAPTURE_V2_OBSERVATION_SCHEMA,
} from "../../../src/lib/capture-v2/prompt";

export type PromptVariantId = "A" | "B" | "C" | "D" | "E";

export const PROMPT_VARIANT_META: Record<
  PromptVariantId,
  { label: string; promptVersion: string }
> = {
  A: { label: "current production", promptVersion: "capture-v2-eval-baseline-v1" },
  B: { label: "stronger typed schema guidance", promptVersion: "exp-prompt-b-typed-v1" },
  C: { label: "uncertainty / reference discipline", promptVersion: "exp-prompt-c-discipline-v1" },
  D: { label: "example-guided", promptVersion: "exp-prompt-d-examples-v1" },
  E: {
    label: "A plus reference + Create-ID discipline",
    promptVersion: "exp-prompt-e-ref-create-id-v1",
  },
};

const PROMPT_E_SYSTEM_ADDENDUM =
  " Do not guess pronoun identity. Do not invent candidateTargetId on Creates.";

const PROMPT_E_DISCIPLINE = `
Reference discipline:
- Do not guess which person a pronoun (she/he/they) refers to.
- Do not attach a person merely because their name appears elsewhere in the paste.
- Preserve unresolved references as unresolved. Do not copy a nearby name into personName unless that name is in the same evidence quote.
- Keep contradictory claims as separate observations. Do not silently pick one.
- Distinguish explicit evidence from inferred identity.
- Do not import nearby or sibling names into another observation's evidence quote.

Create-ID discipline:
- Do not invent candidateTargetId for Creates.
- Never use a project UUID as an entity target ID.
- Only emit an existing candidateTargetId when an existing canonical entity in current records is clearly identified.
- Legitimate new Person / To Do / Milestone / Risk / Knowledge observations may remain create_new with no candidateTargetId.
`;

export function systemMessageFor(variant: PromptVariantId): string {
  if (variant === "A") return CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE;
  if (variant === "E") return CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE + PROMPT_E_SYSTEM_ADDENDUM;
  if (variant === "C") {
    return "You extract atomic project observations as JSON. You do not mutate a database. You never invent record IDs. You do not guess identity. You preserve pronouns and unresolved references. You do not resolve contradictions.";
  }
  return "You extract atomic project observations as JSON. You do not mutate a database. You never invent record IDs.";
}

export function userPromptFor(
  variant: PromptVariantId,
  args: { transcript: string; projectBlock: string },
): string {
  if (variant === "A") return buildObservationExtractionPrompt(args);
  if (variant === "E") return buildPromptE(args);
  return `${coreContract(variant)}

Current authoritative project state:
${args.projectBlock}

Transcript:
"""
${args.transcript}
"""

Return JSON only, matching:
${CAPTURE_V2_OBSERVATION_SCHEMA}`;
}

function buildPromptE(args: { transcript: string; projectBlock: string }): string {
  const base = buildObservationExtractionPrompt(args);
  const marker = "\n\nCurrent authoritative project state:";
  const idx = base.indexOf(marker);
  if (idx < 0) {
    return `${base}\n${PROMPT_E_DISCIPLINE}`;
  }
  return `${base.slice(0, idx)}\n${PROMPT_E_DISCIPLINE}${base.slice(idx)}`;
}

function coreContract(variant: PromptVariantId): string {
  const typed =
    variant === "B" || variant === "D"
      ? `
Entity classes:
- person: a named human. Name-only is valid. Do not invent a responsibility.
- responsibility: personName + scope. Scope is optional; omit it rather than guess.
- risk, milestone, todo, availability, knowledge, commentary as in the schema.

Create vs Update:
- create_new only when no supplied current record is the same thing.
- update_existing only with a candidateTargetId copied from current records.
- If the target is unclear, omit the id and use ambiguous. Never invent an id.
- A legal create must not be attached to an invalid update target.
`
      : "";

  const discipline =
    variant === "C" || variant === "D"
      ? `
Reference discipline:
- Do not guess which person a pronoun refers to.
- Preserve "she/he/they" as unresolved. Do not copy a nearby full name into personName unless that name is in the same evidence quote.
- Do not let one sentence's names contaminate another observation.
- Distinguish explicit current truth from inference, gossip, or "someone should".
- If two sentences contradict (open vs closed, two dates), emit both. Do not silently pick one.
- Foreign / other-project UUIDs in the transcript are not identity. Never copy them as candidateTargetId unless they appear in current records.
`
      : "";

  const examples =
    variant === "D"
      ? `
Examples (follow the contract, do not copy these people into other Captures):

1. Clear create: "Velvet Sprocket is joining as paint lead." → person create_new, proposedValues.name="Velvet Sprocket". No candidateTargetId.

2. Clear update: "Parade day is now 29 October 2026." and current records include ms-parade "Parade day" → milestone update_existing, candidateTargetId=ms-parade, date=2026-10-29.

3. Ambiguous pronoun: "Olga Petrov and Sarah Kim discussed UAT. She will own UAT." → responsibility ambiguous; do not set candidateTargetId to Olga or Sarah.

4. Multiple people: "Olga Petrov is responsible for UAT. Sarah Kim is responsible for Release." → two observations; each evidence quote names only that person.

5. Contradiction: "Gumdrop Bridge icing is still open. Gumdrop Bridge icing is resolved." → two risk observations; do not drop one.

6. Date without existing milestone: a new dated event with no matching current record → milestone create_new with label+date, or Needs-You-shaped omit — do not invent a target id.

7. Optional person responsibility: "bob is the ba" → person create_new name=bob. Scope optional; omit if not explicit.

8. Multiple observations from one span: split into atomic facts; each has its own evidence quote.
`
      : "";

  return `You extract atomic project observations. You do not mutate a database.

Rules:
- Split the transcript into the smallest project-relevant facts.
- Every observation needs a verbatim evidence quote from the transcript.
- candidateTargetId MUST be copied from the supplied current records. Never invent IDs.
- If share vs replace (or two plausible targets) cannot be decided, disposition=ambiguous.
- truthIntent=current only for explicit current authoritative truth.
- Restating existing current truth without a change is disposition=no_change.
- Do not invent missing values. Omit unknowns.
- Project-irrelevant chatter is commentary.
- Do not output operations, SQL, or Apply Ready.
${typed}${discipline}${examples}`;
}
