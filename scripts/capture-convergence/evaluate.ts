import type { CaptureObservationV2 } from "../../src/lib/capture-v2/types";
import { describeDiff, atomsEqual } from "./normalize";
import { runNewProjectAdapter, type NpRun } from "./np";
import { observationsOf } from "./obs";
import { focusAtoms, reasonClass, runPipeline, type PipelineRun } from "./pipeline";
import { worldFor } from "./worlds";
import type {
  CaseResult,
  ConvergenceCase,
  FailureClass,
  PipelineStage,
  SemanticAtom,
} from "./types";

export type Executed = {
  capture?: PipelineRun;
  np?: NpRun;
};

export function executeCase(testCase: ConvergenceCase): Executed {
  if (testCase.surface === "new_project") {
    return { np: runNewProjectAdapter(testCase) };
  }
  return {
    capture: runPipeline({
      transcript: testCase.transcript,
      rawModelJson: testCase.rawModelJson,
      world: worldFor(testCase.world),
      projectId: testCase.projectId,
    }),
  };
}

function snapshotOf(executed: Executed) {
  return executed.np?.snapshot ?? executed.capture!.snapshot;
}

function traceOf(executed: Executed) {
  return executed.np?.trace ?? executed.capture!.trace;
}

function atomMap(atoms: SemanticAtom[]) {
  return new Map(atoms.map((row) => [row.observationId, row]));
}

function earliestRelative(
  baseline: Executed,
  actual: Executed,
  focusIds: string[],
): PipelineStage | null {
  const wanted = new Set(focusIds);
  const left = traceOf(baseline);
  const right = traceOf(actual);
  if (left.parseMalformed !== right.parseMalformed) return "PARSE";

  const leftRejected = new Set(left.rejectedIds.filter((id) => wanted.has(id)));
  const rightRejected = new Set(right.rejectedIds.filter((id) => wanted.has(id)));
  if (
    leftRejected.size !== rightRejected.size ||
    [...leftRejected].some((id) => !rightRejected.has(id))
  ) {
    return "VALIDATE";
  }

  const lp = new Map(left.preserved.filter((row) => wanted.has(row.id)).map((row) => [row.id, row]));
  const rp = new Map(right.preserved.filter((row) => wanted.has(row.id)).map((row) => [row.id, row]));
  for (const id of wanted) {
    const a = lp.get(id);
    const b = rp.get(id);
    if (!a || !b) continue;
    if (
      a.statement !== b.statement ||
      a.evidence !== b.evidence ||
      a.name !== b.name ||
      a.scope !== b.scope ||
      a.date !== b.date
    ) {
      return "PRESERVE";
    }
  }

  const li = new Map(left.identity.filter((row) => wanted.has(row.id)).map((row) => [row.id, row]));
  const ri = new Map(right.identity.filter((row) => wanted.has(row.id)).map((row) => [row.id, row]));
  for (const id of wanted) {
    const a = li.get(id);
    const b = ri.get(id);
    if (!a || !b) continue;
    if (a.targetId !== b.targetId || a.bound !== b.bound || a.personName !== b.personName) {
      return "IDENTITY";
    }
  }

  const lplan = new Map(left.plan.filter((row) => wanted.has(row.id)).map((row) => [row.id, row]));
  const rplan = new Map(right.plan.filter((row) => wanted.has(row.id)).map((row) => [row.id, row]));
  for (const id of wanted) {
    const a = lplan.get(id);
    const b = rplan.get(id);
    if (!a || !b) continue;
    if (
      a.kind !== b.kind ||
      a.writeType !== b.writeType ||
      reasonClass(a.kind, a.reason) !== reasonClass(b.kind, b.reason)
    ) {
      const identityish =
        /person identity|more than one existing person|not on this project|needs a name/i.test(
          `${a.reason ?? ""} ${b.reason ?? ""}`,
        );
      return identityish ? "IDENTITY" : "PLANNER";
    }
  }

  const lr = new Map(left.review.filter((row) => wanted.has(row.id)).map((row) => [row.id, row]));
  const rr = new Map(right.review.filter((row) => wanted.has(row.id)).map((row) => [row.id, row]));
  for (const id of wanted) {
    const a = lr.get(id);
    const b = rr.get(id);
    if ((a?.readiness ?? null) !== (b?.readiness ?? null)) return "REVIEW";
  }

  const lAtoms = atomMap(focusAtoms(snapshotOf(baseline), focusIds));
  const rAtoms = atomMap(focusAtoms(snapshotOf(actual), focusIds));
  for (const id of wanted) {
    const a = lAtoms.get(id);
    const b = rAtoms.get(id);
    if (!a || !b) continue;
    if (a.decisionKind !== b.decisionKind || a.writeType !== b.writeType) {
      return "WRITE_ELIGIBILITY";
    }
  }
  return null;
}

