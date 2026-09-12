/**
 * Explicit responsibility scope from user text.
 *
 * Role is not a scope. Do not invent "QS" from "is the QS".
 * Name-anchored phrases only — never scan sibling sentences for a different person.
 */

function asUsable(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/[.,;:]+$/g, "").trim();
  return trimmed ? trimmed : undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "is responsible for X", "owns X", "will own X", "covers X". */
export function scopeFromResponsiblePhrase(text: string): string | undefined {
  const source = text.replace(/\s+/g, " ").trim();
  if (!source) return undefined;
  const responsible = source.match(/\bis responsible for\s+([^.;\n]+)/i);
  if (responsible?.[1]) return asUsable(responsible[1]);
  const willOwn = source.match(/\bwill own\s+(?:the\s+)?([^.;\n]+)/i);
  if (willOwn?.[1]) return asUsable(willOwn[1]);
  const owns = source.match(/\bowns\s+(?:the\s+)?([^.;\n]+)/i);
  if (owns?.[1]) return asUsable(owns[1]);
  const covers = source.match(/\bcovers\s+([^.;\n]+)/i);
  if (covers?.[1]) return asUsable(covers[1]);
  return undefined;
}

/**
 * Find a sentence that names this person and states an explicit responsibility.
 * Used by New Project organise against the user notes, not model paraphrase.
 */
export function scopeFromNarrativeForName(
  narrative: string,
  name: string,
): string | undefined {
  const person = name.trim();
  if (!person || !narrative.trim()) return undefined;
  const sentenceRe = new RegExp(
    `(?:^|[.\\n])[^.\\n]*\\b${escapeRegExp(person)}\\b[^.\\n]*`,
    "gi",
  );
  const sentences = narrative.match(sentenceRe) ?? [];
  for (const sentence of sentences) {
    const scope = scopeFromResponsiblePhrase(sentence);
    if (scope) return scope;
  }
  return undefined;
}
