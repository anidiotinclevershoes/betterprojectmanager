/**
 * Concise Gate 1 interpretation contract. Disposable. Not Prompt A.
 */
import { GATE1_DOMAINS, GATE1_REFERENCE_KINDS } from "./types";

export const GATE1_SYSTEM_MESSAGE = `You interpret raw Capture text against a mechanical dump of current canonical project truth.

You do not write a database. You do not decide Review or Apply. You do not invent facts that are absent from the Capture and the supplied current truth.

Return only the requested JSON schema.`;

export function buildInterpretationContract(): string {
  return [
    "INTERPRETATION CONTRACT",
    "",
    "Identify material project information expressed by the Capture.",
    "",
    "For every observation return:",
    "- domain: one of " + GATE1_DOMAINS.join(", "),
    "- subject: the entity or topic in plain language",
    "- referencedCanonicalId: an id copied from the snapshot if you believe an existing row is referenced, else null",
    "- referenceKind: one of " + GATE1_REFERENCE_KINDS.join(", "),
    "- assertion: the change or information being expressed",
    "- proposedValue: the asserted value when one is stated, else null",
    "- evidence: an exact supporting quote from the Capture",
    "- ambiguity: genuine uncertainty, else null",
    "",
    "Rules:",
    "- Use the supplied canonical snapshot as context. Do not retrieve or rank beyond what is printed.",
    "- Do not invent facts absent from the Capture or current snapshot.",
    "- Distinguish new information from information that refers to an existing project entity.",
    "- Copy referencedCanonicalId only from the snapshot. Never invent ids.",
    "- If identity, ownership, or which record is meant is unsafe to guess, set referenceKind=ambiguous and say why in ambiguity.",
    "- Preserve evidence as a verbatim Capture excerpt.",
    "- Irrelevant chatter (biscuits, weather, office plants) is commentary, not project truth.",
    "- Do not decide or execute database writes.",
  ].join("\n");
}

export const GATE1_JSON_SCHEMA = {
  name: "ai_first_capture_gate1_interpretation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      observations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            domain: { type: "string", enum: [...GATE1_DOMAINS] },
            subject: { type: "string" },
            referencedCanonicalId: { type: ["string", "null"] },
            referenceKind: { type: "string", enum: [...GATE1_REFERENCE_KINDS] },
            assertion: { type: "string" },
            proposedValue: { type: ["string", "null"] },
            evidence: { type: "string" },
            ambiguity: { type: ["string", "null"] },
          },
          required: [
            "domain",
            "subject",
            "referencedCanonicalId",
            "referenceKind",
            "assertion",
            "proposedValue",
            "evidence",
            "ambiguity",
          ],
        },
      },
      overallUncertainty: { type: ["string", "null"] },
    },
    required: ["observations", "overallUncertainty"],
  },
} as const;
