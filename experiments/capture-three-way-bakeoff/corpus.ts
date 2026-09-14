/**
 * Frozen bake-off corpus builder.
 * Expected outcomes come from existing fixture truth, regression intent,
 * or manual human-authored rows. Never from a contender run.
 */
import { LIVE_EVAL_CASES } from "@/lib/eval-capture-v2/corpus";
import { experimentalApplyWorld } from "@/lib/experiments/worlds";
import type { MaterialExpectation } from "@/lib/eval-capture-v2/types";
import type { ObservationDisposition } from "@/lib/capture-v2/types";
import type {
  BakeoffCategory,
  Disposition,
  ExpectedFact,
  FrozenCase,
  FrozenManifest,
} from "./types";
import { extraFrozenCases } from "./extras";
import { serializeWorld } from "./serialize-world";

const PINS = {
  current: "920d65d9c0f6e49efca8e26fc8906dbbd11e8f25",
  simplification: "bd76bbf35b60cec2685e9bb106a4d4a4a9dbdab0",
  aiFirst: "707b704bbf820fcc4492c86155889d6afe5d5bae",
};

const STAGE2_IDS = [
  "new-person",
  "existing-risk-update",
  "explicit-ownership-first",
  "existing-person",
  "ambiguous-same-first-name",
  "pronoun-ambiguity",
  "vague-parade",
  "mixed-domains",
  "holdout-h6",
  "contradict-parade",
  "title-only-existing-target",
  "irrelevant-commentary",
  "c5-timber-floor",
  "two-token-person-create",
  "share-vs-replace-ambiguous",
  "unsupported-remove",
  "correction-of-wording",
  "similar-name-ambiguous-brick",
];

const STAGE3_IDS = [
  "todo-create",
  "risk-resolution",
  "explicit-ownership-first",
  "share-vs-replace-ambiguous",
  "mixed-domains",
  "noisy-conversational",
  "toyworld-vocabulary-bait",
];

const BLIND_IDS = [
  "new-person",
  "existing-risk-update",
  "existing-person",
  "ambiguous-same-first-name",
  "pronoun-ambiguity",
  "share-vs-replace-ambiguous",
  "mixed-domains",
  "holdout-h6",
  "c5-timber-floor",
  "title-only-existing-target",
  "two-token-person-create",
  "vague-parade",
  "contradict-parade",
  "unsupported-remove",
  "noisy-conversational",
  "harbourline-sarah-first-name",
];

function mapDisposition(
  value: ObservationDisposition | ObservationDisposition[] | undefined,
): Disposition[] {
  const list = value == null ? [] : Array.isArray(value) ? value : [value];
  const mapped: Disposition[] = [];
  for (const item of list) {
    if (item === "create_new") mapped.push("create");
    else if (item === "update_existing") mapped.push("update");
    else if (item === "no_change") mapped.push("no_change");
    else if (item === "ambiguous") mapped.push("needs_you");
    else if (item === "commentary" || item === "ignore" || item === "left_untouched") {
      mapped.push("left_untouched");
    } else if (item === "merge") mapped.push("no_change");
  }
  return mapped;
}

function categoryForEval(category: string): BakeoffCategory {
  if (
    category.startsWith("person-new") ||
    category.startsWith("risk-") ||
    category.startsWith("todo") ||
    category.startsWith("milestone-move") ||
    category === "availability" ||
    category.startsWith("responsibility-continue") ||
    category.startsWith("responsibility-replace")
  ) {
    if (category.includes("ambiguous")) return "uncertainty";
    if (category === "milestone-unchanged") return "no_change_restatement";
    return "clear_ordinary";
  }
  if (
    category.includes("existing") ||
    category === "no-change" ||
    category === "duplicate" ||
    category === "milestone-unchanged"
  ) {
    return "no_change_restatement";
  }
  if (category.includes("ambiguous") || category === "pronoun") return "identity";
  if (category === "commentary") return "unsupported_unplaceable";
  if (category === "isolation" || category === "fail-closed") return "identity";
  if (category === "correction" || category === "mixed") return "messy_realistic";
  if (category.startsWith("responsibility-ambiguous")) return "uncertainty";
  return "clear_ordinary";
}

