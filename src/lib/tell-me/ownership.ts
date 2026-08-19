/**
 * Ownership topic matching — scoped to the owned responsibility phrase.
 */

const DOMAIN_CUES = [
  "security",
  "ux",
  "cab",
  "uat",
  "testing",
  "vendor",
  "budget",
  "design",
  "freeze",
  "rollback",
  "onboarding",
] as const;

export function questionLooksOwnership(question: string): boolean {
  return /\b(who owns|owner of|owns (the )?\w+|sign-off owner|who is (the )?owner)\b/i.test(
    question,
  );
}

/** Topic tokens for ownership questions, e.g. "security sign-off" → security. */
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
  for (const cue of DOMAIN_CUES) {
    if (q.includes(cue) && !tokens.includes(cue)) tokens.push(cue);
  }
  return [...new Set(tokens)];
}

/** Extract the responsibility phrase being owned / denied. */
export function ownedResponsibilityPhrase(text: string): string | null {
  const hay = text.replace(/\s+/g, " ").trim();
  const denial = hay.match(
    /\b(?:does not own|doesn't own|do not own)\s+(?:the\s+)?([^.;—–]+)/i,
  );
  if (denial?.[1]) return denial[1].trim().toLowerCase();
  const owns = hay.match(/\bowns?\s+(?:the\s+)?([^.;—–]+)/i);
  if (owns?.[1]) return owns[1].trim().toLowerCase();
  const ownerOf = hay.match(/\bowner of\s+(?:the\s+)?([^.;—–]+)/i);
  if (ownerOf?.[1]) return ownerOf[1].trim().toLowerCase();
  return null;
}

/**
 * True only when the record assigns (or denies) ownership of the *asked* topic.
 * "Ava owns UX sign-off" does NOT match a Security ownership question.
 */
export function recordMentionsOwnershipOfTopic(
  text: string,
  topicTokens: string[],
): boolean {
  const phrase = ownedResponsibilityPhrase(text);
  if (!phrase) return false;
  if (!topicTokens.length) return true;

  const domain = topicTokens.filter((t) =>
    (DOMAIN_CUES as readonly string[]).includes(t),
  );
  const required = domain.length ? domain : topicTokens;
  // Exact responsibility scope: the owned phrase must contain the domain cue.
  return required.some((t) => phrase.includes(t));
}

/** Ownership line about a different responsibility (adjacent, not matching). */
export function isAdjacentOwnershipStatement(
  text: string,
  topicTokens: string[],
): boolean {
  if (!/\b(owns?|owner|does not own|doesn't own)\b/i.test(text)) return false;
  return !recordMentionsOwnershipOfTopic(text, topicTokens);
}
