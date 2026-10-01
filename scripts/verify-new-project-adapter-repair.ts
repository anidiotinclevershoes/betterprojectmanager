/**
 * New Project Organise adapter — exact field survival.
 *
 * Proves role, To Do detail/dueDate, Issue notes, milestone end,
 * structured knowledge text, unplaced source, historical-year drop,
 * and one setup memory copy.
 *
 * Fixture observations only. Does not call OpenAI.
 *
 * Run: npx tsx scripts/verify-new-project-adapter-repair.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildNewProject, type CreateProjectInput } from "../src/lib/create-project";
import { persistNewProject } from "../src/lib/data/supabase/persist-mutations";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import { intendedCreateTruth } from "../src/lib/new-project/intended-create";
import { structuredItemsFromSetup } from "../src/lib/new-project/materialise-setup";
import { mergeOrganisedDraft } from "../src/lib/new-project/merge-organised";
import { needsYouFromDraft } from "../src/lib/new-project/needs-you";
import {
  draftFromProvisional,
  parseNewProjectV2Envelope,
} from "../src/lib/new-project-v2";
import type { ProvisionalItem } from "../src/lib/new-project-v2/types";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const ROOT = process.cwd();
const REFERENCE = "2026-10-01";

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    await fn();
    console.log(`✓ ${name}`);
  })();
}

function composeDraft(overrides: Partial<CreateProjectInput> = {}): CreateProjectInput {
  return {
    name: "Adapter Repair",
    code: "ADAPT",
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

function observation(args: {
  id: string;
  statement: string;
  evidence?: string;
  domain: string;
  proposedValues?: Record<string, unknown> | null;
  disposition?: string;
}) {
  return {
    id: args.id,
    statement: args.statement,
    evidence: args.evidence ?? args.statement,
    domain: args.domain,
    disposition: args.disposition ?? "create_new",
    truthIntent: "current",
    proposedValues: args.proposedValues ?? null,
  };
}

function organise(notes: string, observations: ReturnType<typeof observation>[]) {
  const parsed = parseNewProjectV2Envelope(
    { observations },
    { referenceDate: REFERENCE },
  );
  const draft = draftFromProvisional({
    sourceNarrative: notes,
    sourceMode: "paste",
    project: { name: "Adapter Repair", summary: "", currentFocus: "" },
    items: parsed.items,
  });
  const merged = mergeOrganisedDraft(composeDraft({ name: "Adapter Repair", code: "ADAPT" }), {
    ...draft,
    name: "Adapter Repair",
    code: "ADAPT",
    sourceMode: "compose",
  });
  return { parsed, draft, merged };
}

function responsibilityScopes(input: CreateProjectInput) {
  const bundle = buildNewProject(input);
  return structuredItemsFromSetup({
    projectId: bundle.project.id,
    input,
    stakeholders: bundle.project.stakeholders,
  })
    .filter((item) => item.kind === "responsibility")
    .map((item) => item.meta?.responsibility?.scope);
}

async function persistAndReload(input: CreateProjectInput) {
  const fake = new FakeWorkspaceClient();
  const persisted = await persistNewProject(
    fake as unknown as Parameters<typeof persistNewProject>[0],
    fake.workspaceId,
    fake.userId,
    input,
  );
  const loaded = await loadMissionStateFromSupabase(
    fake as unknown as Parameters<typeof loadMissionStateFromSupabase>[0],
  );
  return { fake, persisted, loaded };
}

async function main() {
  await check("person role persists and does not become a responsibility", async () => {
    const notes = "Nina has joined as the UX Designer.";
    const { draft, merged } = organise(notes, [
      observation({
        id: "nina",
        statement: notes,
        domain: "person",
        proposedValues: { name: "Nina", role: "UX Designer" },
      }),
    ]);
    const nina = (merged.stakeholders ?? []).find((s) => s.name === "Nina");
    assert.ok(nina);
    assert.equal(nina.role, "UX Designer");
    assert.deepEqual(nina.responsibilities ?? [], []);
    assert.equal((merged.stakeholders ?? []).filter((s) => s.name === "Nina").length, 1);
    assert.deepEqual(responsibilityScopes(merged), []);
    assert.equal(intendedCreateTruth(merged).responsibilityMin, 0);
    assert.equal(draft.stakeholders?.[0]?.role, "UX Designer");

    const { fake, loaded } = await persistAndReload(merged);
    assert.equal(fake.tables.stakeholders[0]?.role, "UX Designer");
    assert.equal(
      fake.tables.knowledge_items.some((row) => row.kind === "responsibility"),
      false,
    );
    const project = loaded.state.projects.find((p) => p.code === "ADAPT");
    assert.equal(project?.stakeholders.find((s) => s.name === "Nina")?.role, "UX Designer");
    const knowledge = loaded.state.knowledge.find((k) => k.projectId === project?.id);
    assert.equal(
      (knowledge?.structured ?? []).some(
        (item) =>
          item.kind === "responsibility" &&
          item.meta?.responsibility?.scope === "UX Designer",
      ),
      false,
    );
  });

  await check("role and explicit responsibility survive as one Nina", async () => {
    const notes = "Nina is the UX Designer. Nina owns the checkout redesign.";
    const { merged } = organise(notes, [
      observation({
        id: "nina-role",
        statement: "Nina is the UX Designer.",
        evidence: notes,
        domain: "person",
        proposedValues: { name: "Nina", role: "UX Designer" },
      }),
      observation({
        id: "nina-scope",
        statement: "Nina owns the checkout redesign.",
        evidence: notes,
        domain: "responsibility",
        proposedValues: { personName: "Nina", scope: "checkout redesign" },
      }),
    ]);
    const ninas = (merged.stakeholders ?? []).filter((s) => s.name === "Nina");
    assert.equal(ninas.length, 1);
    assert.equal(ninas[0]?.role, "UX Designer");
    assert.deepEqual(ninas[0]?.responsibilities ?? [], ["checkout redesign"]);
    assert.deepEqual(responsibilityScopes(merged), ["checkout redesign"]);

    const { fake, loaded } = await persistAndReload(merged);
    assert.equal(fake.tables.stakeholders.filter((row) => row.name === "Nina").length, 1);
    assert.equal(fake.tables.stakeholders[0]?.role, "UX Designer");
    const scopes = fake.tables.knowledge_items
      .filter((row) => row.kind === "responsibility")
      .map((row) => {
        const meta = row.meta as { responsibility?: { scope?: string } } | null;
        return meta?.responsibility?.scope;
      });
    assert.deepEqual(scopes, ["checkout redesign"]);
    const project = loaded.state.projects.find((p) => p.code === "ADAPT");
    assert.equal(project?.stakeholders.find((s) => s.name === "Nina")?.role, "UX Designer");
    const knowledge = loaded.state.knowledge.find((k) => k.projectId === project?.id);
    const reloaded = (knowledge?.structured ?? [])
      .filter((item) => item.kind === "responsibility" && item.lifecycle === "current")
      .map((item) => item.meta?.responsibility?.scope);
    assert.deepEqual(reloaded, ["checkout redesign"]);
  });

  await check("todo title, detail, and dueDate survive draft, create, and reload", async () => {
    const detail = "Include the updated budget figures.";
    const { draft, merged } = organise("Add a To Do to send the steering pack by 6 October 2026.", [
      observation({
        id: "todo-pack",
        statement: "Send the steering pack",
        domain: "todo",
        proposedValues: {
          title: "Send the steering pack",
          detail,
          dueDate: "2026-10-06",
        },
      }),
    ]);
    assert.equal(draft.todos?.[0]?.title, "Send the steering pack");
    assert.equal(draft.todos?.[0]?.detail, detail);
    assert.equal(draft.todos?.[0]?.dueAt, "2026-10-06");
    assert.equal(merged.todos?.[0]?.detail, detail);
    assert.equal(merged.todos?.[0]?.dueAt, "2026-10-06");

    const kept = mergeOrganisedDraft(
      composeDraft({
        todos: [{ title: "Send the steering pack", detail: "User wrote this.", dueAt: "2026-11-01" }],
      }),
      composeDraft({
        todos: [{ title: "Send the steering pack", detail: "", dueAt: "" }],
      }),
    );
    assert.equal(kept.todos?.[0]?.detail, "User wrote this.");
    assert.equal(kept.todos?.[0]?.dueAt, "2026-11-01");

    const filled = mergeOrganisedDraft(
      composeDraft({ todos: [{ title: "Send the steering pack" }] }),
      composeDraft({
        todos: [{ title: "Send the steering pack", detail, dueAt: "2026-10-06" }],
      }),
    );
    assert.equal(filled.todos?.[0]?.detail, detail);
    assert.equal(filled.todos?.[0]?.dueAt, "2026-10-06");

    const english = draftFromProvisional({
      sourceNarrative: "by Friday",
      sourceMode: "paste",
      project: { name: "Adapter Repair", summary: "", currentFocus: "" },
      items: [
        {
          id: "todo-english",
          statement: "Send the pack",
          evidence: "by Friday",
          modelDomain: "todo",
          category: "todo",
          proposedValues: { title: "Send the pack", dueDate: "by Friday" },
        } satisfies ProvisionalItem,
      ],
    });
    assert.equal(english.todos?.[0]?.dueAt, undefined);

    const built = buildNewProject(merged);
    assert.equal(built.todos[0]?.detail, detail);
    assert.match(built.todos[0]?.dueAt ?? "", /^2026-10-06/);

    const { fake, loaded } = await persistAndReload(merged);
    assert.equal(fake.tables.todos[0]?.title, "Send the steering pack");
    assert.equal(fake.tables.todos[0]?.detail, detail);
    assert.equal(fake.tables.todos[0]?.due_on, "2026-10-06");
    const todo = loaded.state.todos.find((item) => item.title === "Send the steering pack");
    assert.equal(todo?.detail, detail);
    assert.match(todo?.dueAt ?? "", /^2026-10-06/);
  });

  await check("issue notes survive onto risks.notes and reload", async () => {
    const notes = "The API supplier may slip by two weeks because their security review is late.";
    const { draft, merged } = organise(notes, [
      observation({
        id: "risk-api",
        statement: "API supplier delay",
        domain: "risk",
        proposedValues: { title: "API supplier delay", notes },
      }),
    ]);
    assert.equal(draft.risks?.[0]?.title, "API supplier delay");
    assert.equal(draft.risks?.[0]?.notes, notes);
    assert.equal(merged.risks?.[0]?.notes, notes);
    assert.equal(draft.risks?.[0]?.needsReview, false);

    const kept = mergeOrganisedDraft(
      composeDraft({ risks: [{ title: "API supplier delay", notes: "User notes." }] }),
      composeDraft({ risks: [{ title: "API supplier delay", notes: "" }] }),
    );
    assert.equal(kept.risks?.[0]?.notes, "User notes.");
    const filled = mergeOrganisedDraft(
      composeDraft({ risks: [{ title: "API supplier delay" }] }),
      composeDraft({ risks: [{ title: "API supplier delay", notes }] }),
    );
    assert.equal(filled.risks?.[0]?.notes, notes);

    const { fake, loaded } = await persistAndReload(merged);
    assert.equal(fake.tables.risks[0]?.title, "API supplier delay");
    assert.equal(fake.tables.risks[0]?.notes, notes);
    assert.equal(fake.tables.risks[0]?.source, "manual");
    const risk = loaded.state.risks?.find((item) => item.title === "API supplier delay");
    assert.equal(risk?.notes, notes);
    const bundleSql = readSrc(
      "supabase/migrations/20261001120000_create_project_bundle_risk_notes.sql",
    );
    assert.match(bundleSql, /insert into public\.risks \(/);
    assert.match(bundleSql, /notes/);
    assert.match(bundleSql, /elem->>'notes'/);
  });

  await check("milestone start and end survive onto milestones and reload", async () => {
    const { draft, merged } = organise("UAT runs from 12 October 2026 to 16 October 2026.", [
      observation({
        id: "uat",
        statement: "UAT",
        domain: "milestone",
        proposedValues: {
          label: "UAT",
          date: "2026-10-12",
          endAt: "2026-10-16",
        },
      }),
    ]);
    assert.equal(draft.importantDates?.[0]?.label, "UAT");
    assert.equal(draft.importantDates?.[0]?.date, "2026-10-12");
    assert.equal(draft.importantDates?.[0]?.endAt, "2026-10-16");
    assert.equal(merged.importantDates?.[0]?.endAt, "2026-10-16");

    const kept = mergeOrganisedDraft(
      composeDraft({
        importantDates: [{ label: "UAT", date: "2026-10-12", endAt: "2026-10-20" }],
      }),
      composeDraft({
        importantDates: [{ label: "UAT", date: "2026-10-12", endAt: "" }],
      }),
    );
    assert.equal(kept.importantDates?.[0]?.endAt, "2026-10-20");
    const filled = mergeOrganisedDraft(
      composeDraft({ importantDates: [{ label: "UAT", date: "2026-10-12" }] }),
      composeDraft({
        importantDates: [{ label: "UAT", date: "2026-10-12", endAt: "2026-10-16" }],
      }),
    );
    assert.equal(filled.importantDates?.[0]?.date, "2026-10-12");
    assert.equal(filled.importantDates?.[0]?.endAt, "2026-10-16");

    const built = buildNewProject(merged);
    assert.match(built.timeline[0]?.startAt ?? "", /^2026-10-12/);
    assert.match(built.timeline[0]?.endAt ?? "", /^2026-10-16/);

    const { fake, loaded } = await persistAndReload(merged);
    assert.equal(fake.tables.milestones[0]?.start_on, "2026-10-12");
    assert.equal(fake.tables.milestones[0]?.end_on, "2026-10-16");
    const item = loaded.state.timeline.find((row) => row.label === "UAT");
    assert.match(item?.startAt ?? "", /^2026-10-12/);
    assert.match(item?.endAt ?? "", /^2026-10-16/);
  });

  await check("structured knowledge text wins over a different statement", async () => {
    const structured = "Agreed to keep the legacy API until January because the React replacement won't be ready.";
    const statement = "React replacement won't be ready by January.";
    const { draft, merged } = organise(structured, [
      observation({
        id: "know-api",
        statement,
        evidence: structured,
        domain: "knowledge",
        proposedValues: { text: structured },
      }),
    ]);
    assert.equal(draft.knowledgeRemember?.[0]?.text, structured);
    assert.equal(merged.knowledgeRemember?.[0]?.text, structured);
    const built = buildNewProject(merged);
    assert.equal(built.knowledge.sections.now.includes(structured), true);
    assert.equal(built.knowledge.sections.now.includes(statement), false);

    const { fake, loaded } = await persistAndReload(merged);
    const row = fake.tables.knowledge_items.find((item) => item.body === structured);
    assert.ok(row);
    assert.equal(
      fake.tables.knowledge_items.some((item) => item.body === statement),
      false,
    );
    const project = loaded.state.projects.find((p) => p.code === "ADAPT");
    const knowledge = loaded.state.knowledge.find((k) => k.projectId === project?.id);
    assert.equal(knowledge?.sections.now.includes(structured), true);
    assert.equal(knowledge?.sections.now.includes(statement), false);

    const fallback = draftFromProvisional({
      sourceNarrative: "Keep the note.",
      sourceMode: "paste",
      project: { name: "Adapter Repair", summary: "", currentFocus: "" },
      items: [
        {
          id: "know-fallback",
          statement: "Keep the note.",
          evidence: "Keep the note.",
          modelDomain: "knowledge",
          category: "knowledge",
          proposedValues: { text: "   " },
        } satisfies ProvisionalItem,
      ],
    });
    assert.equal(fallback.knowledgeRemember?.[0]?.text, "Keep the note.");
  });

  await check("retained notMentioned text is rendered in New Project review", () => {
    const awkward =
      "The vendor's warm-fuzzy readiness index should be filed under the colour of Tuesday.";
    const { draft, merged } = organise(
      `Nina has joined as the UX Designer. ${awkward}`,
      [
        observation({
          id: "nina",
          statement: "Nina has joined as the UX Designer.",
          domain: "person",
          proposedValues: { name: "Nina", role: "UX Designer" },
        }),
        observation({
          id: "awkward",
          statement: awkward,
          domain: "commentary",
          disposition: "commentary",
          proposedValues: null,
        }),
      ],
    );
    assert.ok((draft.notMentioned ?? []).includes(awkward));
    assert.ok((merged.notMentioned ?? []).includes(awkward));
    const ui = readSrc("src/components/onboarding/NewProjectExperience.tsx");
    assert.match(ui, /DidntUnderstand/);
    assert.match(ui, /notMentioned/);
    const didnt = readSrc("src/components/capture/review/DidntUnderstand.tsx");
    assert.match(didnt, /Didn't understand/);
    assert.match(didnt, /This wording won’t be added to project data/);
    assert.match(didnt, /data-testid="review-didnt-understand"/);
  });

  await check("unsafe historical ISO year is dropped and not persisted", async () => {
    const notes = "Launch is 20 October.";
    const parsed = parseNewProjectV2Envelope(
      {
        observations: [
          observation({
            id: "launch",
            statement: "Launch is 20 October.",
            evidence: notes,
            domain: "milestone",
            proposedValues: { label: "Launch", date: "2019-10-20" },
          }),
        ],
      },
      { referenceDate: REFERENCE },
    );
    const launch = parsed.items.find((item) => item.category === "milestone");
    assert.equal(launch?.proposedValues?.date, undefined);
    const draft = draftFromProvisional({
      sourceNarrative: notes,
      sourceMode: "paste",
      project: { name: "Adapter Repair", summary: "", currentFocus: "" },
      items: parsed.items,
    });
    assert.equal(draft.importantDates?.[0]?.date, undefined);
    assert.equal(draft.importantDates?.[0]?.needsReview, true);
    assert.ok(
      needsYouFromDraft(draft).some((item) => /When is the Launch milestone/i.test(item.question)),
    );
    const merged = mergeOrganisedDraft(composeDraft(), {
      ...draft,
      name: "Adapter Repair",
      code: "ADAPT",
      sourceMode: "compose",
    });
    const { fake } = await persistAndReload(merged);
    assert.equal(fake.tables.milestones.length, 0);
    assert.equal(
      JSON.stringify(fake.tables).includes("2019-10-20"),
      false,
    );

    const stated = parseNewProjectV2Envelope(
      {
        observations: [
          observation({
            id: "launch-stated",
            statement: "Launch is 20 October 2019.",
            evidence: "Launch is 20 October 2019.",
            domain: "milestone",
            proposedValues: { label: "Launch", date: "2019-10-20" },
          }),
        ],
      },
      { referenceDate: REFERENCE },
    );
    assert.equal(
      stated.items.find((item) => item.category === "milestone")?.proposedValues?.date,
      "2019-10-20",
    );

    const route = readSrc("src/app/api/new-project/route.ts");
    const parse = readSrc("src/lib/new-project-v2/parse.ts");
    assert.match(route, /captureReferenceDate\(/);
    assert.match(route, /referenceDate/);
    assert.match(parse, /applyCaptureSemanticContract/);
    assert.doesNotMatch(route, /runCaptureV2FromModelJson/);
  });

  await check("one Organise submission is stored once in setup memory", async () => {
    const note = "Nina has joined as the UX Designer.";
    const doubled = mergeOrganisedDraft(
      composeDraft({ sourceNarrative: note }),
      composeDraft({ sourceNarrative: note }),
    );
    assert.equal(doubled.sourceNarrative, note);
    const later = mergeOrganisedDraft(doubled, composeDraft({ sourceNarrative: "A later different note." }));
    assert.equal(later.sourceNarrative, `${note}\n\nA later different note.`);
    const again = mergeOrganisedDraft(later, composeDraft({ sourceNarrative: note }));
    assert.equal(again.sourceNarrative, `${note}\n\nA later different note.`);

    const { fake, loaded } = await persistAndReload(
      composeDraft({ sourceNarrative: note, sourceMode: "compose" }),
    );
    assert.equal(fake.tables.memories.length, 1);
    assert.equal(fake.tables.memories[0]?.content, note);
    const memories = loaded.state.memories.filter((memory) => memory.content?.includes(note));
    assert.equal(memories.length, 1);
    assert.equal(memories[0]?.content, note);

    const ui = readSrc("src/components/onboarding/NewProjectExperience.tsx");
    const organise = ui.slice(ui.indexOf("async function organiseNotes"));
    const body = organise.slice(0, organise.indexOf("function onCreate"));
    assert.doesNotMatch(body, /sourceNarrative:\s*\[current\.sourceNarrative,\s*content\]/);
  });

  console.log("verify-new-project-adapter-repair: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
