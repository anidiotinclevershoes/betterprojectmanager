/**
 * Isolated Current / Simplification runner.
 * Copied untracked into a pinned worktree. Does not change committed files.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
  runCaptureV2FromModelJson,
} from "@/lib/capture-v2";
import { extractObservationsWithOpenAI } from "@/lib/capture-v2/extract";
import { experimentalMissionState } from "@/lib/eval-capture-v2/mission-state";
import { applyCaptureOperationInMemory } from "@/lib/capture/apply/memory-execute";
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import { snapshotProject } from "@/lib/eval-capture-v2/stacked-runtime";

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

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    throw new Error("usage: production-runner.ts <input.json> <output.json>");
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
  const extracted = await extractObservationsWithOpenAI({
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
          modelJson: extracted.rawModelJson,
          resolved: run.resolved.map((row) => ({
            id: row.observation.id,
            domain: row.observation.domain,
            disposition: row.observation.disposition,
            statement: row.observation.statement,
            evidence: row.observation.evidence,
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
          requestedModel: null,
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
