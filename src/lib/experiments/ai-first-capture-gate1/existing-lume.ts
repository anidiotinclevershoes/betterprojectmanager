/**
 * Existing Lume results via current harness / published holdout artifacts.
 * Does not modify production Capture behaviour.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
} from "@/lib/capture-v2";
import { extractObservationsWithOpenAI } from "@/lib/capture-v2/extract";
import { accountObservations } from "@/lib/capture-v2/account";
import { evaluateAgainstCase } from "@/lib/eval-capture-v2/pipeline";
import { CAPTURE_V2_EVAL_CORPUS } from "@/lib/eval-capture-v2/corpus";
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import type { ExistingLumeSummary } from "./types";
import type { Gate1Case } from "./cases";

function corpusIdForCase(testCase: Gate1Case): string | null {
  if (testCase.id === "gate1-create-new-person") return "new-person";
  if (testCase.id === "gate1-change-existing-risk") return "existing-risk-update";
  if (testCase.id === "gate1-messy-mixed-domains") return "mixed-domains";
  if (testCase.id === "gate1-ambiguous-brick") return "ambiguous-same-first-name";
  return null;
}

export async function existingLumeForCase(
  testCase: Gate1Case,
  world: CaptureApplyWorld,
): Promise<ExistingLumeSummary> {
  const corpusId = corpusIdForCase(testCase);
  if (corpusId) {
    const corpusCase = CAPTURE_V2_EVAL_CORPUS.find((row) => row.id === corpusId);
    if (!corpusCase) {
      return {
        source: "missing",
        label: "Existing Lume result unavailable",
        text: `Corpus case ${corpusId} was not found.`,
      };
    }
    const project = world.projects.find((p) => p.id === corpusCase.projectId);
    if (!project) {
      return {
        source: "missing",
        label: "Existing Lume result unavailable",
        text: `Project ${corpusCase.projectId} missing from experimental world.`,
      };
    }
    const projectBlock = formatAuthoritativeStateForPrompt(
      contextRecordsFromWorld(world, corpusCase.projectId),
      { id: project.id, name: project.name, code: project.code },
    );
    const extracted = await extractObservationsWithOpenAI({
      transcript: corpusCase.transcript,
      projectBlock,
    });
    const evaluated = evaluateAgainstCase({
      testCase: corpusCase,
      rawModelJson: extracted.rawModelJson,
      world,
    });
    const account = accountObservations({
      resolved: evaluated.pipeline.resolved,
      rejectedCount: evaluated.pipeline.validation.rejected.length,
    });
    const resolvedLines = evaluated.pipeline.resolved.map((row) => {
      const obs = row.observation;
      return `- ${obs.domain}/${obs.disposition} target=${obs.candidateTargetId ?? "none"} decision=${row.decision.kind} :: ${obs.statement}`;
    });
    const rejected = evaluated.pipeline.validation.rejected.map(
      (obs) => `- rejected ${obs.domain}/${obs.disposition} ${obs.statement}`,
    );
    return {
      source: "live-production-extract+current-resolve",
      label: `Current Capture V2 extract (${extracted.responseModel}) + current resolve`,
      text: [
        `requestedModel=${extracted.requestedModel} responseModel=${extracted.responseModel} fallback=${extracted.fallback}`,
        `usage=${JSON.stringify(extracted.providerUsage)}`,
        `account=${JSON.stringify(account)}`,
        `lumeSafetyTotals=${JSON.stringify(evaluated.lumeSafety.totals)}`,
        "resolved:",
        ...(resolvedLines.length ? resolvedLines : ["(none)"]),
        ...(rejected.length ? ["rejected:", ...rejected] : []),
      ].join("\n"),
    };
  }

  if (testCase.id === "gate1-holdout-h6-messy") {
    const excerptPath = resolve(
      process.cwd(),
      "e2e-hosted-holdout/baselines/post-fix-3/h6-capture-excerpt.json",
    );
    const excerpt = JSON.parse(readFileSync(excerptPath, "utf8")) as {
      calls?: Array<{
        observationAccount?: unknown;
        findings?: Array<{
          fact?: string;
          findingType?: string;
          target?: { entityType?: string; title?: string; entityId?: string };
          requiresClarification?: boolean;
        }>;
      }>;
    };
    const captureCall = excerpt.calls?.find((call) => call.findings?.length);
    const findings = (captureCall?.findings ?? []).map((finding) => {
      const target = finding.target
        ? `${finding.target.entityType ?? "?"} ${finding.target.title ?? ""} ${finding.target.entityId ?? ""}`.trim()
        : "untargeted";
      return `- ${finding.findingType} ${finding.requiresClarification ? "NeedsYou" : ""} :: ${finding.fact} → ${target}`;
    });
    return {
      source: "hosted-holdout-baseline-post-fix-3",
      label:
        "Published hosted holdout H6 excerpt (post-fix-3). Not re-run. Production path was gpt-4o-mini-2024-07-18.",
      text: [
        `observationAccount=${JSON.stringify(captureCall?.observationAccount ?? null)}`,
        "findings:",
        ...findings,
        "Known pipeline weakness on this paste: void-key create and Kwame create were Needs You / AMBIGUOUS rather than independently actionable creates; workshop date update was found.",
      ].join("\n"),
    };
  }

  return {
    source: "not-obtained",
    label: "Existing Lume result not obtained",
    text: "No existing harness path was used for this case.",
  };
}
