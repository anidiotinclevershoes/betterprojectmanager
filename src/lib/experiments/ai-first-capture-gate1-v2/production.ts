/**
 * Current production Capture on origin/main: Prompt A extract + full resolve.
 * Includes rematerialise / hydrate. Used only for comparison.
 */
import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
} from "@/lib/capture-v2";
import { extractObservationsWithOpenAI } from "@/lib/capture-v2/extract";
import { runCaptureV2FromModelJson } from "@/lib/capture-v2/run";
import { accountObservations } from "@/lib/capture-v2/account";
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import type { Gate1V2Item, Gate1V2Operation, Gate1V2ProposedValues } from "./types";

function emptyValues(): Gate1V2ProposedValues {
  return {
    name: null,
    personName: null,
    title: null,
    date: null,
    status: null,
    scope: null,
    ownershipSemantics: null,
    text: null,
    awayFromIso: null,
    awayToIso: null,
  };
}

function asStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapOperation(
  decisionKind: string,
  disposition: string,
  writeType?: string,
): Gate1V2Operation {
  if (disposition === "left_untouched") return "left_untouched";
  if (disposition === "commentary" || disposition === "ignore") {
    return "left_untouched";
  }
  if (decisionKind === "needs_you") return "needs_you";
  if (decisionKind === "no_change") return "no_change";
  if (decisionKind === "write") {
    if (writeType?.startsWith("create_") || writeType === "ensure_person") {
      return writeType === "ensure_person" ? "create" : "create";
    }
    if (writeType?.startsWith("delete_")) return "remove";
    return "update";
  }
  if (disposition === "create_new") return "create";
  if (disposition === "update_existing") return "update";
  if (disposition === "ambiguous") return "needs_you";
  return "left_untouched";
}

export type ProductionComparison = {
  label: string;
  requestedModel: string;
  responseModel: string;
  items: Gate1V2Item[];
  text: string;
  usage: unknown;
};

export async function runProductionCapture(args: {
  transcript: string;
  world: CaptureApplyWorld;
  projectId: string;
}): Promise<ProductionComparison> {
  const project = args.world.projects.find((p) => p.id === args.projectId);
  if (!project) throw new Error(`Missing project ${args.projectId}`);
  const projectBlock = formatAuthoritativeStateForPrompt(
    contextRecordsFromWorld(args.world, args.projectId),
    { id: project.id, name: project.name, code: project.code },
  );
  const extracted = await extractObservationsWithOpenAI({
    transcript: args.transcript,
    projectBlock,
  });
  const run = runCaptureV2FromModelJson({
    transcript: args.transcript,
    rawModelJson: extracted.rawModelJson,
    world: args.world,
    projectId: args.projectId,
  });
  const account = accountObservations({
    resolved: run.resolved,
    rejectedCount: run.validation.rejected.length,
  });

  const items: Gate1V2Item[] = run.resolved.map((row) => {
    const obs = row.observation;
    const writeType =
      row.decision.kind === "write" ? row.decision.operation.type : undefined;
    const values = obs.proposedValues ?? {};
    return {
      operation: mapOperation(row.decision.kind, obs.disposition, writeType),
      domain:
        obs.domain === "commentary" || obs.domain === "unknown"
          ? "unsupported"
          : (obs.domain as Gate1V2Item["domain"]),
      targetCanonicalId: obs.candidateTargetId ?? null,
      subject: obs.candidateTargetTitle || obs.statement,
      proposedValues: {
        ...emptyValues(),
        name: asStr(values.name),
        personName: asStr(values.personName),
        title: asStr(values.title) || asStr(values.label),
        date: asStr(values.date) || asStr(values.startAt) || asStr(values.dueAt),
        status: asStr(values.status),
        scope: asStr(values.scope),
        ownershipSemantics: asStr(values.ownershipSemantics),
        text: asStr(values.text),
        awayFromIso: asStr(values.awayFromIso),
        awayToIso: asStr(values.awayToIso),
      },
      evidence: obs.evidence,
      understood: obs.statement,
      question: row.decision.kind === "needs_you" ? row.decision.reason : null,
      leftUntouchedReason:
        obs.disposition === "left_untouched" || obs.disposition === "commentary"
          ? obs.commentary ??
            (row.decision.kind === "needs_you" || row.decision.kind === "no_change"
              ? row.decision.reason
              : null)
          : null,
    };
  });

  const rejected = run.validation.rejected.map((obs) => {
    return `- rejected ${obs.domain}/${obs.disposition} ${obs.statement}`;
  });

  return {
    label: `Production Prompt A extract (${extracted.responseModel}) + current resolve (hydrate/rematerialise ON)`,
    requestedModel: extracted.requestedModel,
    responseModel: extracted.responseModel,
    items,
    usage: extracted.providerUsage,
    text: [
      `requested=${extracted.requestedModel} response=${extracted.responseModel} fallback=${extracted.fallback}`,
      `account=${JSON.stringify(account)}`,
      "mapped items:",
      ...items.map(
        (item) =>
          `- ${item.operation} ${item.domain} target=${item.targetCanonicalId ?? "none"} :: ${item.understood}`,
      ),
      ...(rejected.length ? ["rejected:", ...rejected] : []),
    ].join("\n"),
  };
}
