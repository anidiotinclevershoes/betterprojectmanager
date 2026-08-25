/**
 * New Project V2 — provisional categorisation map.
 * Fixture model output only. persistNewProject is not called.
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

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

function main() {
  check("flag defaults off", () => {
    assert.equal(isNewProjectV2Enabled({}), false);
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

  check("draft mapping does not persist — no supabase/create call in mapper", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/new-project-v2/map.ts"),
      "utf8",
    );
    assert.doesNotMatch(src, /persistNewProject\(|createProject\(/);
  });

  check("approval cannot be skipped in the Talk V2 UI", () => {
    const ui = readFileSync(
      join(process.cwd(), "src/components/onboarding/NewProjectExperience.tsx"),
      "utf8",
    );
    assert.match(ui, /categorisationApproved/);
    assert.match(ui, /Approve the categorisation map before creating/);
    const cat = readFileSync(
      join(
        process.cwd(),
        "src/components/onboarding/NewProjectCategorisation.tsx",
      ),
      "utf8",
    );
    assert.match(cat, /np-v2-approve-categorisation/);
    assert.match(cat, /not maintained project truth/);
  });

  console.log("verify-new-project-v2: OK");
}

main();
