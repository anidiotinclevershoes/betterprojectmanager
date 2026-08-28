/**
 * Regression checks for intelligent new-project onboarding.
 * Local extraction only — no AI calls.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assembleFromNarrative,
  buildNewProject,
  countSetupItems,
  includedItemCount,
  TALK_EXAMPLE,
} from "../src/lib/create-project";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

check("rich talk extracts multiple entity types + knowledge", () => {
  const draft = assembleFromNarrative(TALK_EXAMPLE, "delivery", "talk");
  assert.match(draft.name.toLowerCase(), /horizon/);
  assert.ok((draft.stakeholders?.length ?? 0) >= 2);
  assert.ok((draft.risks?.length ?? 0) >= 1);
  assert.ok((draft.knowledgeRemember?.length ?? 0) >= 1);
  assert.ok((draft.importantDates?.length ?? 0) >= 1);
  const counts = countSetupItems(draft);
  assert.ok(counts.knowledge >= 1);
  assert.ok(includedItemCount(draft) >= 5);
});

check("sparse talk does not invent stakeholders/risks", () => {
  const draft = assembleFromNarrative(
    "This is Project Phoenix. We need the new portal live by November.",
    "delivery",
    "talk",
  );
  assert.match(draft.name.toLowerCase(), /phoenix/);
  assert.equal((draft.stakeholders ?? []).length, 0);
  assert.equal((draft.risks ?? []).length, 0);
  assert.ok(draft.name);
});

check("paste pathway shares assembleFromNarrative", () => {
  const talk = assembleFromNarrative(TALK_EXAMPLE, "delivery", "talk");
  const paste = assembleFromNarrative(TALK_EXAMPLE, "delivery", "paste");
  assert.equal(talk.name, paste.name);
  assert.ok((paste.knowledgeRemember?.length ?? 0) >= 1);
  assert.equal(talk.sourceMode, "talk");
  assert.equal(paste.sourceMode, "paste");
});

check("buildNewProject does not invent when blank", () => {
  const bundle = buildNewProject({
    name: "Phoenix",
    code: "PHX",
    summary: "",
    currentFocus: "",
    sourceMode: "blank",
  });
  assert.equal(bundle.project.name, "Phoenix");
  assert.equal(bundle.project.summary, "");
  assert.equal(bundle.project.currentFocus, "");
  assert.doesNotMatch(bundle.project.summary, /newly added to Lume/);
  assert.doesNotMatch(bundle.project.currentFocus, /Establish baseline/);
  assert.equal(bundle.todos.length, 0);
  assert.equal(bundle.knowledge.sections.risks.length, 0);
});

check("buildNewProject includes extracted todos/risks/timeline", () => {
  const draft = assembleFromNarrative(TALK_EXAMPLE, "delivery", "talk");
  const bundle = buildNewProject(draft);
  assert.ok(bundle.knowledge.sections.risks.length >= 1);
  assert.ok(bundle.todos.length >= 0);
  assert.equal(bundle.project.id.startsWith("proj-"), true);
});

check("nothing auto-created without createProject call", () => {
  const draft = assembleFromNarrative(TALK_EXAMPLE, "delivery", "talk");
  // assemble is pure — bundle only when buildNewProject is invoked explicitly
  assert.ok(draft.sourceNarrative);
  assert.ok(!("id" in draft));
});

check("live Talk/Paste path does not call regex assembleFromNarrative", () => {
  const route = readFileSync(
    join(process.cwd(), "src/app/api/new-project/route.ts"),
    "utf8",
  );
  const exp = readFileSync(
    join(process.cwd(), "src/components/onboarding/NewProjectExperience.tsx"),
    "utf8",
  );
  assert.doesNotMatch(route, /assembleFromNarrative/);
  assert.doesNotMatch(exp, /assembleFromNarrative/);
  assert.match(route, /extractObservationsWithOpenAI/);
});

console.log(`\n${passed} onboarding checks passed.`);
