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

type GithubEvent = {
  number?: number;
  pull_request?: {
    number?: number;
    head?: {
      sha?: string;
      ref?: string;
      repo?: { full_name?: string };
    };
  };
  repository?: { full_name?: string };
};

function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function readEvent(): GithubEvent | null {
  const path = env("GITHUB_EVENT_PATH");
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as GithubEvent;
  } catch {
    return null;
  }
}

function prFromEvent(event: GithubEvent | null): number | null {
  const n = event?.pull_request?.number ?? event?.number;
  return typeof n === "number" ? n : null;
}

function forkPullRequest(event: GithubEvent | null): boolean {
  const head = event?.pull_request?.head?.repo?.full_name;
  const base = event?.repository?.full_name;
  return Boolean(head && base && head !== base);
}

function prFromRef(): number | null {
  const ref = env("GITHUB_REF") ?? "";
  const match = ref.match(/refs\/pull\/(\d+)\//);
  return match ? Number(match[1]) : null;
}

function headSha(event: GithubEvent | null): string | null {
  const sha = event?.pull_request?.head?.sha;
  return sha && sha.trim() ? sha.trim() : null;
}

export function readGithubContext(overrides: Partial<GithubRunContext> = {}): GithubRunContext {
  const event = readEvent();
  const server = env("GITHUB_SERVER_URL") ?? "https://github.com";
  const repo = env("GITHUB_REPOSITORY");
  const runId = env("GITHUB_RUN_ID") ?? env("LUME_DASHBOARD_RUN_ID") ?? `local-${Date.now()}`;
  const sha =
    headSha(event) ??
    env("GITHUB_SHA") ??
    env("LUME_DASHBOARD_SHA") ??
    "unknown";
  const branch =
    env("GITHUB_HEAD_REF") ??
    event?.pull_request?.head?.ref ??
    env("GITHUB_REF_NAME") ??
    env("LUME_DASHBOARD_BRANCH");
  const prNumber = prFromEvent(event) ?? prFromRef();
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
    isForkPullRequest: forkPullRequest(event),
    timestamp: env("LUME_DASHBOARD_TIMESTAMP") ?? new Date().toISOString(),
    ...overrides,
  };
}
