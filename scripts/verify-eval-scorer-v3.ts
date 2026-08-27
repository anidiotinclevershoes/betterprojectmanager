/**
 * Deterministic Capture V2 scorer-v3 tests.
 * Generic fixtures only — no case-ID or world-name special cases in the rules.
 * No live provider calls.
 *
 * Run: npx tsx scripts/verify-eval-scorer-v3.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import type { CaptureApplyWorld } from "../src/lib/capture/apply";
import type { CaptureObservationV2 } from "../src/lib/capture-v2/types";
import {
  CAPTURE_V2_EVAL_SCORER_V1,
  CAPTURE_V2_EVAL_SCORER_V2,
  CAPTURE_V2_EVAL_SCORER_V3,
  CAPTURE_V2_EVAL_SCORER_VERSION,
  classifyLumeSafety,
} from "../src/lib/eval-capture-v2/lume-safety";
import { FROZEN_CORPUS_COMPOSITION, FROZEN_V2_BASELINE } from "../src/lib/eval-capture-v2/baseline";
import { CAPTURE_V2_EVAL_CORPUS } from "../src/lib/eval-capture-v2/corpus";
import { evaluateAgainstCase } from "../src/lib/eval-capture-v2/pipeline";
import {
  FIRST_LIVE_ENVELOPE_ARCHIVE_ID,
  SCORER_V3_REPLAY_ID,
  replayArchivedThroughCurrentProduction,
  type FirstLiveEnvelopeArchive,
} from "../src/lib/eval-capture-v2/rescore";
import type { BenchmarkCase, LumeSafetyClassification } from "../src/lib/eval-capture-v2/types";

const PARAMS = { numRuns: 40 };
const ALPHA_ID = "proj-alpha";
const ROOT = process.cwd();
const ARCHIVE_DIR = join(ROOT, "src/lib/eval-capture-v2/archive");
const ENVELOPES_PATH = join(ARCHIVE_DIR, "first-live-benchmark-envelopes-v1.json");
const HISTORICAL_RESCORE_PATH = join(ARCHIVE_DIR, "first-live-rescore-scorer-v2.json");

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** Provenance label only. PR checkouts often lack `origin/main`. */
function resolveProductionSha(): string {
  for (const ref of ["origin/main", "main", "HEAD"]) {
    try {
      return execSync(`git rev-parse ${ref}`, {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      continue;
    }
  }
  return "unavailable";
}

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

function obs(
  partial: Partial<CaptureObservationV2> &
    Pick<CaptureObservationV2, "id" | "statement" | "domain" | "disposition">,
): CaptureObservationV2 {
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

function baseCase(
  partial: Partial<BenchmarkCase> & Pick<BenchmarkCase, "id" | "transcript" | "material">,
): BenchmarkCase {
  return {
    title: partial.id,
    category: "scorer-v3-generic",
    world: "candyland",
    projectId: ALPHA_ID,
    evaluationMode: "fixture-only",
    allowedDomains: [
      "person",
      "availability",
      "risk",
      "todo",
      "milestone",
      "responsibility",
      "commentary",
      "unknown",
    ],
    prohibitedInterpretations: [],
    prohibitedWrites: [],
    ...partial,
  };
}

function evaluate(
  testCase: BenchmarkCase,
  observations: CaptureObservationV2[],
  world = genericWorld(),
) {
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

function correctionCase(transcript: string, prohibited: string): BenchmarkCase {
  return baseCase({
    id: "generic-spoken-correction",
    transcript,
    material: [
      {
        id: "intended-risk",
        meaning: "The intended new risk is the corrected system.",
        meaningTokens: transcript.toLowerCase().split(/\s+/).slice(0, 3),
        allowedDomains: ["risk"],
        existingVsNew: "new",
      },
    ],
    allowedDomains: ["risk", "commentary"],
    prohibitedWrites: [
      {
        reason: "Must not write the retracted system as a durable current risk",
        createTitleIncludes: prohibited,
      },
    ],
  });
}

async function main() {
  await check("scorer v3 is explicit and does not overwrite v1/v2 identifiers", () => {
    assert.equal(CAPTURE_V2_EVAL_SCORER_V1, "capture-v2-eval-scorer-v1");
    assert.equal(CAPTURE_V2_EVAL_SCORER_V2, "capture-v2-eval-scorer-v2");
    assert.equal(CAPTURE_V2_EVAL_SCORER_V3, "capture-v2-eval-scorer-v3");
    assert.equal(CAPTURE_V2_EVAL_SCORER_VERSION, CAPTURE_V2_EVAL_SCORER_V3);
    assert.equal(FROZEN_CORPUS_COMPOSITION.version, "capture-v2-eval-corpus-v1-hulk");
    assert.equal(FROZEN_V2_BASELINE.version, "capture-v2-eval-baseline-v1");
    const lume = readFileSync(join(ROOT, "src/lib/eval-capture-v2/lume-safety.ts"), "utf8");
    assert.equal(/shader compile/.test(lume), false);
    assert.equal(/audio bus/.test(lume), false);
    assert.equal(/GamingStudio5000/.test(lume), false);
    assert.equal(/correction-of-wording/.test(lume), false);
    assert.equal(/share-vs-replace-ambiguous/.test(lume), false);
    assert.equal(/Fizz Caramel/.test(lume), false);
    assert.match(lume, /phraseOccursAsAssertion/);
    assert.match(lume, /writeGroundedInCapture/);
  });

  await check("1. retracted assertion of prohibited material is a Lume failure", () => {
    const testCase = correctionCase(
      "The shader compile is stalling the cert build. Wait — I meant the audio bus mixer, not the shader.",
      "shader",
    );
    const evaluated = evaluate(testCase, [
      obs({
        id: "obs-retracted",
        statement: "The shader compile is stalling the cert build.",
        evidence: "The shader compile is stalling the cert build.",
        domain: "risk",
        disposition: "create_new",
      }),
    ]);
    assert.ok(writeTypes(evaluated).includes("create_risk"));
    assert.equal(classOf(evaluated, "obs-retracted"), "lume_failure");
    assert.ok(evaluated.lumeSafety.totals.lumeFailures >= 1);
  });

  await check("2. corrected write mentioning the prohibited term only in denial is not a Lume failure", () => {
    const testCase = correctionCase(
      "The shader compile is stalling the cert build. Wait — I meant the audio bus mixer, not the shader.",
      "shader",
    );
    const evaluated = evaluate(testCase, [
      obs({
        id: "obs-corrected",
        statement: "The audio bus mixer is stalling the cert build, not the shader compile.",
        evidence: "Wait — I meant the audio bus mixer, not the shader.",
        domain: "risk",
        disposition: "create_new",
      }),
    ]);
    assert.ok(writeTypes(evaluated).includes("create_risk"));
    assert.equal(classOf(evaluated, "obs-corrected"), "correct_write");
    assert.equal(evaluated.lumeSafety.totals.lumeFailures, 0);
  });

  await check("3. the same assertion vs denial distinction holds for unrelated generic names", () => {
    const terms: Array<{ retracted: string; corrected: string; prohibited: string }> = [
      {
        retracted: "The widget mill is stalling the night build.",
        corrected: "The gadget mill is stalling the night build, not the widget mill.",
        prohibited: "widget",
      },
      {
        retracted: "The crane firmware is blocking the quay test.",
        corrected: "The winch firmware is blocking the quay test, not the crane firmware.",
        prohibited: "crane",
      },
    ];
    for (const row of terms) {
      const transcript = `${row.retracted} Wait — I meant the other system, not the ${row.prohibited}.`;
      const testCase = correctionCase(transcript, row.prohibited);
      const bad = evaluate(testCase, [
        obs({
          id: "obs-bad",
          statement: row.retracted,
          evidence: row.retracted,
          domain: "risk",
          disposition: "create_new",
        }),
      ]);
      const good = evaluate(testCase, [
        obs({
          id: "obs-good",
          statement: row.corrected,
          evidence: `I meant the other system, not the ${row.prohibited}.`,
          domain: "risk",
          disposition: "create_new",
        }),
      ]);
      assert.equal(classOf(bad, "obs-bad"), "lume_failure", row.prohibited);
      assert.equal(classOf(good, "obs-good"), "correct_write", row.prohibited);
    }
  });

  await check("4. valid independent Decision sibling outside expected domain is not a Lume failure", () => {
    const testCase = baseCase({
      id: "generic-justified-decision-sibling",
      transcript:
        "Jordan Hale might take QA from Sam Patel, or they might share it — the steering group was unclear.",
      expectedNeedsYou: true,
      material: [
        {
          id: "qa-ambiguous",
          meaning: "QA ownership between Jordan and Sam is genuinely ambiguous.",
          meaningTokens: ["qa", "share"],
          allowedDomains: ["responsibility", "person", "unknown"],
          existingVsNew: "ambiguous",
          expectedNeedsYou: true,
        },
      ],
      allowedDomains: ["responsibility", "person", "unknown"],
      prohibitedWrites: [
        { reason: "Must not write a decided ownership change", domain: "responsibility" },
      ],
    });
    const evaluated = evaluate(testCase, [
      obs({
        id: "obs-resp",
        statement: "Jordan Hale might take QA from Sam Patel.",
        evidence: "Jordan Hale might take QA from Sam Patel, or they might share it",
        domain: "responsibility",
        disposition: "ambiguous",
        candidateTargetId: "person-jordan",
        candidateTargetTitle: "Jordan Hale",
      }),
      obs({
        id: "obs-decision",
        statement: "The steering group was unclear about QA responsibility assignment.",
        evidence: "the steering group was unclear",
        domain: "decision",
        disposition: "create_new",
      }),
    ]);
    assert.equal(classOf(evaluated, "obs-decision"), "correct_write");
    assert.equal(evaluated.lumeSafety.totals.wrongDomainLegalWrite, 0);
    assert.notEqual(classOf(evaluated, "obs-decision"), "lume_failure");
  });

  await check("5. valid independent Knowledge sibling outside expected domain is not a Lume failure", () => {
    const testCase = baseCase({
      id: "generic-justified-knowledge-sibling",
      transcript: "Morgan Quinn is joining as paint lead for the riverside path resurfacing.",
      material: [
        {
          id: "morgan-new",
          meaning: "Morgan Quinn is a new person.",
          meaningTokens: ["morgan", "quinn"],
          allowedDomains: ["person"],
          existingVsNew: "new",
        },
      ],
      allowedDomains: ["person"],
    });
    const evaluated = evaluate(testCase, [
      obs({
        id: "obs-person",
        statement: "Morgan Quinn is joining as paint lead.",
        evidence: "Morgan Quinn is joining as paint lead for the riverside path resurfacing.",
        domain: "person",
        disposition: "create_new",
        proposedValues: { name: "Morgan Quinn" },
        candidateTargetTitle: "Morgan Quinn",
      }),
      obs({
        id: "obs-knowledge",
        statement: "There is a riverside path resurfacing effort in the project.",
        evidence: "Morgan Quinn is joining as paint lead for the riverside path resurfacing.",
        domain: "knowledge",
        disposition: "create_new",
      }),
    ]);
    assert.equal(classOf(evaluated, "obs-knowledge"), "correct_write");
    assert.equal(evaluated.lumeSafety.totals.wrongDomainLegalWrite, 0);
  });

  await check("6. invented extra-domain write remains a Lume failure", () => {
    const testCase = baseCase({
      id: "generic-invented-extra-domain",
      transcript:
        "Jordan Hale might take QA from Sam Patel, or they might share it — the steering group was unclear.",
      expectedNeedsYou: true,
      material: [
        {
          id: "qa-ambiguous",
          meaning: "QA ownership is ambiguous.",
          meaningTokens: ["qa", "share"],
          allowedDomains: ["responsibility", "person", "unknown"],
          existingVsNew: "ambiguous",
          expectedNeedsYou: true,
        },
      ],
      allowedDomains: ["responsibility", "person", "unknown"],
    });
    const evaluated = evaluate(testCase, [
      obs({
        id: "obs-resp",
        statement: "Jordan Hale might take QA from Sam Patel.",
        evidence: "Jordan Hale might take QA from Sam Patel, or they might share it",
        domain: "responsibility",
        disposition: "ambiguous",
        candidateTargetId: "person-jordan",
        candidateTargetTitle: "Jordan Hale",
      }),
      obs({
        id: "obs-invented",
        statement: "The orbital drydock freeze was approved by the board.",
        evidence: "the steering group was unclear",
        domain: "knowledge",
        disposition: "create_new",
      }),
    ]);
    assert.equal(classOf(evaluated, "obs-invented"), "lume_failure");
    assert.ok(evaluated.lumeSafety.totals.wrongDomainLegalWrite >= 1);
    const reason = evaluated.lumeSafety.rows.find((row) => row.observationId === "obs-invented")
      ?.reason;
    assert.match(String(reason), /Unjustified extra-domain/);
  });

  await check("7. availability write to an existing Person is still not a Lume failure", () => {
    const testCase = baseCase({
      id: "generic-availability-existing-person-v3",
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

  await check("8. mixed-domain observation-local CREATE is still not an unresolved-target failure", () => {
    const testCase = baseCase({
      id: "generic-mixed-person-new-risk-v3",
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
      }),
    ]);
    assert.equal(evaluated.lumeSafety.totals.unresolvedTargetConvertedToCreate, 0);
    assert.equal(classOf(evaluated, "obs-risk"), "correct_write");
  });

  await check("9. ambiguous Person unsafe bind remains detectable if a write were Apply Ready", () => {
    const testCase = baseCase({
      id: "generic-incomplete-person-bind-historical",
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
    const bind = obs({
      id: "obs-bind",
      statement: "Jordan from the warehouse wants to help with assembly.",
      evidence: "Jordan from the warehouse called; he wants to help with assembly.",
      domain: "person",
      disposition: "update_existing",
      candidateTargetId: "person-jordan",
      candidateTargetTitle: "Jordan Hale",
    });
    const current = evaluate(testCase, [bind]);
    assert.equal(current.pipeline.resolved[0]?.decision.kind, "needs_you");
    assert.equal(current.lumeSafety.totals.applyReady, 0);
    assert.equal(current.lumeSafety.totals.lumeFailures, 0);

    const historical = classifyLumeSafety({
      testCase,
      observations: [bind],
      validation: { ok: true, observations: [bind], rejected: [], issues: [] },
      resolved: [
        {
          observation: bind,
          suggestion: null,
          decision: {
            kind: "write",
            domain: "person",
            operation: {
              type: "ensure_person",
              projectId: ALPHA_ID,
              name: "Jordan Hale",
              personId: "person-jordan",
            },
          },
        },
      ],
    });
    assert.equal(historical.rows[0]?.classification, "lume_failure");
    assert.match(
      historical.rows[0]?.reason ?? "",
      /incomplete identity evidence/,
    );
  });

  await check("10. sibling ordering does not change assertion/denial or extra-domain class", () => {
    const testCase = correctionCase(
      "The widget mill is stalling the night build. Wait — I meant the gadget mill, not the widget.",
      "widget",
    );
    const retracted = obs({
      id: "obs-retracted",
      statement: "The widget mill is stalling the night build.",
      evidence: "The widget mill is stalling the night build.",
      domain: "risk",
      disposition: "create_new",
    });
    const corrected = obs({
      id: "obs-corrected",
      statement: "The gadget mill is stalling the night build, not the widget mill.",
      evidence: "Wait — I meant the gadget mill, not the widget.",
      domain: "risk",
      disposition: "create_new",
    });
    const commentary = obs({
      id: "obs-note",
      statement: "The speaker corrected themselves.",
      domain: "commentary",
      disposition: "commentary",
    });
    const orders = [
      [retracted, corrected],
      [corrected, retracted],
      [commentary, retracted, corrected],
      [corrected, commentary, retracted],
    ];
    for (const order of orders) {
      const evaluated = evaluate(testCase, order);
      assert.equal(classOf(evaluated, "obs-retracted"), "lume_failure");
      assert.equal(classOf(evaluated, "obs-corrected"), "correct_write");
    }
  });

  await check("property: denied prohibited phrase is not a Lume failure; asserted phrase is", () => {
    const nouns = ["widget", "gadget", "pump", "crane", "winch", "boiler"] as const;
    fc.assert(
      fc.property(fc.constantFrom(...nouns), fc.constantFrom(...nouns), (bad, good) => {
        if (bad === good) return;
        const testCase = correctionCase(
          `The ${bad} is stalling the run. I meant the ${good}, not the ${bad}.`,
          bad,
        );
        const asserted = evaluate(testCase, [
          obs({
            id: "obs-assert",
            statement: `The ${bad} is stalling the run.`,
            domain: "risk",
            disposition: "create_new",
          }),
        ]);
        const denied = evaluate(testCase, [
          obs({
            id: "obs-deny",
            statement: `The ${good} is stalling the run, not the ${bad}.`,
            domain: "risk",
            disposition: "create_new",
          }),
        ]);
        assert.equal(classOf(asserted, "obs-assert"), "lume_failure");
        assert.equal(classOf(denied, "obs-deny"), "correct_write");
      }),
      PARAMS,
    );
  });

  await check("property: extra-domain class is invariant to unrelated sibling order", () => {
    const testCase = baseCase({
      id: "generic-extra-domain-order",
      transcript:
        "Jordan Hale remains lead. The steering group was unclear about the quay timetable.",
      material: [
        {
          id: "jordan-still",
          meaning: "Jordan Hale remains lead.",
          meaningTokens: ["jordan", "hale"],
          allowedDomains: ["person"],
          existingTargetId: "person-jordan",
          existingVsNew: "existing",
        },
      ],
      allowedDomains: ["person"],
    });
    const primary = obs({
      id: "obs-decision",
      statement: "The steering group was unclear about the quay timetable.",
      evidence: "The steering group was unclear about the quay timetable.",
      domain: "decision",
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
    ];
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...siblings), { maxLength: 2 }), (extra) => {
        const unique = extra.filter(
          (row, index, all) => all.findIndex((other) => other.id === row.id) === index,
        );
        const alone = classOf(evaluate(testCase, [primary]), "obs-decision");
        const together = classOf(evaluate(testCase, [primary, ...unique]), "obs-decision");
        assert.equal(together, alone);
        assert.equal(together, "correct_write");
      }),
      PARAMS,
    );
  });

  await check("frozen corpus is unchanged", () => {
    assert.equal(CAPTURE_V2_EVAL_CORPUS.length, 22);
    assert.ok(CAPTURE_V2_EVAL_CORPUS.some((c) => c.id === "correction-of-wording"));
    assert.ok(CAPTURE_V2_EVAL_CORPUS.some((c) => c.id === "share-vs-replace-ambiguous"));
    assert.ok(CAPTURE_V2_EVAL_CORPUS.some((c) => c.id === "new-person"));
  });

  await check("archived current-production replay through scorer v3 uses no provider calls", () => {
    assert.equal(existsSync(ENVELOPES_PATH), true);
    assert.equal(existsSync(HISTORICAL_RESCORE_PATH), true);
    const envelopeHashBefore = sha256File(ENVELOPES_PATH);
    const rescoreHashBefore = sha256File(HISTORICAL_RESCORE_PATH);
    const archive = JSON.parse(readFileSync(ENVELOPES_PATH, "utf8")) as FirstLiveEnvelopeArchive;
    assert.equal(archive.archiveId, FIRST_LIVE_ENVELOPE_ARCHIVE_ID);
    const historical = JSON.parse(readFileSync(HISTORICAL_RESCORE_PATH, "utf8")) as {
      scorerVersion: string;
    };
    assert.equal(historical.scorerVersion, CAPTURE_V2_EVAL_SCORER_V2);

    const productionSha = resolveProductionSha();
    const report = replayArchivedThroughCurrentProduction({ archive, productionSha });
    assert.equal(report.scorerVersion, CAPTURE_V2_EVAL_SCORER_V3);
    assert.equal(report.replayId, SCORER_V3_REPLAY_ID);
    assert.equal(report.corpusVersion, FROZEN_CORPUS_COMPOSITION.version);

    const gemini = report.models.find((m) => m.model.includes("gemini"));
    assert.ok(gemini);
    assert.equal(gemini!.successfulEnvelopes, 0);
    assert.equal(gemini!.callErrors, 63);
    assert.equal(gemini!.lumeFailures, 0);

    const mini = report.models.find((m) => m.model.includes("gpt-4o-mini"));
    const fourOne = report.models.find((m) => m.model.includes("gpt-4.1-mini"));
    const claude = report.models.find((m) => m.model.includes("claude"));
    assert.ok(mini && fourOne && claude);

    const genuine = report.cases.filter((row) => row.outcome === "still_genuine_lume_failure");
    const miniGenuine = genuine.filter((row) => row.model.includes("gpt-4o-mini"));
    const fourOneGenuine = genuine.filter((row) => row.model.includes("gpt-4.1-mini"));
    const claudeGenuine = genuine.filter((row) => row.model.includes("claude"));

    assert.equal(mini!.lumeFailures, 0, "gpt-4o-mini must remain zero genuine Lume failures");
    assert.equal(miniGenuine.length, 0);

    for (const row of fourOneGenuine) {
      assert.equal(row.caseId, "correction-of-wording", `${row.model} run${row.runIndex}`);
      assert.ok(
        row.failureStatements.some((statement) =>
          /shader compile is stalling/i.test(statement),
        ),
        `expected retracted shader statement, got ${row.failureStatements.join(" | ")}`,
      );
      assert.equal(
        row.failureStatements.some((statement) =>
          /audio bus mixer is stalling the cert build, not the shader/i.test(statement),
        ),
        false,
        "corrected audio-bus write must not be a Lume failure",
      );
    }

    const claudeDomain = claudeGenuine.filter(
      (row) =>
        row.caseId === "share-vs-replace-ambiguous" || row.caseId === "new-person",
    );
    assert.equal(
      claudeDomain.length,
      0,
      `Claude extra-domain writes must not be genuine failures: ${claudeDomain
        .map((row) => `${row.caseId} run${row.runIndex} ${row.failureStatements.join(" | ")}`)
        .join("; ")}`,
    );

    assert.equal(sha256File(ENVELOPES_PATH), envelopeHashBefore);
    assert.equal(sha256File(HISTORICAL_RESCORE_PATH), rescoreHashBefore);

    console.log(
      report.models
        .map(
          (m) =>
            `${m.model}: success=${m.successfulEnvelopes} lumeFailure=${m.lumeFailures} lumeCatch=${m.lumeCatches} modelFailure=${m.modelFailures}`,
        )
        .join("\n"),
    );
    for (const row of genuine) {
      console.log(
        `GENUINE ${row.model} ${row.caseId} run${row.runIndex} statements=${row.failureStatements.join(" | ")}`,
      );
    }
    console.log(
      `counts gpt-4o-mini=${mini!.lumeFailures} gpt-4.1-mini=${fourOne!.lumeFailures} claude=${claude!.lumeFailures} genuineEnvelopes=${genuine.length}`,
    );
  });

  console.log("\nScorer v3 checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
