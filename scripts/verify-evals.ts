/**
 * Phase 2A intelligence evaluation harness — structural + unit checks.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isEmailAllowedForEvals,
  parseEvalAllowedEmails,
} from "../src/lib/evals/access";
import { getActiveBenchmark, listAllCases, getSampleBenchmark, getOfficialBenchmark, listBenchmarks, summarizeBenchmark } from "../src/lib/evals/fixtures";
import { buildMissionStateForStage } from "../src/lib/evals/build-state";
import { scoreCaseAgainstAnswer } from "../src/lib/evals/scoring";
import {
  classifyCaseChange,
  compareRuns,
  finaliseSummaryWithBaseline,
  attachBaselineScoreMeta,
} from "../src/lib/evals/compare";
import type {
  EvalCaseResult,
  EvalRunRecord,
  SystemAnswerRecord,
} from "../src/lib/evals/types";
import { insertEvalRun, getEvalRun, listEvalRuns, updateEvalRun } from "../src/lib/evals/store";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      passed += 1;
      console.log(`✓ ${name}`);
    } catch (err) {
      console.error(`✗ ${name}`);
      throw err;
    }
  })();
}

function fakeAnswer(text: string): SystemAnswerRecord {
  return {
    system: "lume",
    answer: text,
    confidence: "direct_confirmation",
    sources: [],
    model: "test",
    provider: "local",
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    durationMs: 1,
    error: null,
  };
}

function emptySummary(): EvalRunRecord["summary"] {
  return {
    totalCases: 0,
    completedCases: 0,
    errorCases: 0,
    skippedCases: 0,
    lumePass: 0,
    lumePartial: 0,
    lumeFail: 0,
    baselinePass: 0,
    baselinePartial: 0,
    baselineFail: 0,
    lumeWins: 0,
    gptWins: 0,
    ties: 0,
    trustFailures: 0,
    criticalIntelligenceFailures: 0,
    dimensionAverages: {},
    lumeTotalTokens: null,
    baselineTotalTokens: null,
  };
}

async function main() {
  const root = path.resolve(__dirname, "..");

  await check("allowlist parsing + denial when empty", () => {
    assert.deepEqual(parseEvalAllowedEmails({} as NodeJS.ProcessEnv), []);
    assert.equal(
      isEmailAllowedForEvals("a@b.com", {} as NodeJS.ProcessEnv),
      false,
    );
    assert.equal(
      isEmailAllowedForEvals("Tom@Example.com", {
        LUME_EVAL_ALLOWED_EMAILS: "tom@example.com, other@x.com",
      } as unknown as NodeJS.ProcessEnv),
      true,
    );
    assert.equal(
      isEmailAllowedForEvals("evil@example.com", {
        LUME_EVAL_ALLOWED_EMAILS: "tom@example.com",
      } as unknown as NodeJS.ProcessEnv),
      false,
    );
  });

  await check("eval API routes exist and call requireEvalAccess", () => {
    for (const rel of [
      "src/app/api/evals/access/route.ts",
      "src/app/api/evals/fixtures/route.ts",
      "src/app/api/evals/runs/route.ts",
      "src/app/api/evals/runs/[id]/route.ts",
      "src/app/api/evals/compare/route.ts",
      "src/app/api/evals/runs/[id]/cases/[caseId]/review/route.ts",
    ]) {
      const src = fs.readFileSync(path.join(root, rel), "utf8");
      assert.match(src, /requireEvalAccess/);
    }
  });

  await check("evals layout enforces server-side access", () => {
    const layout = fs.readFileSync(
      path.join(root, "src/app/evals/layout.tsx"),
      "utf8",
    );
    assert.match(layout, /requireEvalAccess/);
    assert.match(layout, /redirect/);
    assert.match(layout, /Evals access denied/);
    assert.match(layout, /LUME_EVAL_ALLOWED_EMAILS/);
  });

  await check("official V1 benchmark is default active suite", () => {
    const active = getActiveBenchmark();
    assert.equal(active.version, "lume-intelligence-benchmark-v1");
    assert.equal(active.kind, "official");
    assert.ok(active.worlds.length >= 5);
    const cases = listAllCases();
    assert.ok(cases.length >= 40 && cases.length <= 55);
    const ids = new Set(cases.map((c) => c.id));
    assert.equal(ids.size, cases.length);
    const summary = summarizeBenchmark(active);
    assert.ok(summary.multiEvidenceCases >= Math.floor(cases.length * 0.25));
    assert.ok(summary.uncertaintyCases >= 8);
    assert.ok(summary.criticalCases >= 5);
  });

  await check("sample harness world remains separate", () => {
    const sample = getSampleBenchmark();
    assert.equal(sample.kind, "sample");
    assert.equal(sample.version, "sample-0.1.0");
    const sampleCases = listAllCases({
      benchmarkVersion: "sample-0.1.0",
    });
    assert.equal(sampleCases.length, 5);
    const official = getOfficialBenchmark();
    assert.ok(!official.worlds.some((w) => w.id === "world-sample-atlas-cutover"));
    assert.ok(listBenchmarks().length >= 2);
  });

  await check("intelligence contract file is present verbatim", () => {
    const contract = path.join(root, "docs/LUME_INTELLIGENCE_CONTRACT_V0.2.md");
    assert.equal(fs.existsSync(contract), true);
    const src = fs.readFileSync(contract, "utf8");
    assert.match(src, /Lume Intelligence Contract v0\.2/);
    assert.match(src, /Think broadly\. Answer narrowly\./);
    assert.match(src, /Trust Before Cleverness/);
    assert.match(src, /Generic GPT Comparison/);
  });

  await check("sample fixture stages remain deterministic", () => {
    const world = getSampleBenchmark().worlds[0]!;
    const early = buildMissionStateForStage(world, "stage-kickoff");
    const late = buildMissionStateForStage(world, "stage-risk");
    assert.ok(early.captures.length < late.captures.length);
    assert.match(late.contextDocument, /26 August/);
    assert.doesNotMatch(early.contextDocument, /Nina is drafting/);
  });

  await check("V1 meridian stage supersession is deterministic", () => {
    const world = getOfficialBenchmark().worlds.find(
      (w) => w.id === "world-v1-meridian-payments",
    )!;
    const early = buildMissionStateForStage(world, "mer-stage-kickoff");
    const late = buildMissionStateForStage(world, "mer-stage-pre-cab");
    assert.match(early.contextDocument, /19 August/);
    assert.match(late.contextDocument, /26 August/);
    assert.doesNotMatch(early.contextDocument, /One Snyk critical still open/);
  });

  await check("trust failure + critical failure detection", () => {
    const sampleCases = listAllCases({
      benchmarkVersion: "sample-0.1.0",
    });
    const security = sampleCases.find((c) => c.id.includes("security"))!;
    const monday = sampleCases.find((c) => c.id.includes("dev-monday"))!;

    const badSecurity = scoreCaseAgainstAnswer(
      security,
      fakeAnswer("Yes — Dave approved Security yesterday."),
    );
    assert.ok(badSecurity.hardFailures.includes("trust_failure"));

    const badMonday = scoreCaseAgainstAnswer(
      monday,
      fakeAnswer("Yes."),
    );
    assert.ok(
      badMonday.hardFailures.includes("critical_intelligence_failure"),
    );

    const goodMonday = scoreCaseAgainstAnswer(
      monday,
      fakeAnswer(
        "No. Sarah must finish UX first and she is away until 25 August, so development must not start Monday 18 August.",
      ),
    );
    assert.equal(
      goodMonday.hardFailures.includes("critical_intelligence_failure"),
      false,
    );
  });

  await check("V1 critical / restraint scoring smoke", () => {
    const cases = listAllCases({
      benchmarkVersion: "lume-intelligence-benchmark-v1",
    });
    const security = cases.find((c) => c.id === "v1-meridian-q3-security-approved")!;
    const uat = cases.find((c) => c.id === "v1-meridian-q4-uat-monday")!;
    const invent = scoreCaseAgainstAnswer(
      security,
      fakeAnswer("Security has approved the Meridian release."),
    );
    assert.ok(invent.hardFailures.includes("trust_failure"));
    const badUat = scoreCaseAgainstAnswer(
      uat,
      fakeAnswer("Yes, UAT can start Monday."),
    );
    assert.ok(badUat.hardFailures.includes("critical_intelligence_failure"));
  });

  await check("immutable run persistence (filesystem backend)", async () => {
    process.env.LUME_EVAL_FORCE_FILESTORE = "1";
    const idA = `test-run-${Date.now()}-a`;
    const idB = `test-run-${Date.now()}-b`;
    const baseCase: EvalCaseResult = {
      caseId: "sample-atlas-q1-owner-ux",
      worldId: "world-sample-atlas-cutover",
      stageId: "stage-kickoff",
      question: "Who owns UX?",
      categories: ["recall"],
      lume: fakeAnswer("fail answer"),
      baseline: fakeAnswer("baseline"),
      dimensionScores: [],
      hardFailures: ["trust_failure"],
      automatedNotes: [],
      automatedBand: "fail",
      manual: null,
    };
    const goodCase: EvalCaseResult = {
      ...baseCase,
      lume: fakeAnswer("Sarah owns UX sign-off"),
      hardFailures: [],
      automatedBand: "pass",
    };

    const runA: EvalRunRecord = {
      id: idA,
      createdAt: new Date().toISOString(),
      label: "A",
      status: "complete",
      gitCommit: "aaa",
      lumeVersion: "vA",
      fixtureVersion: "sample-0.1.0",
      fixtureLabel: "sample",
      lumeModel: "test",
      baselineModel: "test",
      baselinePromptVersion: "gpt-baseline-v1",
      createdByEmail: "test@example.com",
      notes: null,
      worldFilter: null,
      categoryFilter: null,
      summary: emptySummary(),
      cases: [
        attachBaselineScoreMeta(baseCase, "partial", 0.4),
      ],
    };
    runA.summary = finaliseSummaryWithBaseline(runA.cases);

    const runB: EvalRunRecord = {
      ...runA,
      id: idB,
      label: "B",
      lumeVersion: "vB",
      cases: [attachBaselineScoreMeta(goodCase, "partial", 0.4)],
    };
    runB.summary = finaliseSummaryWithBaseline(runB.cases);

    await insertEvalRun(runA);
    await insertEvalRun(runB);
    const loadedA = await getEvalRun(idA);
    const loadedB = await getEvalRun(idB);
    assert.ok(loadedA);
    assert.ok(loadedB);
    assert.equal(loadedA!.label, "A");
    assert.notEqual(loadedA!.id, loadedB!.id);

    // update B must not overwrite A
    await updateEvalRun({ ...loadedB!, notes: "touched" });
    const stillA = await getEvalRun(idA);
    assert.equal(stillA!.notes, null);

    const listed = await listEvalRuns(20);
    assert.ok(listed.some((r) => r.id === idA));
    assert.ok(listed.some((r) => r.id === idB));

    const comparison = compareRuns(loadedA!, loadedB!);
    assert.ok(comparison.summaryDeltas.trustFailuresDelta <= 0);
    const change = classifyCaseChange(loadedA!.cases[0]!, loadedB!.cases[0]!);
    assert.ok(
      change.includes("improved") ||
        change.includes("trust_failure_resolved") ||
        change.includes("failed_to_passed"),
    );

    const regressions = comparison.cases.filter((c) =>
      c.classification.some((x) => x.includes("regressed") || x.includes("introduced")),
    );
    assert.equal(Array.isArray(regressions), true);
  });

  await check("migration denies authenticated table access", () => {
    const sql = fs.readFileSync(
      path.join(root, "supabase/migrations/20260817200000_eval_runs.sql"),
      "utf8",
    );
    assert.match(sql, /eval_runs/);
    assert.match(sql, /force row level security/i);
    assert.match(sql, /revoke all on table public.eval_runs from anon, authenticated/i);
    assert.match(sql, /service_role/);
  });

  console.log(`\n${passed} eval harness checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
