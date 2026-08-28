/**
 * New Project — shared Capture extraction + setup lifecycle.
 * Fixture model output only. persistNewProject is not called.
 *
 * Run: npx tsx scripts/verify-new-project-v2.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildNewProject } from "../src/lib/create-project";
import {
  draftFromProvisional,
  isNewProjectV2Enabled,
  parseNewProjectV2Envelope,
  recategoriseItem,
} from "../src/lib/new-project-v2";
import { NEW_PROJECT_UNSCOPED_PROJECT_BLOCK } from "../src/lib/new-project-v2/extract";
import { NEW_PROJECT_MESSY_INPUT } from "../src/lib/experiments/worlds";

const ROOT = process.cwd();

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

/** Nick audit fixture — Capture-shaped observations, not a live model run. */
const ALFRESCO_PVS_OBSERVATIONS = {
  observations: [
    {
      id: "dev-1",
      statement: "Developer one is on the team",
      evidence: "We've got four developers",
      domain: "person",
      disposition: "ambiguous",
      proposedValues: { name: "Developer one" },
    },
    {
      id: "dev-2",
      statement: "Developer two is on the team",
      evidence: "We've got four developers",
      domain: "person",
      disposition: "ambiguous",
      proposedValues: { name: "Developer two" },
    },
    {
      id: "dev-3",
      statement: "Developer three is on the team",
      evidence: "We've got four developers",
      domain: "person",
      disposition: "ambiguous",
      proposedValues: { name: "Developer three" },
    },
    {
      id: "dev-4",
      statement: "Developer four is on the team",
      evidence: "We've got four developers",
      domain: "person",
      disposition: "ambiguous",
      proposedValues: { name: "Developer four" },
    },
    {
      id: "stack-legacy",
      statement: "Two developers are on Legacy",
      evidence: "Two are on the Legacy stack",
      domain: "knowledge",
      disposition: "create_new",
    },
    {
      id: "stack-react",
      statement: "Two developers are on React",
      evidence: "two are on React",
      domain: "knowledge",
      disposition: "create_new",
    },
    {
      id: "alfresco",
      statement: "Nothing goes live without records in Alfresco",
      evidence: "The Alfresco rule is that nothing goes live without records in Alfresco",
      domain: "knowledge",
      disposition: "create_new",
    },
    {
      id: "pvs",
      statement: "PVS testing and registration is separate work",
      evidence: "PVS testing and registration is a separate piece of work",
      domain: "knowledge",
      disposition: "create_new",
    },
  ],
};

