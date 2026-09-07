/**
 * Four-frame New Project — identity, sparse create, Needs You, organise merge.
 * Local / deterministic. Does not call OpenAI.
 *
 * Run: npx tsx scripts/verify-new-project-four-frame.ts
 */
import assert from "node:assert/strict";
import {
  buildNewProject,
  isProjectCodeTaken,
  isProjectNameTaken,
  projectCodeTakenMessage,
  projectNameTakenMessage,
  suggestCode,
  type CreateProjectInput,
} from "../src/lib/create-project";
import { deriveProjectSummary } from "../src/lib/new-project/derive-summary";
import { mergeOrganisedDraft } from "../src/lib/new-project/merge-organised";
import { needsYouFromDraft } from "../src/lib/new-project/needs-you";
import { parsePersonLine } from "../src/lib/new-project/person-text";
import {
  risksFromSetup,
  structuredItemsFromSetup,
} from "../src/lib/new-project/materialise-setup";
import { draftFromProvisional } from "../src/lib/new-project-v2";
import { persistNewProject } from "../src/lib/data/supabase/persist-mutations";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import type { MissionState } from "../src/lib/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  })();
}

function composeDraft(overrides: Partial<CreateProjectInput> = {}): CreateProjectInput {
  return {
    name: "Member Claims Upload",
    code: "MCU",
    summary: "",
    currentFocus: "",
    sourceMode: "compose",
    stakeholders: [],
    risks: [],
    todos: [],
    importantDates: [],
    knowledgeRemember: [],
    ...overrides,
  };
}

