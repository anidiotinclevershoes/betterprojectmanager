/**
 * Copied into this experiment checkout. Uses Gate 1 interpreter on this SHA
 * plus the thin Gate 2 materialiser. Does not change production Capture.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import { interpretOnce } from "@/lib/experiments/ai-first-capture-gate1-v2/interpreter";
import { inspectEnvelope } from "@/lib/experiments/ai-first-capture-gate1-v2/inspect";
import {
  knownCanonicalIds,
  serializeCurrentCanonicalTruth,
} from "@/lib/experiments/ai-first-capture-gate1-v2/snapshot";
import type { Gate1V2Item } from "@/lib/experiments/ai-first-capture-gate1-v2/types";
import { applyCaptureOperationInMemory } from "@/lib/capture/apply/memory-execute";
import { planCaptureApply } from "@/lib/capture/apply";
import { experimentalMissionState } from "@/lib/eval-capture-v2/mission-state";
import { snapshotProject } from "@/lib/eval-capture-v2/stacked-runtime";
import { materialiseGate2, suggestionFromItem } from "./materialise";

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
  replayPath?: string | null;
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

function normalizeItem(item: Gate1V2Item) {
  const values = item.proposedValues;
  const hasValue =
    values &&
    Object.values(values).some((entry) => entry != null && String(entry).trim() !== "");
  return {
    domain: asStr(item.domain) === "omitted" ? "omitted" : item.domain,
    subject: asStr(item.subject),
    referencedCanonicalId: asStr(item.targetCanonicalId),
    assertedValue: hasValue ? values : "omitted",
    evidence: asStr(item.evidence),
    ambiguity:
      asStr(item.question) !== "omitted" ? asStr(item.question) : asStr(item.leftUntouchedReason),
    disposition: asStr(item.operation) === "omitted" ? "unsupported" : item.operation,
    writeProposed:
      item.operation === "create" || item.operation === "update" || item.operation === "remove",
  };
}

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) throw new Error("usage: worktree-runner.ts <in> <out>");
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as Input;
  const world = revive(input.world);
  const snapshot = serializeCurrentCanonicalTruth(world, input.projectId);
  const known = knownCanonicalIds(world, input.projectId);

  let requestedModel: string | null = "gpt-6-astra";
  let responseModel: string | null = null;
  let latencyMs: number | null = 0;
  let usage: ContenderUsage | null = null;
  let rawEnvelope: unknown = null;
  let inspectIssues: unknown = [];

  if (input.replayPath) {
    if (!existsSync(input.replayPath)) {
      throw new Error(`Replay envelope missing: ${input.replayPath}`);
    }
    const baked = JSON.parse(readFileSync(input.replayPath, "utf8")) as {
      requestedModel?: string;
      responseModel?: string;
      latencyMs?: number;
      usage?: ContenderUsage;
      raw?: { envelope?: unknown };
    };
    requestedModel = baked.requestedModel ?? "gpt-6-astra";
    responseModel = baked.responseModel ?? requestedModel;
    latencyMs = baked.latencyMs ?? 0;
    usage = baked.usage ?? null;
    rawEnvelope = baked.raw?.envelope ?? null;
  } else {
    const call = await interpretOnce({
      captureText: input.captureText,
      snapshot,
    });
    requestedModel = call.requestedModel;
    responseModel = call.responseModel;
    latencyMs = call.latencyMs;
    usage = call.usage;
    rawEnvelope = call.raw;
  }

  const inspected = inspectEnvelope(rawEnvelope, known);
  inspectIssues = inspected.issues;
  const gate2 = materialiseGate2({
    items: inspected.items,
    world,
    projectId: input.projectId,
    captureText: input.captureText,
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
    let attempted = 0;
    let executed = 0;
    for (const [index, item] of gate2.items.entries()) {
      if (item.operation !== "create" && item.operation !== "update" && item.operation !== "remove") {
        continue;
      }
      const suggestion = suggestionFromItem(item, index, input.projectId);
      if (!suggestion) continue;
      attempted += 1;
      const planned = planCaptureApply({
        item: suggestion,
        text: input.captureText,
        world,
        captureEntryProjectId: input.projectId,
      });
      if (planned.kind !== "write") continue;
      state = applyCaptureOperationInMemory(state, planned.operation);
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
        ok: !inspected.malformed,
        error: inspected.malformed ? inspected.issues.map((i) => i.message).join("; ") : null,
        requestedModel,
        responseModel,
        latencyMs,
        usage,
        raw: {
          snapshotChars: snapshot.length,
          envelope: rawEnvelope,
          inspect: inspectIssues,
          traces: gate2.traces,
        },
        normalized: gate2.items.map(normalizeItem),
        apply,
      },
      null,
      2,
    )}\n`,
  );
}

type ContenderUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  reasoning_tokens?: number;
};

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
          requestedModel: process.env.GATE1_V2_MODEL || "gpt-6-astra",
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
