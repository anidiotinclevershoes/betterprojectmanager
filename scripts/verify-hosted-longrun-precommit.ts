/**
 * Deterministic proofs that the long-run programme is frozen and off CI.
 * No network. No OpenAI. No hosted execution.
 *
 * Run: npm run verify:hosted-longrun-precommit
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { CAPTURES, LONGRUN_SEED, LONGRUN_SUITE_ID } from "../e2e-hosted-longrun/frozen-manifest";
import { FORBIDDEN_SUITE_MARKERS, NEW_PROJECT_NOTES } from "../e2e-hosted-longrun/new-project";
import { hashCanonicalSlice, LONGRUN_DB_CHECKPOINTS } from "../e2e-hosted-longrun/db-verify";

const ROOT = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`ok  ${name}`);
}

const spec = read("e2e-hosted-longrun/SPEC.md");
const readme = read("e2e-hosted-longrun/README.md");
const pkg = read("package.json");
const regression = read("scripts/run-regression-suite.ts");
const docs = read("docs/README.md");
const allSources = [NEW_PROJECT_NOTES, ...CAPTURES.map((c) => c.source)].join("\n");

check("suite id and seed are frozen", () => {
  assert.equal(LONGRUN_SUITE_ID, "hosted-longrun-v1");
  assert.equal(LONGRUN_SEED, "lume-longrun-v1-20260912-a3db");
  assert.match(spec, /hosted-longrun-v1/);
  assert.match(spec, /lume-longrun-v1-20260912-a3db/);
});

check("exactly 50 frozen captures in order", () => {
  assert.equal(CAPTURES.length, 50);
  assert.deepEqual(
    CAPTURES.map((c) => c.n),
    Array.from({ length: 50 }, (_, i) => i + 1),
  );
});

check("size mix is in the guided bands", () => {
  const single = CAPTURES.filter((c) => c.size === "single").length;
  const mixed = CAPTURES.filter((c) => c.size === "mixed").length;
  const heavy = CAPTURES.filter((c) => c.size === "heavy").length;
  assert.ok(single >= 10 && single <= 18, `single ${single}`);
  assert.ok(mixed >= 22 && mixed <= 32, `mixed ${mixed}`);
  assert.ok(heavy >= 5 && heavy <= 10, `heavy ${heavy}`);
});

check("Review interactions are pre-planned", () => {
  const kinds = CAPTURES.flatMap((c) => c.review.map((r) => r.kind));
  assert.ok(kinds.filter((k) => k === "exclude").length >= 3);
  assert.ok(kinds.includes("exclude_then_reinclude"));
  assert.ok(kinds.filter((k) => k === "needs_you_resolve").length >= 2);
  assert.ok(kinds.filter((k) => k === "needs_you_exclude").length >= 2);
  assert.ok(kinds.includes("edit_date"));
  assert.ok(kinds.includes("edit_entity_kind"));
});

check("reload checkpoints include suggested gates", () => {
  const checked = new Set(
    CAPTURES.filter((c) => c.checkpoint?.includes("reload")).map((c) => c.n),
  );
  for (const n of [5, 10, 20, 30, 40, 50]) assert.ok(checked.has(n), `missing reload ${n}`);
});

check("product-model gaps are not expected deletes", () => {
  const gaps = CAPTURES.flatMap((c) => c.expected).filter((e) => e.op === "product_model_gap_needs_you");
  assert.ok(gaps.length >= 2);
  assert.equal(
    CAPTURES.flatMap((c) => c.expected).filter((e) => e.op === "remove").length,
    0,
    "do not invent milestone/person/knowledge Remove success",
  );
});

check("forbidden 6+6 markers stay out of this story", () => {
  for (const marker of FORBIDDEN_SUITE_MARKERS) {
    assert.equal(allSources.toLowerCase().includes(marker.toLowerCase()), false, marker);
  }
});

check("not wired into npm test or the regression suite", () => {
  assert.match(pkg, /"e2e:hosted-longrun"/);
  assert.match(pkg, /"verify:hosted-longrun-precommit"/);
  assert.doesNotMatch(regression, /hosted-longrun/);
  const testScript = pkg.match(/"test":\s*"([^"]+)"/)?.[1] || "";
  assert.doesNotMatch(testScript, /hosted-longrun/);
});

check("docs entry points at the programme", () => {
  assert.match(docs, /e2e-hosted-longrun/);
  assert.match(readme, /not.*npm test/);
});

check("canonical DB verification is mandatory and off CI", () => {
  assert.match(spec, /Canonical database verification/);
  assert.match(spec, /SELECT/);
  assert.match(spec, /information_schema/);
  assert.deepEqual([...LONGRUN_DB_CHECKPOINTS], [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  assert.match(pkg, /"audit:hosted-longrun-db"/);
  assert.doesNotMatch(regression, /audit-hosted-longrun-db/);
  const journeys = read("e2e-hosted-longrun/journeys.spec.ts");
  assert.match(journeys, /proveProductionSupabaseCorrespondence/);
  assert.match(journeys, /isDbCheckpoint/);
});

check("canonical hash ignores row order", () => {
  const base = {
    projectId: "p",
    projectName: "n",
    projectCode: "c",
    people: [
      { id: "b", name: "B" },
      { id: "a", name: "A" },
    ],
    todos: [],
    risks: [],
    milestones: [],
    knowledge: [],
    responsibilities: [],
  };
  assert.equal(
    hashCanonicalSlice(base),
    hashCanonicalSlice({ ...base, people: [...base.people].reverse() }),
  );
});

console.log("\nhosted-longrun precommit: all checks passed");
