import { GATE1_V2_DOMAINS, GATE1_V2_OPERATIONS } from "./types";

export const GATE1_V2_SYSTEM = `You interpret a Capture against current canonical project truth.

Return only the JSON schema. You do not write a database. You do not advise. You do not recommend. You do not analyse the project. You do not invent facts absent from the Capture or the snapshot.`;

export function buildGate1V2Contract(): string {
  return [
    "CONTRACT",
    "Identify explicit project information in the Capture relative to current truth.",
    "",
    "Each item is one of: " + GATE1_V2_OPERATIONS.join(", ") + ".",
    "Domains: " + GATE1_V2_DOMAINS.join(", ") + ".",
    "",
    "create — new current truth that does not already exist.",
    "update — change to an existing row. Copy targetCanonicalId from the snapshot.",
    "remove — only if the Capture explicitly asks to delete/remove a row that the write model could remove. If removal is not a safe supported operation, use left_untouched or needs_you. Do not invent a delete.",
    "needs_you — the operation is clear enough to describe, but one bounded fact is unsafe to guess (which person, which row, share vs replace).",
    "left_untouched — cannot safely become a project operation. Give original wording in evidence and a concise reason.",
    "no_change — Capture restates current truth without changing it.",
    "",
    "Rules:",
    "- Use only the supplied snapshot as current truth.",
    "- Copy targetCanonicalId only from the snapshot. Never invent ids.",
    "- proposedValues.date / awayFromIso / awayToIso must be ISO YYYY-MM-DD when a date is explicit.",
    "- evidence must be a verbatim Capture excerpt.",
    "- Vague worry with no named change is left_untouched, not a new risk.",
    "- Spoken corrections: keep the corrected fact, not the retracted one.",
    "- Contradictory statements about the same row: needs_you, do not pick a side.",
    "- Irrelevant chatter is left_untouched.",
    "- No inference presented as truth.",
  ].join("\n");
}

const proposedValueProps = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: ["string", "null"] },
    personName: { type: ["string", "null"] },
    title: { type: ["string", "null"] },
    date: { type: ["string", "null"] },
    status: { type: ["string", "null"] },
    scope: { type: ["string", "null"] },
    ownershipSemantics: { type: ["string", "null"] },
    text: { type: ["string", "null"] },
    awayFromIso: { type: ["string", "null"] },
    awayToIso: { type: ["string", "null"] },
  },
  required: [
    "name",
    "personName",
    "title",
    "date",
    "status",
    "scope",
    "ownershipSemantics",
    "text",
    "awayFromIso",
    "awayToIso",
  ],
} as const;

export const GATE1_V2_JSON_SCHEMA = {
  name: "ai_first_capture_gate1_v2",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            operation: { type: "string", enum: [...GATE1_V2_OPERATIONS] },
            domain: { type: "string", enum: [...GATE1_V2_DOMAINS] },
            targetCanonicalId: { type: ["string", "null"] },
            subject: { type: "string" },
            proposedValues: proposedValueProps,
            evidence: { type: "string" },
            understood: { type: "string" },
            question: { type: ["string", "null"] },
            leftUntouchedReason: { type: ["string", "null"] },
          },
          required: [
            "operation",
            "domain",
            "targetCanonicalId",
            "subject",
            "proposedValues",
            "evidence",
            "understood",
            "question",
            "leftUntouchedReason",
          ],
        },
      },
    },
    required: ["items"],
  },
} as const;
