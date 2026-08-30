export const CAPTURE_V2_OBSERVATION_SCHEMA = `{
  "observations": [
    {
      "id": "obs-1",
      "statement": "short atomic fact",
      "evidence": "verbatim quote from the transcript",
      "domain": "person | responsibility | risk | milestone | todo | availability | knowledge | decision | commentary | unknown",
      "disposition": "update_existing | create_new | no_change | ambiguous | merge | commentary | ignore",
      "truthIntent": "current | non_current | uncertain",
      "projectId": "only an id supplied in current project state",
      "candidateTargetId": "only an id supplied in current project state, or omit",
      "candidateTargetTitle": "current title if targeting an existing record",
      "mergeWithObservationId": "optional id of a duplicate observation",
      "proposedValues": {
        "name": "person create/update: explicit usable person name",
        "personName": "availability/responsibility: explicit usable person name",
        "title": "todo/risk create: concise title",
        "label": "milestone create: semantic date label, not the whole transcript",
        "date": "ISO YYYY-MM-DD when the domain is a dated fact",
        "startAt": "ISO YYYY-MM-DD milestone date if not using date",
        "awayFromIso": "availability: ISO YYYY-MM-DD start",
        "awayToIso": "availability: ISO YYYY-MM-DD end, or omit to use awayFromIso",
        "scope": "responsibility: the owned thing",
        "ownershipSemantics": "share | replace | continue | ambiguous",
        "status": "risk/todo update: open | watch | resolved | accepted | complete",
        "text": "knowledge/decision body when statement is not enough"
      },
      "commentary": "optional note when disposition is commentary or ambiguous",
      "modelConfidence": 0
    }
  ]
}`;

export function buildObservationExtractionPrompt(args: {
  transcript: string;
  projectBlock: string;
}): string {
  return `You extract atomic project observations. You do not mutate a database.

Rules:
- Split the transcript into the smallest project-relevant facts (multiple observations per sentence are expected).
- Every observation needs a verbatim evidence quote from the transcript.
- candidateTargetId MUST be copied from the supplied current records. Never invent IDs.
- If a person/risk/date/todo already exists, prefer update_existing or no_change over create_new.
- If share vs replace (or two plausible targets) cannot be decided from the transcript, disposition=ambiguous.
- truthIntent=current only when the user is asserting this as current authoritative project truth (including explicit corrections, agreed dates/ownership, and agreed future milestones). truthIntent=non_current for historical, quoted, superseded, considered-but-not-agreed, or rejected alternatives. truthIntent=uncertain when it is unclear whether current truth should change.
- Restating existing current truth without a change is disposition=no_change. Do not mark historical or quoted material as truthIntent=current.
- Put domain-required values in proposedValues. Do not invent missing values. If a required value is unknown, omit it (Lume will Needs You) rather than guessing.
- Person create: proposedValues.name must be the explicit usable person name.
- Milestone create: proposedValues.label and proposedValues.date (ISO YYYY-MM-DD).
- Availability: proposedValues.personName (or name) and proposedValues.awayFromIso (ISO). Optional awayToIso.
- Responsibility: proposedValues.personName, proposedValues.scope, and proposedValues.ownershipSemantics (share|replace|continue|ambiguous).
- Todo create: proposedValues.title. Risk create: proposedValues.title. Knowledge/decision: proposedValues.text or a clear statement.
- Project-irrelevant chatter is domain=commentary and disposition=commentary.
- Duplicate restatements: keep one observation and mark others disposition=merge.
- Do not output operations, SQL, or Apply Ready. Confidence is informational only.

Current authoritative project state:
${args.projectBlock}

Transcript:
"""
${args.transcript}
"""

Return JSON only, matching:
${CAPTURE_V2_OBSERVATION_SCHEMA}`;
}
