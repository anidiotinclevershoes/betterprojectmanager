/**
 * Slice 2D: People & Context UI — share/replace + person detail behaviour.
 * Deterministic. No OpenAI. No browser.
 *
 * Run: npm run verify:people-context-ui
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  refForPerson,
  refForStructuredItem,
  resolveKnowledgeItemDetail,
} from "../src/lib/knowledge-centre/knowledge-item-detail";
import { buildPeopleRows } from "../src/lib/knowledge-centre/ocean-frames";
import {
  resolveConfirmOwnerChoice,
  resolveReplacePersonId,
} from "../src/lib/people/confirm-owner-choice";
import {
  confirmResponsibilityOwner,
  getPersonBundle,
} from "../src/lib/people/identity";
import type { CanonicalTruthItem } from "../src/lib/canonical-truth/types";
import type { MissionState, Project } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const AVA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MARK = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BRUNO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BOB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MARY = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const AVA_OTHER = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const ITEM_NOW = "12121212-1212-4121-8121-121212121212";

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function baseProject(
  partial: Partial<Project> & Pick<Project, "id" | "name" | "code">,
): Project {
  return {
    summary: "",
    status: "healthy",
    currentFocus: "",
    stakeholders: [],
    ...partial,
  };
}

function emptyState(): MissionState {
  return {
    projects: [],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [],
    knowledge: [],
    risks: [],
    timeline: [],
    history: [],
  };
}

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("verify-people-context-ui\n");

check("1. People frame renders durable stakeholder identities", () => {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "Alpha",
      code: "A",
      stakeholders: [{ id: AVA, name: "Ava Chen", role: "UX" }],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX design sign-off",
    personName: "Ava Chen",
    personId: AVA,
  }).state;
  const rows = buildPeopleRows(state, PROJECT_A);
  assert.ok(rows.some((r) => r.personId === AVA));
  assert.ok(rows.some((r) => /@Ava Chen · UX design sign-off/.test(r.title)));
});

check("2. Selecting a Person resolves detail by stable ID", () => {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "Alpha",
      code: "A",
      stakeholders: [{ id: AVA, name: "Ava Chen", role: "UX" }],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX design sign-off",
    personName: "Ava Chen",
    personId: AVA,
  }).state;
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForPerson(AVA),
  );
  assert.ok(detail);
  assert.equal(detail!.personBundle!.person.id, AVA);
  assert.equal(detail!.domain, "person");
});

check("3. Current responsibilities render correctly", () => {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [{ id: AVA, name: "Ava Chen", role: "UX" }],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX design sign-off",
    personName: "Ava Chen",
    personId: AVA,
  }).state;
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForPerson(AVA),
  )!;
  assert.equal(detail.personBundle!.currentResponsibilities.length, 1);
  assert.equal(
    detail.personBundle!.currentResponsibilities[0]!.scope,
    "UX design sign-off",
  );
});

check("4. Two current owners for the same scope both render", () => {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [
        { id: MARK, name: "Mark", role: "Dev" },
        { id: BRUNO, name: "Bruno", role: "Dev" },
      ],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "React bug fixing",
    personName: "Mark",
    personId: MARK,
  }).state;
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "React bug fixing",
    personName: "Bruno",
    personId: BRUNO,
  }).state;
  const rows = buildPeopleRows(state, PROJECT_A);
  assert.ok(rows.some((r) => r.personId === MARK && /React bug fixing/.test(r.title)));
  assert.ok(rows.some((r) => r.personId === BRUNO && /React bug fixing/.test(r.title)));
  assert.ok(rows.filter((r) => /React bug fixing/.test(r.title)).every((r) => r.epistemic === "Shared"));
});

check("5. Adding a second owner does not automatically replace the first", () => {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [
        { id: BOB, name: "Bob", role: "PM" },
        { id: MARY, name: "Mary", role: "PM" },
      ],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "release tasks",
    personName: "Bob",
    personId: BOB,
  }).state;
  // Share path (no replacePersonId)
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "release tasks",
    personName: "Mary",
    personId: MARY,
  }).state;
  const bob = getPersonBundle(state, PROJECT_A, BOB)!;
  const mary = getPersonBundle(state, PROJECT_A, MARY)!;
  assert.equal(bob.currentResponsibilities.length, 1);
  assert.equal(mary.currentResponsibilities.length, 1);
  const choice = resolveConfirmOwnerChoice(
    state.knowledge.find((k) => k.projectId === PROJECT_A),
    "release tasks",
    { selectedPersonId: MARY, selectedPersonName: "Mary" },
  );
  // Mary already owner → no intent required for reconfirm
  assert.equal(choice.selectedIsCurrentOwner, true);
  assert.equal(choice.requiresOwnershipIntent, false);
});

check("6. Explicit replacement supersedes the selected prior relationship", () => {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [
        { id: BOB, name: "Bob", role: "PM" },
        { id: MARY, name: "Mary", role: "PM" },
      ],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "release tasks",
    personName: "Bob",
    personId: BOB,
  }).state;

  const choice = resolveConfirmOwnerChoice(
    state.knowledge.find((k) => k.projectId === PROJECT_A),
    "release tasks",
    { selectedPersonId: MARY, selectedPersonName: "Mary" },
  );
  assert.equal(choice.requiresOwnershipIntent, true);
  const replaceId = resolveReplacePersonId({
    intent: "replace",
    requiresOwnershipIntent: true,
    replacePersonId: BOB,
    currentOwners: choice.currentOwners,
  });
  assert.equal(replaceId, BOB);

  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "release tasks",
    personName: "Mary",
    personId: MARY,
    replacePersonId: BOB,
  }).state;

  const bob = getPersonBundle(state, PROJECT_A, BOB)!;
  const mary = getPersonBundle(state, PROJECT_A, MARY)!;
  assert.equal(bob.currentResponsibilities.length, 0);
  assert.equal(bob.historicalResponsibilities.length, 1);
  assert.equal(mary.currentResponsibilities.length, 1);
});

check("7. Historical responsibility remains inspectable", () => {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [
        { id: BOB, name: "Bob", role: "PM" },
        { id: MARY, name: "Mary", role: "PM" },
      ],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "release tasks",
    personName: "Bob",
    personId: BOB,
  }).state;
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "release tasks",
    personName: "Mary",
    personId: MARY,
    replacePersonId: BOB,
  }).state;
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForPerson(BOB),
  )!;
  assert.match(detail.previousValue ?? "", /release tasks/);
  assert.equal(detail.personBundle!.historicalResponsibilities.length, 1);
});

check("8. One person can hold multiple distinct responsibilities", () => {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [{ id: AVA, name: "Ava Chen", role: "UX" }],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX design sign-off",
    personName: "Ava Chen",
    personId: AVA,
  }).state;
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "Research summary",
    personName: "Ava Chen",
    personId: AVA,
  }).state;
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForPerson(AVA),
  )!;
  assert.equal(detail.personBundle!.currentResponsibilities.length, 2);
  const rows = buildPeopleRows(state, PROJECT_A).filter((r) => r.personId === AVA);
  assert.equal(rows.length, 2);
});

check("9. Two similar/same-first-name people remain distinct", () => {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [
        { id: AVA, name: "Ava Chen", role: "UX" },
        { id: AVA_OTHER, name: "Ava Patel", role: "Research" },
      ],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX design sign-off",
    personName: "Ava Chen",
    personId: AVA,
  }).state;
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "Research summary",
    personName: "Ava Patel",
    personId: AVA_OTHER,
  }).state;
  const chen = getPersonBundle(state, PROJECT_A, AVA)!;
  const patel = getPersonBundle(state, PROJECT_A, AVA_OTHER)!;
  assert.equal(chen.person.name, "Ava Chen");
  assert.equal(patel.person.name, "Ava Patel");
  assert.equal(chen.currentResponsibilities[0]!.scope, "UX design sign-off");
  assert.equal(patel.currentResponsibilities[0]!.scope, "Research summary");
  assert.equal(
    state.projects[0]!.stakeholders.filter((s) => s.name.startsWith("Ava"))
      .length,
    2,
  );
});

check("10. Existing Person is reused rather than duplicated", () => {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [{ id: AVA, name: "Ava Chen", role: "UX" }],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  const first = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX design sign-off",
    personName: "Ava Chen",
    personId: AVA,
  });
  assert.equal(first.personCreated, false);
  assert.equal(first.person.id, AVA);
  const second = confirmResponsibilityOwner({
    state: first.state,
    projectId: PROJECT_A,
    scope: "Journey freeze",
    personName: "Ava Chen",
    personId: AVA,
  });
  assert.equal(second.personCreated, false);
  assert.equal(
    second.state.projects[0]!.stakeholders.filter((s) => s.id === AVA).length,
    1,
  );
});

check("11. New Person persists through Confirm Owner path", () => {
  const state = emptyState();
  state.projects = [baseProject({ id: PROJECT_A, name: "A", code: "A" })];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  const result = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "CAB pack",
    personName: "Priya Shah",
  });
  assert.equal(result.personCreated, true);
  assert.ok(
    result.state.projects[0]!.stakeholders.some((s) => s.id === result.person.id),
  );
  assert.equal(result.item.meta?.responsibility?.personId, result.person.id);
});

check("12. Provenance is retained on confirm", () => {
  const state = emptyState();
  state.projects = [baseProject({ id: PROJECT_A, name: "A", code: "A" })];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  const result = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "CAB pack",
    personName: "Priya Shah",
  });
  assert.ok(
    result.item.provenance?.some((p) => p.type === "user_confirmation"),
  );
  const detail = resolveKnowledgeItemDetail(
    result.state,
    PROJECT_A,
    refForPerson(result.person.id),
  )!;
  assert.ok(detail.provenanceLines.some((l) => /Confirmed by you/.test(l)));
});

check("13. Availability renders only when structured data exists", () => {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [{ id: AVA, name: "Ava Chen", role: "UX" }],
    }),
  ];
  const k = emptyKnowledge(PROJECT_A);
  const availability: CanonicalTruthItem = {
    id: "99999999-9999-4999-8999-999999999999",
    projectId: PROJECT_A,
    body: "Ava Chen — Away 1–12 Sep",
    kind: "availability",
    epistemic: "confirmed",
    lifecycle: "current",
    meta: {
      availability: {
        personId: AVA,
        personName: "Ava Chen",
        awayFromIso: "2026-09-01",
        awayToIso: "2026-09-12",
      },
    },
  };
  k.structured = [availability];
  state.knowledge = [k];
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX design sign-off",
    personName: "Ava Chen",
    personId: AVA,
  }).state;
  const rows = buildPeopleRows(state, PROJECT_A);
  assert.ok(rows.some((r) => r.meta && /Away/.test(r.meta)));
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForPerson(AVA),
  )!;
  assert.equal(detail.personBundle!.availability.length, 1);
});

check("14. No false availability is invented", () => {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [{ id: AVA, name: "Ava Chen", role: "UX" }],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX design sign-off",
    personName: "Ava Chen",
    personId: AVA,
  }).state;
  const rows = buildPeopleRows(state, PROJECT_A);
  assert.ok(rows.every((r) => !r.meta || !/Away/.test(r.meta)));
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForPerson(AVA),
  )!;
  assert.equal(detail.personBundle!.availability.length, 0);
  assert.ok(
    detail.honestyNotes.some((n) => /No structured availability/i.test(n)),
  );
});

check("15. Project A Person cannot mutate / inspect Project B", () => {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [{ id: AVA, name: "Ava Chen", role: "UX" }],
    }),
    baseProject({
      id: PROJECT_B,
      name: "B",
      code: "B",
      stakeholders: [{ id: MARK, name: "Mark", role: "Dev" }],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A), emptyKnowledge(PROJECT_B)];
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX design sign-off",
    personName: "Ava Chen",
    personId: AVA,
  }).state;
  assert.equal(
    resolveKnowledgeItemDetail(state, PROJECT_B, refForPerson(AVA)),
    null,
  );
  assert.equal(getPersonBundle(state, PROJECT_B, AVA), null);
});

check("16. Slice 2C drawer remains wired for non-People item types", () => {
  const frames = readSrc(
    "src/components/knowledge-centre/OceanKnowledgeFrames.tsx",
  );
  assert.match(frames, /refForStructuredItem|refForRisk|refForTodo/);
  assert.match(frames, /KnowledgeItemDetailDrawer/);
  const state = emptyState();
  state.projects = [baseProject({ id: PROJECT_A, name: "A", code: "A" })];
  const k = emptyKnowledge(PROJECT_A);
  k.sections.now = ["Launch 25 Aug"];
  k.sectionItemIds = { now: [ITEM_NOW] };
  k.structured = [
    {
      id: ITEM_NOW,
      projectId: PROJECT_A,
      section: "now",
      body: "Launch 25 Aug",
      kind: "fact",
      epistemic: "confirmed",
      lifecycle: "current",
    },
  ];
  state.knowledge = [k];
  const detail = resolveKnowledgeItemDetail(
    state,
    PROJECT_A,
    refForStructuredItem(ITEM_NOW),
  );
  assert.equal(detail!.domain, "knowledge");
  assert.equal(detail!.body, "Launch 25 Aug");
});

check("17. Confirm Owner UI requires share vs replace (source contract)", () => {
  const dialog = readSrc("src/components/intelligence/ConfirmOwnerDialog.tsx");
  assert.match(dialog, /confirm-owner-intent/);
  assert.match(dialog, /confirm-owner-intent-share/);
  assert.match(dialog, /confirm-owner-intent-replace/);
  assert.match(dialog, /replacePersonId/);
  assert.match(dialog, /resolveConfirmOwnerChoice/);
  assert.match(dialog, /Needs you/);
});

check("18. Share intent helper returns null replacePersonId", () => {
  const owners = [
    {
      personName: "Bob",
      personId: BOB,
      scope: "release tasks",
      item: { id: "x" } as CanonicalTruthItem,
    },
  ];
  assert.equal(
    resolveReplacePersonId({
      intent: "share",
      requiresOwnershipIntent: true,
      replacePersonId: null,
      currentOwners: owners,
    }),
    null,
  );
  assert.throws(() =>
    resolveReplacePersonId({
      intent: null,
      requiresOwnershipIntent: true,
      replacePersonId: null,
      currentOwners: owners,
    }),
  );
});

check("UI: person detail exposes assign + handover actions", () => {
  const drawer = readSrc(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.match(drawer, /Assign ownership|Hand over/);
  assert.match(drawer, /allowScopeEdit/);
  assert.match(drawer, /defaultReplacePersonId/);
});

check("Capture / Ask boundaries untouched in this slice wiring", () => {
  const dialog = readSrc("src/components/intelligence/ConfirmOwnerDialog.tsx");
  assert.doesNotMatch(dialog, /LUME_CANONICAL_TRUTH|portfolio/i);
  const workspace = readSrc(
    "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
  );
  assert.match(workspace, /CaptureWorkspace/);
  assert.match(workspace, /variant="ocean"/);
  assert.doesNotMatch(workspace, /LUME_CANONICAL_TRUTH\s*=\s*1/);
});

console.log(`\n${passed} checks passed`);