async function main() {
  await check("deterministic code: compact 2–3 characters, never one letter", () => {
    assert.equal(suggestCode("Member Claims Upload"), "MCU");
    assert.equal(suggestCode("Web BAU"), "WB");
    assert.equal(suggestCode("Phoenix"), "PH");
    assert.equal(suggestCode("Customer Data Platform"), "CDP");
    assert.equal(suggestCode("  atlas  "), "AT");
    assert.equal(suggestCode("W"), "");
    assert.ok((suggestCode("Web BAU") ?? "").length >= 2);
  });

  await check("manual code is not overwritten by name helper", () => {
    const generated = suggestCode("Member Claims Upload");
    const manual = "CLAIMS";
    assert.notEqual(manual, generated);
    assert.equal(manual, "CLAIMS");
  });

  await check("duplicate code is blocked at workspace scope, no suffix", () => {
    const existing = [
      { id: "a", code: "MCU" },
      { id: "b", code: "ATLAS" },
    ];
    assert.equal(isProjectCodeTaken(existing, "mcu"), true);
    assert.equal(isProjectCodeTaken(existing, "MCU"), true);
    assert.equal(isProjectCodeTaken(existing, "CLAIMS"), false);
    assert.equal(isProjectCodeTaken(existing, "MCU", "a"), false);
    assert.match(projectCodeTakenMessage("MCU"), /already exists/i);
    assert.doesNotMatch(projectCodeTakenMessage("MCU"), /MCU-2|MCU1/);
  });

  await check("names and codes are unique at workspace scope", () => {
    const existing = [{ id: "a", code: "ONE", name: "Same Project" }];
    assert.equal(isProjectCodeTaken(existing, "TWO"), false);
    assert.equal(isProjectNameTaken(existing, "same project"), true);
    assert.equal(isProjectNameTaken(existing, "Other"), false);
    assert.equal(isProjectNameTaken(existing, "Same Project", "a"), false);
    assert.match(projectNameTakenMessage("Same Project"), /already exists/i);
  });

  await check("sparse compose create does not invent todos, dates, or roles", () => {
    const bundle = buildNewProject(composeDraft());
    assert.equal(bundle.todos.length, 0);
    assert.equal(bundle.timeline.length, 0);
    assert.equal(bundle.project.stakeholders.length, 0);
    assert.equal(bundle.recommendations.length, 0);
    assert.equal(bundle.project.currentFocus, "");
  });

  await check("many responsibilities per person and shared scopes persist as structured overlay", () => {
    const draft = composeDraft({
      stakeholders: [
        {
          name: "Sarah Murphy",
          responsibilities: ["Product Owner", "UAT", "CAB representative"],
        },
        {
          name: "Niamh Kelly",
          responsibilities: ["UAT", "Business SME"],
        },
      ],
    });
    const bundle = buildNewProject(draft);
    assert.equal(bundle.project.stakeholders.length, 2);
    const structured = structuredItemsFromSetup({
      projectId: bundle.project.id,
      input: draft,
      stakeholders: bundle.project.stakeholders,
    });
    const scopes = structured
      .filter((i) => i.kind === "responsibility")
      .map((i) => i.meta?.responsibility?.scope);
    assert.equal(scopes.filter((s) => s === "UAT").length, 2);
    assert.ok(scopes.includes("Product Owner"));
    assert.ok(scopes.includes("CAB representative"));
    assert.ok(scopes.includes("Business SME"));
  });

  await check("undated milestone is not persisted as a timeline row", () => {
    const draft = composeDraft({
      importantDates: [{ label: "Beta milestone" }],
    });
    const bundle = buildNewProject(draft);
    assert.equal(bundle.timeline.length, 0);
    const structured = structuredItemsFromSetup({
      projectId: bundle.project.id,
      input: draft,
      stakeholders: [],
    });
    assert.ok(structured.some((i) => i.kind === "date" && !i.meta?.date?.dateIso));
    assert.ok(
      needsYouFromDraft(draft).some((q) => /When is the Beta milestone/i.test(q.question)),
    );
  });

  await check("person without responsibility is persistable and is not fake Needs You", () => {
    const draft = composeDraft({
      stakeholders: [{ name: "Sarah Murphy", responsibilities: [] }],
    });
    const bundle = buildNewProject(draft);
    assert.equal(bundle.project.stakeholders[0]?.name, "Sarah Murphy");
    assert.equal(bundle.project.stakeholders[0]?.role, "");
    assert.equal(
      needsYouFromDraft(draft).some((q) =>
        /What is Sarah Murphy responsible for/i.test(q.question),
      ),
      false,
    );
    const structured = structuredItemsFromSetup({
      projectId: bundle.project.id,
      input: draft,
      stakeholders: bundle.project.stakeholders,
    });
    assert.equal(
      structured.some((item) => item.kind === "ambiguity"),
      false,
    );
  });

  await check("extract mapping splits concatenated person names and keeps structured scopes", () => {
    const draft = draftFromProvisional({
      sourceNarrative: "Andris is responsible for Legacy. Olga is on the team.",
      sourceMode: "paste",
      project: { name: "", summary: "", currentFocus: "" },
      items: [
        {
          id: "p-andris",
          statement: "Andris is responsible for Legacy",
          evidence: "Andris is responsible for Legacy",
          modelDomain: "person",
          category: "person",
          proposedValues: { name: "Andris responsible for Legacy" },
        },
        {
          id: "p-olga",
          statement: "Olga is on the team",
          evidence: "Olga is on the team",
          modelDomain: "person",
          category: "person",
          proposedValues: { name: "Olga" },
        },
      ],
    });
    const andris = draft.stakeholders?.find((s) => s.name === "Andris");
    const olga = draft.stakeholders?.find((s) => s.name === "Olga");
    assert.ok(andris);
    assert.deepEqual(andris?.responsibilities, ["Legacy"]);
    assert.ok(olga);
    assert.deepEqual(olga?.responsibilities ?? [], []);
    assert.equal(needsYouFromDraft(draft).some((q) => /Olga/i.test(q.question)), false);
  });

  await check("Andris responsible for Legacy becomes name + responsibility", () => {
    const parsed = parsePersonLine("Andris responsible for Legacy");
    assert.equal(parsed.name, "Andris");
    assert.deepEqual(parsed.responsibilities, ["Legacy"]);
    const merged = mergeOrganisedDraft(
      composeDraft(),
      composeDraft({
        stakeholders: [{ name: "Andris responsible for Legacy" }],
      }),
    );
    assert.equal(merged.stakeholders?.[0]?.name, "Andris");
    assert.deepEqual(merged.stakeholders?.[0]?.responsibilities, ["Legacy"]);
    assert.equal(merged.stakeholders?.[0]?.needsReview, false);
  });

  await check("derived summary condenses user overview into Project.summary", () => {
    const summary = deriveProjectSummary(
      "Monthly WEB BAU project centred around monthly bug fixes and small change requests. Olga is QA.",
    );
    assert.match(summary, /WEB BAU/i);
    assert.ok(summary.length <= 200);
    const merged = mergeOrganisedDraft(
      composeDraft({ name: "Web BAU", code: "WB" }),
      composeDraft({
        name: "New project",
        summary: "",
        sourceNarrative:
          "Monthly WEB BAU project centred around monthly bug fixes and small change requests.",
      }),
    );
    assert.match(merged.summary, /WEB BAU/i);
  });

  await check("todo without due date does not block create", () => {
    const bundle = buildNewProject(
      composeDraft({
        todos: [{ title: "Chase finance pack", kind: "ACTION" }],
      }),
    );
    assert.equal(bundle.todos.length, 1);
    assert.equal(bundle.todos[0]?.dueAt, undefined);
  });

  await check("issues map to risks, not a new issues table", () => {
    const draft = composeDraft({
      risks: [{ title: "Identity provider may delay testing" }],
    });
    const risks = risksFromSetup("proj-x", draft);
    assert.equal(risks.length, 1);
    assert.equal(risks[0]?.source, "manual");
    assert.equal(risks[0]?.status, "open");
  });

  await check("organise notes merge is proposal-only and does not overwrite a locked code", () => {
    const current = composeDraft({
      name: "Member Claims Upload",
      code: "CLAIMS",
    });
    const organised = composeDraft({
      name: "Other Name",
      code: "OTHR",
      risks: [{ title: "Vendor delay", needsReview: true }],
      stakeholders: [{ name: "Ava Chen" }],
    });
    const merged = mergeOrganisedDraft(current, organised, { codeLocked: true });
    assert.equal(merged.name, "Member Claims Upload");
    assert.equal(merged.code, "CLAIMS");
    assert.equal(merged.risks?.[0]?.title, "Vendor delay");
    assert.equal(merged.risks?.[0]?.needsReview, true);
    assert.equal(merged.stakeholders?.[0]?.name, "Ava Chen");
    assert.equal(Boolean(merged.stakeholders?.[0]?.needsReview), false);
  });

  await check("ambiguous organise result stays Needs You, not Ready truth", () => {
    const merged = mergeOrganisedDraft(
      composeDraft(),
      composeDraft({
        importantDates: [{ label: "Beta milestone", needsReview: true }],
        stakeholders: [{ name: "Sam", needsReview: true }],
      }),
    );
    const questions = needsYouFromDraft(merged);
    assert.ok(questions.some((q) => /Beta/i.test(q.question)));
    assert.ok(questions.some((q) => /Sam/i.test(q.question)));
    assert.ok(!questions.some((q) => /What is Sam responsible for/i.test(q.question)));
    const bundle = buildNewProject(merged);
    assert.equal(bundle.timeline.length, 0);
  });

  await check("supabase persist blocks duplicate names without inventing a suffix", async () => {
    const fake = new FakeWorkspaceClient();
    const client = fake as unknown as Parameters<typeof persistNewProject>[0];
    await persistNewProject(client, fake.workspaceId, fake.userId, composeDraft());
    let message = "";
    try {
      await persistNewProject(
        client,
        fake.workspaceId,
        fake.userId,
        composeDraft({ name: "Member Claims Upload", code: "ZZZ" }),
      );
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    assert.match(message, /name already exists/i);
    assert.equal(fake.tables.projects.length, 1);
  });

  await check("supabase persist blocks duplicate codes without suffixing", async () => {
    const fake = new FakeWorkspaceClient();
    const client = fake as unknown as Parameters<typeof persistNewProject>[0];
    await persistNewProject(client, fake.workspaceId, fake.userId, composeDraft());
    let message = "";
    try {
      await persistNewProject(
        client,
        fake.workspaceId,
        fake.userId,
        composeDraft({ name: "Member Claims Upload Two" }),
      );
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    assert.match(message, /already exists/i);
    assert.doesNotMatch(message, /MCU-2|MCU1/);
    assert.equal(fake.tables.projects.length, 1);
  });

  await check("production organise → review → persist path writes canonical rows only", async () => {
    const organised = draftFromProvisional({
      sourceNarrative:
        "Monthly WEB BAU. Andris is responsible for Legacy. Raise the AddSearch PO.",
      sourceMode: "paste",
      project: { name: "", summary: "", currentFocus: "" },
      items: [
        {
          id: "p1",
          statement: "Andris is responsible for Legacy",
          evidence: "Andris is responsible for Legacy",
          modelDomain: "person",
          category: "person",
          proposedValues: { name: "Andris", role: "Legacy" },
        },
        {
          id: "t1",
          statement: "Raise the AddSearch purchase order",
          evidence: "Raise the AddSearch PO",
          modelDomain: "todo",
          category: "todo",
          proposedValues: { title: "Raise the AddSearch purchase order" },
        },
        {
          id: "k1",
          statement: "Releases normally happen on Thursday evenings",
          evidence: "Releases normally happen on Thursday evenings",
          modelDomain: "knowledge",
          category: "knowledge",
        },
        {
          id: "r1",
          statement: "Checkout is intermittently returning 500 errors",
          evidence: "Checkout is intermittently returning 500 errors",
          modelDomain: "risk",
          category: "risk",
          proposedValues: { title: "The supplier portal is intermittently returning 500 errors" },
        },
      ],
    });
    const merged = mergeOrganisedDraft(
      composeDraft({
        name: "Web BAU",
        code: "WB",
        sourceNarrative: "Monthly WEB BAU.",
      }),
      organised,
    );
    merged.todos = (merged.todos ?? []).filter((todo) => !todo.needsReview);
    merged.risks = (merged.risks ?? []).filter((risk) => !risk.needsReview);
    const fake = new FakeWorkspaceClient();
    const client = fake as unknown as Parameters<typeof persistNewProject>[0];
    const persisted = await persistNewProject(
      client,
      fake.workspaceId,
      fake.userId,
      merged,
    );
    assert.equal(persisted.project.name, "Web BAU");
    assert.equal(persisted.project.code, "WB");
    assert.match(persisted.project.summary, /WEB BAU/i);
    assert.equal(fake.tables.projects.length, 1);
    assert.ok(fake.tables.stakeholders.some((row) => row.name === "Andris"));
    assert.ok(
      fake.tables.knowledge_items.some(
        (row) =>
          row.kind === "responsibility" && /Legacy/i.test(String(row.body)),
      ),
    );
    assert.ok(
      fake.tables.todos.some((row) => /AddSearch/i.test(String(row.title))),
    );
    assert.ok(
      fake.tables.risks.some((row) => /supplier portal/i.test(String(row.title))),
    );
    const retry = await persistNewProject(
      client,
      fake.workspaceId,
      fake.userId,
      { ...merged, clientProjectId: persisted.project.id },
    );
    assert.equal(retry.project.id, persisted.project.id);
    assert.equal(fake.tables.projects.length, 1);
  });

  await check("partial persist failure cleans up the project bundle", async () => {
    const fake = new FakeWorkspaceClient({ failOnTable: "todos" });
    const client = fake as unknown as Parameters<typeof persistNewProject>[0];
    let failed = false;
    try {
      await persistNewProject(
        client,
        fake.workspaceId,
        fake.userId,
        composeDraft({
          todos: [{ title: "Write the CAB pack" }],
        }),
      );
    } catch {
      failed = true;
    }
    assert.equal(failed, true);
    assert.equal(fake.tables.projects.length, 0);
    assert.equal(fake.tables.todos.length, 0);
  });

  await check("capture apply world ignores retrieval tags", () => {
    const state: MissionState = {
      projects: [
        {
          id: "p1",
          name: "X",
          code: "X",
          summary: "",
          status: "watch",
          currentFocus: "",
          stakeholders: [],
        },
      ],
      memories: [],
      recommendations: [],
      meetings: [],
      releases: [],
      todos: [],
      knowledge: [],
      risks: [],
      timeline: [],
      projectTags: [
        {
          id: "tag-1",
          projectId: "p1",
          name: "Release",
          slug: "release",
          origin: "predefined",
        },
      ],
      itemTags: [
        {
          id: "it-1",
          projectId: "p1",
          tagId: "tag-1",
          targetKind: "risk",
          targetId: "r1",
        },
      ],
    };
    const world = captureApplyWorldFromState(state);
    assert.equal("projectTags" in world, false);
    assert.equal("itemTags" in world, false);
  });

  await check("compose surface stays calm and does not use onboarding chrome", () => {
    const ui = readFileSync(
      join(process.cwd(), "src/components/onboarding/NewProjectExperience.tsx"),
      "utf8",
    );
    assert.match(ui, /Add what you know now/);
    assert.match(ui, /Organise my project/);
    assert.match(ui, /addLabel="Add issue"/);
    assert.match(ui, /Needs You \{needsYou\.length\}/);
    assert.match(ui, /np-add-person-scope/);
    const mic = readFileSync(
      join(process.cwd(), "src/lib/transcribe/use-microphone-transcript.ts"),
      "utf8",
    );
    assert.match(ui, /useMicrophoneTranscript/);
    assert.match(mic, /\/api\/transcribe/);
    assert.match(ui, /\/api\/new-project/);
    assert.match(ui, /createProject\(/);
    assert.doesNotMatch(ui, /Getting Started|0 of 4 complete|Save Draft|Talk It Through/);
    assert.doesNotMatch(ui, /accent-risks|accent-people|accent-todo|accent-knowledge/);
  });

  console.log(`\n${passed} four-frame New Project checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
