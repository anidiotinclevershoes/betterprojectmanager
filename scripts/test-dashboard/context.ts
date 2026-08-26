import { readFileSync } from "node:fs";

export type GithubRunContext = {
  sha: string;
  branch: string | null;
  prNumber: number | null;
  runId: string;
  workflowUrl: string | null;
  repository: string | null;
  token: string | null;
  stepSummaryPath: string | null;
  isForkPullRequest: boolean;
  timestamp: string;
};

function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function prFromEvent(): number | null {
  const path = env("GITHUB_EVENT_PATH");
  if (!path) return null;
  try {
    const event = JSON.parse(readFileSync(path, "utf8")) as {
      number?: number;
      pull_request?: { number?: number; head?: { repo?: { full_name?: string } } };
      repository?: { full_name?: string };
    };
    const n = event.pull_request?.number ?? event.number;
    return typeof n === "number" ? n : null;
  } catch {
    return null;
  }
}

function forkPullRequest(): boolean {
  const path = env("GITHUB_EVENT_PATH");
  if (!path) return false;
  try {
    const event = JSON.parse(readFileSync(path, "utf8")) as {
      pull_request?: { head?: { repo?: { full_name?: string } } };
      repository?: { full_name?: string };
    };
    const head = event.pull_request?.head?.repo?.full_name;
    const base = event.repository?.full_name;
    return Boolean(head && base && head !== base);
  } catch {
    return false;
  }
}

function prFromRef(): number | null {
  const ref = env("GITHUB_REF") ?? "";
  const match = ref.match(/refs\/pull\/(\d+)\//);
  return match ? Number(match[1]) : null;
}

export function readGithubContext(overrides: Partial<GithubRunContext> = {}): GithubRunContext {
  const server = env("GITHUB_SERVER_URL") ?? "https://github.com";
  const repo = env("GITHUB_REPOSITORY");
  const runId = env("GITHUB_RUN_ID") ?? env("LUME_DASHBOARD_RUN_ID") ?? `local-${Date.now()}`;
  const sha =
    env("GITHUB_SHA") ??
    env("LUME_DASHBOARD_SHA") ??
    "unknown";
  const branch =
    env("GITHUB_HEAD_REF") ??
    env("GITHUB_REF_NAME") ??
    env("LUME_DASHBOARD_BRANCH");
  const prNumber = prFromEvent() ?? prFromRef();
  const workflowUrl =
    repo && env("GITHUB_RUN_ID")
      ? `${server}/${repo}/actions/runs/${env("GITHUB_RUN_ID")}`
      : null;

  return {
    sha,
    branch: branch ?? null,
    prNumber,
    runId,
    workflowUrl,
    repository: repo,
    token: env("GITHUB_TOKEN") ?? env("GH_TOKEN"),
    stepSummaryPath: env("GITHUB_STEP_SUMMARY"),
    isForkPullRequest: forkPullRequest(),
    timestamp: env("LUME_DASHBOARD_TIMESTAMP") ?? new Date().toISOString(),
    ...overrides,
  };
}
