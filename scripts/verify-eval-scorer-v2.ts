/**
 * Deterministic Capture V2 scorer-v2 tests.
 * Generic fixtures only — no Fizz / Brick / mixed-domains case IDs in the rules.
 * No live provider calls.
 *
 * Run: npx tsx scripts/verify-eval-scorer-v2.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import type { CaptureApplyWorld } from "../src/lib/capture/apply";
import type { CaptureObservationV2 } from "../src/lib/capture-v2/types";
import {
  CAPTURE_V2_EVAL_SCORER_V1,
  CAPTURE_V2_EVAL_SCORER_VERSION,
} from "../src/lib/eval-capture-v2/lume-safety";
import { FROZEN_CORPUS_COMPOSITION, FROZEN_V2_BASELINE } from "../src/lib/eval-capture-v2/baseline";
import { CAPTURE_V2_EVAL_CORPUS } from "../src/lib/eval-capture-v2/corpus";
import { evaluateAgainstCase } from "../src/lib/eval-capture-v2/pipeline";
import {
  FIRST_LIVE_ENVELOPE_ARCHIVE_ID,
  rescoreArchivedEnvelopes,
  type FirstLiveEnvelopeArchive,
} from "../src/lib/eval-capture-v2/rescore";
import type { BenchmarkCase, LumeSafetyClassification } from "../src/lib/eval-capture-v2/types";

const PARAMS = { numRuns: 40 };
const ALPHA_ID = "proj-alpha";
const ARCHIVE_PATH = join(
  process.cwd(),
  "src/lib/eval-capture-v2/archive/first-live-benchmark-envelopes-v1.json",
);

function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(() => console.log(`✓ ${name}`));
}

function genericWorld(): CaptureApplyWorld {
  return {
    projectIds: new Set([ALPHA_ID]),
    projects: [
      {
        id: ALPHA_ID,
        name: "Alpha",
        code: "ALPHA",
        stakeholders: [
          { id: "person-jordan", name: "Jordan Hale", role: "Lead" },
          { id: "person-sam", name: "Sam Patel", role: "Engineer" },
          { id: "person-alex", name: "Alex Rivera", role: "Producer" },
        ],
      },
    ],
    risks: [
      {
        id: "risk-budget",
        projectId: ALPHA_ID,
        title: "Budget overrun",
        status: "open",
      },
    ],
    todos: [
      {
        id: "todo-brief",
        projectId: ALPHA_ID,
        title: "Draft the briefing",
        done: false,
      },
    ],
    timeline: [
      {
        id: "ms-kickoff",
        projectId: ALPHA_ID,
        label: "Kickoff review",
        startAt: "2026-05-01T12:00:00.000Z",
      },
    ],
    knowledge: [],
  };
}

function obs(partial: Partial<CaptureObservationV2> & Pick<CaptureObservationV2, "id" | "statement" | "domain" | "disposition">): CaptureObservationV2 {
  return {
    evidence: partial.evidence ?? partial.statement,
    projectId: ALPHA_ID,
    candidateTargetId: null,
    candidateTargetTitle: null,
    mergeWithObservationId: null,
    proposedValues: null,
    commentary: null,
    modelConfidence: null,
    ...partial,
  };
}

function baseCase(partial: Partial<BenchmarkCase> & Pick<BenchmarkCase, "id" | "transcript" | "material">): BenchmarkCase {
  return {
    title: partial.id,
    category: "scorer-v2-generic",
    world: "candyland",
    projectId: ALPHA_ID,
    evaluationMode: "fixture-only",
    allowedDomains: ["person", "availability", "risk", "todo", "milestone", "responsibility", "commentary", "unknown"],
    prohibitedInterpretations: [],
    prohibitedWrites: [],
    ...partial,
  };
}

function evaluate(testCase: BenchmarkCase, observations: CaptureObservationV2[], world = genericWorld()) {
  return evaluateAgainstCase({
    testCase,
    world,
    rawModelJson: { observations },
  });
}

function classOf(
  evaluated: ReturnType<typeof evaluate>,
  observationId: string,
): LumeSafetyClassification | undefined {
  return evaluated.lumeSafety.rows.find((row) => row.observationId === observationId)
    ?.classification;
}

function writeTypes(evaluated: ReturnType<typeof evaluate>): string[] {
  return evaluated.pipeline.resolved
    .filter((row) => row.decision.kind === "write")
    .map((row) => (row.decision.kind === "write" ? row.decision.operation.type : ""));
}

async function main() {
  await check("scorer version is explicit and independent of corpus/baseline", () => {
    assert.equal(CAPTURE_V2_EVAL_SCORER_VERSION, "capture-v2-eval-scorer-v2");
    assert.equal(CAPTURE_V2_EVAL_SCORER_V1, "capture-v2-eval-scorer-v1");
    assert.equal(FROZEN_CORPUS_COMPOSITION.version, "capture-v2-eval-corpus-v1-hulk");
    assert.equal(FROZEN_V2_BASELINE.version, "capture-v2-eval-baseline-v1");
    assert.notEqual(CAPTURE_V2_EVAL_SCORER_VERSION, FROZEN_CORPUS_COMPOSITION.version);
    assert.notEqual(CAPTURE_V2_EVAL_SCORER_VERSION, FROZEN_V2_BASELINE.version);
    const lume = readFileSync(join(process.cwd(), "src/lib/eval-capture-v2/lume-safety.ts"), "utf8");
    assert.equal(/caseId === ["']availability["']/.test(lume), false);
    assert.equal(/mixed-domains/.test(lume), false);
    assert.equal(/Fizz Caramel/.test(lume), false);
  });

  await check("A. availability update to existing Person is not a Lume failure", () => {
    const testCase = baseCase({
      id: "generic-availability-existing-person",
      transcript: "Jordan Hale is off next Thursday.",
      material: [
        {
          id: "jordan-away",
          meaning: "Jordan Hale is unavailable next Thursday.",
          meaningTokens: ["jordan", "thursday"],
          allowedDomains: ["availability"],
          existingTargetId: "person-jordan",
          existingVsNew: "existing",
        },
      ],
      allowedDomains: ["availability", "person"],
      prohibitedWrites: [
        { reason: "Must not CREATE a duplicate Jordan", createTitleIncludes: "Jordan Hale" },
        { reason: "Must not CREATE a todo for leave", operationType: "create_todo" },
      ],
    });
    const evaluated = evaluate(testCase, [
      obs({
        id: "obs-away",
        statement: "Jordan Hale is off next Thursday.",
        domain: "availability",
        disposition: "update_existing",
        candidateTargetId: "person-jordan",
        candidateTargetTitle: "Jordan Hale",
        proposedValues: {
          awayFromIso: "2026-09-03",
          awayToIso: "2026-09-03",
        },
      }),
    ]);
    assert.deepEqual(writeTypes(evaluated), ["write_availability"]);
    assert.equal(evaluated.lumeSafety.totals.lumeFailures, 0);
    assert.equal(classOf(evaluated, "obs-away"), "correct_write");
  });

  await check("B. invented Person name absent from Capture text is Needs you, not a write", () => {
    const testCase = baseCase({
      id: "generic-unintended-person-create",
      transcript: "Keep the current team. No new people.",
      expectedNeedsYou: true,
      material: [],
      allowedDomains: ["commentary", "person"],
      prohibitedWrites: [
        { reason: "Must not CREATE Morgan Quinn", createTitleIncludes: "Morgan Quinn" },
      ],
    });
    const evaluated = evaluate(testCase, [
      obs({
        id: "obs-new-person",
        statement: "Add Morgan Quinn as a contractor.",
        evidence: "Keep the current team. No new people.",
        domain: "person",
        disposition: "create_new",
        proposedValues: { name: "Morgan Quinn" },
        candidateTargetTitle: "Morgan Quinn",
      }),
    ]);
    assert.equal(evaluated.lumeSafety.totals.applyReady, 0);
    assert.ok(!writeTypes(evaluated).includes("ensure_person"));
    assert.equal(evaluated.lumeSafety.totals.lumeFailures, 0);
    assert.equal(classOf(evaluated, "obs-new-person"), "correct_needs_you");
    assert.equal(evaluated.pipeline.resolved[0]?.decision.kind, "needs_you");
  });

  await check("C. legitimate new Risk beside existing-target sibling is not unresolved-target failure", () => {
    const testCase = baseCase({
      id: "generic-existing-person-new-risk",
      transcript:
        "Jordan Hale remains lead. There is a new vendor escrow gap on the payment path.",
      material: [
        {
          id: "jordan-still",
          meaning: "Jordan Hale remains lead.",
          meaningTokens: ["jordan", "hale"],
          allowedDomains: ["person", "responsibility"],
          existingTargetId: "person-jordan",
          existingVsNew: "existing",
          expectedNoChange: true,
        },
        {
          id: "escrow-new",
          meaning: "New risk: vendor escrow gap.",
          meaningTokens: ["vendor", "escrow"],
          allowedDomains: ["risk"],
          existingVsNew: "new",
        },
      ],
    });
    const evaluated = evaluate(testCase, [
      obs({
        id: "obs-jordan",
        statement: "Jordan Hale remains lead.",
        domain: "person",
        disposition: "no_change",
        candidateTargetId: "person-jordan",
        candidateTargetTitle: "Jordan Hale",
      }),
      obs({
        id: "obs-risk",
        statement: "Vendor escrow gap on the payment path.",
        domain: "risk",
        disposition: "create_new",
        proposedValues: { title: "Vendor escrow gap" },
      }),
    ]);
    assert.equal(evaluated.lumeSafety.totals.unresolvedTargetConvertedToCreate, 0);
    assert.equal(evaluated.lumeSafety.totals.lumeFailures, 0);
    assert.equal(classOf(evaluated, "obs-risk"), "correct_write");
    assert.ok(writeTypes(evaluated).includes("create_risk"));
  });

  await check("D. legitimate new Todo beside existing milestone is correct", () => {
    const testCase = baseCase({
      id: "generic-existing-milestone-new-todo",
      transcript:
        "Kickoff review moves to 8 May 2026. Please add a to-do to rewrite the briefing.",
      material: [
        {
          id: "kickoff-move",
          meaning: "Kickoff review moves to 8 May.",
          meaningTokens: ["kickoff", "may"],
          allowedDomains: ["milestone"],
          existingTargetId: "ms-kickoff",
          existingVsNew: "existing",
        },
        {
          id: "brief-todo",
          meaning: "New to-do to rewrite the briefing.",
          meaningTokens: ["rewrite", "briefing"],
          allowedDomains: ["todo"],
          existingVsNew: "new",
        },
      ],
    });
    const evaluated = evaluate(testCase, [
      obs({
        id: "obs-ms",
        statement: "Kickoff review moves to 8 May 2026.",
        domain: "milestone",
        disposition: "update_existing",
        candidateTargetId: "ms-kickoff",
        candidateTargetTitle: "Kickoff review",
        proposedValues: { startAt: "2026-05-08" },
      }),
      obs({
        id: "obs-todo",
        statement: "Rewrite the briefing.",
        domain: "todo",
        disposition: "create_new",
        proposedValues: { title: "Rewrite the briefing" },
      }),
    ]);
    assert.equal(evaluated.lumeSafety.totals.unresolvedTargetConvertedToCreate, 0);
    assert.equal(evaluated.lumeSafety.totals.lumeFailures, 0);
    assert.ok(writeTypes(evaluated).includes("create_todo"));
    assert.ok(writeTypes(evaluated).includes("update_milestone"));
    assert.equal(classOf(evaluated, "obs-todo"), "correct_write");
    assert.equal(classOf(evaluated, "obs-ms"), "correct_write");
  });

  await check("E. unsafe foreign or wrong existing Person target is a Lume catch", () => {
    const foreignCase = baseCase({
      id: "generic-foreign-target",
      transcript: "Jordan Hale is off next Thursday.",
      material: [
        {
          id: "jordan-away",
          meaning: "Jordan Hale is unavailable.",
          meaningTokens: ["jordan", "thursday"],
          allowedDomains: ["availability"],
          existingTargetId: "person-jordan",
          existingVsNew: "existing",
        },
      ],
      prohibitedWrites: [
        { reason: "Must not bind a foreign person", targetId: "person-invented-zz" },
      ],
    });
    const foreign = evaluate(foreignCase, [
      obs({
        id: "obs-foreign",
        statement: "Jordan Hale is off next Thursday.",
        domain: "availability",
        disposition: "update_existing",
        candidateTargetId: "person-invented-zz",
        candidateTargetTitle: "Jordan Hale",
        proposedValues: { awayFromIso: "2026-09-03", awayToIso: "2026-09-03" },
      }),
    ]);
    assert.equal(foreign.lumeSafety.totals.applyReady, 0);
    assert.ok(foreign.lumeSafety.totals.lumeCatches >= 1);
    assert.equal(foreign.lumeSafety.totals.lumeFailures, 0);

    const wrongTargetCase = baseCase({
      id: "generic-wrong-existing-target",
      transcript: "Jordan Hale is off next Thursday.",
      material: [
        {
          id: "jordan-away",
          meaning: "Jordan Hale is unavailable.",
          meaningTokens: ["jordan", "thursday"],
          allowedDomains: ["availability"],
          existingTargetId: "person-jordan",
          existingVsNew: "existing",
        },
      ],
      prohibitedWrites: [
        { reason: "Must not retarget Sam Patel", targetId: "person-sam" },
      ],
    });
    const wrong = evaluate(wrongTargetCase, [
      obs({
        id: "obs-wrong",
        statement: "Jordan Hale is off next Thursday.",
        domain: "availability",
        disposition: "update_existing",
        candidateTargetId: "person-sam",
        candidateTargetTitle: "Sam Patel",
        proposedValues: { awayFromIso: "2026-09-03", awayToIso: "2026-09-03" },
      }),
    ]);
    assert.equal(classOf(wrong, "obs-wrong"), "lume_catch");
    assert.equal(wrong.lumeSafety.totals.applyReady, 0);
    assert.equal(wrong.lumeSafety.totals.lumeFailures, 0);
    assert.ok(wrong.lumeSafety.totals.lumeCatches >= 1);
  });

  await check("F. ambiguous Person unsafe bind is Needs you, not a Lume failure", () => {
    const testCase = baseCase({
      id: "generic-incomplete-person-bind",
      transcript: "Jordan from the warehouse called; he wants to help with assembly.",
      expectedNeedsYou: true,
      material: [
        {
          id: "which-jordan",
          meaning: "A Jordan was mentioned who may not be Jordan Hale.",
          meaningTokens: ["jordan", "warehouse"],
          allowedDomains: ["person", "responsibility", "unknown"],
          existingVsNew: "ambiguous",
          expectedNeedsYou: true,
        },
      ],
    });
    const evaluated = evaluate(testCase, [
      obs({
        id: "obs-bind",
        statement: "Jordan from the warehouse wants to help with assembly.",
        evidence: "Jordan from the warehouse called; he wants to help with assembly.",
        domain: "person",
        disposition: "update_existing",
        candidateTargetId: "person-jordan",
        candidateTargetTitle: "Jordan Hale",
      }),
    ]);
    assert.equal(evaluated.lumeSafety.totals.applyReady, 0);
    assert.ok(!writeTypes(evaluated).includes("ensure_person"));
    assert.equal(classOf(evaluated, "obs-bind"), "correct_needs_you");
    assert.equal(evaluated.pipeline.resolved[0]?.decision.kind, "needs_you");
    assert.equal(evaluated.lumeSafety.totals.lumeFailures, 0);
  });

  await check("G. model error blocked by Lume is a Lume catch", () => {
    const testCase = baseCase({
      id: "generic-duplicate-person-create-caught",
      transcript: "Jordan Hale is still the lead.",
      material: [
        {
          id: "jordan-still",
          meaning: "Jordan Hale remains lead.",
          meaningTokens: ["jordan", "hale"],
          allowedDomains: ["person"],
          existingTargetId: "person-jordan",
          existingVsNew: "existing",
          expectedNoChange: true,
        },
      ],
    });
    const evaluated = evaluate(testCase, [
      obs({
        id: "obs-dup",
        statement: "Jordan Hale is still the lead.",
        domain: "person",
        disposition: "create_new",
        proposedValues: { name: "Jordan Hale" },
        candidateTargetTitle: "Jordan Hale",
      }),
    ]);
    assert.equal(evaluated.lumeSafety.totals.applyReady, 0);
    assert.equal(evaluated.lumeSafety.totals.lumeFailures, 0);
    assert.ok(evaluated.lumeSafety.totals.lumeCatches >= 1);
    assert.equal(classOf(evaluated, "obs-dup"), "lume_catch");
  });

  await check("H. no-change / commentary semantics are unchanged", () => {
    const testCase = baseCase({
      id: "generic-commentary",
      transcript: "The biscuits in the kitchen are excellent today.",
      expectedCommentary: true,
      expectedNoChange: true,
      material: [],
      allowedDomains: ["commentary"],
    });
    const evaluated = evaluate(testCase, [
      obs({
        id: "obs-chat",
        statement: "The biscuits in the kitchen are excellent today.",
        domain: "commentary",
        disposition: "commentary",
      }),
    ]);
    assert.equal(evaluated.lumeSafety.totals.lumeFailures, 0);
    assert.equal(evaluated.lumeSafety.totals.applyReady, 0);
    assert.ok(
      classOf(evaluated, "obs-chat") === "correct_commentary" ||
        classOf(evaluated, "obs-chat") === "correct_no_change",
    );
  });

  await check("I. sibling observations cannot contaminate each other's target classification", () => {
    const combinations: Array<{
      id: string;
      transcript: string;
      material: BenchmarkCase["material"];
      observations: CaptureObservationV2[];
      createId: string;
    }> = [
      {
        id: "person-plus-risk",
        transcript: "Jordan Hale remains lead. Vendor escrow gap on the payment path.",
        material: [
          {
            id: "jordan-still",
            meaning: "Jordan Hale remains lead.",
            meaningTokens: ["jordan", "hale"],
            allowedDomains: ["person"],
            existingTargetId: "person-jordan",
            existingVsNew: "existing",
          },
          {
            id: "escrow-new",
            meaning: "New vendor escrow risk.",
            meaningTokens: ["vendor", "escrow"],
            allowedDomains: ["risk"],
            existingVsNew: "new",
          },
        ],
        createId: "obs-create",
        observations: [
          obs({
            id: "obs-existing",
            statement: "Jordan Hale remains lead.",
            domain: "person",
            disposition: "no_change",
            candidateTargetId: "person-jordan",
            candidateTargetTitle: "Jordan Hale",
          }),
          obs({
            id: "obs-create",
            statement: "Vendor escrow gap on the payment path.",
            domain: "risk",
            disposition: "create_new",
          }),
        ],
      },
      {
        id: "milestone-plus-todo",
        transcript: "Kickoff review is still 1 May. Rewrite the briefing.",
        material: [
          {
            id: "kickoff",
            meaning: "Kickoff review date.",
            meaningTokens: ["kickoff", "may"],
            allowedDomains: ["milestone"],
            existingTargetId: "ms-kickoff",
            existingVsNew: "existing",
          },
          {
            id: "brief",
            meaning: "Rewrite the briefing to-do.",
            meaningTokens: ["rewrite", "briefing"],
            allowedDomains: ["todo"],
            existingVsNew: "new",
          },
        ],
        createId: "obs-create",
        observations: [
          obs({
            id: "obs-existing",
            statement: "Kickoff review is still 1 May.",
            domain: "milestone",
            disposition: "no_change",
            candidateTargetId: "ms-kickoff",
            candidateTargetTitle: "Kickoff review",
          }),
          obs({
            id: "obs-create",
            statement: "Rewrite the briefing.",
            domain: "todo",
            disposition: "create_new",
          }),
        ],
      },
      {
        id: "risk-plus-new-person",
        transcript: "Budget overrun is still open. Add Morgan Quinn as a contractor.",
        material: [
          {
            id: "budget",
            meaning: "Budget overrun remains.",
            meaningTokens: ["budget", "overrun"],
            allowedDomains: ["risk"],
            existingTargetId: "risk-budget",
            existingVsNew: "existing",
          },
          {
            id: "morgan",
            meaning: "Morgan Quinn is a new person.",
            meaningTokens: ["morgan", "quinn"],
            allowedDomains: ["person"],
            existingVsNew: "new",
          },
        ],
        createId: "obs-create",
        observations: [
          obs({
            id: "obs-existing",
            statement: "Budget overrun is still open.",
            domain: "risk",
            disposition: "no_change",
            candidateTargetId: "risk-budget",
            candidateTargetTitle: "Budget overrun",
          }),
          obs({
            id: "obs-create",
            statement: "Add Morgan Quinn as a contractor.",
            domain: "person",
            disposition: "create_new",
            proposedValues: { name: "Morgan Quinn" },
            candidateTargetTitle: "Morgan Quinn",
          }),
        ],
      },
      {
        id: "new-risk-plus-existing-todo",
        transcript: "Draft the briefing is unchanged. Vendor escrow gap on the payment path.",
        material: [
          {
            id: "brief",
            meaning: "Briefing to-do already exists.",
            meaningTokens: ["briefing"],
            allowedDomains: ["todo"],
            existingTargetId: "todo-brief",
            existingVsNew: "existing",
          },
          {
            id: "escrow",
            meaning: "New vendor escrow risk.",
            meaningTokens: ["vendor", "escrow"],
            allowedDomains: ["risk"],
            existingVsNew: "new",
          },
        ],
        createId: "obs-create",
        observations: [
          obs({
            id: "obs-existing",
            statement: "Draft the briefing is unchanged.",
            domain: "todo",
            disposition: "no_change",
            candidateTargetId: "todo-brief",
            candidateTargetTitle: "Draft the briefing",
          }),
          obs({
            id: "obs-create",
            statement: "Vendor escrow gap on the payment path.",
            domain: "risk",
            disposition: "create_new",
          }),
        ],
      },
    ];

    for (const combo of combinations) {
      const testCase = baseCase({
        id: `generic-mixed-${combo.id}`,
        transcript: combo.transcript,
        material: combo.material,
      });
      const together = evaluate(testCase, combo.observations);
      const createOnly = evaluate(
        testCase,
        combo.observations.filter((row) => row.id === combo.createId),
      );
      assert.equal(
        together.lumeSafety.totals.unresolvedTargetConvertedToCreate,
        0,
        combo.id,
      );
      assert.equal(
        classOf(together, combo.createId),
        classOf(createOnly, combo.createId),
        combo.id,
      );
      assert.notEqual(classOf(together, combo.createId), "lume_failure", combo.id);
    }
  });

  await check("property: unrelated sibling does not change another observation's safety class", () => {
    const testCase = baseCase({
      id: "generic-sibling-property",
      transcript:
        "Jordan Hale remains lead. Kickoff review is unchanged. Vendor escrow gap on the payment path.",
      material: [
        {
          id: "jordan-still",
          meaning: "Jordan Hale remains lead.",
          meaningTokens: ["jordan", "hale"],
          allowedDomains: ["person"],
          existingTargetId: "person-jordan",
          existingVsNew: "existing",
        },
        {
          id: "kickoff",
          meaning: "Kickoff review date.",
          meaningTokens: ["kickoff", "review"],
          allowedDomains: ["milestone"],
          existingTargetId: "ms-kickoff",
          existingVsNew: "existing",
        },
        {
          id: "escrow-new",
          meaning: "New vendor escrow risk.",
          meaningTokens: ["vendor", "escrow"],
          allowedDomains: ["risk"],
          existingVsNew: "new",
        },
      ],
    });
    const primary = obs({
      id: "obs-risk",
      statement: "Vendor escrow gap on the payment path.",
      domain: "risk",
      disposition: "create_new",
    });
    const siblings: CaptureObservationV2[] = [
      obs({
        id: "obs-jordan",
        statement: "Jordan Hale remains lead.",
        domain: "person",
        disposition: "no_change",
        candidateTargetId: "person-jordan",
        candidateTargetTitle: "Jordan Hale",
      }),
      obs({
        id: "obs-ms",
        statement: "Kickoff review is unchanged.",
        domain: "milestone",
        disposition: "no_change",
        candidateTargetId: "ms-kickoff",
        candidateTargetTitle: "Kickoff review",
      }),
      obs({
        id: "obs-todo",
        statement: "Draft the briefing is unchanged.",
        domain: "todo",
        disposition: "no_change",
        candidateTargetId: "todo-brief",
        candidateTargetTitle: "Draft the briefing",
      }),
    ];
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...siblings), { maxLength: 3 }), (extra) => {
        const unique = extra.filter(
          (row, index, all) => all.findIndex((other) => other.id === row.id) === index,
        );
        const alone = classOf(evaluate(testCase, [primary]), "obs-risk");
        const together = classOf(evaluate(testCase, [primary, ...unique]), "obs-risk");
        assert.equal(together, alone);
        assert.notEqual(together, "lume_failure");
      }),
      PARAMS,
    );
  });

  await check("property: Person display name on write_availability is not Person creation", () => {
    const first = ["Ada", "Ken", "Riley", "Morgan", "Chris", "Dana"] as const;
    const last = ["West", "Park", "Cole", "Quinn", "Lang", "Shah"] as const;
    fc.assert(
      fc.property(fc.constantFrom(...first), fc.constantFrom(...last), (a, b) => {
        const name = `${a} ${b}`;
        const world = genericWorld();
        world.projects[0]!.stakeholders[0] = {
          id: "person-jordan",
          name,
          role: "Lead",
        };
        const testCase = baseCase({
          id: "generic-availability-name-property",
          transcript: `${name} is off next Thursday.`,
          material: [
            {
              id: "away",
              meaning: `${name} is unavailable next Thursday.`,
              meaningTokens: [a.toLowerCase(), "thursday"],
              allowedDomains: ["availability"],
              existingTargetId: "person-jordan",
              existingVsNew: "existing",
            },
          ],
          prohibitedWrites: [
            { reason: "Must not CREATE this person", createTitleIncludes: name },
          ],
        });
        const evaluated = evaluate(
          testCase,
          [
            obs({
              id: "obs-away",
              statement: `${name} is off next Thursday.`,
              domain: "availability",
              disposition: "update_existing",
              candidateTargetId: "person-jordan",
              candidateTargetTitle: name,
              proposedValues: {
                personName: name,
                awayFromIso: "2026-09-03",
                awayToIso: "2026-09-03",
              },
            }),
          ],
          world,
        );
        assert.deepEqual(writeTypes(evaluated), ["write_availability"]);
        assert.equal(evaluated.lumeSafety.totals.lumeFailures, 0);
        assert.equal(classOf(evaluated, "obs-away"), "correct_write");
      }),
      PARAMS,
    );
  });

  await check("frozen corpus cases and count are unchanged", () => {
    assert.equal(CAPTURE_V2_EVAL_CORPUS.length, 22);
    assert.ok(CAPTURE_V2_EVAL_CORPUS.some((c) => c.id === "availability"));
    assert.ok(CAPTURE_V2_EVAL_CORPUS.some((c) => c.id === "mixed-domains"));
    assert.ok(CAPTURE_V2_EVAL_CORPUS.some((c) => c.id === "ambiguous-same-first-name"));
  });

  await check("archived first-live envelopes rescore through scorer v2 without provider calls", () => {
    assert.equal(existsSync(ARCHIVE_PATH), true, "envelope archive missing");
    const archive = JSON.parse(readFileSync(ARCHIVE_PATH, "utf8")) as FirstLiveEnvelopeArchive;
    assert.equal(archive.archiveId, FIRST_LIVE_ENVELOPE_ARCHIVE_ID);
    assert.equal(archive.corpusVersion, FROZEN_CORPUS_COMPOSITION.version);
    assert.equal(archive.originalScorerVersion, CAPTURE_V2_EVAL_SCORER_V1);
    const first = rescoreArchivedEnvelopes(archive);
    const second = rescoreArchivedEnvelopes(archive);
    assert.equal(first.scorerVersion, CAPTURE_V2_EVAL_SCORER_VERSION);
    assert.equal(first.corpusVersion, FROZEN_CORPUS_COMPOSITION.version);
    assert.equal(first.baselineVersion, FROZEN_V2_BASELINE.version);
    assert.deepEqual(
      first.models.map((m) => m.v2),
      second.models.map((m) => m.v2),
    );

    const gemini = first.models.find((m) => m.model.includes("gemini"));
    assert.ok(gemini);
    assert.equal(gemini!.original.successfulRuns, 0);
    assert.equal(gemini!.original.callErrors, gemini!.original.runs);
    assert.equal(gemini!.v2.lumeFailures, 0);
    assert.equal(gemini!.v2.lumeCatches, 0);
    assert.equal(gemini!.v2.modelFailures, 0);

    const originalFailures = first.models.reduce((n, m) => n + m.original.lumeFailures, 0);
    const storedOriginal = archive.envelopes.reduce(
      (n, env) => n + (env.originalLume?.lumeFailures ?? 0),
      0,
    );
    assert.equal(originalFailures, storedOriginal);

    const mini = first.models.find((m) => m.model.includes("gpt-4o-mini"));
    assert.ok(mini);
    const availabilityOriginal = first.cases.filter(
      (row) => row.model === mini!.model && row.caseId === "availability",
    );
    assert.ok(availabilityOriginal.some((row) => row.original.lumeFailures > 0));
    assert.ok(availabilityOriginal.every((row) => row.v2.lumeFailures === 0));

    const mixedOriginal = first.cases.filter(
      (row) => row.model === mini!.model && row.caseId === "mixed-domains",
    );
    assert.ok(mixedOriginal.some((row) => row.original.lumeFailures > 0));
    assert.ok(
      mixedOriginal.every((row) => row.v2.unresolvedTargetConvertedToCreate === 0),
    );

    const ambiguous = first.cases.filter(
      (row) => row.model === mini!.model && row.caseId === "ambiguous-same-first-name",
    );
    assert.ok(ambiguous.length > 0);
    assert.ok(ambiguous.every((row) => row.v2.lumeFailures === 0));

    console.log(
      first.models
        .map(
          (m) =>
            `${m.model}: v1 lumeFailure=${m.original.lumeFailures} → v2 lumeFailure=${m.v2.lumeFailures} lumeCatch=${m.v2.lumeCatches} modelFailure=${m.v2.modelFailures} errors=${m.v2.callErrors}`,
        )
        .join("\n"),
    );
  });

  console.log("\nScorer v2 checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