function classify(
  testCase: ConvergenceCase,
  stage: PipelineStage | null,
  diffs: string[],
): FailureClass {
  if (testCase.expect?.productModelGap || testCase.family === "product_model_gap") {
    return "PRODUCT MODEL GAP";
  }
  const blob = diffs.join(" ").toLowerCase();
  if (stage === "PARSE" || stage === "VALIDATE") return "VALIDATION";
  if (stage === "PRESERVE" || /missing \(expected/.test(blob) && /scope|name|date/.test(blob)) {
    return "INFORMATION LOSS";
  }
  if (stage === "IDENTITY" || /needs_you_identity/.test(blob)) return "IDENTITY RESOLUTION";
  if (stage === "PLANNER" || stage === "WRITE_ELIGIBILITY") return "PLANNER";
  if (testCase.family === "information_preservation") return "INFORMATION LOSS";
  if (testCase.family === "identity_matrix") return "IDENTITY RESOLUTION";
  return "UNKNOWN";
}

function checkPreserve(testCase: ConvergenceCase, executed: Executed): string[] {
  const rules = testCase.expect?.preserve ?? [];
  if (!rules.length) return [];
  const trace = traceOf(executed);
  const input = observationsOf(testCase.rawModelJson);
  const byId = new Map(input.map((row) => [row.id, row]));
  const diffs: string[] = [];
  for (const rule of rules) {
    const flag = trace.preserved.find((row) => row.id === rule.id);
    const src = byId.get(rule.id);
    if (!flag) {
      diffs.push(`${rule.id}: missing preserve trace`);
      continue;
    }
    for (const field of rule.fields) {
      const had = hadField(src, field);
      if (!had) continue;
      if (!flag[field]) diffs.push(`${rule.id}: dropped ${field}`);
    }
  }
  return diffs;
}

function hadField(
  src: CaptureObservationV2 | undefined,
  field: "name" | "scope" | "date" | "statement" | "evidence",
): boolean {
  if (!src) return false;
  const values = src.proposedValues ?? {};
  if (field === "statement") return Boolean(src.statement?.trim());
  if (field === "evidence") return Boolean(src.evidence?.trim());
  if (field === "name") {
    return Boolean(
      (typeof values.name === "string" && values.name.trim()) ||
        (typeof values.personName === "string" && values.personName.trim()) ||
        src.candidateTargetTitle?.trim(),
    );
  }
  if (field === "scope") return typeof values.scope === "string" && Boolean(values.scope.trim());
  if (field === "date") {
    return Boolean(
      (typeof values.date === "string" && values.date.trim()) ||
        (typeof values.startAt === "string" && values.startAt.trim()) ||
        (typeof values.awayFromIso === "string" && values.awayFromIso.trim()),
    );
  }
  return false;
}

function checkAbsolute(testCase: ConvergenceCase, executed: Executed): string[] {
  const diffs: string[] = [];
  const atoms = atomMap(snapshotOf(executed).atoms);
  const expect = testCase.expect;
  if (!expect) return diffs;

  if (expect.decisionById) {
    for (const [id, kind] of Object.entries(expect.decisionById)) {
      const atom = atoms.get(id);
      if (!atom) {
        diffs.push(`${id}: missing atom (expected decision ${kind})`);
        continue;
      }
      if (atom.decisionKind !== kind) {
        diffs.push(`${id}: decision ${atom.decisionKind} (expected ${kind})`);
      }
    }
  }
  if (expect.writeTypeById) {
    for (const [id, writeType] of Object.entries(expect.writeTypeById)) {
      const atom = atoms.get(id);
      if (!atom) {
        diffs.push(`${id}: missing atom (expected writeType ${writeType})`);
        continue;
      }
      if (atom.writeType !== writeType) {
        diffs.push(`${id}: writeType ${atom.writeType ?? "null"} (expected ${writeType})`);
      }
    }
  }
  if (expect.reasonClassById) {
    for (const [id, cls] of Object.entries(expect.reasonClassById)) {
      const atom = atoms.get(id);
      if (!atom) {
        diffs.push(`${id}: missing atom (expected reasonClass ${cls})`);
        continue;
      }
      if (atom.reasonClass !== cls) {
        diffs.push(`${id}: reasonClass ${atom.reasonClass} (expected ${cls})`);
      }
    }
  }
  if (expect.reasonIncludesById) {
    const plan = new Map(traceOf(executed).plan.map((row) => [row.id, row]));
    for (const [id, needle] of Object.entries(expect.reasonIncludesById)) {
      const reason = plan.get(id)?.reason ?? "";
      if (!reason.includes(needle)) {
        diffs.push(`${id}: reason missing ${JSON.stringify(needle)}`);
      }
    }
  }
  if (expect.needsYouLocal) {
    const focus = testCase.focusIds
      .map((id) => atoms.get(id))
      .filter((row): row is SemanticAtom => Boolean(row));
    const writes = focus.filter((row) => row.decisionKind === "write");
    const needs = focus.filter((row) => row.decisionKind === "needs_you");
    if (writes.length > 1 && needs.length === 0) {
      diffs.push(
        `contradiction locality: ${writes.length} focus writes and 0 Needs You (expected conflict to stay local)`,
      );
    }
  }
  if (expect.np && executed.np) {
    if (
      expect.np.needsYouCount != null &&
      executed.np.needsYouCount !== expect.np.needsYouCount
    ) {
      diffs.push(
        `NP needsYou ${executed.np.needsYouCount} (expected ${expect.np.needsYouCount})`,
      );
    }
    if (expect.np.responsibilitiesByName) {
      for (const [name, scopes] of Object.entries(expect.np.responsibilitiesByName)) {
        const got = executed.np.responsibilitiesByName[name] ?? [];
        const same =
          got.length === scopes.length && scopes.every((scope) => got.includes(scope));
        if (!same) {
          diffs.push(
            `NP ${name} responsibilities ${JSON.stringify(got)} (expected ${JSON.stringify(scopes)})`,
          );
        }
      }
    }
    if (expect.np.names) {
      const got = new Set(
        executed.np.names.map((name) => name.trim().toLowerCase()).filter(Boolean),
      );
      for (const name of expect.np.names) {
        if (!got.has(name.trim().toLowerCase())) {
          diffs.push(`NP missing person ${name}`);
        }
      }
    }
  }
  return diffs;
}

function absoluteStage(diffs: string[]): PipelineStage | null {
  const blob = diffs.join(" ").toLowerCase();
  if (/malformed|rejected|missing atom/.test(blob) && /decision/.test(blob) === false) {
    return "VALIDATE";
  }
  if (/dropped /.test(blob)) return "PRESERVE";
  if (/reasonclass|identity/.test(blob)) return "IDENTITY";
  if (/writetype|decision/.test(blob)) return "PLANNER";
  if (/contradiction locality/.test(blob)) return "PLANNER";
  if (/np /.test(blob)) return "PRESERVE";
  return diffs.length ? "PLANNER" : null;
}

export function evaluateCase(
  testCase: ConvergenceCase,
  executed: Executed,
  byId: Map<string, Executed>,
): CaseResult {
  const diffs: string[] = [];
  let earliest: PipelineStage | null = null;

  diffs.push(...checkPreserve(testCase, executed));
  diffs.push(...checkAbsolute(testCase, executed));
  if (diffs.length && !earliest) earliest = absoluteStage(diffs);

  if (testCase.compareToId) {
    const baseline = byId.get(testCase.compareToId);
    if (!baseline) {
      diffs.push(`missing compareToId ${testCase.compareToId}`);
    } else {
      const expected = focusAtoms(snapshotOf(baseline), testCase.focusIds);
      const actual = focusAtoms(snapshotOf(executed), testCase.focusIds);
      if (!atomsEqual(expected, actual)) {
        diffs.push(describeDiff(expected, actual));
        earliest = earliestRelative(baseline, executed, testCase.focusIds) ?? earliest ?? "PLANNER";
      }
    }
  }

  const unique = [...new Set(diffs.filter(Boolean))];
  const ok = unique.length === 0;
  const classification = ok ? null : classify(testCase, earliest, unique);
  return {
    id: testCase.id,
    family: testCase.family,
    seed: testCase.seed,
    baseScenario: testCase.baseScenario,
    perturbation: testCase.perturbation,
    expectedInvariant: testCase.expectedInvariant,
    ok,
    expected: testCase.expectedInvariant,
    actual: ok ? "matches" : unique.join(" | "),
    earliestStage: ok ? null : earliest,
    classification,
    productModelGap: Boolean(testCase.expect?.productModelGap) || testCase.family === "product_model_gap",
    heldOut: Boolean(testCase.heldOut),
    snapshot: snapshotOf(executed),
  };
}
