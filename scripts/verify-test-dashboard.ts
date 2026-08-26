/**
 * Deterministic tests for the Lume Test Dashboard reporter.
 * No live model calls. Fixtures are fake and must never be published
 * as real benchmark history.
 *
 * Run: npx tsx scripts/verify-test-dashboard.ts
 */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectEvidence } from "./test-dashboard/collect";
import {
  corpusVersionFromReport,
  scorerVersionFromReport,
} from "./test-dashboard/aggregate";
import { readGithubContext, type GithubRunContext } from "./test-dashboard/context";
import type { GithubClient, GithubIssue } from "./test-dashboard/github";
import {
  InvalidDashboardStateError,
  applyEvidence,
  parseDashboardState,
  upsertModelRow,
} from "./test-dashboard/history";
import { publishEvidence } from "./test-dashboard/publish";
import { composeIssueBody, latestModels, renderJobSummary, renderIssueBody } from "./test-dashboard/render";
import {
  DASHBOARD_ISSUE_TITLE,
  emptyDashboardState,
  type ModelRow,
} from "./test-dashboard/schema";
import { assertNoSecrets, containsSecret } from "./test-dashboard/secrets";

const ROOT = process.cwd();
const FIX = join(ROOT, "scripts/test-dashboard/fixtures");

function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).then(() => console.log(`✓ ${name}`));
}

function ctx(partial: Partial<GithubRunContext> = {}): GithubRunContext {
  return {
    sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    branch: "cursor/v1-test-results-dashboard-08a0",
    prNumber: 72,
    runId: "run-1",
    workflowUrl: "https://github.com/example/lume/actions/runs/1",
    repository: "example/lume",
    token: "test-token",
    stepSummaryPath: null,
    isForkPullRequest: false,
    timestamp: "2026-08-26T10:00:00.000Z",
    ...partial,
  };
}

function collect(dir: string, partial?: Partial<GithubRunContext>) {
  return collectEvidence({
    resultsDir: join(FIX, dir),
    context: ctx(partial),
  });
}

function fakeGithub(store: { body: string | null }): GithubClient {
  return {
    async findDashboardIssue() {
      if (!store.body) return null;
      return {
        number: 7,
        title: DASHBOARD_ISSUE_TITLE,
        body: store.body,
        html_url: "https://github.com/example/lume/issues/7",
        state: "open",
      } satisfies GithubIssue;
    },
    async createDashboardIssue(body: string) {
      store.body = body;
      return {
        number: 7,
        title: DASHBOARD_ISSUE_TITLE,
        body,
        html_url: "https://github.com/example/lume/issues/7",
        state: "open",
      };
    },
    async updateIssueBody(number: number, body: string) {
      store.body = body;
      return {
        number,
        title: DASHBOARD_ISSUE_TITLE,
        body,
        html_url: "https://github.com/example/lume/issues/7",
        state: "open",
      };
    },
  };
}

function sampleModel(partial: Partial<ModelRow> = {}): ModelRow {
  return {
    runId: "run-m",
    timestamp: "2026-08-26T11:00:00.000Z",
    prNumber: 72,
    branch: "cursor/x",
    sha: "bbbbbbb",
    provider: "fixture-alpha",
    model: "alpha-1",
    corpusVersion: "capture-v2-eval-corpus-v1-hulk",
    scorerVersion: null,
    caseCount: 1,
    recall: 0.9,
    falsePositives: 0,
    domainAccuracy: 1,
    existingVsNewAccuracy: 1,
    targetIdAccuracy: 1,
    ambiguityHandling: null,
    noChangeHandling: null,
    commentaryHandling: null,
    stability: null,
    modelFailures: 0,
    lumeCatches: 0,
    lumeFailures: 0,
    tokens: { input: 10, output: 5, total: 15 },
    latencyMs: 100,
    costUsd: 0.001,
    result: "pass",
    workflowUrl: null,
    worlds: {},
    ...partial,
  };
}

