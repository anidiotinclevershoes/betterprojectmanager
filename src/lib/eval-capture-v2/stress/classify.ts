/**
 * Stress-journey classification. Observes current production.
 * Not a second scorer — labels outcomes for the completion report.
 */

import type { StackedStepResult } from "../stacked-runtime";
import type { StressStep } from "./util";

export const STRESS_CLASSES = [
  "correct_autonomous",
  "intelligent_needs_you",
  "lume_catch",
  "genuine_lume_failure",
  "silent_failure",
  "over_conservative",
  "architectural_limit",
] as const;

export type StressClass = (typeof STRESS_CLASSES)[number];

export type ClassifiedStep = {
  id: string;
  title: string;
  difficulty: StressStep["difficulty"];
  expectedReview: StressStep["expectedReview"];
  actualReview: StackedStepResult["review"];
  writeCount: number;
  needsYouCount: number;
  noChangeCount: number;
  rejectedCount: number;
  classification: StressClass;
  note: string;
};

export function classifyStressStep(args: {
  step: StressStep;
  result: StackedStepResult;
  extra?: { classification?: StressClass; note?: string };
}): ClassifiedStep {
  const rejectedCount = args.result.pipeline.validation.rejected.length;
  const base: Omit<ClassifiedStep, "classification" | "note"> = {
    id: args.step.id,
    title: args.step.title,
    difficulty: args.step.difficulty,
    expectedReview: args.step.expectedReview,
    actualReview: args.result.review,
    writeCount: args.result.writeCount,
    needsYouCount: args.result.needsYouCount,
    noChangeCount: args.result.noChangeCount,
    rejectedCount,
  };
  if (args.extra?.classification) {
    return {
      ...base,
      classification: args.extra.classification,
      note: args.extra.note ?? "",
    };
  }

  if (rejectedCount > 0 && args.result.writeCount === 0) {
    return {
      ...base,
      classification: "lume_catch",
      note: "Model target/envelope rejected; no durable write.",
    };
  }

  if (args.step.expectedReview === "needs_you") {
    if (args.result.writeCount > 0) {
      return {
        ...base,
        classification: "genuine_lume_failure",
        note: "Ambiguous or unsafe item became Apply Ready.",
      };
    }
    if (args.result.needsYouCount > 0) {
      return {
        ...base,
        classification: "intelligent_needs_you",
        note: "Material ambiguity surfaced rather than guessed.",
      };
    }
    return {
      ...base,
      classification: "intelligent_needs_you",
      note: "No write; fail-closed without a Needs you chip (still not a silent mutation).",
    };
  }

  if (args.step.expectedReview === "no_change") {
    if (args.result.writeCount > 0) {
      return {
        ...base,
        classification: "genuine_lume_failure",
        note: "Restated or already-known fact became a durable write.",
      };
    }
    return {
      ...base,
      classification: "correct_autonomous",
      note: "Existing identity/object reused; no duplicate write.",
    };
  }

  if (args.step.expectedReview === "mixed") {
    const ambiguousHeld =
      args.result.needsYouCount > 0 || rejectedCount > 0;
    if (args.result.writeCount > 0 && ambiguousHeld) {
      return {
        ...base,
        classification: "correct_autonomous",
        note: "Clear sibling Apply Ready; ambiguous sibling fail-closed (Needs you or rejected).",
      };
    }
    if (args.result.writeCount > 0 && !ambiguousHeld) {
      return {
        ...base,
        classification: "genuine_lume_failure",
        note: "Ambiguous sibling was not held at Needs you.",
      };
    }
    if (args.result.review === "needs_you" && args.result.writeCount === 0) {
      return {
        ...base,
        classification: "over_conservative",
        note: "Clear sibling also held at Needs you.",
      };
    }
  }

  if (args.step.expectedReview === "apply" || args.step.expectedReview === "apply_or_no_change") {
    if (args.result.writeCount > 0) {
      return {
        ...base,
        classification: "correct_autonomous",
        note: "Clear item Apply Ready.",
      };
    }
    if (args.result.review === "no_change") {
      return {
        ...base,
        classification: "correct_autonomous",
        note: "Resolved as no-change (identity reuse or already current).",
      };
    }
    return {
      ...base,
      classification: "over_conservative",
      note: "Clear item held at Needs you.",
    };
  }

  return {
    ...base,
    classification: "correct_autonomous",
    note: "",
  };
}

export function tallyClasses(rows: ClassifiedStep[]) {
  const tally: Record<StressClass, number> = {
    correct_autonomous: 0,
    intelligent_needs_you: 0,
    lume_catch: 0,
    genuine_lume_failure: 0,
    silent_failure: 0,
    over_conservative: 0,
    architectural_limit: 0,
  };
  for (const row of rows) tally[row.classification] += 1;
  return tally;
}
