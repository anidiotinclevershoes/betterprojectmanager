/**
 * FROZEN prompt-experiment holdout.
 *
 * Frozen before any prompt variant was edited or compared.
 * Do not tune prompts against this set. Do not enlarge it to chase scores.
 *
 * These are transcripts + expected *behaviour*, not expected observation counts.
 */
export const PROMPT_HOLDOUT_FROZEN_AT = "2026-09-11T23:30:00.000Z";

export type HoldoutExpected = {
  id: string;
  theme: string;
  /** Must appear as a named person / fact; omission is a miss. */
  mustRecall: string[];
  /** Must not be invented or bound. */
  mustNotInvent: string[];
  /** Identity must stay unresolved (pronoun / competing names). */
  mustPreserveAmbiguity?: string[];
  /** Legal create (name-only people allowed). */
  mustAllowCreate?: string[];
  /** Existing record — prefer update / no_change, not a second create. */
  mustNotDuplicate?: string[];
  /** Contradictions must not silently resolve. */
  mustPreserveContradiction?: boolean;
  /** Optional responsibility may be omitted; name-only is enough. */
  optionalResponsibilityOk?: boolean;
};

export const FROZEN_PROMPT_HOLDOUT: HoldoutExpected[] = [
  {
    id: "held-two-names-update",
    theme: "two or more named people",
    mustRecall: ["Pippa Gumdrop", "Fizz Caramel"],
    mustNotInvent: [],
    mustNotDuplicate: ["Pippa Gumdrop"],
  },
  {
    id: "held-they-pronoun-two-people",
    theme: "pronouns",
    mustRecall: ["UAT"],
    mustNotInvent: [],
    mustPreserveAmbiguity: ["They", "Pippa Gumdrop", "Fizz Caramel"],
  },
  {
    id: "held-fizz-and-pippa-independent",
    theme: "repeated / sibling names",
    mustRecall: ["Pippa Gumdrop", "Fizz Caramel"],
    mustNotInvent: [],
  },
  {
    id: "held-unsupported-complete-todo",
    theme: "contradictory / status language beside another fact",
    mustRecall: ["Gumdrop Bridge"],
    mustNotInvent: [],
    mustPreserveContradiction: false,
  },
  {
    id: "held-irrelevant-weather",
    theme: "milestone/date language + chatter",
    mustRecall: ["Production release", "19 September"],
    mustNotInvent: [],
  },
  {
    id: "held-cross-project-mention",
    theme: "unrelated project UUID/context",
    mustRecall: ["Parade day"],
    mustNotInvent: [],
  },
  {
    id: "held-mixed-people-dates-risk",
    theme: "mixed domains",
    mustRecall: ["Parade day", "Fizz Caramel", "Gumdrop Bridge"],
    mustNotInvent: [],
  },
  {
    id: "held-person-role-not-scope",
    theme: "optional missing responsibility",
    mustRecall: ["Captain Buttons"],
    mustNotInvent: [],
    optionalResponsibilityOk: true,
    mustAllowCreate: [],
  },
  {
    id: "held-busy-aurora-ops",
    theme: "messy multi-sentence real-world prose",
    mustRecall: ["Olga Petrov", "Production release", "19 September"],
    mustNotInvent: [],
  },
  {
    id: "held-two-new-people",
    theme: "clear Create of new people",
    mustRecall: ["Nova Quill", "Remy Volt"],
    mustNotInvent: [],
    mustAllowCreate: ["Nova Quill", "Remy Volt"],
    mustNotDuplicate: ["Pixel Ramos"],
  },
];
