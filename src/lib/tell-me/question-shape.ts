/**
 * Tell Me question shape helpers — used for context selection (not scoring).
 * Keep heuristics cheap and conservative.
 */

export {
  isAdjacentOwnershipStatement,
  ownedResponsibilityPhrase,
  ownershipTopicTokens,
  questionLooksOwnership,
  recordMentionsOwnershipOfTopic,
} from "@/lib/tell-me/ownership";

/**
 * Historical / change-oriented questions may retrieve History evidence and
 * superseded facts. Keep conservative — do not treat ordinary status asks as
 * historical merely because the word "was" appears in prose.
 */
export function questionLooksHistorical(question: string): boolean {
  const q = question;
  if (
    /\b(originally|previously|used to|at the start|first planned|before (it |we |the )?moved|was (the |our )?original|how many .+ (were|was) (originally|initially)|historical)\b/i.test(
      q,
    )
  ) {
    return true;
  }
  // Slice 1D History rule — explicit change / prior-state phrasings
  if (/\bwhat\s+changed\b/i.test(q)) return true;
  if (/\bwhat\s+was\s+(the\s+)?(old|previous|original)\b/i.test(q)) return true;
  if (/\bwho\s+(used to|previously|formerly)\b/i.test(q)) return true;
  if (/\bwho\s+(owned|handled|managed).{0,48}\bbefore\b/i.test(q)) return true;
  if (/\bwhy\s+did\b.{0,48}\b(move|change|slip|shift)\b/i.test(q)) return true;
  if (/\bwhen\s+did\s+(we|it|this)\s+(learn|decide|change|move|find out)\b/i.test(q))
    return true;
  if (/\b(old date|previous owner|prior owner|former owner|superseded)\b/i.test(q))
    return true;
  return false;
}

/** Current-state / status questions — prefer Current position over older history. */
export function questionLooksCurrentState(question: string): boolean {
  if (questionLooksHistorical(question)) return false;
  return /\b(are|is|cleared|remain|remaining|current|still|ready|approved|official|what is the|how many .+ remain|who owns|who should)\b/i.test(
    question,
  );
}
