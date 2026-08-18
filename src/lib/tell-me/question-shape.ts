/**
 * Tell Me question shape helpers — used for context selection (not scoring).
 * Keep heuristics cheap and conservative.
 */

export function questionLooksHistorical(question: string): boolean {
  return /\b(originally|previously|used to|at the start|first planned|before (it |we |the )?moved|was (the |our )?original|how many .+ (were|was) (originally|initially)|historical)\b/i.test(
    question,
  );
}

/** Current-state / status questions — prefer Current position over older history. */
export function questionLooksCurrentState(question: string): boolean {
  if (questionLooksHistorical(question)) return false;
  return /\b(are|is|cleared|remain|remaining|current|still|ready|approved|official|what is the|how many .+ remain|who owns|who should)\b/i.test(
    question,
  );
}

export function questionLooksOwnership(question: string): boolean {
  return /\b(who owns|owner of|owns (the )?\w+|sign-off owner|who is (the )?owner)\b/i.test(
    question,
  );
}

/** Topic tokens for ownership questions, e.g. "security sign-off" → security, sign-off. */
export function ownershipTopicTokens(question: string): string[] {
  const q = question.toLowerCase();
  const afterOwns = q.match(
    /(?:who owns|owner of|owns)\s+(?:the\s+)?(.+?)(?:\s+on\s+|\s+for\s+|\?|$)/i,
  );
  const raw = (afterOwns?.[1] ?? q)
    .replace(/\b(who|owns|owner|of|the|a|an|on|for|sign.?off)\b/gi, " ")
    .trim();
  const tokens = raw
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  // Always keep domain cues when present in the question
  for (const cue of [
    "security",
    "ux",
    "cab",
    "uat",
    "testing",
    "vendor",
    "budget",
    "design",
    "freeze",
  ]) {
    if (q.includes(cue) && !tokens.includes(cue)) tokens.push(cue);
  }
  return [...new Set(tokens)];
}

export function recordMentionsOwnershipOfTopic(
  text: string,
  topicTokens: string[],
): boolean {
  const hay = text.toLowerCase();
  if (!/\b(owns?|owner|sign-?off)\b/.test(hay)) return false;
  if (!topicTokens.length) return /\bowns?\b/.test(hay);
  return topicTokens.some((t) => hay.includes(t));
}
