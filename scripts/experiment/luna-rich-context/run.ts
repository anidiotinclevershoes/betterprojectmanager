/**
 * Isolated Luna vs Mini context experiment.
 * Does not modify production Capture. Never writes canonical truth.
 *
 * A: pinned Mini, Prompt A, thin context, production resolver
 * B: gpt-6-luna, Prompt A, thin context, production resolver
 * C: gpt-6-luna, Prompt A, richer evidence block, production resolver
 *
 * Luna rejects temperature 0.2. The call omits temperature (provider default).
 * Prompt text, schema, and downstream gates are unchanged.
 *
 * Run: npx tsx scripts/experiment/luna-rich-context/run.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
  runCaptureV2FromModelJson,
} from "@/lib/capture-v2";
import {
  CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
  CAPTURE_V2_PROMPT_VERSION,
  buildObservationExtractionPrompt,
} from "@/lib/capture-v2/prompt";
import { PINNED_OPENAI_CHAT_MODEL } from "@/lib/openai-model";
import { getOpenAIKey } from "@/lib/openai";
import { namesMatchExact } from "@/lib/people/identity";
import { evaluateAgainstCase } from "@/lib/eval-capture-v2/pipeline";
import type { CaptureObservationV2 } from "@/lib/capture-v2/types";
import type { CaptureApplyDecision } from "@/lib/capture/apply";
import { experimentCases, type ExperimentCase } from "./cases";
import {
  EXPERIMENT_REFERENCE_DATE,
  formatRichCanonicalContext,
} from "./rich-context";

const LUNA_MODEL = "gpt-6-luna";
const OUT_DIR = "scripts/experiment/luna-rich-context/results";

type ConditionId = "A" | "B" | "C";

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
  temperature: number | null;
};

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

async function complete(args: {
  model: string;
  temperature: number | null;
  userPrompt: string;
}): Promise<CallResult> {
  const key = getOpenAIKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const body: Record<string, unknown> = {
    model: args.model,
    store: false,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE },
      { role: "user", content: args.userPrompt },
    ],
  };
  if (args.temperature != null) body.temperature = args.temperature;
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
  if (!response.ok) {
    return {
      requestedModel: args.model,
      responseModel: null,
      latencyMs,
      usage: null,
      error: `OpenAI failed (${response.status}): ${detail.slice(0, 500)}`,
      rawJson: null,
      temperature: args.temperature,
    };
  }
  const data = JSON.parse(detail) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return {
    requestedModel: args.model,
    responseModel: data.model ?? null,
    latencyMs,
    usage: data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens,
          reasoning_tokens: data.usage.completion_tokens_details?.reasoning_tokens,
        }
      : null,
    error: content ? null : "empty completion",
    rawJson: content ? parseJsonObject(content) : null,
    temperature: args.temperature,
  };
}

function projectBlock(testCase: ExperimentCase, condition: ConditionId): string {
  const project = testCase.world.projects.find((p) => p.id === testCase.projectId);
  if (!project) return "Current project: (unscoped)\nAuthoritative current records:\n(none)";
  if (condition === "C") {
    return formatRichCanonicalContext({
      world: testCase.world,
      projectId: testCase.projectId,
      referenceDate: EXPERIMENT_REFERENCE_DATE,
    });
  }
  const records = contextRecordsFromWorld(testCase.world, testCase.projectId);
  return formatAuthoritativeStateForPrompt(records, project);
}

function asObservations(raw: unknown): CaptureObservationV2[] {
  const obj = raw && typeof raw === "object" ? (raw as { observations?: unknown }) : null;
  const list = Array.isArray(obj?.observations) ? obj!.observations : [];
  return list.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const str = (value: unknown) => (typeof value === "string" ? value : "");
    return [
      {
        id: str(row.id) || `obs-${index + 1}`,
        statement: str(row.statement),
        evidence: str(row.evidence),
        domain: str(row.domain) as CaptureObservationV2["domain"],
        disposition: str(row.disposition) as CaptureObservationV2["disposition"],
        truthIntent: (str(row.truthIntent) || "uncertain") as CaptureObservationV2["truthIntent"],
        projectId: str(row.projectId) || null,
        candidateTargetId: str(row.candidateTargetId) || null,
        candidateTargetTitle: str(row.candidateTargetTitle) || null,
        mergeWithObservationId: str(row.mergeWithObservationId) || null,
        proposedValues:
          row.proposedValues && typeof row.proposedValues === "object"
            ? (row.proposedValues as Record<string, unknown>)
            : null,
        commentary: str(row.commentary) || null,
        modelConfidence: typeof row.modelConfidence === "number" ? row.modelConfidence : null,
      },
    ];
  });
}

function decisionLabel(decision: CaptureApplyDecision, disposition: string): string {
  if (disposition === "left_untouched") return "Left untouched";
  if (decision.kind === "needs_you") return "Needs You";
  if (decision.kind === "no_change") return "No change";
  if (decision.kind !== "write") return decision.kind;
  const op = decision.operation.type;
  if (op.startsWith("create") || op === "ensure_person" || op === "confirm_responsibility" || op === "write_knowledge" || op === "write_availability" || op === "write_memory") {
    return `Ready ${op}`;
  }
  if (op.startsWith("delete") || op.includes("remove")) return `Ready Remove ${op}`;
  return `Ready ${op}`;
}

function knownIds(testCase: ExperimentCase): Set<string> {
  return new Set(contextRecordsFromWorld(testCase.world, testCase.projectId).map((row) => row.id));
}

function allIds(testCase: ExperimentCase): Map<string, string> {
  const map = new Map<string, string>();
  for (const project of testCase.world.projects) {
    map.set(project.id, project.id);
    for (const person of project.stakeholders) map.set(person.id, project.id);
  }
  for (const risk of testCase.world.risks) map.set(risk.id, risk.projectId);
  for (const todo of testCase.world.todos) if (todo.projectId) map.set(todo.id, todo.projectId);
  for (const item of testCase.world.timeline) map.set(item.id, item.projectId);
  return map;
}

type SafetyFlag =
  | "wrong_existing_person"
  | "duplicate_person"
  | "invented_stable_id"
  | "cross_project_binding"
  | "destructive_operation"
  | "unsupported_write";

function safetyFlags(testCase: ExperimentCase, raw: CaptureObservationV2[], decisions: Array<{ decision: CaptureApplyDecision; disposition: string; statement: string }>): SafetyFlag[] {
  const flags = new Set<SafetyFlag>();
  const inProject = knownIds(testCase);
  const anywhere = allIds(testCase);
  const people =
    testCase.world.projects.find((p) => p.id === testCase.projectId)?.stakeholders ?? [];
  for (const obs of raw) {
    const id = obs.candidateTargetId?.trim();
    if (!id) continue;
    if (!anywhere.has(id)) flags.add("invented_stable_id");
    else if (anywhere.get(id) !== testCase.projectId) flags.add("cross_project_binding");
    else if (!inProject.has(id)) flags.add("invented_stable_id");
  }
  for (const row of decisions) {
    if (row.decision.kind !== "write") continue;
    const op = row.decision.operation;
    if (op.type === "delete_todo") flags.add("destructive_operation");
    if (op.type === "ensure_person") {
      if (people.some((person) => namesMatchExact(person.name, op.name))) {
        flags.add("duplicate_person");
      }
    }
    if (op.type === "confirm_responsibility" && op.personId) {
      const person = people.find((p) => p.id === op.personId);
      if (!person) flags.add("wrong_existing_person");
      else if (op.personName && !namesMatchExact(person.name, op.personName)) {
        flags.add("wrong_existing_person");
      }
    }
    if (op.type === "ensure_person" || op.type === "confirm_responsibility") {
      const name = op.type === "ensure_person" ? op.name : op.personName;
      const bound = people.find((person) => namesMatchExact(person.name, name));
      if (bound && op.type === "confirm_responsibility" && op.personId && op.personId !== bound.id) {
        flags.add("wrong_existing_person");
      }
    }
  }
  return [...flags];
}

function summariseCase(testCase: ExperimentCase, call: CallResult) {
  const pipeline = runCaptureV2FromModelJson({
    transcript: testCase.transcript,
    rawModelJson: call.rawJson,
    world: testCase.world,
    projectId: testCase.projectId,
  });
  const raw = asObservations(call.rawJson);
  const decisions = pipeline.resolved.map((row) => ({
    id: row.observation.id,
    domainIn: raw.find((item) => item.id === row.observation.id)?.domain ?? row.observation.domain,
    domainOut: row.observation.domain,
    disposition: row.observation.disposition,
    statement: row.observation.statement,
    candidateTargetId: row.observation.candidateTargetId,
    proposedValues: row.observation.proposedValues,
    label: decisionLabel(row.decision, row.observation.disposition),
    reason: "reason" in row.decision ? row.decision.reason : "",
    operation: row.decision.kind === "write" ? row.decision.operation : null,
  }));
  const benchmark = testCase.benchmark
    ? evaluateAgainstCase({
        testCase: testCase.benchmark,
        rawModelJson: call.rawJson,
        world: testCase.world,
      })
    : null;
  return {
    rawObservations: raw.map((obs) => ({
      id: obs.id,
      domain: obs.domain,
      disposition: obs.disposition,
      truthIntent: obs.truthIntent,
      statement: obs.statement,
      candidateTargetId: obs.candidateTargetId,
      candidateTargetTitle: obs.candidateTargetTitle,
      proposedValues: obs.proposedValues,
      commentary: obs.commentary,
    })),
    outcomes: decisions.map((row) => row.label),
    decisions,
    safety: safetyFlags(
      testCase,
      raw,
      decisions.map((row) => ({
        decision: pipeline.resolved.find((item) => item.observation.id === row.id)!.decision,
        disposition: row.disposition,
        statement: row.statement,
      })),
    ),
    validationIssues: pipeline.validation.issues.map((issue) => issue.code),
    modelMetrics: benchmark?.modelMetrics ?? null,
    lumeSafety: benchmark?.lumeSafety.totals ?? null,
    lumeRows: benchmark?.lumeSafety.rows.map((row) => ({
      classification: row.classification,
      detail: row.detail,
    })) ?? null,
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

async function main() {
  const sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  const cases = experimentCases();
  const conditions: Array<{ id: ConditionId; model: string; temperature: number | null }> = [
    { id: "A", model: PINNED_OPENAI_CHAT_MODEL, temperature: 0.2 },
    { id: "B", model: LUNA_MODEL, temperature: null },
    { id: "C", model: LUNA_MODEL, temperature: null },
  ];
  const jobs = conditions.flatMap((condition) =>
    cases.map((testCase) => ({ condition, testCase })),
  );
  console.log(`cases=${cases.length} calls=${jobs.length} branch=${branch} sha=${sha}`);
  const started = Date.now();
  const rows = await mapPool(jobs, 4, async (job) => {
    const block = projectBlock(job.testCase, job.condition.id);
    const userPrompt = buildObservationExtractionPrompt({
      transcript: job.testCase.transcript,
      projectBlock: block,
    });
    const call = await complete({
      model: job.condition.model,
      temperature: job.condition.temperature,
      userPrompt,
    });
    const summary = call.error
      ? null
      : summariseCase(job.testCase, call);
    const line = [
      job.condition.id,
      job.testCase.id,
      call.error ? "ERROR" : (summary?.outcomes.join(" | ") || "(empty)"),
      `${call.latencyMs}ms`,
    ].join(" :: ");
    console.log(line);
    return {
      condition: job.condition.id,
      caseId: job.testCase.id,
      category: job.testCase.category,
      title: job.testCase.title,
      requestedModel: job.condition.model,
      responseModel: call.responseModel,
      temperature: call.temperature,
      latencyMs: call.latencyMs,
      usage: call.usage,
      error: call.error,
      contextChars: block.length,
      summary,
    };
  });
  mkdirSync(OUT_DIR, { recursive: true });
  const payload = {
    branch,
    startingSha: sha,
    promptVersion: CAPTURE_V2_PROMPT_VERSION,
    systemMessage: CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
    referenceDateForC: EXPERIMENT_REFERENCE_DATE,
    models: {
      A: PINNED_OPENAI_CHAT_MODEL,
      B: LUNA_MODEL,
      C: LUNA_MODEL,
    },
    temperatureNote:
      "A uses production temperature 0.2. B and C omit temperature because gpt-6-luna rejects every value except the provider default.",
    caseIds: cases.map((row) => row.id),
    elapsedMs: Date.now() - started,
    rows,
  };
  writeFileSync(`${OUT_DIR}/luna-rich-context.json`, JSON.stringify(payload, null, 2));
  console.log(`wrote ${OUT_DIR}/luna-rich-context.json elapsed=${payload.elapsedMs}ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
