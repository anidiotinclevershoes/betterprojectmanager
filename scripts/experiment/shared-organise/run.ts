/**
 * Isolated shared Organise experiment.
 * Does not modify production Capture or New Project.
 * Does not write canonical truth.
 *
 * Capture: GPT-6 Luna Project Change Form vs the stored GPT-6 observation path.
 * New Project: production Mini observation adapter vs the same form engine.
 *
 * Run: npx tsx scripts/experiment/shared-organise/run.ts
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { draftFromProvisional, parseNewProjectV2Envelope } from "@/lib/new-project-v2";
import {
  CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
  CAPTURE_V2_PROMPT_VERSION,
  buildObservationExtractionPrompt,
} from "@/lib/capture-v2/prompt";
import { PINNED_OPENAI_CHAT_MODEL } from "@/lib/openai-model";
import { getOpenAIKey } from "@/lib/openai";
import { experimentCases } from "../luna-rich-context/cases";
import { buildSharedOrganiseContext } from "./context";
import { SHARED_ORGANISE_PROMPT_VERSION } from "./form";
import { NEW_PROJECT_EXPERIMENT_CASES } from "./np-corpus";
import {
  SHARED_ORGANISE_SYSTEM_MESSAGE,
  buildProjectChangePrompt,
} from "./prompt";
import { runSharedOrganiseSelfCheck } from "./self-check";
import { parseProjectChangeForm, reviewProjectChangeForm, type ReviewedChange } from "./validate";

const LUNA = "gpt-6-luna";
const OUT = "scripts/experiment/shared-organise/results/shared-organise.json";
const GPT6_OBSERVATION = "scripts/experiment/luna-rich-context/results/luna-rich-context.json";

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
  system: string;
  userPrompt: string;
}): Promise<CallResult> {
  const key = getOpenAIKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const body: Record<string, unknown> = {
    model: args.model,
    store: false,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: args.system },
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
    requestedModel: args.model,
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

function counts(rows: ReviewedChange[]) {
  const tally = { Ready: 0, "Needs You": 0, "Left untouched": 0, "No change": 0 };
  for (const row of rows) tally[row.label] += 1;
  return tally;
}

function summariseReview(rows: ReviewedChange[]) {
  return {
    counts: counts(rows),
    cards: rows.map((row) => ({
      id: row.id,
      label: row.label,
      domain: row.domain,
      modelOutcome: row.modelOutcome,
      modelOperation: row.modelOperation,
      operationType: row.operation?.type ?? null,
      reason: row.reason,
      safety: row.safety,
      evidence: row.evidence.slice(0, 240),
    })),
    survivingSafety: rows
      .filter((row) => row.label === "Ready" && row.safety.length > 0)
      .map((row) => ({ id: row.id, safety: row.safety, operation: row.operation?.type })),
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

function observationBaseline() {
  const data = JSON.parse(readFileSync(GPT6_OBSERVATION, "utf8")) as {
    rows: Array<{
      condition: string;
      caseId: string;
      responseModel: string;
      summary: { outcomes?: string[]; safety?: string[]; validationIssues?: string[] };
    }>;
  };
  const map = new Map<string, { outcomes: string[]; safety: string[]; validationIssues: string[] }>();
  for (const row of data.rows) {
    if (row.condition !== "B" || row.responseModel !== "gpt-6-luna") continue;
    map.set(row.caseId, {
      outcomes: row.summary?.outcomes ?? [],
      safety: row.summary?.safety ?? [],
      validationIssues: row.summary?.validationIssues ?? [],
    });
  }
  return map;
}

async function main() {
  runSharedOrganiseSelfCheck();
  const sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
  const baseline = observationBaseline();
  const captureCases = experimentCases();
  const started = Date.now();

  const captureRows = await mapPool(captureCases, 4, async (testCase) => {
    const context = buildSharedOrganiseContext({
      world: testCase.world,
      projectId: testCase.projectId,
    });
    const call = await complete({
      model: LUNA,
      temperature: null,
      system: SHARED_ORGANISE_SYSTEM_MESSAGE,
      userPrompt: buildProjectChangePrompt({
        source: testCase.transcript,
        projectBlock: context.prompt,
      }),
    });
    const reviewed = call.error
      ? []
      : reviewProjectChangeForm({
          form: parseProjectChangeForm(call.rawJson),
          context,
          source: testCase.transcript,
        });
    const line = `${testCase.id} :: ${reviewed.map((row) => row.label).join(" | ") || "(empty)"} :: ${call.latencyMs}ms`;
    console.log(line);
    return {
      caseId: testCase.id,
      title: testCase.title,
      category: testCase.category,
      call,
      contextChars: context.prompt.length,
      review: summariseReview(reviewed),
      observationPath: baseline.get(testCase.id) ?? null,
    };
  });

  const unscoped =
    "Current project: (unscoped)\nAuthoritative current records:\n(none)";
  const newProjectRows = await mapPool(NEW_PROJECT_EXPERIMENT_CASES, 4, async (testCase) => {
    const currentCall = await complete({
      model: PINNED_OPENAI_CHAT_MODEL,
      temperature: 0.2,
      system: CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
      userPrompt: buildObservationExtractionPrompt({
        transcript: testCase.source,
        projectBlock: unscoped,
      }),
    });
    const parsed = currentCall.error ? null : parseNewProjectV2Envelope(currentCall.rawJson);
    const draft = parsed
      ? draftFromProvisional({
          sourceNarrative: testCase.source,
          sourceMode: "paste",
          project: parsed.project,
          items: parsed.items,
        })
      : null;
    const empty = buildSharedOrganiseContext({
      world: {
        projectIds: new Set(["proj-new"]),
        projects: [{ id: "proj-new", name: "New project", code: "NEW", stakeholders: [] }],
        risks: [],
        todos: [],
        timeline: [],
        knowledge: [],
      },
      projectId: "proj-new",
    });
    const formCall = await complete({
      model: LUNA,
      temperature: null,
      system: SHARED_ORGANISE_SYSTEM_MESSAGE,
      userPrompt: buildProjectChangePrompt({
        source: testCase.source,
        projectBlock: empty.prompt,
      }),
    });
    const reviewed = formCall.error
      ? []
      : reviewProjectChangeForm({
          form: parseProjectChangeForm(formCall.rawJson),
          context: empty,
          source: testCase.source,
        });
    console.log(
      `np ${testCase.id} :: current people=${draft?.stakeholders.length ?? "ERR"} form=${reviewed.map((row) => row.label).join(" | ") || "(empty)"}`,
    );
    return {
      caseId: testCase.id,
      title: testCase.title,
      current: {
        call: { ...currentCall, rawJson: undefined },
        error: currentCall.error,
        people: draft?.stakeholders.map((row) => ({
          name: row.name,
          role: row.role,
          responsibilities: row.responsibilities,
          needsReview: row.needsReview,
        })),
        risks: draft?.risks,
        todos: draft?.todos,
        dates: draft?.importantDates,
        knowledge: draft?.knowledgeRemember,
        notMentioned: draft?.notMentioned,
        rawModel: currentCall.rawJson,
      },
      form: {
        call: { ...formCall, rawJson: undefined },
        error: formCall.error,
        rawModel: formCall.rawJson,
        review: summariseReview(reviewed),
      },
    };
  });

  mkdirSync("scripts/experiment/shared-organise/results", { recursive: true });
  const payload = {
    branch,
    startingSha: sha,
    model: LUNA,
    promptVersion: SHARED_ORGANISE_PROMPT_VERSION,
    observationPromptVersion: CAPTURE_V2_PROMPT_VERSION,
    referenceDate: "2026-10-03",
    elapsedMs: Date.now() - started,
    note: "Experiment only. Production Capture and New Project were not modified. No canonical writes.",
    capture: captureRows,
    newProject: newProjectRows,
  };
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`wrote ${OUT} elapsed=${payload.elapsedMs}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
