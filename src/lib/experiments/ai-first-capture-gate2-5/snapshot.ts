/**
 * Gate 2.5 snapshot. Gate 2 already supplied project.id / name / code.
 * This only makes the current-project header explicit. No other-project
 * catalogue, retrieval, or regex.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import {
  knownCanonicalIds,
  measureSnapshot,
} from "@/lib/experiments/ai-first-capture-gate1-v2/snapshot";
import { serializeCurrentCanonicalTruth as serializeGate2Snapshot } from "@/lib/experiments/ai-first-capture-gate1-v2/snapshot";

export { knownCanonicalIds, measureSnapshot };

export function serializeCurrentCanonicalTruth(
  world: CaptureApplyWorld,
  projectId: string,
): string {
  const project = world.projects.find((p) => p.id === projectId);
  const body = serializeGate2Snapshot(world, projectId);
  const withoutOldHead = body.replace(
    /^CURRENT CANONICAL PROJECT TRUTH\nCurrent rows only\. Not history\. Not Review\. Not ranked\.\nproject\.id=\S[^\n]*/,
    [
      "CURRENT PROJECT",
      `id=${JSON.stringify(project?.id ?? projectId)}`,
      `name=${JSON.stringify(project?.name ?? "")}`,
      `code=${JSON.stringify(project?.code ?? "")}`,
      "Current rows only. Not history. Not Review. Not ranked. Not other projects.",
    ].join("\n"),
  );
  return withoutOldHead;
}