async function main() {
  await check("deterministic regression with no model renders correctly", () => {
    const evidence = collect("regression-only");
    assert.equal(evidence.modelRows.length, 0);
    assert.equal(evidence.npmTest, "pass");
    assert.equal(evidence.playwright, "pass");
    assert.equal(evidence.stacked, "pass");
    assert.equal(evidence.overall, "pass");
    assert.equal(evidence.worlds.candyland.result, "pass");
    assert.equal(evidence.worlds.toyworld.result, "pass");
    assert.equal(evidence.worlds.gamingstudio5000.result, "pass");
    const summary = renderJobSummary(evidence);
    assert.match(summary, /npm test/);
    assert.match(summary, /Frozen Playwright/);
    assert.match(summary, /Stacked Capture/);
    assert.match(summary, /Candyland/);
    assert.match(summary, /No live Capture V2 benchmark has been recorded for this run/);
    assert.doesNotMatch(summary, /fixture-model-a/);
    const issue = renderIssueBody(emptyDashboardState(evidence.timestamp), evidence.timestamp);
    assert.match(issue, /No live Capture V2 benchmark has been recorded yet/);
  });

  await check("one model renders correctly", () => {
    const evidence = collect("one-model", { runId: "run-one" });
    assert.equal(evidence.modelRows.length, 1);
    const row = evidence.modelRows[0];
    assert.equal(row.provider, "fixture-provider-a");
    assert.equal(row.model, "fixture-model-a");
    assert.equal(row.corpusVersion, "capture-v2-eval-corpus-v1-hulk");
    assert.equal(row.scorerVersion, "capture-v2-eval-scorer-v1");
    assert.equal(row.caseCount, 1);
    assert.equal(row.recall, 1);
    assert.equal(row.falsePositives, 0);
    assert.equal(row.lumeFailures, 0);
    assert.equal(row.tokens.total, 140);
    assert.equal(row.costUsd, 0.0025);
    assert.equal(row.latencyMs, 800);
    assert.equal(row.stability, null);
    assert.equal(row.result, "pass");
    const summary = renderJobSummary(evidence);
    assert.match(summary, /fixture-provider-a \/ fixture-model-a/);
    assert.match(summary, /MODEL FAILURE/);
    assert.match(summary, /LUME CATCH/);
    assert.match(summary, /LUME FAILURE/);
    assert.match(summary, /\$0\.0025/);
  });

  await check("multiple providers/models render as data, not hard-coded columns", () => {
    const evidence = collect("multi-model", { runId: "run-multi" });
    assert.equal(evidence.modelRows.length, 3);
    const labels = evidence.modelRows.map((row) => `${row.provider}/${row.model}`).sort();
    assert.deepEqual(labels, [
      "fixture-alpha/alpha-1",
      "fixture-beta/beta-9",
      "fixture-gamma/gamma-z",
    ]);
    const issue = composeIssueBody(applyEvidence(emptyDashboardState(), evidence));
    assert.match(issue, /fixture-alpha \/ alpha-1/);
    assert.match(issue, /fixture-beta \/ beta-9/);
    assert.match(issue, /fixture-gamma \/ gamma-z/);
    assert.doesNotMatch(issue, /OpenAI \.\.\./);
    const beta = evidence.modelRows.find((row) => row.provider === "fixture-beta");
    assert.equal(beta?.result, "fail");
    assert.equal(beta?.lumeFailures, 1);
    const alpha = evidence.modelRows.find((row) => row.provider === "fixture-alpha");
    assert.equal(alpha?.result, "warn");
    assert.equal(alpha?.lumeCatches, 1);
    const gamma = evidence.modelRows.find((row) => row.provider === "fixture-gamma");
    assert.equal(gamma?.result, "pass");
  });

  await check("missing optional metrics display as em dash", () => {
    const evidence = collect("missing-metrics", { runId: "run-sparse" });
    assert.equal(evidence.modelRows.length, 1);
    const row = evidence.modelRows[0];
    assert.equal(row.recall, null);
    assert.equal(row.falsePositives, null);
    assert.equal(row.stability, null);
    assert.equal(row.tokens.total, null);
    assert.equal(row.costUsd, null);
    assert.equal(row.latencyMs, null);
    const summary = renderJobSummary(evidence);
    assert.match(summary, /\*\*Stability:\*\* —/);
    assert.match(summary, /\*\*Recall:\*\* —/);
    assert.match(summary, /\*\*Approximate cost:\*\* —/);
    assert.match(summary, /\*\*Latency:\*\* —/);
    assert.match(summary, /\*\*Total tokens:\*\* —/);
  });

  await check("MODEL FAILURE / LUME CATCH / LUME FAILURE remain distinct", () => {
    const evidence = collect("classifications", { runId: "run-class" });
    const classes = evidence.importantFailures.map((row) => row.classification).sort();
    assert.deepEqual(classes, ["LUME CATCH", "LUME FAILURE", "MODEL FAILURE"]);
    const summary = renderJobSummary(evidence);
    assert.match(summary, /MODEL FAILURE/);
    assert.match(summary, /LUME CATCH/);
    assert.match(summary, /LUME FAILURE/);
    const modelFail = evidence.importantFailures.find((row) => row.classification === "MODEL FAILURE");
    const catchRow = evidence.importantFailures.find((row) => row.classification === "LUME CATCH");
    const lumeFail = evidence.importantFailures.find((row) => row.classification === "LUME FAILURE");
    assert.ok(modelFail);
    assert.ok(catchRow);
    assert.ok(lumeFail);
    assert.notEqual(modelFail?.classification, catchRow?.classification);
    assert.notEqual(catchRow?.classification, lumeFail?.classification);
    assert.equal(modelFail?.expected, "No change");
    assert.equal(evidence.modelRows[0]?.result, "fail");
  });

  await check("historical PR rows append; same runId does not duplicate", () => {
    const first = collect("regression-only", {
      runId: "run-hist-1",
      prNumber: 72,
      sha: "1111111111111111111111111111111111111111",
      timestamp: "2026-08-26T10:00:00.000Z",
    });
    const second = collect("regression-only", {
      runId: "run-hist-2",
      prNumber: 79,
      sha: "2222222222222222222222222222222222222222",
      timestamp: "2026-08-26T12:00:00.000Z",
    });
    let state = applyEvidence(emptyDashboardState(), first);
    state = applyEvidence(state, second);
    assert.equal(state.regressionRows.length, 2);
    assert.equal(state.regressionRows[0]?.prNumber, 79);
    assert.equal(state.regressionRows[1]?.prNumber, 72);
    state = applyEvidence(state, second);
    assert.equal(state.regressionRows.length, 2);

    const modelA = sampleModel({ runId: "run-m1", provider: "fixture-alpha", model: "alpha-1" });
    const modelB = sampleModel({
      runId: "run-m1",
      provider: "fixture-beta",
      model: "beta-9",
      timestamp: "2026-08-26T11:01:00.000Z",
    });
    state = upsertModelRow(state, modelA);
    state = upsertModelRow(state, modelB);
    assert.equal(
      state.modelRows.filter((row) => row.runId === "run-m1").length,
      2,
    );
    state = upsertModelRow(state, { ...modelA, recall: 0.91 });
    const alphas = state.modelRows.filter(
      (row) => row.runId === "run-m1" && row.provider === "fixture-alpha",
    );
    assert.equal(alphas.length, 1);
    assert.equal(alphas[0]?.recall, 0.91);
  });

  await check("no live benchmark state is handled", () => {
    const dir = mkdtempSync(join(tmpdir(), "lume-dash-empty-"));
    const evidence = collectEvidence({ resultsDir: dir, context: ctx({ runId: "empty" }) });
    assert.equal(evidence.modelRows.length, 0);
    assert.equal(evidence.overall, "unknown");
    const issue = composeIssueBody(applyEvidence(emptyDashboardState(), evidence));
    assert.match(issue, /No live Capture V2 benchmark has been recorded yet/);
    assert.doesNotMatch(issue, /gpt-/i);
    assert.doesNotMatch(issue, /claude/i);
    assert.doesNotMatch(issue, /gemini/i);
  });

  await check("Markdown escaping works and secrets are never included", () => {
    const evidence = collect("escaping", { runId: "run-escape" });
    const summary = renderJobSummary(evidence);
    const issue = composeIssueBody(applyEvidence(emptyDashboardState(), evidence));
    assert.match(summary, /fixture-escape \/ escape\\\|model/);
    assert.match(issue, /→ leak/);
    assert.doesNotMatch(issue, /sk-testfixturevalue999/);
    assert.ok(!containsSecret(summary));
    assert.ok(!containsSecret(issue));
    assertNoSecrets(summary);
    assertNoSecrets(issue);
    assert.doesNotMatch(issue, /rawJson/);
    assert.doesNotMatch(issue, /responseText/);
    assert.doesNotMatch(issue, /OPENAI_API_KEY/);
    assert.doesNotMatch(issue, /Authorization/);
  });

  await check("issue update preserves intended history and skips fork writes", async () => {
    const store: { body: string | null } = { body: null };
    const github = fakeGithub(store);
    const tmp = mkdtempSync(join(tmpdir(), "lume-dash-pub-"));
    const first = await publishEvidence({
      mode: "both",
      resultsDir: join(FIX, "regression-only"),
      context: ctx({ runId: "pub-1", timestamp: "2026-08-26T10:00:00.000Z" }),
      github,
      summaryPath: join(tmp, "summary.md"),
    });
    assert.equal(first.issueNumber, 7);
    assert.match(first.issueBody, /#72 \/ `aaaaaaa`/);
    const second = await publishEvidence({
      mode: "issue",
      resultsDir: join(FIX, "one-model"),
      context: ctx({
        runId: "pub-2",
        prNumber: 79,
        sha: "dddddddddddddddddddddddddddddddddddddddd",
        timestamp: "2026-08-26T11:00:00.000Z",
      }),
      github,
    });
    const parsed = parseDashboardState(second.issueBody).state;
    assert.equal(parsed.regressionRows.length, 1);
    assert.equal(parsed.modelRows.length, 1);
    assert.match(second.issueBody, /fixture-provider-a \/ fixture-model-a/);
    assert.match(second.issueBody, /Current Safety Status/);

    const third = await publishEvidence({
      mode: "issue",
      resultsDir: join(FIX, "regression-only"),
      context: ctx({ runId: "pub-1", timestamp: "2026-08-26T10:00:00.000Z" }),
      github,
    });
    assert.equal(parseDashboardState(third.issueBody).state.regressionRows.length, 1);

    const fork = await publishEvidence({
      mode: "both",
      resultsDir: join(FIX, "one-model"),
      context: ctx({
        runId: "pub-fork",
        isForkPullRequest: true,
        timestamp: "2026-08-26T12:00:00.000Z",
      }),
      github,
    });
    assert.match(fork.skippedIssueReason ?? "", /Fork pull requests/);
    assert.equal(parseDashboardState(store.body ?? "").state.modelRows.length, 1);
  });

  await check("corrupt stored state refuses to overwrite history", () => {
    assert.throws(
      () => parseDashboardState("hello\n<!-- lume-test-dashboard-state:v1\n{not json}\n-->\n"),
      InvalidDashboardStateError,
    );
  });

  await check("same-run model rows survive upsert by provider+model", () => {
    const evidence = collect("multi-model", { runId: "same-run" });
    const state = applyEvidence(emptyDashboardState(), evidence);
    assert.equal(state.modelRows.length, 3);
    const again = applyEvidence(state, evidence);
    assert.equal(again.modelRows.length, 3);
  });

  await check("pull_request context uses head SHA, not the merge ref", () => {
    const dir = mkdtempSync(join(tmpdir(), "lume-dash-event-"));
    const eventPath = join(dir, "event.json");
    writeFileSync(
      eventPath,
      JSON.stringify({
        number: 72,
        pull_request: {
          number: 72,
          head: {
            sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            ref: "cursor/v1-test-results-dashboard-08a0",
            repo: { full_name: "example/lume" },
          },
        },
        repository: { full_name: "example/lume" },
      }),
    );
    const previous = {
      GITHUB_EVENT_PATH: process.env.GITHUB_EVENT_PATH,
      GITHUB_SHA: process.env.GITHUB_SHA,
      GITHUB_RUN_ID: process.env.GITHUB_RUN_ID,
      GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
      GITHUB_HEAD_REF: process.env.GITHUB_HEAD_REF,
    };
    process.env.GITHUB_EVENT_PATH = eventPath;
    process.env.GITHUB_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    process.env.GITHUB_RUN_ID = "32973184687";
    process.env.GITHUB_REPOSITORY = "example/lume";
    process.env.GITHUB_HEAD_REF = "cursor/v1-test-results-dashboard-08a0";
    try {
      const context = readGithubContext();
      assert.equal(context.sha, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
      assert.equal(context.prNumber, 72);
      assert.equal(context.isForkPullRequest, false);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  await check("scorer version is independent of corpus/baseline; v1 and v2 rows coexist", () => {
    assert.equal(
      corpusVersionFromReport({ baselineVersion: "capture-v2-eval-baseline-v1" }),
      "capture-v2-eval-corpus-v1-hulk",
    );
    assert.equal(
      corpusVersionFromReport({
        baselineVersion: "capture-v2-eval-baseline-v1",
        corpusVersion: "capture-v2-eval-corpus-v1-hulk",
      }),
      "capture-v2-eval-corpus-v1-hulk",
    );
    assert.equal(scorerVersionFromReport({}), "capture-v2-eval-scorer-v1");
    assert.equal(
      scorerVersionFromReport({ scorerVersion: "capture-v2-eval-scorer-v2" }),
      "capture-v2-eval-scorer-v2",
    );

    const v1 = sampleModel({
      runId: "run-hist-v1",
      timestamp: "2026-08-26T11:00:00.000Z",
      scorerVersion: "capture-v2-eval-scorer-v1",
      lumeFailures: 5,
    });
    const v2 = sampleModel({
      runId: "run-rescore-v2",
      timestamp: "2026-08-26T16:00:00.000Z",
      scorerVersion: "capture-v2-eval-scorer-v2",
      lumeFailures: 1,
    });
    let state = emptyDashboardState();
    state = upsertModelRow(state, v1);
    state = upsertModelRow(state, v2);
    assert.equal(state.modelRows.length, 2);
    const latest = latestModels(state.modelRows);
    assert.equal(latest.length, 2);
    const body = composeIssueBody(state);
    assert.match(body, /capture-v2-eval-scorer-v1/);
    assert.match(body, /capture-v2-eval-scorer-v2/);
    assert.match(body, /\|\s*Scorer\s*\|/);
  });

  console.log("\nLume Test Dashboard reporter tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
