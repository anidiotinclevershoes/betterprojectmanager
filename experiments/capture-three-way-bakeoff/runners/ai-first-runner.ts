/**
 * Isolated AI-first Gate 1 v2 runner.
 * Copied untracked into the pinned 707b704 worktree. Uses that SHA's interpreter.
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import { interpretOnce } from "@/lib/experiments/ai-first-capture-gate1-v2/interpreter";
import { inspectEnvelope } from "@/lib/experiments/ai-first-capture-gate1-v2/inspect";
import {
  knownCanonicalIds,
  serializeCurrentCanonicalTruth,
} from "@/lib/experiments/ai-first-capture-gate1-v2/snapshot";
import type { Gate1V2Item } from "@/lib/experiments/ai-first-capture-gate1-v2/types";

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
    ambiguity: asStr(item.question) !== "omitted" ? asStr(item.question) : asStr(item.leftUntouchedReason),
    disposition: asStr(item.operation) === "omitted" ? "unsupported" : item.operation,
    writeProposed:
      item.operation === "create" ||
      item.operation === "update" ||
      item.operation === "remove",
  };
}

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    throw new Error("usage: ai-first-runner.ts <input.json> <output.json>");
  }
  const input = JSON.parse(readFileSync(inputPath, "utf8")) as Input;
  const world = revive(input.world);
  const snapshot = serializeCurrentCanonicalTruth(world, input.projectId);
  const call = await interpretOnce({
    captureText: input.captureText,
    snapshot,
  });
  const inspected = inspectEnvelope(
    call.raw,
    knownCanonicalIds(world, input.projectId),
  );
  const items = inspected.items;
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        caseId: input.caseId,
        ok: inspected.ok,
        error: inspected.malformed ? inspected.issues.map((i) => i.message).join("; ") : null,
        requestedModel: call.requestedModel,
        responseModel: call.responseModel,
        latencyMs: call.latencyMs,
        usage: call.usage,
        raw: {
          snapshotChars: snapshot.length,
          envelope: call.raw,
          inspect: inspected.issues,
        },
        normalized: items.map(normalizeItem),
        apply: input.apply
          ? {
              writesAttempted: 0,
              writesExecuted: 0,
              before: null,
              after: null,
              note: "AI-first is Gate 1 only — not included in Apply.",
            }
          : null,
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
