/**
 * Re-apply the validator to stored model JSON. Does not call the model.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { experimentCases } from "../luna-rich-context/cases";
import { buildSharedOrganiseContext } from "./context";
import { NEW_PROJECT_EXPERIMENT_CASES } from "./np-corpus";
import { parseProjectChangeForm, reviewProjectChangeForm, type ReviewedChange } from "./validate";

const OUT = "scripts/experiment/shared-organise/results/shared-organise.json";

function counts(rows: ReviewedChange[]) {
  const tally = { Ready: 0, "Needs You": 0, "Left untouched": 0, "No change": 0 };
  for (const row of rows) tally[row.label] += 1;
  return tally;
}

function summariseReview(rows: ReviewedChange[]) {
  return {
    counts: counts(rows),
    cards: rows.map((row) => ({
      id: row.id,
      label: row.label,
      domain: row.domain,
      modelOutcome: row.modelOutcome,
      modelOperation: row.modelOperation,
      operationType: row.operation?.type ?? null,
      reason: row.reason,
      safety: row.safety,
      evidence: row.evidence.slice(0, 240),
    })),
    survivingSafety: rows
      .filter((row) => row.label === "Ready" && row.safety.length > 0)
      .map((row) => ({ id: row.id, safety: row.safety, operation: row.operation?.type })),
  };
}

const data = JSON.parse(readFileSync(OUT, "utf8")) as {
  capture: Array<{ caseId: string; call: { rawJson: unknown }; review: unknown }>;
  newProject: Array<{ caseId: string; form: { rawModel: unknown; review: unknown } }>;
  reviewReplay?: string;
};

const cases = new Map(experimentCases().map((row) => [row.id, row]));
for (const row of data.capture) {
  const testCase = cases.get(row.caseId);
  if (!testCase) throw new Error(`missing case ${row.caseId}`);
  const context = buildSharedOrganiseContext({
    world: testCase.world,
    projectId: testCase.projectId,
  });
  row.review = summariseReview(
    reviewProjectChangeForm({
      form: parseProjectChangeForm(row.call.rawJson),
      context,
      source: testCase.transcript,
    }),
  );
}

const empty = buildSharedOrganiseContext({
  world: {
    projectIds: new Set(["proj-new"]),
    projects: [{ id: "proj-new", name: "New project", code: "NEW", stakeholders: [] }],
    risks: [],
    todos: [],
    timeline: [],
    knowledge: [],
  },
  projectId: "proj-new",
});
const sources = new Map(NEW_PROJECT_EXPERIMENT_CASES.map((row) => [row.id, row.source]));
for (const row of data.newProject) {
  const source = sources.get(row.caseId);
  if (!source) throw new Error(`missing np ${row.caseId}`);
  row.form.review = summariseReview(
    reviewProjectChangeForm({
      form: parseProjectChangeForm(row.form.rawModel),
      context: empty,
      source,
    }),
  );
}

data.reviewReplay =
  "Stored model JSON re-validated after the needs_you + operation none label fix. No new model calls.";
writeFileSync(OUT, JSON.stringify(data, null, 2));
console.log("replayed reviews");