function main() {
  check("shared extract path cannot be restored by flag", () => {
    assert.equal(isNewProjectV2Enabled({}), true);
    assert.equal(isNewProjectV2Enabled({ LUME_NEW_PROJECT_V2: "0" }), true);
    assert.equal(isNewProjectV2Enabled({ LUME_NEW_PROJECT_V2: "1" }), true);
  });

  const parsed = parseNewProjectV2Envelope({
    project: {
      name: "Candyland parade rebuild",
      summary: "Rebuild the Candyland parade",
      currentFocus: "Icing on Gumdrop Bridge",
    },
    observations: [
      {
        id: "p1",
        statement: "Pippa Gumdrop is UAT lead",
        evidence: "Pippa Gumdrop is UAT lead.",
        domain: "person",
        proposedValues: { name: "Pippa Gumdrop", role: "UAT lead" },
      },
      {
        id: "p2",
        statement: "Fizz Caramel is doing the float design",
        evidence: "Fizz Caramel is doing the float design.",
        domain: "person",
        proposedValues: { name: "Fizz Caramel", role: "Designer" },
      },
      {
        id: "r1",
        statement: "Gumdrop Bridge icing may slip",
        evidence: "We're worried the Gumdrop Bridge icing will slip.",
        domain: "risk",
        proposedValues: { title: "Gumdrop Bridge icing" },
      },
      {
        id: "d1",
        statement: "Parade day is 15 October 2026",
        evidence: "Parade day is 15 October 2026.",
        domain: "milestone",
        proposedValues: { label: "Parade day", date: "2026-10-15" },
      },
      {
        id: "t1",
        statement: "Order extra sprinkles",
        evidence: "Need to order extra sprinkles.",
        domain: "todo",
      },
      {
        id: "k1",
        statement: "CAB pack must be ready 24 hours before the parade",
        evidence: "CAB pack must be ready 24 hours before the parade.",
        domain: "knowledge",
      },
      {
        id: "c1",
        statement: "Pixel Ramos is not on this project",
        evidence: "Pixel Ramos is not on this project — she's on GamingStudio5000.",
        domain: "commentary",
      },
    ],
  });

  check("messy input organises into buckets", () => {
    assert.equal(parsed.project.name, "Candyland parade rebuild");
    assert.equal(parsed.items.filter((i) => i.category === "person").length, 2);
    assert.equal(parsed.items.filter((i) => i.category === "risk").length, 1);
    assert.equal(parsed.items.filter((i) => i.category === "milestone").length, 1);
    assert.equal(parsed.items.filter((i) => i.category === "todo").length, 1);
    assert.equal(parsed.items.filter((i) => i.category === "knowledge").length, 1);
    assert.equal(parsed.items.filter((i) => i.category === "commentary").length, 1);
  });

  check("Pixel Ramos is commentary, not a Person on Candyland", () => {
    const people = parsed.items.filter((i) => i.category === "person");
    assert.ok(!people.some((p) => /Pixel Ramos/i.test(p.statement)));
    assert.ok(
      parsed.items.some(
        (i) => i.category === "commentary" && /Pixel Ramos/i.test(i.statement),
      ),
    );
  });

  check("recategorise then draft mapping", () => {
    const moved = recategoriseItem(parsed.items, "t1", "knowledge");
    assert.equal(moved.find((i) => i.id === "t1")?.category, "knowledge");
    const draft = draftFromProvisional({
      sourceNarrative: NEW_PROJECT_MESSY_INPUT,
      sourceMode: "talk",
      project: parsed.project,
      items: moved,
    });
    assert.equal(draft.name, "Candyland parade rebuild");
    assert.ok((draft.stakeholders ?? []).some((s) => s.name === "Pippa Gumdrop"));
    assert.ok((draft.risks ?? []).some((r) => /Gumdrop Bridge/i.test(r.title)));
    assert.equal((draft.todos ?? []).length, 0);
    assert.ok((draft.knowledgeRemember ?? []).some((k) => /sprinkles/i.test(k.text)));
    assert.ok((draft.notMentioned ?? []).some((n) => /Pixel Ramos/i.test(n)));
    assert.equal(draft.sourceNarrative, NEW_PROJECT_MESSY_INPUT);
  });

  check("Capture envelope without project seed keeps Objective empty", () => {
    const fromCapture = parseNewProjectV2Envelope({
      observations: [
        {
          id: "obs-1",
          statement: "Sarah owns the business side",
          evidence: "Sarah owns the business side",
          domain: "person",
          disposition: "create_new",
          proposedValues: { name: "Sarah", role: "Business owner" },
        },
      ],
    });
    assert.equal(fromCapture.project.name, "");
    assert.equal(fromCapture.project.summary, "");
    assert.equal(fromCapture.project.currentFocus, "");
    const draft = draftFromProvisional({
      sourceNarrative: "Sarah owns the business side.",
      sourceMode: "talk",
      project: fromCapture.project,
      items: fromCapture.items,
    });
    assert.equal(draft.summary, "");
    assert.equal(draft.currentFocus, "");
    assert.doesNotMatch(draft.summary, /newly added to Lume/);
  });

  check("ambiguous observations map onto needsReview", () => {
    const fromCapture = parseNewProjectV2Envelope({
      observations: [
        {
          id: "obs-amb",
          statement: "Someone called Sam may be involved",
          evidence: "Someone called Sam may be involved",
          domain: "person",
          disposition: "ambiguous",
          proposedValues: { name: "Sam" },
        },
      ],
    });
    assert.equal(fromCapture.items[0]?.needsReview, true);
    const draft = draftFromProvisional({
      sourceNarrative: "Someone called Sam may be involved.",
      sourceMode: "talk",
      project: fromCapture.project,
      items: fromCapture.items,
    });
    assert.equal(draft.stakeholders?.[0]?.needsReview, true);
  });

  check("Alfresco/PVS fixture mapping preserves shared observations", () => {
    const mapped = parseNewProjectV2Envelope(ALFRESCO_PVS_OBSERVATIONS);
    assert.equal(mapped.project.summary, "");
    assert.equal(mapped.project.currentFocus, "");
    assert.equal(mapped.items.filter((i) => i.category === "person").length, 4);
    assert.ok(mapped.items.some((i) => /Alfresco/i.test(i.statement)));
    assert.ok(mapped.items.some((i) => /PVS/i.test(i.statement)));
    assert.ok(mapped.items.some((i) => /Legacy/i.test(i.statement)));
    assert.ok(mapped.items.some((i) => /React/i.test(i.statement)));
    const pvs = mapped.items.find((i) => /PVS/i.test(i.statement));
    const alfresco = mapped.items.find((i) => /Alfresco/i.test(i.statement));
    assert.ok(pvs && alfresco && pvs.id !== alfresco.id);
    const draft = draftFromProvisional({
      sourceNarrative: "four developers… Alfresco… PVS…",
      sourceMode: "talk",
      project: mapped.project,
      items: mapped.items,
    });
    assert.equal((draft.stakeholders ?? []).length, 4);
    assert.ok((draft.stakeholders ?? []).every((s) => s.needsReview));
    assert.equal(draft.summary, "");
    const bundle = buildNewProject(draft);
    assert.equal(bundle.project.summary, "");
    assert.equal(bundle.project.currentFocus, "");
    assert.doesNotMatch(bundle.project.summary, /newly added to Lume/);
  });

  check("blank persist does not invent Objective or currentFocus", () => {
    const bundle = buildNewProject({
      name: "Phoenix",
      code: "PHX",
      summary: "",
      currentFocus: "",
      sourceMode: "blank",
    });
    assert.equal(bundle.project.summary, "");
    assert.equal(bundle.project.currentFocus, "");
  });

  check("draft mapping does not persist — no supabase/create call in mapper", () => {
    const src = readSrc("src/lib/new-project-v2/map.ts");
    assert.doesNotMatch(src, /persistNewProject\(|createProject\(/);
  });

  check("Talk path uses shared Capture extractor, not a third engine", () => {
    const route = readSrc("src/app/api/new-project/route.ts");
    const extract = readSrc("src/lib/new-project-v2/extract.ts");
    const capture = readSrc("src/app/api/capture/route.ts");
    assert.match(route, /extractObservationsWithOpenAI/);
    assert.match(extract, /extractObservationsWithOpenAI/);
    assert.doesNotMatch(extract, /buildNewProjectV2Prompt/);
    assert.doesNotMatch(route, /buildNewProjectV2Prompt/);
    assert.doesNotMatch(route, /assembleFromNarrative/);
    assert.doesNotMatch(route, /assembleNarrativeWithOpenAI/);
    assert.match(route, /parseObservationEnvelope/);
    assert.match(route, /NEW_PROJECT_UNSCOPED_PROJECT_BLOCK/);
    assert.match(capture, /Current project: \(unscoped\)/);
    assert.match(capture, /Authoritative current records:/);
    assert.equal(
      NEW_PROJECT_UNSCOPED_PROJECT_BLOCK,
      "Current project: (unscoped)\nAuthoritative current records:\n(none)",
    );
  });

  check("client New Project UI does not import OpenAI extract", () => {
    const cat = readSrc("src/components/onboarding/NewProjectCategorisation.tsx");
    const exp = readSrc("src/components/onboarding/NewProjectExperience.tsx");
    const barrel = readSrc("src/lib/new-project-v2/index.ts");
    assert.doesNotMatch(cat, /extractNewProjectV2WithOpenAI|@\/lib\/openai/);
    assert.doesNotMatch(exp, /extractNewProjectV2WithOpenAI|@\/lib\/openai/);
    assert.doesNotMatch(barrel, /extractNewProjectV2WithOpenAI/);
    assert.doesNotMatch(exp, /assembleFromNarrative/);
  });

  check("OpenAI failure does not silently succeed with a regex draft", () => {
    const route = readSrc("src/app/api/new-project/route.ts");
    const contentPath = route.slice(
      route.indexOf("if (typeof body.content"),
      route.indexOf("if (!body?.answers"),
    );
    assert.match(contentPath, /status: 503/);
    assert.match(contentPath, /status: 502/);
    assert.doesNotMatch(contentPath, /assembleFromNarrative/);
    assert.doesNotMatch(contentPath, /draft: local/);
    const exp = readSrc("src/components/onboarding/NewProjectExperience.tsx");
    const analyse = exp.slice(exp.indexOf("async function analyseNarrative"));
    const analyseBody = analyse.slice(0, analyse.indexOf("function cancelBuild"));
    assert.doesNotMatch(analyseBody, /setPath\("review"\)/);
    assert.match(analyseBody, /Nothing was created/);
  });

  check("approval cannot be skipped in the Talk V2 UI", () => {
    const ui = readSrc("src/components/onboarding/NewProjectExperience.tsx");
    assert.match(ui, /categorisationApproved/);
    assert.match(ui, /createUnlocked/);
    assert.match(ui, /setCreateUnlocked\(false\)/);
    assert.match(ui, /if \(!createUnlocked\)/);
    assert.match(ui, /Approve the categorisation map before creating/);
    const cat = readSrc(
      "src/components/onboarding/NewProjectCategorisation.tsx",
    );
    assert.match(cat, /np-v2-approve-categorisation/);
    assert.match(cat, /not maintained project truth/);
  });

  console.log("verify-new-project-v2: OK");
}

main();
