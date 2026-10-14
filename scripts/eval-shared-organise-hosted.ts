/**
 * Hosted Shared Organise reliability gate.
 * Uses the flagged preview (server-side model key). Disposable project only.
 * Not part of npm test.
 *
 * Budget: at most 100 Capture calls. Published GPT-6 Luna rates make that
 * well under the USD 25 ceiling set for this qualification.
 *
 * Run: npx tsx scripts/eval-shared-organise-hosted.ts [--limit N]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import { buildReviewChangeViewModels } from "../src/lib/capture/review/viewModel";
import { buildSuggestions } from "../src/lib/capture/suggestions";
import type { MissionState } from "../src/lib/types";
import { GATE_STEPS, type GateStep } from "./shared-organise-gate-steps";

const BASE = "https://betterprojectmanager-ofzlu8opa-tomhughes-s-projects.vercel.app";
const OUT = "/opt/cursor/artifacts";
const BUDGET_CALLS = 100;

type Kind = "correct" | "wrong_write" | "silent_omission" | "unnecessary_needs_you" | "persistence" | "model_error";
type Issue = { kind: Exclude<Kind, "correct">; detail: string };

type Session = { email: string; userId: string; jar: Map<string, string>; retryAt: number };
const sessions: Session[] = [];
let active = 0;
const latencies: number[] = [];
const tokenTotals = { prompt: 0, completion: 0, calls: 0 };

function cookieHeader(jar: Map<string, string>) {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

function store(jar: Map<string, string>, response: Response) {
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const cookie of cookies) {
    const pair = cookie.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

async function callOnce(path: string, options: { method?: string; body?: unknown } = {}) {
  const session = sessions[active]!;
  const headers: Record<string, string> = {
    "x-vercel-protection-bypass": process.env.LUME_E2E_VERCEL_BYPASS_SECRET ?? "",
    "x-vercel-set-bypass-cookie": "true",
  };
  if (options.body) headers["content-type"] = "application/json";
  const cookie = cookieHeader(session.jar);
  if (cookie) headers.cookie = cookie;
  const response = await fetch(BASE + path, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
  });
  store(session.jar, response);
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
}

async function call(path: string, options: { method?: string; body?: unknown } = {}) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const response = await callOnce(path, options);
    if (response.status !== 429) return response;
    const retryAtRaw = (response.json as { retryAt?: string } | null)?.retryAt;
    const retryAt = retryAtRaw ? Date.parse(retryAtRaw) : Date.now() + 60_000;
    sessions[active]!.retryAt = Number.isFinite(retryAt) ? retryAt : Date.now() + 60_000;
    const open = sessions.findIndex((row) => row.retryAt <= Date.now());
    if (open >= 0) {
      active = open;
      console.log(`rate limit, switched to ${sessions[active]!.email}`);
      continue;
    }
    const soonest = Math.min(...sessions.map((row) => row.retryAt));
    const wait = Math.max(0, soonest - Date.now()) + 1500;
    if (wait > 70 * 60 * 1000) {
      return response;
    }
    console.log(`rate limit, waiting ${Math.ceil(wait / 1000)}s`);
    await new Promise((resolve) => setTimeout(resolve, wait));
    active = Math.max(0, sessions.findIndex((row) => row.retryAt <= Date.now()));
  }
  return callOnce(path, options);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stable(item)).sort().join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function linesOf(state: MissionState, projectId: string): string[] {
  const project = state.projects.find((row) => row.id === projectId);
  const people = (project?.stakeholders ?? []).map((row) => `person ${row.id} ${row.name} ${row.role ?? ""}`);
  const todos = state.todos
    .filter((row) => row.projectId === projectId)
    .map((row) => `todo ${row.id} ${row.title} ${row.done === true}`);
  const risks = (state.risks ?? [])
    .filter((row) => row.projectId === projectId)
    .map((row) => `risk ${row.id} ${row.title} ${row.status}`);
  const dates = state.timeline
    .filter((row) => row.projectId === projectId)
    .map((row) => `date ${row.id} ${row.label} ${(row.startAt ?? "").slice(0, 10)}`);
  const knowledge = (state.knowledge ?? [])
    .filter((row) => row.projectId === projectId)
    .flatMap((row) => [
      `sections ${stable(row.sections)}`,
      ...(row.structured ?? []).map((item) => `structured ${item.id} ${item.lifecycle} ${item.body}`),
    ]);
  return [...people, ...todos, ...risks, ...dates, ...knowledge].map((row) => row.toLowerCase()).sort();
}

function snapshot(state: MissionState, projectId: string) {
  return JSON.stringify(linesOf(state, projectId));
}

function diffLines(before: MissionState, after: MissionState, projectId: string) {
  const prior = new Set(linesOf(before, projectId));
  return linesOf(after, projectId).filter((line) => !prior.has(line));
}

function removed(before: MissionState, after: MissionState, projectId: string) {
  const next = new Set(linesOf(after, projectId));
  return linesOf(before, projectId).filter((line) => !next.has(line));
}

function grounded(line: string, transcript: string, needles: string[]) {
  const hay = line.toLowerCase();
  if (needles.some((needle) => hay.includes(needle.toLowerCase()))) return true;
  const words = transcript.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3);
  return words.filter((word) => hay.includes(word)).length >= 2;
}

function worst(issues: Issue[]): Kind {
  if (issues.some((row) => row.kind === "wrong_write")) return "wrong_write";
  if (issues.some((row) => row.kind === "persistence")) return "persistence";
  if (issues.some((row) => row.kind === "silent_omission")) return "silent_omission";
  if (issues.some((row) => row.kind === "unnecessary_needs_you")) return "unnecessary_needs_you";
  if (issues.some((row) => row.kind === "model_error")) return "model_error";
  return "correct";
}

function judge(step: GateStep, before: MissionState, after: MissionState, projectId: string, surfaced: boolean): Issue[] {
  const issues: Issue[] = [];
  const added = diffLines(before, after, projectId);
  const gone = removed(before, after, projectId);
  const blob = added.join("\n");
  const needles = step.creates ?? [];
  if (step.hold) {
    if (added.length || (step.removes ?? []).some((needle) => gone.some((line) => line.includes(needle)))) {
      issues.push({ kind: "wrong_write", detail: `held step changed canonical truth: ${added.slice(0, 2).join(" | ")}` });
    } else if (step.hold === "needs_you" && !surfaced) {
      issues.push({ kind: "silent_omission", detail: "ambiguous input produced no review card and no write" });
    }
  }
  for (const needle of needles) {
    if (!blob.includes(needle.toLowerCase())) {
      issues.push({
        kind: surfaced ? "unnecessary_needs_you" : "silent_omission",
        detail: `missing canonical result for ${needle}`,
      });
    }
  }
  for (const needle of step.removes ?? []) {
    const wasThere = linesOf(before, projectId).some((line) => line.includes(needle.toLowerCase()));
    const stillThere = linesOf(after, projectId).some((line) => line.includes(needle.toLowerCase()));
    if (wasThere && stillThere) {
      issues.push({
        kind: surfaced ? "unnecessary_needs_you" : "silent_omission",
        detail: `${needle} was not removed`,
      });
    }
    if (!wasThere && added.length) {
      issues.push({ kind: "wrong_write", detail: `delete wrote without ${needle}` });
    }
  }
  for (const needle of step.forbid ?? []) {
    if (blob.includes(needle.toLowerCase())) issues.push({ kind: "wrong_write", detail: `forbidden write ${needle}` });
  }
  for (const line of added) {
    if (line.startsWith("person ") && /\b(someone|somebody|she|he|they)\b/.test(line)) {
      issues.push({ kind: "wrong_write", detail: `generic person written: ${line}` });
    }
    if (!grounded(line, step.transcript, [...needles, ...(step.removes ?? [])])) {
      issues.push({ kind: "wrong_write", detail: `ungrounded write: ${line.slice(0, 180)}` });
    }
  }
  const duplicateKeys = (lines: string[]) => {
    const seen = new Map<string, number>();
    for (const prefix of ["todo ", "risk ", "person ", "date "]) {
      for (const line of lines.filter((row) => row.startsWith(prefix))) {
        const title = line.split(" ").slice(2, -1).join(" ");
        if (!title) continue;
        const key = `${prefix}${title}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
    return [...seen.entries()].filter(([, count]) => count > 1).map(([key]) => key);
  };
  const priorDupes = new Set(duplicateKeys(linesOf(before, projectId)));
  for (const key of duplicateKeys(linesOf(after, projectId))) {
    if (!priorDupes.has(key)) issues.push({ kind: "wrong_write", detail: `duplicate ${key}` });
  }
  return issues;
}

async function main() {
  const runStartedAt = new Date().toISOString();
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit"));
  const limit = limitArg ? Number(process.argv[process.argv.indexOf(limitArg) + 1] ?? GATE_STEPS.length) : GATE_STEPS.length;
  const steps = GATE_STEPS.slice(0, Math.min(limit, BUDGET_CALLS));
  if (GATE_STEPS.length !== 100) throw new Error(`expected 100 frozen steps, found ${GATE_STEPS.length}`);
  mkdirSync(OUT, { recursive: true });
  const file = process.env.GATE_USERS_FILE ?? "";
  const accounts: Array<{ email: string; password: string; userId?: string }> = file
    ? (JSON.parse(await (await import("node:fs/promises")).readFile(file, "utf8")) as Array<{ email: string; password: string; userId?: string }>)
    : [{ email: process.env.LUME_E2E_EMAIL ?? "", password: process.env.LUME_E2E_PASSWORD ?? "" }];
  if (!accounts.length || accounts.some((row) => !row.email || !row.password)) {
    throw new Error("missing disposable credentials");
  }
  for (const account of accounts) {
    const session: Session = { email: account.email, userId: account.userId ?? "", jar: new Map(), retryAt: 0 };
    sessions.push(session);
    active = sessions.length - 1;
    const warmup = await callOnce("/");
    if (warmup.status >= 400 && warmup.status !== 307) throw new Error(`warmup ${warmup.status}`);
    const login = await callOnce("/api/auth/login", { method: "POST", body: { email: account.email, password: account.password } });
    if (login.status !== 200) throw new Error(`login ${account.email} ${login.status} ${login.text.slice(0, 120)}`);
  }
  active = 0;
  const created = await call("/api/workspace/projects", {
    method: "POST",
    body: {
      input: {
        name: `E2E-SO-GATE-${new Date().toISOString().replace(/[:.]/g, "-")}`,
        code: `SG${Date.now().toString(36).slice(-6).toUpperCase()}`,
        summary: "Disposable Shared Organise reliability gate",
        currentFocus: "Gate",
        sourceMode: "blank",
      },
    },
  });
  const createdBody = created.json as { projectId?: string; state?: MissionState } | null;
  const projectId = createdBody?.projectId ?? "";
  if (created.status !== 200 || !projectId || !createdBody?.state) {
    throw new Error(`create ${created.status} ${created.text.slice(0, 180)}`);
  }
  let state = createdBody.state;
  let historyCount = (state.history ?? []).filter((row) => row.projectId === projectId).length;
  const siblingBefore = new Map<string, string>();
  for (const project of state.projects) {
    if (project.id !== projectId) siblingBefore.set(project.id, snapshot(state, project.id));
  }
  console.log(`project ${projectId} siblings ${siblingBefore.size} steps ${steps.length}`);
  const supabaseHeaders =
    process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL
      ? {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        }
      : null;
  const supabaseRoot = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  let workspaceId = "";
  if (supabaseHeaders) {
    const projectResponse = await fetch(`${supabaseRoot}/rest/v1/projects?id=eq.${projectId}&select=workspace_id`, {
      headers: supabaseHeaders,
    });
    if (projectResponse.ok) {
      workspaceId = ((await projectResponse.json()) as Array<{ workspace_id?: string }>)[0]?.workspace_id ?? "";
    }
    if (workspaceId) {
      for (const session of sessions.slice(1)) {
        if (!session.userId) continue;
        await fetch(`${supabaseRoot}/rest/v1/workspace_members`, {
          method: "POST",
          headers: { ...supabaseHeaders, "content-type": "application/json", Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify({ workspace_id: workspaceId, user_id: session.userId, role: "member" }),
        });
      }
    }
  }
  const siblingHistory = async () => {
    if (!supabaseHeaders || !workspaceId) return [] as Array<{ project_id?: string; type?: string; title?: string; created_at?: string }>;
    const endpoint = `${supabaseRoot}/rest/v1/history_events?select=project_id,type,title,created_at&workspace_id=eq.${workspaceId}&created_at=gte.${encodeURIComponent(runStartedAt)}&project_id=neq.${projectId}&order=created_at.desc&limit=20`;
    const response = await fetch(endpoint, { headers: supabaseHeaders });
    if (!response.ok) return [];
    return (await response.json()) as Array<{ project_id?: string; type?: string; title?: string; created_at?: string }>;
  };

  const rows: Array<Record<string, unknown>> = [];
  let calls = 0;
  let abort = "";
  for (const step of steps) {
    calls += 1;
    const started = Date.now();
    let capture = await call("/api/capture", {
      method: "POST",
      body: { content: step.transcript, projectId, sourceType: "paste" },
    });
    if (capture.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      capture = await call("/api/capture", {
        method: "POST",
        body: { content: step.transcript, projectId, sourceType: "paste" },
      });
    }
    const elapsedMs = Date.now() - started;
    latencies.push(elapsedMs);
    const body = capture.json as {
      result?: import("../src/lib/types").CaptureResult;
      provenance?: { responseModel?: string; promptVersion?: string };
      sharedOrganise?: boolean;
      usagePrompt?: number | null;
      usageCompletion?: number | null;
    } | null;
    if (typeof body?.usagePrompt === "number") {
      tokenTotals.prompt += body.usagePrompt;
      tokenTotals.completion += body.usageCompletion ?? 0;
      tokenTotals.calls += 1;
    }
    if (capture.status !== 200 || !body?.result) {
      rows.push({ id: step.id, primary: "model_error", detail: `capture ${capture.status}`, elapsedMs });
      console.log(`${step.id} model_error ${capture.status} ${elapsedMs}ms`);
      continue;
    }
    if (body.provenance?.responseModel && body.provenance.responseModel !== "gpt-6-luna") {
      abort = `model ${body.provenance.responseModel}`;
      break;
    }
    const scoped: MissionState = {
      ...state,
      projects: state.projects.filter((row) => row.id === projectId),
      todos: state.todos.filter((row) => row.projectId === projectId),
      risks: (state.risks ?? []).filter((row) => row.projectId === projectId),
      timeline: state.timeline.filter((row) => row.projectId === projectId),
      knowledge: (state.knowledge ?? []).filter((row) => row.projectId === projectId),
    };
    const world = captureApplyWorldFromState(scoped);
    const suggestions = buildSuggestions(body.result);
    const cards = buildReviewChangeViewModels(suggestions, body.result, step.transcript, {}, {
      world,
      captureEntryProjectId: projectId,
    });
    const surfaced = cards.some((card) => card.readiness !== "ready");
    let wrote = 0;
    let applyRefused = 0;
    let immediateMismatch = 0;
    const applyNotes: string[] = [];
    for (const card of cards) {
      if (!(card.readiness === "ready" && card.canApprove)) continue;
      const applied = await call("/api/capture/apply", {
        method: "POST",
        body: {
          projectId,
          item: card.suggestion,
          text: step.transcript,
          expectedTarget: card.suggestion.expectedTarget ?? null,
        },
      });
      const appliedBody = applied.json as { executed?: { kind?: string }; state?: MissionState } | null;
      if (applied.status !== 200 || appliedBody?.executed?.kind !== "wrote") {
        applyRefused += 1;
        const kind = appliedBody?.executed?.kind ?? `http ${applied.status}`;
        applyNotes.push(kind);
        continue;
      }
      wrote += 1;
      if (appliedBody.state) {
        const fresh = await call("/api/workspace/state");
        const freshState = (fresh.json as { state?: MissionState } | null)?.state;
        if (freshState && snapshot(appliedBody.state, projectId) !== snapshot(freshState, projectId)) {
          immediateMismatch += 1;
          state = freshState;
        } else if (freshState) state = freshState;
        else state = appliedBody.state;
      }
    }
    if (wrote === 0) {
      const fresh = await call("/api/workspace/state");
      const freshState = (fresh.json as { state?: MissionState } | null)?.state;
      if (freshState) state = freshState;
    }
    const issues = judge(step, scoped, state, projectId, surfaced);
    const historyForProject = (state.history ?? []).filter((row) => row.projectId === projectId).length;
    if (wrote > 0 && historyForProject < historyCount + wrote) {
      issues.push({
        kind: "persistence",
        detail: `history grew ${historyForProject - historyCount} for ${wrote} writes`,
      });
    }
    historyCount = historyForProject;
    if (applyRefused && wrote === 0) {
      issues.push({ kind: "persistence", detail: `${applyRefused} ready card(s) refused at Apply (${applyNotes.join(", ")})` });
    }
    if (immediateMismatch) issues.push({ kind: "persistence", detail: "apply response and fresh reload disagreed" });
    const siblingNoise: string[] = [];
    for (const [id, prior] of siblingBefore) {
      const next = snapshot(state, id);
      if (next === prior) continue;
      const priorLines = new Set(JSON.parse(prior) as string[]);
      const nextLines = JSON.parse(next) as string[];
      const changed = [
        ...nextLines.filter((line) => !priorLines.has(line)),
        ...[...priorLines].filter((line) => !nextLines.includes(line)).map((line) => `removed ${line}`),
      ];
      siblingNoise.push(`${id.slice(0, 8)}:${changed[0]?.slice(0, 120) ?? "changed"}`);
      siblingBefore.set(id, next);
    }
    const foreignHistory = await siblingHistory();
    if (foreignHistory.length) {
      const hit = foreignHistory[0]!;
      issues.push({
        kind: "wrong_write",
        detail: `history on ${hit.project_id} during this run: ${hit.type ?? ""} ${hit.title ?? ""}`.slice(0, 220),
      });
      abort = `history ${hit.project_id}`;
    }
    const primary = worst(issues);
    rows.push({
      id: step.id,
      primary,
      wrote,
      surfaced,
      elapsedMs,
      labels: cards.map((card) => card.readiness),
      issues,
      siblingNoise,
      applyNotes,
    });
    console.log(`${step.id} ${primary} wrote=${wrote} ${elapsedMs}ms`);
    if (abort) break;
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const pct = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] : 0);
  const tally: Record<string, number> = {};
  for (const row of rows) tally[String(row.primary)] = (tally[String(row.primary)] ?? 0) + 1;
  const siblingWrites = await siblingHistory();
  const report = {
    base: BASE,
    projectId,
    runStartedAt,
    calls,
    siblingWritesDuringRun: siblingWrites,
    budgetCalls: BUDGET_CALLS,
    aborted: abort,
    latencyMs: { median: pct(50), p95: pct(95), max: pct(100) },
    tokens: tokenTotals,
    accounts: sessions.length,
    tally,
    rows,
  };
  writeFileSync(`${OUT}/shared-organise-hosted.json`, JSON.stringify(report, null, 2));
  const md = [
    `# Hosted Shared Organise gate`,
    ``,
    `Project \`${projectId}\`. Calls ${calls}. Median ${pct(50)}ms. p95 ${pct(95)}ms.`,
    abort ? `Aborted: ${abort}` : `Completed ${rows.length} steps.`,
    ``,
    "```",
    JSON.stringify(tally, null, 2),
    "```",
    ``,
    ...rows
      .filter((row) => row.primary !== "correct")
      .map((row) => {
        const issues = (row.issues as Issue[] | undefined) ?? [];
        return `- ${row.id} **${row.primary}** — ${issues.map((issue) => issue.detail).join("; ") || row.detail || ""}`;
      }),
  ];
  writeFileSync(`${OUT}/shared-organise-hosted.md`, md.join("\n"));
  console.log(JSON.stringify({ projectId, calls, tally, latency: report.latencyMs, abort }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
