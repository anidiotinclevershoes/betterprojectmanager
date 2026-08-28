/**
 * New Project V2 — provisional categorisation map.
 * Fixture model output only. persistNewProject is not called.
 * Live Talk/Paste uses shared Capture extractObservationsWithOpenAI;
 * this file only checks the New Project adapter + lifecycle gates.
 *
 * CLASS C if treated as Talk composition proof.
 * This suite starts from already-split observations. That does NOT prove
 * messy New Project input uses the shared Capture extractor. See
 * scripts/verify-v09-architecture-conformance.ts journey 1.
 *
 * Run: npx tsx scripts/verify-new-project-v2.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  draftFromProvisional,
  isNewProjectV2Enabled,
  parseNewProjectV2Envelope,
  recategoriseItem,
} from "../src/lib/new-project-v2";
import { NEW_PROJECT_MESSY_INPUT } from "../src/lib/experiments/worlds";
import { buildNewProject } from "../src/lib/create-project";

const ROOT = process.cwd();

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

/** Shared Capture observation shape for the developer / Alfresco / PVS case. */
const ALFRESCO_PVS_OBSERVATIONS = [
  {
    id: "obs-olga",
    statement: "Olga is a Legacy developer",
    evidence: "Olga and Andris are on Legacy",
    domain: "person",
    disposition: "ambiguous",
    proposedValues: { name: "Olga", role: "Legacy" },
  },
  {
    id: "obs-andris",
    statement: "Andris is a Legacy developer",
    evidence: "Olga and Andris are on Legacy",
    domain: "person",
    disposition: "ambiguous",
    proposedValues: { name: "Andris", role: "Legacy" },
  },
  {
    id: "obs-martins",
    statement: "Martins is a React developer",
    evidence: "Martins and Elman are on React",
    domain: "person",
    disposition: "ambiguous",
    proposedValues: { name: "Martins", role: "React" },
  },
  {
    id: "obs-elman",
    statement: "Elman is a React developer",
    evidence: "Martins and Elman are on React",
    domain: "person",
    disposition: "ambiguous",
    proposedValues: { name: "Elman", role: "React" },
  },
  {
    id: "obs-alfresco",
    statement: "Alfresco applies to the Legacy stack only",
    evidence: "Alfresco is a Legacy-only rule",
    domain: "knowledge",
    disposition: "create_new",
  },
  {
    id: "obs-pvs",
    statement: "PVS has a separate testing and registration rule",
    evidence: "PVS testing and registration is a separate rule",
    domain: "knowledge",
    disposition: "create_new",
  },
  {
    id: "obs-bau",
    statement: "This work is BAU",
    evidence: "this is BAU",
    domain: "knowledge",
    disposition: "create_new",
  },
];