function fromMaterial(
  material: MaterialExpectation,
  captureText: string,
): ExpectedFact {
  const dispositions = mapDisposition(material.expectedDisposition);
  if (material.expectedNeedsYou) {
    for (const op of ["needs_you", "left_untouched"] as const) {
      if (!dispositions.includes(op)) dispositions.push(op);
    }
  }
  if (material.expectedNoChange && !dispositions.includes("no_change")) {
    dispositions.push("no_change");
  }
  if (material.commentary) {
    for (const op of ["left_untouched", "no_change"] as const) {
      if (!dispositions.includes(op)) dispositions.push(op);
    }
  }
  const genuineAmbiguity =
    material.existingVsNew === "ambiguous" || Boolean(material.expectedNeedsYou);
  const noCanonical =
    genuineAmbiguity ||
    Boolean(material.commentary) ||
    dispositions.every((d) => d === "needs_you" || d === "left_untouched" || d === "no_change");
  const autoSafe =
    !genuineAmbiguity &&
    !material.commentary &&
    (dispositions.includes("create") ||
      dispositions.includes("update") ||
      dispositions.includes("remove") ||
      dispositions.includes("no_change"));
  return {
    id: material.id,
    meaning: material.meaning,
    tokens: material.meaningTokens,
    domain: material.allowedDomains.length === 1 ? material.allowedDomains[0] : material.allowedDomains,
    existingVsNew: material.existingVsNew ?? "none",
    targetId: material.existingTargetId ?? null,
    acceptedTargetIds: material.existingTargetId
      ? material.existingTargetId === "person-gumdrop"
        ? ["person-gumdrop", "resp-uat"]
        : material.existingTargetId === "person-pixel"
          ? ["person-pixel"]
          : [material.existingTargetId]
      : undefined,
    expectedDisposition: dispositions.length ? dispositions : ["needs_you", "left_untouched"],
    changedValue: null,
    evidencePhrase: captureText.slice(0, 180),
    genuineAmbiguity,
    automaticActionSafe: autoSafe,
    humanClarificationAppropriate: genuineAmbiguity,
    noCanonicalOperation: noCanonical && !dispositions.includes("create") && !dispositions.includes("update"),
  };
}

function evalCases(): FrozenCase[] {
  const world = experimentalApplyWorld();
  const serialized = serializeWorld(world);
  return LIVE_EVAL_CASES.map((row) => {
    const expected: ExpectedFact[] =
      row.material.length > 0
        ? row.material.map((m) => fromMaterial(m, row.transcript))
        : [
            {
              id: `${row.id}-no-write`,
              meaning: row.expectedCommentary
                ? "Commentary / chatter must not become a write."
                : "Explicit no-change / empty material — no canonical write.",
              tokens: row.transcript.toLowerCase().includes("chiptune")
                ? ["chiptune"]
                : row.transcript.toLowerCase().includes("nothing")
                  ? ["nothing"]
                  : row.transcript.toLowerCase().split(/\s+/).slice(0, 2),
              domain: row.allowedDomains,
              existingVsNew: "none",
              targetId: null,
              expectedDisposition: ["left_untouched", "no_change", "needs_you"],
              changedValue: null,
              evidencePhrase: row.transcript.slice(0, 180),
              genuineAmbiguity: Boolean(row.expectedNeedsYou),
              automaticActionSafe: false,
              humanClarificationAppropriate: Boolean(row.expectedNeedsYou),
              noCanonicalOperation: true,
            },
          ];
    const forbidden = row.prohibitedWrites
      .map((p) => p.targetId)
      .filter((id): id is string => Boolean(id));
    if (forbidden.length) {
      for (const fact of expected) {
        fact.forbiddenTargetIds = [
          ...new Set([...(fact.forbiddenTargetIds ?? []), ...forbidden]),
        ];
      }
    }
    const category = categoryForEval(row.category);
    return {
      id: row.id,
      title: row.title,
      category,
      source: `eval-corpus ${row.id}`,
      expectedSource: "eval-corpus",
      captureText: row.transcript,
      projectId: row.projectId,
      world: serialized,
      expected,
      stage2: STAGE2_IDS.includes(row.id),
      stage3: STAGE3_IDS.includes(row.id),
      historical: row.category === "isolation" || row.category === "pronoun",
    };
  });
}

export function buildFrozenManifest(): FrozenManifest {
  const extras = extraFrozenCases();
  const fromEval = evalCases();
  const seen = new Set<string>();
  const cases: FrozenCase[] = [];
  for (const row of [...fromEval, ...extras]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    cases.push({
      ...row,
      stage2: STAGE2_IDS.includes(row.id) || row.stage2,
      stage3: STAGE3_IDS.includes(row.id) || row.stage3,
    });
  }
  return {
    frozenAt: "2026-09-14T15:00:00.000Z",
    note:
      "Frozen before any three-way live run. Do not retune cases or expected outcomes after seeing contender output.",
    pins: PINS,
    cases,
    stage2Ids: STAGE2_IDS,
    stage3Ids: STAGE3_IDS,
    blindIds: BLIND_IDS,
  };
}
