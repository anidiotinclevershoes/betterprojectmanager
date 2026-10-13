/**
 * Paired V4/V5 prompt comparison on gpt-6-luna.
 * Not part of npm test. Does not select V5.
 *
 * Spending ceiling: USD 8 of published short-context GPT-6 Luna rates
 * ($0.10 / 1M input, $0.50 / 1M output). The run stops before another call
 * once measured spend reaches that ceiling. If the API omits usage, spend
 * is recorded as unknown rather than estimated.
 *
 * Run: npx tsx scripts/eval-shared-organise-v5.ts
 * Simplified paired run through the preview key:
 *   npx tsx scripts/eval-shared-organise-v5.ts --simple --via preview
 *   LUME_V5_TRIAL_BASE must be the preview that contains this route.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { getOpenAIKey, withOpenAiChatPrivacy } from "../src/lib/openai";
import { SHARED_ORGANISE_MODEL } from "../src/lib/shared-organise/extract";
import {
  SHARED_ORGANISE_PROMPT_VERSION,
  SHARED_ORGANISE_PROMPT_V5_VERSION,
  SHARED_ORGANISE_SYSTEM_MESSAGE,
  buildProjectChangePrompt,
  buildProjectChangePromptV5,
} from "../src/lib/shared-organise/prompt";
import { buildSharedOrganiseContext } from "../src/lib/shared-organise/context";
import { runSharedOrganiseFromModelJson } from "../src/lib/shared-organise/run";
import type { ReviewedChange } from "../src/lib/shared-organise/validate";
import { V5_CASES, type CaseExpect, type V5Case } from "./shared-organise-v5-cases";

const CEILING_USD = 8;
const SIMPLE_IDS = [
  "s20",
  "s27",
  "s29",
  "s31",
  "s44",
  "s52",
  "s53",
  "s82",
  "s95",
  "s96",
  "o-contradiction",
  "o-hedge",
  "o-distinct-name",
  "o-former-date",
  "o-share",
  "o-back",
  "s-share",
];
const USD_PER_TOKEN_IN = 0.1 / 1_000_000;
const USD_PER_TOKEN_OUT = 0.5 / 1_000_000;
const OUT = "/opt/cursor/artifacts";

type Version = "v4" | "v5";

type Score = {
  intended: boolean;
  omission: boolean;
  wrongWrite: boolean;
  unnecessaryNeedsYou: boolean;
  incorrectlyReady: boolean;
  contradictionHandled: boolean | null;
  empty: boolean;
  ready: number;
  needsYou: number;
};

function readyOps(reviewed: ReviewedChange[]) {
  return reviewed.filter((row) => row.label === "Ready" && row.operation);
}

function blob(reviewed: ReviewedChange[]) {
  return readyOps(reviewed)
    .map((row) => JSON.stringify(row.operation).toLowerCase())
    .join("\n");
}

function scoreCase(expect: CaseExpect, reviewed: ReviewedChange[]): Score {
  const ready = readyOps(reviewed);
  const text = blob(reviewed);
  const needsYou = reviewed.filter((row) => row.label === "Needs You").length;
  const empty = reviewed.length === 0 || reviewed.every((row) => row.label === "No change" || row.label === "Left untouched");
  const forbidden = (expect.forbidReadyIncludes ?? []).filter((needle) => text.includes(needle.toLowerCase()));
  const needles = expect.readyIncludes ?? [];
  const needlesMet = needles.every((needle) => text.includes(needle.toLowerCase()));
  const operationMet = !expect.readyOperation || ready.some((row) => row.operation?.type === expect.readyOperation);
  const incorrectlyReady =
    forbidden.length > 0 || ((expect.noReadyWrite || expect.contradiction) && ready.length > 0 && needles.length === 0);
  const wrongWrite = forbidden.length > 0 || (Boolean(expect.noReadyWrite || expect.contradiction) && ready.length > 0);
  const wantedWrite = needles.length > 0;
  const unnecessaryNeedsYou = wantedWrite && !needlesMet && needsYou > 0 && ready.length === 0;
  const omission =
    (wantedWrite && !needlesMet && needsYou === 0) ||
    (Boolean(expect.contradiction) && needsYou === 0) ||
    (Boolean(expect.needsYou) && needsYou === 0 && ready.length === 0 && !expect.contradiction);
  const contradictionHandled = expect.contradiction ? needsYou > 0 && ready.length === 0 : null;
  const intended =
    !wrongWrite &&
    !incorrectlyReady &&
    (expect.contradiction
      ? contradictionHandled === true
      : wantedWrite
        ? needlesMet && operationMet && !unnecessaryNeedsYou
        : ready.length === 0 && (expect.needsYou ? needsYou > 0 : true));
  return {
    intended,
    omission,
    wrongWrite,
    unnecessaryNeedsYou,
    incorrectlyReady,
    contradictionHandled,
    empty,
    ready: ready.length,
    needsYou,
  };
}

type Trial = {
  id: string;
  set: V5Case["set"];
  version: Version;
  trial: number;
  elapsedMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  score: Score;
  reasons: string[];
  error?: string;
};

type CallResult = {
  json: unknown;
  promptTokens: number | null;
  completionTokens: number | null;
  elapsedMs: number;
  promptVersion?: string;
};

const previewJar = new Map<string, string>();

function previewBase() {
  const base = process.env.LUME_V5_TRIAL_BASE?.replace(/\/$/, "") ?? "";
  if (!base) throw new Error("LUME_V5_TRIAL_BASE is not set");
  return base;
}

function storeCookies(response: Response) {
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  for (const cookie of cookies) {
    const pair = cookie.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq > 0) previewJar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

async function previewFetch(path: string, body?: unknown) {
  const headers: Record<string, string> = {
    "x-vercel-protection-bypass": process.env.LUME_E2E_VERCEL_BYPASS_SECRET ?? "",
    "x-vercel-set-bypass-cookie": "true",
  };
  if (body) headers["content-type"] = "application/json";
  const cookie = [...previewJar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
  if (cookie) headers.cookie = cookie;
  const response = await fetch(previewBase() + path, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  storeCookies(response);
  const text = await response.text();
  return { status: response.status, text };
}

async function loginPreview() {
  const warmup = await previewFetch("/");
  if (warmup.status >= 400 && warmup.status !== 307) {
    throw new Error(`preview warmup ${warmup.status}`);
  }
  const login = await previewFetch("/api/auth/login", {
    email: process.env.LUME_E2E_EMAIL ?? "",
    password: process.env.LUME_E2E_PASSWORD ?? "",
  });
  if (login.status !== 200) throw new Error(`preview login ${login.status} ${login.text.slice(0, 120)}`);
}

async function callDirect(prompt: string): Promise<CallResult> {
  const key = getOpenAIKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const started = Date.now();
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(
      withOpenAiChatPrivacy({
        model: SHARED_ORGANISE_MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SHARED_ORGANISE_SYSTEM_MESSAGE },
          { role: "user", content: prompt },
        ],
      }),
    ),
  });
  const elapsedMs = Date.now() - started;
  const text = await response.text();
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${text.replace(/sk-[A-Za-z0-9_-]+/g, "sk-redacted").slice(0, 240)}`);
  const data = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return {
    json: content ? JSON.parse(content) : null,
    promptTokens: data.usage?.prompt_tokens ?? null,
    completionTokens: data.usage?.completion_tokens ?? null,
    elapsedMs,
  };
}

async function callPreview(version: Version, source: string, projectBlock: string): Promise<CallResult> {
  let last = { status: 0, text: "" };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    last = await previewFetch("/api/dev/shared-organise-trial", { version, source, projectBlock });
    if (last.status !== 429) break;
    let retryAt = Number.NaN;
    try {
      retryAt = Date.parse((JSON.parse(last.text) as { retryAt?: string }).retryAt ?? "");
    } catch {
      retryAt = Number.NaN;
    }
    const wait = Math.min(70 * 60 * 1000, Math.max(1500, (Number.isFinite(retryAt) ? retryAt : Date.now() + 15_000) - Date.now() + 1000));
    console.log(`rate limit, waiting ${Math.ceil(wait / 1000)}s`);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  if (last.status !== 200) {
    throw new Error(`preview trial ${last.status}: ${last.text.replace(/sk-[A-Za-z0-9_-]+/g, "sk-redacted").slice(0, 240)}`);
  }
  const data = JSON.parse(last.text) as {
    json?: unknown;
    promptTokens?: number | null;
    completionTokens?: number | null;
    elapsedMs?: number;
    promptVersion?: string;
  };
  return {
    json: data.json ?? null,
    promptTokens: data.promptTokens ?? null,
    completionTokens: data.completionTokens ?? null,
    elapsedMs: data.elapsedMs ?? 0,
    promptVersion: data.promptVersion,
  };
}

function summarise(trials: Trial[], version: Version, set?: V5Case["set"]) {
  const rows = trials.filter((row) => row.version === version && !row.error && (!set || row.set === set));
  const rate = (key: keyof Score) => {
    const relevant = rows.filter((row) => key !== "contradictionHandled" || row.score.contradictionHandled !== null);
    if (!relevant.length) return null;
    const hits = relevant.filter((row) => row.score[key] === true).length;
    return { hits, n: relevant.length };
  };
  const latencies = rows.map((row) => row.elapsedMs).sort((a, b) => a - b);
  const pct = (p: number) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil((p / 100) * latencies.length) - 1)] : null);
  const promptTokens = rows.reduce((sum, row) => sum + (row.promptTokens ?? 0), 0);
  const completionTokens = rows.reduce((sum, row) => sum + (row.completionTokens ?? 0), 0);
  const usageKnown = rows.filter((row) => row.promptTokens != null).length;
  return {
    calls: rows.length,
    intended: rate("intended"),
    omission: rate("omission"),
    wrongWrite: rate("wrongWrite"),
    unnecessaryNeedsYou: rate("unnecessaryNeedsYou"),
    incorrectlyReady: rate("incorrectlyReady"),
    contradictionHandled: rate("contradictionHandled"),
    latencyMs: { median: pct(50), p95: pct(95) },
    tokens: { prompt: promptTokens, completion: completionTokens, callsWithUsage: usageKnown },
    usd: usageKnown
      ? Number((promptTokens * USD_PER_TOKEN_IN + completionTokens * USD_PER_TOKEN_OUT).toFixed(4))
      : null,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const simple = process.argv.includes("--simple");
  const viaPreview = process.argv.includes("--via") && process.argv[process.argv.indexOf("--via") + 1] === "preview";
  if (viaPreview) await loginPreview();
  const trials: Trial[] = [];
  let spent = 0;
  let usageMissing = 0;
  let aborted = "";
  const builders = {
    v4: buildProjectChangePrompt,
    v5: buildProjectChangePromptV5,
  } as const;
  const cases = simple ? V5_CASES.filter((item) => SIMPLE_IDS.includes(item.id)) : V5_CASES;
  if (simple && cases.length !== SIMPLE_IDS.length) {
    throw new Error(`simple set missing ${SIMPLE_IDS.filter((id) => !cases.some((item) => item.id === id)).join(",")}`);
  }

  for (const item of cases) {
    for (const version of ["v4", "v5"] as const) {
      const trialCount = simple ? 1 : item.trials;
      for (let trial = 1; trial <= trialCount; trial += 1) {
        if (spent >= CEILING_USD) {
          aborted = "ceiling";
          break;
        }
        const context = buildSharedOrganiseContext({ world: item.world, projectId: item.projectId, referenceDate: "2026-10-13" });
        try {
          const called = viaPreview
            ? await callPreview(version, item.transcript, context.prompt)
            : await callDirect(builders[version]({ source: item.transcript, projectBlock: context.prompt }));
          if (called.promptVersion && called.promptVersion !== (version === "v5" ? SHARED_ORGANISE_PROMPT_V5_VERSION : SHARED_ORGANISE_PROMPT_VERSION)) {
            throw new Error(`prompt version ${called.promptVersion} did not match ${version}`);
          }
          if (called.promptTokens == null || called.completionTokens == null) usageMissing += 1;
          else spent += called.promptTokens * USD_PER_TOKEN_IN + called.completionTokens * USD_PER_TOKEN_OUT;
          const run = runSharedOrganiseFromModelJson({
            transcript: item.transcript,
            rawModelJson: called.json,
            world: item.world,
            projectId: item.projectId,
            referenceDate: "2026-10-13",
          });
          const score = scoreCase(item.expect, run.reviewed);
          trials.push({
            id: item.id,
            set: item.set,
            version,
            trial,
            elapsedMs: called.elapsedMs,
            promptTokens: called.promptTokens,
            completionTokens: called.completionTokens,
            score,
            reasons: run.reviewed.map((row) => `${row.label}: ${row.reason}`).slice(0, 6),
          });
          console.log(`${item.id} ${version}#${trial} intended=${score.intended} wrong=${score.wrongWrite} ${called.elapsedMs}ms`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          trials.push({
            id: item.id,
            set: item.set,
            version,
            trial,
            elapsedMs: 0,
            promptTokens: null,
            completionTokens: null,
            score: scoreCase(item.expect, []),
            reasons: [],
            error: message,
          });
          console.log(`${item.id} ${version}#${trial} ERROR ${message.slice(0, 180)}`);
          if (message.includes("401") || message.includes("Incorrect API key") || message.includes("not configured")) {
            aborted = "auth";
            break;
          }
        }
      }
      if (aborted) break;
    }
    if (aborted) break;
  }

  const report = {
    ceilingUsd: CEILING_USD,
    spentUsd: Number(spent.toFixed(4)),
    usageMissing,
    aborted,
    model: SHARED_ORGANISE_MODEL,
    versions: { v4: SHARED_ORGANISE_PROMPT_VERSION, v5: SHARED_ORGANISE_PROMPT_V5_VERSION },
    simple,
    via: viaPreview ? "preview" : "direct",
    note: "Replay scores are paired on reconstructed prefixes. They are not the sequential 84/100 live result.",
    bySet: (["replay", "historical", "holdout", "safety"] as const).map((set) => ({
      set,
      v4: summarise(trials, "v4", set),
      v5: summarise(trials, "v5", set),
    })),
    overall: { v4: summarise(trials, "v4"), v5: summarise(trials, "v5") },
    trials,
  };
  writeFileSync(`${OUT}/shared-organise-v5.json`, JSON.stringify(report, null, 2));
  const lines = [
    "# Shared Organise V4 vs V5",
    "",
    aborted ? `Stopped: ${aborted}. Measured spend USD ${report.spentUsd}. Usage missing on ${usageMissing} calls.` : `Measured spend USD ${report.spentUsd}.`,
    "",
    ...report.bySet.flatMap((row) => [
      `## ${row.set}`,
      "",
      `- V4 intended ${JSON.stringify(row.v4.intended)} wrong ${JSON.stringify(row.v4.wrongWrite)} needs-you ${JSON.stringify(row.v4.unnecessaryNeedsYou)} omission ${JSON.stringify(row.v4.omission)}`,
      `- V5 intended ${JSON.stringify(row.v5.intended)} wrong ${JSON.stringify(row.v5.wrongWrite)} needs-you ${JSON.stringify(row.v5.unnecessaryNeedsYou)} omission ${JSON.stringify(row.v5.omission)}`,
      "",
    ]),
  ];
  writeFileSync(`${OUT}/shared-organise-v5.md`, lines.join("\n"));
  console.log(JSON.stringify({ aborted, spent: report.spentUsd, overall: report.overall }, null, 2));
  if (aborted === "auth") process.exit(2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
