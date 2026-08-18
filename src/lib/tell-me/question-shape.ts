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
