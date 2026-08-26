/**
 * Publish collected test evidence to the GitHub Actions Job Summary
 * and/or the persistent Lume Test Dashboard issue.
 *
 * Test-only. Does not score Capture and does not change product behaviour.
 *
 *   npx tsx scripts/test-dashboard/publish.ts --mode preview
 *   npx tsx scripts/test-dashboard/publish.ts --mode both
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { collectEvidence } from "./collect";
import { readGithubContext, type GithubRunContext } from "./context";
import { createGithubClient, type GithubClient } from "./github";
import { applyEvidence, parseDashboardState } from "./history";
import { composeIssueBody, renderJobSummary } from "./render";
import { emptyDashboardState, type CollectedEvidence, type DashboardState } from "./schema";
import { assertNoSecrets, scrubUnknown } from "./secrets";

export type PublishMode = "summary" | "issue" | "both" | "preview";

export type PublishOptions = {
  mode: PublishMode;
  resultsDir: string;
  context?: GithubRunContext;
  github?: GithubClient;
  summaryPath?: string | null;
  issueOutPath?: string | null;
  evidenceOutPath?: string | null;
  stateInPath?: string | null;
};

export type PublishResult = {
  summary: string;
  issueBody: string;
  evidence: CollectedEvidence;
  state: DashboardState;
  issueNumber: number | null;
  issueUrl: string | null;
  skippedIssueReason: string | null;
};

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0) return process.argv[idx + 1];
  return undefined;
}

function forbiddenFields(payload: string): string[] {
  const hits: string[] = [];
  for (const field of [
    "rawJson",
    "responseText",
    "Authorization",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "apiKey",
    "api_key",
  ]) {
    if (payload.includes(field)) hits.push(field);
  }
  return hits;
}

export function assertSafeDashboardText(payload: string): void {
  assertNoSecrets(payload);
  const fields = forbiddenFields(payload);
  if (fields.length) {
    throw new Error(
      `Dashboard output contained forbidden field name(s): ${fields.join(", ")}`,
    );
  }
}

function loadPriorState(opts: PublishOptions): DashboardState {
  if (opts.stateInPath && existsSync(opts.stateInPath)) {
    return parseDashboardState(readFileSync(opts.stateInPath, "utf8")).state;
  }
  return emptyDashboardState();
}

export async function publishEvidence(opts: PublishOptions): Promise<PublishResult> {
  const context = opts.context ?? readGithubContext();
  const evidence = collectEvidence({
    resultsDir: opts.resultsDir,
    context,
  });
  const summary = renderJobSummary(evidence);
  assertSafeDashboardText(summary);

  let prior = loadPriorState(opts);
  let skippedIssueReason: string | null = null;
  let issueNumber: number | null = null;
  let issueUrl: string | null = null;

  const wantsIssue = opts.mode === "issue" || opts.mode === "both";
  if (wantsIssue && context.isForkPullRequest) {
    skippedIssueReason = "Fork pull requests do not update the persistent dashboard issue.";
  }

  if (wantsIssue && !skippedIssueReason && opts.github && context.repository) {
    const existing = await opts.github.findDashboardIssue();
    if (existing?.body) {
      prior = parseDashboardState(existing.body).state;
    }
    const state = applyEvidence(prior, evidence);
    const issueBody = composeIssueBody(state);
    assertSafeDashboardText(issueBody);
    if (existing) {
      const updated = await opts.github.updateIssueBody(
        existing.number,
        issueBody,
        existing.state === "closed",
      );
      issueNumber = updated.number;
      issueUrl = updated.html_url;
    } else {
      const created = await opts.github.createDashboardIssue(issueBody);
      issueNumber = created.number;
      issueUrl = created.html_url;
    }
    const result: PublishResult = {
      summary,
      issueBody,
      evidence,
      state,
      issueNumber,
      issueUrl,
      skippedIssueReason,
    };
    writeOutputs(opts, result, context);
    return result;
  }

  if (wantsIssue && !skippedIssueReason && !opts.github) {
    skippedIssueReason = "No GitHub client/token available; issue update skipped.";
  }

  const state = applyEvidence(prior, evidence);
  const issueBody = composeIssueBody(state);
  assertSafeDashboardText(issueBody);
  const result: PublishResult = {
    summary,
    issueBody,
    evidence,
    state,
    issueNumber,
    issueUrl,
    skippedIssueReason,
  };
  writeOutputs(opts, result, context);
  return result;
}

function writeOutputs(
  opts: PublishOptions,
  result: PublishResult,
  context: GithubRunContext,
): void {
  const summaryPath = opts.summaryPath ?? context.stepSummaryPath;
  if (
    (opts.mode === "summary" || opts.mode === "both") &&
    summaryPath
  ) {
    appendFileSync(summaryPath, `${result.summary}\n`, "utf8");
  }

  if (opts.mode === "preview") {
    process.stdout.write(result.summary);
    process.stdout.write("\n\n--- issue preview ---\n\n");
    process.stdout.write(result.issueBody);
  }

  if (opts.issueOutPath) {
    writeFileSync(opts.issueOutPath, result.issueBody, "utf8");
  }

  const evidenceOut = opts.evidenceOutPath;
  if (evidenceOut) {
    mkdirSync(dirname(evidenceOut), { recursive: true });
    writeFileSync(
      evidenceOut,
      `${JSON.stringify(scrubUnknown(result.evidence), null, 2)}\n`,
      "utf8",
    );
  }
}

export async function publishFromCli(): Promise<void> {
  const mode = (arg("mode") ?? "preview") as PublishMode;
  if (!["summary", "issue", "both", "preview"].includes(mode)) {
    throw new Error(`Unknown --mode ${mode}`);
  }
  const resultsDir = arg("results-dir") ?? join(process.cwd(), "test-results");
  const context = readGithubContext();
  const github =
    (mode === "issue" || mode === "both") && context.token && context.repository
      ? createGithubClient({ token: context.token, repo: context.repository })
      : undefined;

  const result = await publishEvidence({
    mode,
    resultsDir,
    context,
    github,
    summaryPath: arg("summary-out") ?? context.stepSummaryPath,
    issueOutPath: arg("issue-out"),
    evidenceOutPath: arg("evidence-out"),
    stateInPath: arg("state-in"),
  });

  if (result.skippedIssueReason && (mode === "issue" || mode === "both")) {
    console.warn(`Dashboard issue not updated: ${result.skippedIssueReason}`);
  } else if (result.issueUrl) {
    console.log(`Dashboard issue updated: ${result.issueUrl}`);
  }
}

const isDirect =
  process.argv[1]?.includes("test-dashboard/publish.ts") ||
  process.argv[1]?.includes("test-dashboard/publish.js");

if (isDirect) {
  publishFromCli().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
