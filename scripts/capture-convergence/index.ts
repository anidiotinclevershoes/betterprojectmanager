import { buildGeneratedCases } from "./cases";
import {
  DISTINCT_CAPTURE_BEHAVIOURS,
  DISTINCT_NEW_PROJECT_BEHAVIOURS,
  HISTORICAL_BEHAVIOURS,
} from "./catalogue";
import { buildHeldOutCases } from "./held-out";
import type { ConvergenceCase, FamilyId } from "./types";

export function allCases(): ConvergenceCase[] {
  return [...buildGeneratedCases(), ...buildHeldOutCases()];
}

export function catalogueCounts() {
  return {
    historicalScenarioCount: HISTORICAL_BEHAVIOURS.length,
    historicalCaptureBehaviours: DISTINCT_CAPTURE_BEHAVIOURS,
    historicalNewProjectBehaviours: DISTINCT_NEW_PROJECT_BEHAVIOURS,
  };
}

export function perturbationCount(cases: ConvergenceCase[]) {
  return cases.filter((row) => row.perturbation !== "none" && !row.perturbation.startsWith("none")).length;
}

export function familyFilter(cases: ConvergenceCase[], family: FamilyId) {
  return cases.filter((row) => row.family === family);
}
