/**
 * Model-only semantic metrics. Dimensions stay separate — never one score.
 */

import type { CaptureObservationV2, ObservationDomain } from "@/lib/capture-v2/types";
import type {
  BenchmarkCase,
  MaterialExpectation,
  ModelDimensionScores,
} from "./types";

function norm(value: string): string {
  return value.toLowerCase();
}

function blob(observation: CaptureObservationV2): string {
  return norm(
    [
      observation.statement,
      observation.evidence,
      observation.candidateTargetTitle ?? "",
      observation.commentary ?? "",
      JSON.stringify(observation.proposedValues ?? {}),
    ].join(" "),
  );
}

function covers(observation: CaptureObservationV2, fact: MaterialExpectation): boolean {
  const text = blob(observation);
  const hits = fact.meaningTokens.filter((token) => text.includes(norm(token)));
  if (hits.length < Math.ceil(fact.meaningTokens.length * 0.5)) return false;
  if (!fact.allowedDomains.includes(observation.domain)) return false;
  return true;
}

function dispositionsOf(fact: MaterialExpectation): string[] | null {
  if (!fact.expectedDisposition) return null;
  return Array.isArray(fact.expectedDisposition)
    ? fact.expectedDisposition
    : [fact.expectedDisposition];
}

function isWritey(observation: CaptureObservationV2): boolean {
  return (
    observation.disposition === "create_new" ||
    observation.disposition === "update_existing"
  );
}

export function scoreModelObservations(
  testCase: BenchmarkCase,
  observations: CaptureObservationV2[],
): ModelDimensionScores {
  const matchedFacts = new Map<string, string[]>();
  const used = new Set<string>();

  for (const fact of testCase.material) {
    const hits = observations.filter((obs) => covers(obs, fact));
    matchedFacts.set(
      fact.id,
      hits.map((h) => h.id),
    );
    hits.forEach((h) => used.add(h.id));
  }

  const missedMaterial = testCase.material
    .filter((fact) => (matchedFacts.get(fact.id) ?? []).length === 0)
    .map((fact) => fact.meaning);

  const materialRecall =
    testCase.material.length === 0
      ? null
      : (testCase.material.length - missedMaterial.length) / testCase.material.length;

  const unsupported: CaptureObservationV2[] = [];
  for (const obs of observations) {
    if (used.has(obs.id)) continue;
    if (obs.domain === "commentary" || obs.disposition === "commentary" || obs.disposition === "ignore") {
      if (testCase.expectedCommentary || testCase.expectedNoChange) continue;
    }
    if (obs.disposition === "merge" || obs.disposition === "no_change") continue;
    if (testCase.material.length === 0 && !isWritey(obs)) continue;
    unsupported.push(obs);
  }

  let domainChecked = 0;
  let domainOk = 0;
  const domainMismatches: string[] = [];
  let existingChecked = 0;
  let existingOk = 0;
  const existingVsNewMismatches: string[] = [];
  let targetChecked = 0;
  let targetOk = 0;
  const stableTargetMismatches: string[] = [];

  for (const fact of testCase.material) {
    const ids = matchedFacts.get(fact.id) ?? [];
    const obs = observations.find((o) => ids.includes(o.id));
    if (!obs) continue;

    domainChecked += 1;
    if (fact.allowedDomains.includes(obs.domain)) domainOk += 1;
    else domainMismatches.push(`${fact.id}: got ${obs.domain}`);

    if (fact.existingVsNew && fact.existingVsNew !== "none") {
      existingChecked += 1;
      const gotNew = obs.disposition === "create_new";
      const gotExisting =
        obs.disposition === "update_existing" || obs.disposition === "no_change";
      const gotAmbiguous =
        obs.disposition === "ambiguous" || obs.domain === "commentary";
      const ok =
        fact.existingVsNew === "new"
          ? gotNew || gotAmbiguous
          : fact.existingVsNew === "existing"
            ? gotExisting || gotAmbiguous
            : gotAmbiguous || obs.disposition === "ambiguous";
      if (ok) existingOk += 1;
      else existingVsNewMismatches.push(`${fact.id}: expected ${fact.existingVsNew}, got ${obs.disposition}`);
    }

    if (fact.existingTargetId) {
      targetChecked += 1;
      if (obs.candidateTargetId === fact.existingTargetId) targetOk += 1;
      else if (obs.disposition === "ambiguous" || obs.disposition === "no_change") {
        // Ambiguous / no-change without an ID is not a stable-target hit, but
        // also not a false ID. Count as miss of stable targeting.
        stableTargetMismatches.push(
          `${fact.id}: expected ${fact.existingTargetId}, got ${obs.candidateTargetId ?? "none"}`,
        );
      } else {
        stableTargetMismatches.push(
          `${fact.id}: expected ${fact.existingTargetId}, got ${obs.candidateTargetId ?? "none"}`,
        );
      }
    }
  }

  const expectsAmbiguity =
    Boolean(testCase.expectedNeedsYou) ||
    testCase.material.some((f) => f.expectedNeedsYou || f.existingVsNew === "ambiguous");
  let ambiguityPreserved: boolean | null = null;
  if (expectsAmbiguity) {
    ambiguityPreserved = observations.some(
      (o) =>
        o.disposition === "ambiguous" ||
        o.domain === "unknown" ||
        o.disposition === "commentary",
    );
    if (!ambiguityPreserved && observations.some(isWritey)) {
      ambiguityPreserved = false;
    } else if (observations.length === 0) {
      // Empty output preserves lack of false certainty.
      ambiguityPreserved = true;
    }
  }

  let noChangeHandled: boolean | null = null;
  if (testCase.expectedNoChange) {
    const wrote = observations.some(isWritey);
    const noted =
      observations.length === 0 ||
      observations.every(
        (o) =>
          o.disposition === "no_change" ||
          o.disposition === "commentary" ||
          o.disposition === "ignore" ||
          o.disposition === "merge" ||
          o.domain === "commentary",
      );
    noChangeHandled = !wrote && noted;
  }

  let commentaryHandled: boolean | null = null;
  if (testCase.expectedCommentary) {
    commentaryHandled =
      !observations.some(isWritey) &&
      (observations.length === 0 ||
        observations.every(
          (o) =>
            o.domain === "commentary" ||
            o.disposition === "commentary" ||
            o.disposition === "ignore" ||
            o.disposition === "no_change",
        ));
  }

  return {
    materialRecall,
    missedMaterial,
    unsupportedCount: unsupported.length,
    unsupportedObservationIds: unsupported.map((o) => o.id),
    domainCorrectness: domainChecked ? domainOk / domainChecked : null,
    domainMismatches,
    existingVsNewCorrectness: existingChecked ? existingOk / existingChecked : null,
    existingVsNewMismatches,
    stableTargetCorrectness: targetChecked ? targetOk / targetChecked : null,
    stableTargetMismatches,
    ambiguityPreserved,
    noChangeHandled,
    commentaryHandled,
  };
}

export function observationDomains(observations: CaptureObservationV2[]): ObservationDomain[] {
  return [...new Set(observations.map((o) => o.domain))];
}
