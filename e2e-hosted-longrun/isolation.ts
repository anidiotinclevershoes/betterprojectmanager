import type { Page } from "@playwright/test";
import type { CanonicalSlice } from "./types";

const SYNTHETIC_NAME = /e2e|hv-|ho-|lr[0-9a-z]|longrun|hosted|dogfood|holdout/i;
const FORBIDDEN_CUSTOMER = /candyland|toyworld|gamingstudio5000|acme corp|live client/i;

export type IsolationProof = {
  ok: boolean;
  userId?: string;
  workspaceId?: string;
  emailDomainOk: boolean;
  projectCount: number;
  projectNames: string[];
  suspiciousNames: string[];
  reason?: string;
};

export async function readWorkspaceState(page: Page): Promise<{
  workspaceId?: string;
  userId?: string;
  projectCount?: number;
  state?: {
    projects?: Array<{ id: string; name: string; code?: string }>;
  };
  status: number;
}> {
  return page.evaluate(async () => {
    const res = await fetch("/api/workspace/state", { credentials: "include", cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as {
      workspaceId?: string;
      userId?: string;
      projectCount?: number;
      state?: { projects?: Array<{ id: string; name: string; code?: string }> };
    };
    return { ...json, status: res.status };
  });
}

export async function proveIsolation(page: Page, email: string): Promise<IsolationProof> {
  const domain = (email.split("@")[1] || "").toLowerCase();
  const emailDomainOk = domain === "lume.com" || domain.endsWith(".test") || /e2e|test|dogfood/.test(email);
  const ws = await readWorkspaceState(page);
  if (ws.status !== 200 || !ws.userId) {
    return {
      ok: false,
      emailDomainOk,
      projectCount: 0,
      projectNames: [],
      suspiciousNames: [],
      reason: `workspace state HTTP ${ws.status} — cannot prove isolation`,
    };
  }
  const names = (ws.state?.projects ?? []).map((p) => p.name);
  const forbidden = names.filter((name) => FORBIDDEN_CUSTOMER.test(name));
  const suspiciousNames = names.filter((name) => !SYNTHETIC_NAME.test(name));
  // Known customer-dogfood worlds on this identity are a hard stop.
  if (forbidden.length) {
    return {
      ok: false,
      userId: ws.userId,
      workspaceId: ws.workspaceId,
      emailDomainOk,
      projectCount: names.length,
      projectNames: names,
      suspiciousNames: forbidden,
      reason: "Workspace contains known non-E2E dogfood/customer project names",
    };
  }
  if (!emailDomainOk) {
    return {
      ok: false,
      userId: ws.userId,
      workspaceId: ws.workspaceId,
      emailDomainOk,
      projectCount: names.length,
      projectNames: names,
      suspiciousNames,
      reason: "Test identity email does not look like a dedicated E2E account",
    };
  }
  return {
    ok: true,
    userId: ws.userId,
    workspaceId: ws.workspaceId,
    emailDomainOk,
    projectCount: names.length,
    projectNames: names,
    suspiciousNames: [],
  };
}

export function siblingFingerprint(state: {
  projects?: Array<{ id: string; name: string }>;
  todos?: Array<{ id: string; projectId?: string | null; title: string; done?: boolean }>;
  risks?: Array<{ id: string; projectId: string; title: string; status: string }>;
  timeline?: Array<{ id: string; projectId: string; label: string; startAt: string }>;
}, dedicatedProjectId: string): string {
  const others = (state.projects ?? []).filter((p) => p.id !== dedicatedProjectId);
  const rows = others.map((p) => {
    const todos = (state.todos ?? []).filter((t) => t.projectId === p.id).map((t) => `${t.id}:${t.title}:${t.done}`);
    const risks = (state.risks ?? []).filter((r) => r.projectId === p.id).map((r) => `${r.id}:${r.title}:${r.status}`);
    const dates = (state.timeline ?? []).filter((m) => m.projectId === p.id).map((m) => `${m.id}:${m.label}:${m.startAt}`);
    return `${p.id}|${p.name}|t=${todos.sort().join(",")}|r=${risks.sort().join(",")}|d=${dates.sort().join(",")}`;
  });
  return rows.sort().join("\n");
}

export function assertStillIsolated(slice: CanonicalSlice, dedicatedProjectId: string): string | undefined {
  if (slice.projectId !== dedicatedProjectId) {
    return `CROSS_PROJECT_ISOLATION: snapshot project ${slice.projectId} is not the dedicated long-run project`;
  }
  const leaked = slice.otherProjectNames.filter((name) => FORBIDDEN_CUSTOMER.test(name));
  if (leaked.length) return `CROSS_PROJECT_ISOLATION: customer-like project names visible: ${leaked.join(", ")}`;
  return undefined;
}
