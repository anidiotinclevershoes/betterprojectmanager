/**
 * Natural-language "when" questions from stored date labels.
 * Presentation only — does not change stored labels or dates.
 */
export function formatWhenQuestion(
  label: string,
  dateIso?: string | null,
): string {
  const trimmed = label.trim().replace(/[.?!]+$/g, "");
  if (!trimmed) return "When is this date?";
  if (/^when\s/i.test(trimmed)) {
    return trimmed.endsWith("?") ? trimmed : `${trimmed}?`;
  }

  const past =
    typeof dateIso === "string" &&
    Number.isFinite(Date.parse(dateIso)) &&
    Date.parse(dateIso) < Date.now();

  const closedWindow = trimmed.match(/^(.+?)\s+closed$/i);
  if (closedWindow?.[1]) {
    const core = softenPhrase(closedWindow[1]);
    return past
      ? `When did the ${core} close?`
      : `When does the ${core} close?`;
  }

  const article = /^(the|a|an)\s/i.test(trimmed) ? "" : "the ";
  return `When is ${article}${trimmed}?`;
}

function softenPhrase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed === trimmed.toUpperCase()) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}
