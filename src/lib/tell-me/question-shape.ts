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

/**
 * Current-state questions about a scheduled date.
 * Grounded only in timeline / release records — not knowledge prose.
 * Not a special-case for any one label.
 */
export function questionLooksScheduledDate(question: string): boolean {
  if (questionLooksHistorical(question)) return false;
  return (
    /\b(what|when|which)\b.{0,40}\b(date|when|schedule|milestone)\b/i.test(
      question,
    ) || /\b(target|current).{0,24}\bdate\b/i.test(question)
  );
}

export const SCHEDULED_DATE_AUTHORITY_KINDS = new Set([
  "timeline",
  "release",
]);

export const RISK_AUTHORITY_KINDS = new Set(["risk"]);

export const TODO_AUTHORITY_KINDS = new Set(["todo"]);

/** Current open-risk questions — domain Risk records, not knowledge prose. */
export function questionLooksCurrentRisk(question: string): boolean {
  if (questionLooksHistorical(question)) return false;
  return /\b(open\s+)?risks?\b/i.test(question);
}

/** Current todo / waiting / chase / action-status questions. */
export function questionLooksTodoStatus(question: string): boolean {
  if (questionLooksHistorical(question)) return false;
  return (
    /\b(to-?dos?|action items?|waiting(?:\s+on)?|chase|still open)\b/i.test(
      question,
    ) || /\bwhat(?:'s| is) (?:still )?(?:open|outstanding)\b/i.test(question)
  );
}

/**
 * First-class current responsibility: structured confirmed owner,
 * or a current stakeholder / person-role record.
 * Generic knowledge prose is not this.
 */
export function isFirstClassResponsibilitySource(source: {
  kind: string;
  detail?: string | null;
}): boolean {
  if (source.detail === "confirmed responsibility") return true;
  return source.kind === "stakeholder";
}

/** Current-state / status questions — prefer Current position over older history. */
export function questionLooksCurrentState(question: string): boolean {
  if (questionLooksHistorical(question)) return false;
  return /\b(are|is|cleared|remain|remaining|current|still|ready|approved|official|what is the|how many .+ remain|who owns|who should)\b/i.test(
    question,
  );
}
