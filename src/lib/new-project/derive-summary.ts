/**
 * Condense user-supplied overview text into the existing Project.summary field.
 * Does not invent facts. Does not call a model. Capture extract still does
 * not emit Objective / summary.
 */

export function deriveProjectSummary(narrative: string, maxLen = 200): string {
  const cleaned = narrative.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const sentences = cleaned.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  let out = (sentences[0] || cleaned).trim();
  if (out.length < 40 && sentences[1]) {
    out = `${out} ${sentences[1]}`.trim();
  }
  if (out.length <= maxLen) return out;
  const sliced = out.slice(0, maxLen - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced).trim()}…`;
}
