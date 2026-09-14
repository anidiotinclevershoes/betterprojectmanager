/**
 * Experiment-only Simplification+Astra runner.
 * Copied untracked into the pinned Simplification worktree.
 *
 * Uses that SHA's Prompt A, validation, resolve, leftover coverage,
 * and planCaptureApply. Does not import AI-first code.
 *
 * Adapter: gpt-6-astra rejects Prompt A's temperature=0.2 (only default 1).
 * This runner omits temperature, matching the accepted AI-first Astra call
 * shape for that one request field. Prompt text and json_object are unchanged.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
  runCaptureV2FromModelJson,
} from "@/lib/capture-v2";
import { getOpenAIKey } from "@/lib/openai";
import {
  buildObservationExtractionPrompt,
  CAPTURE_V2_EXTRACT_PATH,
  CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE,
  CAPTURE_V2_PROMPT_ID,
  CAPTURE_V2_PROMPT_VERSION,
} from "@/lib/capture-v2/prompt";
import { observationCountFromRaw } from "@/lib/capture-v2/provenance";
import { experimentalMissionState } from "@/lib/eval-capture-v2/mission-state";
import { applyCaptureOperationInMemory } from "@/lib/capture/apply/memory-execute";
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import { snapshotProject } from "@/lib/eval-capture-v2/stacked-runtime";

const REQUESTED_MODEL = "gpt-6-astra";

type Input = {
  caseId: string;
  captureText: string;
  projectId: string;
  world: {
    projectIds: string[];
    projects: CaptureApplyWorld["projects"];
    risks: CaptureApplyWorld["risks"];
    todos: CaptureApplyWorld["todos"];
    timeline: CaptureApplyWorld["timeline"];
    knowledge: CaptureApplyWorld["knowledge"];
  };
  apply?: boolean;
};

function revive(world: Input["world"]): CaptureApplyWorld {
  return {
    projectIds: new Set(world.projectIds),
    projects: world.projects,
    risks: world.risks,
    todos: world.todos,
    timeline: world.timeline,
    knowledge: world.knowledge,
  };
}

function asStr(value: unknown): string | "omitted" {
  return typeof value === "string" && value.trim() ? value.trim() : "omitted";
}

function mapDisposition(kind: string, disposition: string, writeType?: string): string {
  if (disposition === "left_untouched") return "left_untouched";
  if (disposition === "commentary" || disposition === "ignore") return "left_untouched";
  if (kind === "needs_you") return "needs_you";
  if (kind === "no_change") return "no_change";
  if (kind === "write") {
    if (writeType?.startsWith("create_") || writeType === "ensure_person") return "create";
    if (writeType?.startsWith("delete_")) return "remove";
    return "update";
  }
  if (disposition === "create_new") return "create";
  if (disposition === "update_existing") return "update";
  if (disposition === "ambiguous") return "needs_you";
  return "unsupported";
}

function idFromOperation(op: Record<string, unknown> | undefined): string | "omitted" {
  if (!op) return "omitted";
  for (const key of [
    "todoId",
    "riskId",
    "milestoneId",
    "personId",
    "itemId",
    "knowledgeId",
    "targetId",
    "id",
  ]) {
    const value = op[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "omitted";
}

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

async function extractPromptAWithAstra(args: { transcript: string; projectBlock: string }) {
  const key = getOpenAIKey();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const prompt = buildObservationExtractionPrompt({
    transcript: args.transcript,
    projectBlock: args.projectBlock,
  });
  const body: Record<string, unknown> = {
    model: REQUESTED_MODEL,
    // temperature omitted: gpt-6-astra 400s on 0.2; only default 1 is supported.
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CAPTURE_V2_EXTRACT_SYSTEM_MESSAGE },
      { role: "user", content: prompt },
    ],
  };
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI capture V2 failed (${response.status}): ${detail}`);
  }
  const data = (await response.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      completion_tokens_details?: { reasoning_tokens?: number };
    };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty observation response");
  const rawModelJson = parseJsonObject(content);
  const responseModel =
    typeof data.model === "string" && data.model.trim() ? data.model.trim() : REQUESTED_MODEL;
  return {
    rawModelJson,
    requestedModel: REQUESTED_MODEL,
    responseModel,
    providerUsage: {
      prompt_tokens: data.usage?.prompt_tokens,
      completion_tokens: data.usage?.completion_tokens,
      total_tokens: data.usage?.total_tokens,
      reasoning_tokens: data.usage?.completion_tokens_details?.reasoning_tokens,
    },
    promptId: CAPTURE_V2_PROMPT_ID,
    promptVersion: CAPTURE_V2_PROMPT_VERSION,
    path: CAPTURE_V2_EXTRACT_PATH,
    observationCount: observationCountFromRaw(rawModelJson),
    adapter: "omit-temperature-for-gpt-6-astra",
  };
}

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    throw new Error("usage: simplification-astra-runner.ts <input.json> <output.json>");
  }
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as Input;
  const world = revive(input.world);
  const project = world.projects.find((p) => p.id === input.projectId);
  if (!project) throw new Error(`Missing project ${input.projectId}`);
  const projectBlock = formatAuthoritativeStateForPrompt(
    contextRecordsFromWorld(world, input.projectId),
    { id: project.id, name: project.name, code: project.code },
  );
  const started = Date.now();
  const extracted = await extractPromptAWithAstra({
    transcript: input.captureText,
    projectBlock,
  });
  const latencyMs = Date.now() - started;
  const run = runCaptureV2FromModelJson({
    transcript: input.captureText,
    rawModelJson: extracted.rawModelJson,
    world,
    projectId: input.projectId,
  });

  const normalized = run.resolved.map((row) => {
    const obs = row.observation;
    const writeType = row.decision.kind === "write" ? row.decision.operation.type : undefined;
    const referenced =
      asStr(obs.candidateTargetId) !== "omitted"
        ? asStr(obs.candidateTargetId)
        : row.decision.kind === "write"
          ? idFromOperation(row.decision.operation as unknown as Record<string, unknown>)
          : "omitted";
    const asserted =
      obs.proposedValues && Object.keys(obs.proposedValues).length > 0
        ? obs.proposedValues
        : "omitted";
    return {
      domain: asStr(obs.domain),
      subject: asStr(obs.candidateTargetTitle) !== "omitted"
        ? asStr(obs.candidateTargetTitle)
        : asStr(obs.statement),
      referencedCanonicalId: referenced,
      assertedValue: asserted,
      evidence: asStr(obs.evidence),
      ambiguity: asStr(obs.commentary) !== "omitted"
        ? asStr(obs.commentary)
        : row.decision.kind === "needs_you"
          ? asStr(row.decision.reason)
          : "omitted",
      disposition: mapDisposition(row.decision.kind, obs.disposition, writeType),
      writeProposed: row.decision.kind === "write",
    };
  });

  let apply: {
    writesAttempted: number;
    writesExecuted: number;
    before: unknown;
    after: unknown;
  } | null = null;

  if (input.apply) {
    let state = experimentalMissionState(world);
    const before = snapshotProject(state, input.projectId);
    let executed = 0;
    let attempted = 0;
    for (const row of run.resolved) {
      if (row.decision.kind !== "write") continue;
      attempted += 1;
      state = applyCaptureOperationInMemory(state, row.decision.operation);
      executed += 1;
    }
    apply = {
      writesAttempted: attempted,
      writesExecuted: executed,
      before,
      after: snapshotProject(state, input.projectId),
    };
  }

  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        caseId: input.caseId,
        ok: true,
        error: null,
        requestedModel: extracted.requestedModel,
        responseModel: extracted.responseModel,
        latencyMs,
        usage: extracted.providerUsage,
        raw: {
          adapter: extracted.adapter,
          promptId: extracted.promptId,
          promptVersion: extracted.promptVersion,
          path: extracted.path,
          observationCount: extracted.observationCount,
          modelJson: extracted.rawModelJson,
          resolved: run.resolved.map((row) => ({
            id: row.observation.id,
            domain: row.observation.domain,
            disposition: row.observation.disposition,
            statement: row.observation.statement,
            evidence: row.observation.evidence,
            truthIntent: row.observation.truthIntent ?? null,
            candidateTargetId: row.observation.candidateTargetId ?? null,
            decisionKind: row.decision.kind,
            writeType: row.decision.kind === "write" ? row.decision.operation.type : null,
            reason:
              row.decision.kind === "needs_you" || row.decision.kind === "no_change"
                ? row.decision.reason
                : null,
          })),
        },
        normalized,
        apply,
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  const outputPath = process.argv[3];
  const message = error instanceof Error ? error.stack || error.message : String(error);
  if (outputPath) {
    writeFileSync(
      outputPath,
      `${JSON.stringify(
        {
          caseId: null,
          ok: false,
          error: message,
          requestedModel: REQUESTED_MODEL,
          responseModel: null,
          latencyMs: null,
          usage: null,
          raw: null,
          normalized: [],
          apply: null,
        },
        null,
        2,
      )}\n`,
    );
  }
  process.exitCode = 1;
});
