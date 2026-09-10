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
  nextDerivedProjectCode,
  projectCodeTakenMessage,
  suggestCode,
  type CreateProjectInput,
} from "../src/lib/create-project";
import { mergeOrganisedDraft } from "../src/lib/new-project/merge-organised";
import {
  needsYouFromDraft,
  personResponsibilityQuestion,
} from "../src/lib/new-project/needs-you";
import { composePersonLine } from "../src/lib/new-project/people-line";
import {
  draftFromProvisional,
  parseNewProjectV2Envelope,
} from "../src/lib/new-project-v2";
import { intendedCreateTruth } from "../src/lib/new-project/intended-create";
import {
  risksFromSetup,
  structuredItemsFromSetup,
} from "../src/lib/new-project/materialise-setup";
import { persistNewProject } from "../src/lib/data/supabase/persist-mutations";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import { composeKnowledgeCentreItems } from "../src/lib/knowledge-centre/four-bucket";
import type { CanonicalTruthItem } from "../src/lib/canonical-truth/types";
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

function asClient(fake: FakeWorkspaceClient) {
  return fake as unknown as Parameters<typeof persistNewProject>[0];
}

/** Fifteen distinct compose Knowledge facts — above the old uniqueBullets cap of 12. */
const FIFTEEN_KNOWLEDGE_FACTS: string[] = [
  "UAT environment is shared with payroll",
  "Web launch is in scope first",
  "Mobile app follows the web release",
  "Finance wants residual risk in writing",
  "CAB pack is due forty eight hours early",
  "Identity provider is the long pole",
  "Nightly batch must finish before seven",
  "Customer letters stay paper until autumn",
  "The warehouse cutover is a weekend window",
  "Training environment lags production by a day",
  "Vendor contract renews in March",
  "Support handover needs a named owner",
  "Regression pack still misses the mobile journeys",
  "Data migration rehearsal is booked for Friday",
  "The sponsor wants a one-page weekly",
];

