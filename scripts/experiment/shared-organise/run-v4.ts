/**
 * Form v4 closure run: material uncertainty and unresolved direction.
 * Does not modify production Capture or New Project.
 * Does not write canonical truth.
 *
 * Run: npx tsx scripts/experiment/shared-organise/run-v4.ts
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { getOpenAIKey } from "@/lib/openai";
import { closureCases, closureSmokeCases } from "./closure-corpus";
import { buildSharedOrganiseContext } from "./context";
import type { OrganiseCase } from "./corpus-v2";
import { SHARED_ORGANISE_PROMPT_VERSION } from "./form";
import { SHARED_ORGANISE_SYSTEM_MESSAGE, buildProjectChangePrompt } from "./prompt";
import { scoreCaseRun } from "./score";
import { runSharedOrganiseSelfCheck } from "./self-check";
import { parseProjectChangeForm, reviewProjectChangeForm } from "./validate";

const LUNA = "gpt-6-luna";
const OUT = "scripts/experiment/shared-organise/results/shared-organise-v4.json";

type CallResult = {
  requestedModel: string;
  responseModel: string | null;
  latencyMs: number;
  usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
  } | null;
  error: string | null;
  rawJson: unknown;
};

type Job = { testCase: OrganiseCase; run: number };

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function complete(userPrompt: string): Promise<CallResult> {
  const key = getOpenAIKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const body = {
    model: LUNA,
    store: false,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SHARED_ORGANISE_SYSTEM_MESSAGE },
      { role: "user", content: userPrompt },
    ],
  };
  let lastError = "OpenAI failed";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const started = Date.now();
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const latencyMs = Date.now() - started;
    const detail = await response.text();
    if (response.status === 429 || response.status >= 500) {
      lastError = `OpenAI failed (${response.status}): ${detail.slice(0, 300)}`;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      continue;
    }
    if (!response.ok) {
      return {
        requestedModel: LUNA,
        responseModel: null,
        latencyMs,
        usage: null,
        error: `OpenAI failed (${response.status}): ${detail.slice(0, 500)}`,
        rawJson: null,
      };
    }
    const data = JSON.parse(detail) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: CallResult["usage"] & {
        completion_tokens_details?: { reasoning_tokens?: number };
      };
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    return {
      requestedModel: LUNA,
      responseModel: data.model ?? null,
      latencyMs,
      usage: data.usage
        ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens,
            reasoning_tokens: data.usage.completion_tokens_details?.reasoning_tokens ?? 0,
          }
        : null,
      error: null,
      rawJson: parseJsonObject(text),
    };
  }
  return {
    requestedModel: LUNA,
    responseModel: null,
    latencyMs: 0,
    usage: null,
    error: lastError,
    rawJson: null,
  };
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function tally(rows: Array<{ reviewLabels: Record<string, number> }>) {
  const totals = { Ready: 0, "Needs You": 0, "Left untouched": 0, "No change": 0 };
  for (const row of rows) {
    for (const [label, count] of Object.entries(row.reviewLabels)) {
      if (label in totals) totals[label as keyof typeof totals] += count;
    }
  }
  return totals;
}

async function main() {
  runSharedOrganiseSelfCheck();
  const cases = [...closureCases(), ...closureSmokeCases()];
  const jobs: Job[] = cases.flatMap((testCase) =>
    Array.from({ length: testCase.runs ?? 1 }, (_, index) => ({ testCase, run: index + 1 })),
  );
  const sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  console.log(`form v4 cases=${cases.length} calls=${jobs.length}`);
  const started = Date.now();
  let done = 0;
  const rows = await mapPool(jobs, 4, async (job) => {
    const context = buildSharedOrganiseContext({
      world: job.testCase.world,
      projectId: job.testCase.projectId,
    });
    const call = await complete(
      buildProjectChangePrompt({ source: job.testCase.source, projectBlock: context.prompt }),
    );
    const form = parseProjectChangeForm(call.rawJson);
    const review = call.error
      ? []
      : reviewProjectChangeForm({ form, context, source: job.testCase.source });
    const score = scoreCaseRun({
      context,
      review,
      sufficient: job.testCase.sufficient,
      hoped: job.testCase.hoped,
      unsafe: job.testCase.unsafe,
      unsafeAnyReady: job.testCase.unsafeAnyReady,
      wrongCreate: job.testCase.wrongCreate,
      wrongDomain: job.testCase.wrongDomain,
      contamination: job.testCase.contamination,
      roleUpdateUnsupported: job.testCase.roleUpdateUnsupported,
      onlyReadyDate: job.testCase.onlyReadyDate,
      allowedReadyDates: job.testCase.allowedReadyDates,
      noReadyMilestone: job.testCase.noReadyMilestone,
    });
    done += 1;
    if (done % 10 === 0 || score.flags.includes("unsafe_ready") || call.error) {
      console.log(
        `${done}/${jobs.length} ${job.testCase.id}#${job.run} ${call.error ? "ERROR" : score.flags.join(",") || "ok"} ${call.latencyMs}ms`,
      );
    }
    return {
      caseId: job.testCase.id,
      title: job.testCase.title,
      group: job.testCase.group,
      critical: job.testCase.critical,
      run: job.run,
      intent: job.testCase.intent,
      sufficient: job.testCase.sufficient,
      responseModel: call.responseModel,
      latencyMs: call.latencyMs,
      usage: call.usage,
      error: call.error,
      rawJson: call.rawJson,
      modelOperations: form.changes.map((change) => ({
        id: change.id,
        outcome: change.outcome,
        operation: change.operation,
        targetId: change.targetId,
        evidence: change.evidence.slice(0, 240),
        materialUncertainty: change.materialUncertainty,
        values: change.values,
      })),
      review: review.map((row) => ({
        id: row.id,
        label: row.label,
        domain: row.domain,
        modelOutcome: row.modelOutcome,
        modelOperation: row.modelOperation,
        operationType: row.operation?.type ?? null,
        operation: row.operation,
        reason: row.reason,
        safety: row.safety,
        evidence: row.evidence.slice(0, 240),
      })),
      reviewLabels: score.labels,
      score,
    };
  });

  const byCase = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byCase.get(row.caseId) ?? [];
    list.push(row);
    byCase.set(row.caseId, list);
  }
  const caseSummaries = cases.map((testCase) => {
    const runs = byCase.get(testCase.id) ?? [];
    const flagCounts: Record<string, number> = {};
    const readySignatures = new Set<string>();
    for (const run of runs) {
      for (const flag of run.score.flags) flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
      readySignatures.add(run.score.readyTypes.join("+") || "(none)");
    }
    return {
      id: testCase.id,
      group: testCase.group,
      critical: testCase.critical,
      runs: runs.length,
      errors: runs.filter((run) => run.error).length,
      labels: tally(runs),
      flagCounts,
      readySignatures: [...readySignatures],
      unsafeRuns: runs
        .filter((run) => run.score.unsafe.length)
        .map((run) => ({ run: run.run, unsafe: run.score.unsafe })),
    };
  });

  const payload = {
    promptVersion: SHARED_ORGANISE_PROMPT_VERSION,
    model: LUNA,
    temperature: null,
    store: false,
    referenceDate: "2026-10-03",
    branch,
    startingSha: sha,
    elapsedMs: Date.now() - started,
    calls: jobs.length,
    totals: tally(rows),
    usage: rows.reduce(
      (sum, row) => ({
        prompt: sum.prompt + (row.usage?.prompt_tokens ?? 0),
        completion: sum.completion + (row.usage?.completion_tokens ?? 0),
        reasoning: sum.reasoning + (row.usage?.reasoning_tokens ?? 0),
      }),
      { prompt: 0, completion: 0, reasoning: 0 },
    ),
    unsafeRunCount: rows.filter((row) => row.score.flags.includes("unsafe_ready")).length,
    frictionRunCount: rows.filter((row) => row.score.flags.includes("avoidable_friction")).length,
    caseSummaries,
    rows,
  };
  mkdirSync("scripts/experiment/shared-organise/results", { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(
    `wrote ${OUT} elapsed=${payload.elapsedMs} unsafeRuns=${payload.unsafeRunCount} frictionRuns=${payload.frictionRunCount}`,
  );
  console.log(JSON.stringify(payload.totals));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