function main() {
  check("flag helper still exists but is unused by the live Talk path", () => {
    assert.equal(isNewProjectV2Enabled({}), false);
    assert.equal(isNewProjectV2Enabled({ LUME_NEW_PROJECT_V2: "1" }), true);
    const route = readSrc("src/app/api/new-project/route.ts");
    assert.doesNotMatch(route, /isNewProjectV2Enabled/);
    assert.doesNotMatch(route, /LUME_NEW_PROJECT_V2/);
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
        disposition: "create_new",
        proposedValues: { name: "Pippa Gumdrop", role: "UAT lead" },
      },
      {
        id: "p2",
        statement: "Fizz Caramel is doing the float design",
        evidence: "Fizz Caramel is doing the float design.",
        domain: "person",
        disposition: "create_new",
        proposedValues: { name: "Fizz Caramel", role: "Designer" },
      },
      {
        id: "r1",
        statement: "Gumdrop Bridge icing may slip",
        evidence: "We're worried the Gumdrop Bridge icing will slip.",
        domain: "risk",
        disposition: "create_new",
        proposedValues: { title: "Gumdrop Bridge icing" },
      },
      {
        id: "d1",
        statement: "Parade day is 15 October 2026",
        evidence: "Parade day is 15 October 2026.",
        domain: "milestone",
        disposition: "create_new",
        proposedValues: { label: "Parade day", date: "2026-10-15" },
      },
      {
        id: "t1",
        statement: "Order extra sprinkles",
        evidence: "Need to order extra sprinkles.",
        domain: "todo",
        disposition: "create_new",
      },
      {
        id: "k1",
        statement: "CAB pack must be ready 24 hours before the parade",
        evidence: "CAB pack must be ready 24 hours before the parade.",
        domain: "knowledge",
        disposition: "create_new",
      },
      {
        id: "c1",
        statement: "Pixel Ramos is not on this project",
        evidence: "Pixel Ramos is not on this project — she's on GamingStudio5000.",
        domain: "commentary",
        disposition: "commentary",
      },
    ],
  });

  check("messy input organises into buckets from Capture observations", () => {
    assert.equal(parsed.project.name, "");
    assert.equal(parsed.project.summary, "");
    assert.equal(parsed.project.currentFocus, "");
    assert.equal(parsed.envelopeMalformed, false);
    assert.equal(parsed.items.filter((i) => i.category === "person").length, 2);
    assert.equal(parsed.items.filter((i) => i.category === "risk").length, 1);
    assert.equal(parsed.items.filter((i) => i.category === "milestone").length, 1);
    assert.equal(parsed.items.filter((i) => i.category === "todo").length, 1);
    assert.equal(parsed.items.filter((i) => i.category === "knowledge").length, 1);
    assert.equal(parsed.items.filter((i) => i.category === "commentary").length, 1);
  });

  check("envelope project metadata is ignored so Objective is not invented", () => {
    assert.equal(parsed.project.summary, "");
    assert.doesNotMatch(parsed.project.summary, /Rebuild the Candyland/);
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
      project: {
        name: "Candyland parade rebuild",
        summary: "",
        currentFocus: "",
      },
      items: moved,
    });
    assert.equal(draft.name, "Candyland parade rebuild");
    assert.equal(draft.summary, "");
    assert.equal(draft.currentFocus, "");
    assert.ok((draft.stakeholders ?? []).some((s) => s.name === "Pippa Gumdrop"));
    assert.ok((draft.risks ?? []).some((r) => /Gumdrop Bridge/i.test(r.title)));
    assert.equal((draft.todos ?? []).length, 0);
    assert.ok((draft.knowledgeRemember ?? []).some((k) => /sprinkles/i.test(k.text)));
    assert.ok((draft.notMentioned ?? []).some((n) => /Pixel Ramos/i.test(n)));
    assert.equal(draft.sourceNarrative, NEW_PROJECT_MESSY_INPUT);
  });

  check("Alfresco/PVS fixture keeps four people, two rules, and no Objective", () => {
    const mapped = parseNewProjectV2Envelope({
      project: {
        name: "Should not be used",
        summary:
          "there are four developers Olga and Andris Martins and Elman leftover transcript",
        currentFocus: "Establish baseline: owners, next milestone, and open risks",
      },
      observations: ALFRESCO_PVS_OBSERVATIONS,
    });
    const people = mapped.items.filter((i) => i.category === "person");
    assert.equal(people.length, 4);
    assert.ok(people.every((p) => p.disposition === "ambiguous"));
    const knowledge = mapped.items.filter((i) => i.category === "knowledge");
    assert.ok(knowledge.some((k) => /Alfresco/i.test(k.statement)));
    assert.ok(knowledge.some((k) => /PVS/i.test(k.statement)));
    assert.ok(knowledge.some((k) => /BAU/i.test(k.statement)));
    assert.equal(mapped.project.summary, "");
    assert.equal(mapped.project.currentFocus, "");
    assert.doesNotMatch(mapped.project.summary, /four developers/i);

    const draft = draftFromProvisional({
      sourceNarrative: "four developers on Legacy and React. Alfresco. PVS. BAU.",
      sourceMode: "talk",
      project: mapped.project,
      items: mapped.items,
    });
    assert.equal((draft.stakeholders ?? []).length, 4);
    assert.ok((draft.stakeholders ?? []).every((s) => s.needsReview));
    assert.ok((draft.knowledgeRemember ?? []).some((k) => /Alfresco/i.test(k.text)));
    assert.ok((draft.knowledgeRemember ?? []).some((k) => /PVS/i.test(k.text)));
    assert.equal(draft.summary, "");
    assert.equal(draft.currentFocus, "");

    const bundle = buildNewProject({
      ...draft,
      name: "BAU platform",
      code: "BAU",
    });
    assert.equal(bundle.project.summary, "");
    assert.equal(bundle.project.currentFocus, "");
    assert.doesNotMatch(bundle.project.summary, /newly added to Lume/);
    assert.doesNotMatch(
      bundle.project.currentFocus,
      /Establish baseline: owners, next milestone, and open risks/,
    );
    assert.equal(bundle.project.stakeholders.length, 4);
  });

  check("ambiguous disposition maps onto existing needsReview", () => {
    const mapped = parseNewProjectV2Envelope({
      observations: [
        {
          id: "p-amb",
          statement: "Someone named Olga may be on Legacy",
          evidence: "Olga maybe on Legacy",
          domain: "person",
          disposition: "ambiguous",
        },
        {
          id: "r-amb",
          statement: "Alfresco rule may be Legacy-only",
          evidence: "Alfresco maybe Legacy only",
          domain: "risk",
          disposition: "ambiguous",
        },
      ],
    });
    const draft = draftFromProvisional({
      sourceNarrative: "Olga maybe. Alfresco maybe.",
      sourceMode: "paste",
      project: { name: "BAU", summary: "", currentFocus: "" },
      items: mapped.items,
    });
    assert.equal(draft.stakeholders?.[0]?.needsReview, true);
    assert.equal(draft.risks?.[0]?.needsReview, true);
  });

  check("malformed Capture envelope fails closed in the adapter", () => {
    const bad = parseNewProjectV2Envelope("not json");
    assert.equal(bad.envelopeMalformed, true);
    assert.equal(bad.items.length, 0);
    const missing = parseNewProjectV2Envelope({ hello: true });
    assert.equal(missing.envelopeMalformed, true);
    assert.equal(missing.items.length, 0);
  });

  check("draft mapping does not persist — no supabase/create call in mapper", () => {
    const src = readSrc("src/lib/new-project-v2/map.ts");
    assert.doesNotMatch(src, /persistNewProject\(|createProject\(/);
  });

  check("client New Project UI does not import OpenAI extract", () => {
    const cat = readSrc("src/components/onboarding/NewProjectCategorisation.tsx");
    const exp = readSrc("src/components/onboarding/NewProjectExperience.tsx");
    const barrel = readSrc("src/lib/new-project-v2/index.ts");
    assert.doesNotMatch(cat, /extractNewProjectV2WithOpenAI|@\/lib\/openai/);
    assert.doesNotMatch(exp, /extractNewProjectV2WithOpenAI|@\/lib\/openai/);
    assert.doesNotMatch(barrel, /extractNewProjectV2WithOpenAI/);
  });

  check("Talk/Paste uses shared Capture extractor, not a New Project engine", () => {
    const route = readSrc("src/app/api/new-project/route.ts");
    const parse = readSrc("src/lib/new-project-v2/parse.ts");
    assert.match(route, /extractObservationsWithOpenAI/);
    assert.match(route, /from "@\/lib\/capture-v2\/extract"/);
    assert.doesNotMatch(route, /extractNewProjectV2WithOpenAI/);
    assert.doesNotMatch(route, /assembleFromNarrative/);
    assert.doesNotMatch(route, /assembleNarrativeWithOpenAI/);
    assert.doesNotMatch(route, /runCaptureV2FromModelJson/);
    assert.doesNotMatch(route, /planCaptureApply|executeCaptureApply/);
    assert.match(parse, /parseObservationEnvelope/);
    assert.match(parse, /validateObservations/);
  });

  check("client fail-closed does not regex-assemble on AI failure", () => {
    const exp = readSrc("src/components/onboarding/NewProjectExperience.tsx");
    assert.doesNotMatch(exp, /assembleFromNarrative/);
    assert.doesNotMatch(exp, /Showing a local draft instead/);
    const analyse = exp.slice(exp.indexOf("async function analyseNarrative"));
    const analyseBody = analyse.slice(0, analyse.indexOf("function cancelBuild"));
    assert.doesNotMatch(analyseBody, /setPath\("review"\)/);
    assert.doesNotMatch(analyseBody, /setCreateUnlocked\(true\)/);
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