async function main() {
  await check("deterministic code: Member Claims Upload → MCU", () => {
    assert.equal(suggestCode("Member Claims Upload"), "MCU");
    assert.equal(suggestCode("  atlas  "), "ATLAS");
    assert.equal(suggestCode("Aurora Migration"), "AM");
    assert.equal(suggestCode("Aurora"), "AURORA");
    let code = "";
    for (const name of [
      "A",
      "Au",
      "Aurora",
      "Aurora ",
      "Aurora M",
      "Aurora Migration",
    ]) {
      code = nextDerivedProjectCode(name, code, false);
    }
    assert.equal(code, "AM");
    assert.equal(nextDerivedProjectCode("Aurora Migration", "A", true), "A");
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

  await check("names are not required to be unique", () => {
    const existing = [{ id: "a", code: "ONE", name: "Same" }];
    assert.equal(isProjectCodeTaken(existing, "TWO"), false);
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

  await check("organise path keeps explicit responsibilities and does not re-ask", () => {
    const mapped = parseNewProjectV2Envelope({
      observations: [
        {
          id: "p-olga",
          statement: "Olga Petrov is responsible for UAT.",
          evidence: "Olga Petrov is responsible for UAT.",
          domain: "responsibility",
          disposition: "create_new",
          truthIntent: "current",
          proposedValues: { personName: "Olga Petrov", scope: "UAT" },
        },
        {
          id: "p-sarah",
          statement: "Sarah Kim is responsible for Release.",
          evidence: "Sarah Kim is responsible for Release.",
          domain: "person",
          disposition: "ambiguous",
          truthIntent: "current",
          proposedValues: { name: "Sarah Kim" },
        },
      ],
    });
    const organised = draftFromProvisional({
      sourceNarrative:
        "Olga Petrov is responsible for UAT.\nSarah Kim is responsible for Release.",
      sourceMode: "paste",
      project: mapped.project,
      items: mapped.items,
    });
    const merged = mergeOrganisedDraft(
      composeDraft({ name: "Aurora Migration", code: "AM" }),
      { ...organised, sourceMode: "compose" },
    );
    const olga = (merged.stakeholders ?? []).find((s) => s.name === "Olga Petrov");
    const sarah = (merged.stakeholders ?? []).find((s) => s.name === "Sarah Kim");
    assert.ok(olga, "Olga Petrov must survive the production organise map");
    assert.ok(sarah, "Sarah Kim must survive the production organise map");
    assert.ok((olga?.responsibilities ?? []).some((scope) => /UAT/i.test(scope)));
    assert.ok(
      (sarah?.responsibilities ?? []).some((scope) => /Release/i.test(scope)),
      "statement-only responsibility must not be discarded",
    );
    const questions = needsYouFromDraft(merged);
    assert.equal(questions.some((q) => /Olga Petrov/i.test(q.question)), false);
    assert.equal(questions.some((q) => /Sarah Kim/i.test(q.question)), false);
    assert.equal(composePersonLine(olga!), "Olga Petrov — UAT");
    assert.equal(composePersonLine(sarah!), "Sarah Kim — Release");
    const ui = readFileSync(join(process.cwd(), "src/components/onboarding/NewProjectExperience.tsx"), "utf8");
    assert.match(ui, /composePersonLine/);
    assert.match(ui, /mergeOrganisedDraft/);
    assert.match(ui, /\/api\/new-project/);
  });

  await check("person with only a name is complete — no Needs You or responsibility ambiguity", () => {
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
      structured.some(
        (item) =>
          item.kind === "ambiguity" &&
          item.body === personResponsibilityQuestion("Sarah Murphy"),
      ),
      false,
    );
    assert.equal(structured.filter((item) => item.kind === "responsibility").length, 0);
    assert.equal(
      intendedCreateTruth(draft).ambiguityBodies.includes(
        personResponsibilityQuestion("Sarah Murphy"),
      ),
      false,
    );
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
    assert.notEqual(merged.stakeholders?.[0]?.needsReview, true);
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
    const bundle = buildNewProject(merged);
    assert.equal(bundle.timeline.length, 0);
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
    assert.match(ui, /addLabel="Add issue"/);
    assert.match(ui, /Needs You \{needsYou\.length\}/);
    assert.doesNotMatch(ui, /Getting Started|0 of 4 complete|Save Draft|Talk It Through/);
    assert.doesNotMatch(ui, /accent-risks|accent-people|accent-todo|accent-knowledge/);
    assert.doesNotMatch(
      ui,
      /needsReview:\s*true/,
      "compose must not mark a manually added person as Needs You",
    );
    const todoAdd = ui.slice(ui.indexOf('addLabel="Add to do"'));
    const todoAddBlock = todoAdd.slice(0, todoAdd.indexOf("ComposeFrame"));
    assert.doesNotMatch(todoAddBlock, /dueAt/);
    assert.doesNotMatch(ui, /type="date"/);
  });

  await check("five or more compose Knowledge notes all remain ordinary facts", () => {
    const notes = [
      "UAT environment is shared with payroll",
      "Web launch is in scope first",
      "Mobile app follows the web release",
      "Finance wants residual risk in writing",
      "CAB pack is due forty eight hours early",
      "Identity provider is the long pole",
    ];
    const draft = composeDraft({
      knowledgeRemember: notes.map((text) => ({ text, remember: true })),
      knowledgeDecisions: ["Board approved the winter window"],
    });
    const bundle = buildNewProject(draft);
    for (const note of notes) {
      assert.ok(
        bundle.knowledge.sections.now.includes(note),
        `expected fact in now: ${note}`,
      );
      assert.equal(
        bundle.knowledge.sections.decisions.includes(note),
        false,
        `note must not become a decision: ${note}`,
      );
    }
    assert.ok(
      bundle.knowledge.sections.decisions.includes("Board approved the winter window"),
    );
  });

  await check(
    "persist New Project: name-only person and five Knowledge facts hydrate without Needs You",
    async () => {
      const notes = [
        "UAT environment is shared with payroll",
        "Web launch is in scope first",
        "Mobile app follows the web release",
        "Finance wants residual risk in writing",
        "CAB pack is due forty eight hours early",
      ];
      const fake = new FakeWorkspaceClient();
      const draft = composeDraft({
        stakeholders: [{ name: "Sarah Murphy", responsibilities: [] }],
        knowledgeRemember: notes.map((text) => ({ text, remember: true })),
      });
      const persisted = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        draft,
      );
      assert.ok(persisted.project.stakeholders.some((s) => s.name === "Sarah Murphy"));
      const ambiguityQuestion = personResponsibilityQuestion("Sarah Murphy");
      assert.equal(
        fake.tables.knowledge_items.some(
          (row) =>
            row.kind === "ambiguity" && String(row.body) === ambiguityQuestion,
        ),
        false,
      );
      assert.equal(
        fake.tables.knowledge_items.some((row) => row.kind === "responsibility"),
        false,
      );
      for (const note of notes) {
        const row = fake.tables.knowledge_items.find(
          (item) => String(item.body) === note,
        );
        assert.ok(row, `missing persisted knowledge: ${note}`);
        assert.equal(row.section, "now");
        assert.equal(row.kind, "fact");
        assert.equal(String(row.lifecycle ?? "current"), "current");
      }
      assert.equal(
        fake.tables.knowledge_items.filter((row) =>
          notes.includes(String(row.body)) && row.section === "decisions",
        ).length,
        0,
      );

      const loaded = await loadMissionStateFromSupabase(asClient(fake));
      const project = loaded.state.projects.find(
        (p) => p.id === persisted.project.id,
      );
      assert.ok(project);
      assert.ok(project!.stakeholders.some((s) => s.name === "Sarah Murphy"));
      const knowledge = loaded.state.knowledge.find(
        (k) => k.projectId === persisted.project.id,
      );
      assert.ok(knowledge);
      for (const note of notes) {
        assert.ok(knowledge!.sections.now.includes(note));
        assert.equal(knowledge!.sections.decisions.includes(note), false);
        const overlay: CanonicalTruthItem | undefined = (
          knowledge!.structured ?? []
        ).find((item) => item.body === note);
        assert.ok(overlay);
        assert.equal(overlay.kind, "fact");
        assert.equal(overlay.section, "now");
        assert.equal(overlay.lifecycle, "current");
      }
      assert.equal(
        (knowledge!.structured ?? []).some(
          (item) =>
            item.kind === "ambiguity" && item.body === ambiguityQuestion,
        ),
        false,
      );
      const kc = composeKnowledgeCentreItems(loaded.state, persisted.project.id);
      const personRow = kc.find(
        (item) => item.bucket === "people" && item.title === "Sarah Murphy",
      );
      assert.ok(personRow, "name-only person must re-project into Knowledge Centre");
      assert.equal(personRow!.needsYou, null);
    },
  );

  await check(
    "persist New Project: explicit responsibilities still write the established overlay",
    async () => {
      const fake = new FakeWorkspaceClient();
      const draft = composeDraft({
        stakeholders: [
          {
            name: "Sarah Murphy",
            responsibilities: ["Product Owner", "UAT"],
          },
        ],
      });
      const persisted = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        draft,
      );
      assert.ok(persisted.project.stakeholders.some((s) => s.name === "Sarah Murphy"));
      const scopes = fake.tables.knowledge_items
        .filter((row) => row.kind === "responsibility")
        .map((row) => {
          const meta = row.meta as { responsibility?: { scope?: string } } | null;
          return meta?.responsibility?.scope;
        });
      assert.ok(scopes.includes("Product Owner"));
      assert.ok(scopes.includes("UAT"));
      assert.equal(
        fake.tables.knowledge_items.some(
          (row) =>
            row.kind === "ambiguity" &&
            String(row.body) === personResponsibilityQuestion("Sarah Murphy"),
        ),
        false,
      );

      const loaded = await loadMissionStateFromSupabase(asClient(fake));
      const knowledge = loaded.state.knowledge.find(
        (k) => k.projectId === persisted.project.id,
      );
      const overlayScopes = (knowledge?.structured ?? [])
        .filter((item) => item.kind === "responsibility" && item.lifecycle === "current")
        .map((item) => item.meta?.responsibility?.scope);
      assert.ok(overlayScopes.includes("Product Owner"));
      assert.ok(overlayScopes.includes("UAT"));
      const kc = composeKnowledgeCentreItems(loaded.state, persisted.project.id);
      const personRow = kc.find(
        (item) => item.bucket === "people" && item.title === "Sarah Murphy",
      );
      assert.ok(personRow);
      assert.match(personRow!.supporting ?? "", /Product Owner/);
      assert.match(personRow!.supporting ?? "", /UAT/);
      assert.equal(personRow!.needsYou, null);
    },
  );

  await check(
    "more than twelve distinct Knowledge facts all survive buildNewProject in order",
    () => {
      const notes = [...FIFTEEN_KNOWLEDGE_FACTS];
      const draft = composeDraft({
        knowledgeRemember: [
          ...notes.map((text) => ({ text, remember: true as const })),
          { text: notes[0]!, remember: true },
        ],
      });
      const bundle = buildNewProject(draft);
      const now = bundle.knowledge.sections.now;
      assert.deepEqual(
        now.filter((line) => notes.includes(line)),
        notes,
      );
      assert.equal(
        now.filter((line) => line === notes[0]).length,
        1,
        "identical Knowledge lines still dedupe",
      );
      assert.equal(now.includes(notes[12]!), true, "13th distinct fact must not be dropped");
      assert.equal(now.includes(notes[14]!), true, "15th distinct fact must not be dropped");
      assert.equal(bundle.knowledge.sections.decisions.length, 0);
    },
  );

  await check(
    "persist New Project: fifteen Knowledge facts survive hydrate and Knowledge Centre in order",
    async () => {
      const notes = [...FIFTEEN_KNOWLEDGE_FACTS];
      const fake = new FakeWorkspaceClient();
      const draft = composeDraft({
        knowledgeRemember: [
          ...notes.map((text) => ({ text, remember: true as const })),
          { text: notes[3]!, remember: true },
        ],
      });
      const persisted = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        draft,
      );
      const factRows = fake.tables.knowledge_items.filter(
        (row) =>
          notes.includes(String(row.body)) &&
          row.section === "now" &&
          row.kind === "fact",
      );
      assert.equal(factRows.length, notes.length);
      assert.deepEqual(
        factRows.map((row) => String(row.body)),
        notes,
      );
      assert.equal(
        fake.tables.knowledge_items.filter((row) => String(row.body) === notes[3]).length,
        1,
      );

      const loaded = await loadMissionStateFromSupabase(asClient(fake));
      const knowledge = loaded.state.knowledge.find(
        (k) => k.projectId === persisted.project.id,
      );
      assert.ok(knowledge);
      const nowFacts = knowledge!.sections.now.filter((line) => notes.includes(line));
      assert.deepEqual(nowFacts, notes);
      const overlayBodies = (knowledge!.structured ?? [])
        .filter(
          (item) =>
            item.section === "now" &&
            item.kind === "fact" &&
            notes.includes(item.body),
        )
        .map((item) => item.body);
      assert.deepEqual(overlayBodies, notes);

      const kc = composeKnowledgeCentreItems(loaded.state, persisted.project.id);
      const kcFacts = kc
        .filter(
          (item) =>
            item.bucket === "knowledge" &&
            item.knowledgeSubtype === "information" &&
            notes.includes(item.title),
        )
        .map((item) => item.title);
      assert.deepEqual(kcFacts, notes);
    },
  );

  await check(
    "New Project Knowledge fact longer than 220 characters persists in full",
    async () => {
      const longFact =
        "The CAB pack must include residual risk, the identity-provider runbook, the weekend warehouse cutover window, and the named support owner, because Finance will not accept a verbal briefing as the audit trail for the winter release.";
      assert.ok(longFact.length > 220);
      const fake = new FakeWorkspaceClient();
      const persisted = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        composeDraft({
          knowledgeRemember: [{ text: longFact, remember: true }],
        }),
      );
      const row = fake.tables.knowledge_items.find(
        (item) => item.section === "now" && item.kind === "fact",
      );
      assert.equal(String(row?.body), longFact);
      const loaded = await loadMissionStateFromSupabase(asClient(fake));
      const knowledge = loaded.state.knowledge.find(
        (k) => k.projectId === persisted.project.id,
      );
      assert.ok(knowledge!.sections.now.includes(longFact));
      assert.ok((knowledge!.structured ?? []).some((item) => item.body === longFact));
    },
  );

  await check(
    "more than twelve New Project issues persist as risks in order",
    async () => {
      const titles = Array.from(
        { length: 15 },
        (_, i) => `Issue ${String(i + 1).padStart(2, "0")} needs a named owner`,
      );
      const fake = new FakeWorkspaceClient();
      const persisted = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        composeDraft({
          risks: titles.map((title) => ({ title })),
        }),
      );
      const riskTitles = fake.tables.risks.map((row) => String(row.title));
      assert.deepEqual(riskTitles, titles);
      const loaded = await loadMissionStateFromSupabase(asClient(fake));
      const projectRisks = (loaded.state.risks ?? [])
        .filter((r) => r.projectId === persisted.project.id)
        .map((r) => r.title);
      assert.deepEqual(projectRisks, titles);
    },
  );

  await check(
    "more than twelve New Project people persist as people and people-context bullets",
    async () => {
      const names = Array.from(
        { length: 15 },
        (_, i) => `Person ${String(i + 1).padStart(2, "0")} Murphy`,
      );
      const fake = new FakeWorkspaceClient();
      const persisted = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        composeDraft({
          stakeholders: names.map((name) => ({ name, responsibilities: [] })),
        }),
      );
      assert.deepEqual(
        persisted.project.stakeholders.map((s) => s.name),
        names,
      );
      const loaded = await loadMissionStateFromSupabase(asClient(fake));
      const project = loaded.state.projects.find((p) => p.id === persisted.project.id);
      assert.deepEqual(
        project!.stakeholders.map((s) => s.name),
        names,
      );
      const knowledge = loaded.state.knowledge.find(
        (k) => k.projectId === persisted.project.id,
      );
      for (const name of names) {
        assert.ok(
          (knowledge!.sections.people ?? []).some((line) => line.includes(name)),
          `people-context bullet missing for ${name}`,
        );
      }
    },
  );

  await check(
    "Knowledge Centre Correct must not slice a section to 8 before reconcile",
    () => {
      const store = readFileSync(
        join(process.cwd(), "src/lib/store.tsx"),
        "utf8",
      );
      const start = store.indexOf("const updateKnowledgeSection = useCallback");
      const block = store.slice(start, store.indexOf("const addKnowledgeBullet"));
      assert.doesNotMatch(
        block,
        /\.slice\(\s*0\s*,\s*8\s*\)/,
        "Correcting one Knowledge line must not drop the 9th+ canonical facts",
      );
      const bullets = readFileSync(
        join(process.cwd(), "src/lib/knowledge.ts"),
        "utf8",
      );
      const merge = bullets.slice(bullets.indexOf("export function mergeSectionBullets"));
      const mergeFn = merge.slice(0, merge.indexOf("export function mergeKnowledge"));
      assert.doesNotMatch(
        mergeFn,
        /next\.slice\(\s*0\s*,\s*max\s*\)/,
        "Adding Knowledge must not drop existing facts from the working set",
      );
    },
  );

  console.log(`\n${passed} four-frame New Project checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
