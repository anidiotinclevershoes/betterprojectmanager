import { DASHBOARD_ISSUE_TITLE } from "./schema";

export type GithubIssue = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
};

export type GithubClient = {
  findDashboardIssue(): Promise<GithubIssue | null>;
  createDashboardIssue(body: string): Promise<GithubIssue>;
  updateIssueBody(number: number, body: string, reopen?: boolean): Promise<GithubIssue>;
};

export class GithubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
  }
}

export function createGithubClient(opts: {
  token: string;
  repo: string;
  apiBase?: string;
  fetchImpl?: typeof fetch;
}): GithubClient {
  const apiBase = (opts.apiBase ?? "https://api.github.com").replace(/\/$/, "");
  const fetchImpl = opts.fetchImpl ?? fetch;

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    return fetchImpl(`${apiBase}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${opts.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(init.headers ?? {}),
      },
    });
  }

  async function readIssue(number: number): Promise<GithubIssue> {
    const issueResponse = await request(`/repos/${opts.repo}/issues/${number}`);
    if (!issueResponse.ok) {
      throw new GithubApiError(
        `GitHub issue fetch failed (${issueResponse.status})`,
        issueResponse.status,
        await issueResponse.text(),
      );
    }
    return (await issueResponse.json()) as GithubIssue;
  }

  return {
    async findDashboardIssue() {
      const q = encodeURIComponent(
        `repo:${opts.repo} is:issue in:title "${DASHBOARD_ISSUE_TITLE}"`,
      );
      const response = await request(`/search/issues?q=${q}&per_page=10`);
      if (response.ok) {
        const payload = (await response.json()) as {
          items?: { number: number; title: string }[];
        };
        const match = (payload.items ?? []).find((item) => item.title === DASHBOARD_ISSUE_TITLE);
        if (match) return readIssue(match.number);
      }

      for (let page = 1; page <= 3; page += 1) {
        const listed = await request(
          `/repos/${opts.repo}/issues?state=all&per_page=100&page=${page}`,
        );
        if (!listed.ok) {
          throw new GithubApiError(
            `GitHub issue list failed (${listed.status})`,
            listed.status,
            await listed.text(),
          );
        }
        const items = (await listed.json()) as GithubIssue[];
        const match = items.find((item) => item.title === DASHBOARD_ISSUE_TITLE);
        if (match) return match;
        if (items.length < 100) break;
      }
      return null;
    },

    async createDashboardIssue(body: string) {
      const response = await request(`/repos/${opts.repo}/issues`, {
        method: "POST",
        body: JSON.stringify({
          title: DASHBOARD_ISSUE_TITLE,
          body,
        }),
      });
      if (!response.ok) {
        throw new GithubApiError(
          `GitHub issue create failed (${response.status})`,
          response.status,
          await response.text(),
        );
      }
      return (await response.json()) as GithubIssue;
    },

    async updateIssueBody(number: number, body: string, reopen = false) {
      const payload: { body: string; state?: "open" } = { body };
      if (reopen) payload.state = "open";
      const response = await request(`/repos/${opts.repo}/issues/${number}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new GithubApiError(
          `GitHub issue update failed (${response.status})`,
          response.status,
          await response.text(),
        );
      }
      return (await response.json()) as GithubIssue;
    },
  };
}
