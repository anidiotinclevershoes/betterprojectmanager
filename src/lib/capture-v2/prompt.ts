export const CAPTURE_V2_OBSERVATION_SCHEMA = `{
  "observations": [
    {
      "id": "obs-1",
      "statement": "short atomic fact",
      "evidence": "verbatim quote from the transcript",
      "domain": "person | responsibility | risk | milestone | todo | availability | knowledge | decision | commentary | unknown",
      "disposition": "update_existing | create_new | no_change | ambiguous | merge | commentary | ignore",
      "projectId": "only an id supplied in current project state",
      "candidateTargetId": "only an id supplied in current project state, or omit",
      "candidateTargetTitle": "current title if targeting an existing record",
      "mergeWithObservationId": "optional id of a duplicate observation",
      "proposedValues": { "status": "optional", "date": "optional ISO", "ownershipSemantics": "share|replace|continue|ambiguous" },
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
