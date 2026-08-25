export const NEW_PROJECT_V2_SCHEMA = `{
  "project": {
    "name": "short project name evidenced in the notes",
    "summary": "one-sentence objective",
    "currentFocus": "optional current focus"
  },
  "observations": [
    {
      "id": "obs-1",
      "statement": "atomic fact",
      "evidence": "verbatim quote",
      "domain": "person | risk | milestone | todo | knowledge | commentary | unknown",
      "proposedValues": { "name": "optional", "role": "optional", "date": "YYYY-MM-DD", "title": "optional" }
    }
  ]
}`;

export function buildNewProjectV2Prompt(content: string): string {
  return `You organise messy project start notes into a provisional map.

Rules:
- Split into atomic observations. Multiple observations per sentence are expected.
- Every observation needs a verbatim evidence quote.
- Do not invent people, dates, risks or tasks that are not in the notes.
- If someone is explicitly not on this project, domain=commentary (do not add them as a person).
- Project-irrelevant chatter is commentary.
- You are not creating a project yet. This is a categorised map for the user to approve.

Notes:
"""
${content}
"""

Return JSON only, matching:
${NEW_PROJECT_V2_SCHEMA}`;
}
