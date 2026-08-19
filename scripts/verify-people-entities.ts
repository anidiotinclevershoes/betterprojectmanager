/**
 * Slice 1C: durable People entities + scoped relationships.
 * Deterministic. No OpenAI. No live Supabase.
 *
 * Run: npm run verify:people-entities
 */
import assert from "node:assert/strict";
import { emptyKnowledge } from "../src/lib/knowledge";
import { isKnowledgeUuid } from "../src/lib/knowledge-identity";
import {
  confirmResponsibilityOwner,
  findConfirmedOwners,
  getPersonBundle,
  namesMatchExact,
} from "../src/lib/people/identity";
import type { MissionState, Project } from "../src/lib/types";

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const PERSON_AVA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSON_MARK = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PERSON_BRUNO = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PERSON_BOB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PERSON_MARY = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const PERSON_AVA_OTHER = "ffffffff-ffff-4fff-8fff-ffffffffffff";

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

function testNewPersonConfirmOwnerCreatesDurableIdentity() {
  const state = emptyState();
  state.projects = [baseProject({ id: PROJECT_A, name: "Alpha", code: "ALP" })];
  state.knowledge = [emptyKnowledge(PROJECT_A)];

  const result = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX sign-off",
    personName: "Ava Chen",
  });

  assert.equal(result.personCreated, true);
  assert.ok(isKnowledgeUuid(result.person.id));
  assert.ok(isKnowledgeUuid(result.item.id), "responsibility id must be UUID");
  assert.equal(result.item.meta?.responsibility?.personId, result.person.id);
  assert.equal(result.responsibilityCreated, true);
  assert.ok(
    result.item.provenance?.some((p) => p.type === "user_confirmation"),
  );

  // Simulate reload shape: stakeholders + structured survive on state
  const reloadedPerson = result.state.projects[0]!.stakeholders.find(
    (s) => s.id === result.person.id,
  );
  assert.ok(reloadedPerson);
  assert.equal(reloadedPerson!.name, "Ava Chen");
  const owners = findConfirmedOwners(
    result.state.knowledge.find((k) => k.projectId === PROJECT_A),
    "UX sign-off",
  );
  assert.equal(owners.length, 1);
  assert.equal(owners[0]!.personId, result.person.id);
}

function testExistingPersonReuseNoDuplicate() {
  const state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "Alpha",
      code: "ALP",
      stakeholders: [
        { id: PERSON_AVA, name: "Ava Chen", role: "UX Lead" },
      ],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];

  const first = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX sign-off",
    personName: "Ava Chen",
    personId: PERSON_AVA,
  });
  assert.equal(first.personCreated, false);
  assert.equal(first.person.id, PERSON_AVA);

  const second = confirmResponsibilityOwner({
    state: first.state,
    projectId: PROJECT_A,
    scope: "Research summary",
    personName: "Ava Chen",
    personId: PERSON_AVA,
  });
  assert.equal(second.personCreated, false);
  assert.equal(second.person.id, PERSON_AVA);
  assert.equal(
    second.state.projects[0]!.stakeholders.filter((s) =>
      namesMatchExact(s.name, "Ava Chen"),
    ).length,
    1,
    "must not create duplicate Ava",
  );

  const reconfirm = confirmResponsibilityOwner({
    state: second.state,
    projectId: PROJECT_A,
    scope: "UX sign-off",
    personName: "Ava Chen",
    personId: PERSON_AVA,
  });
  assert.equal(reconfirm.responsibilityCreated, false);
  assert.equal(reconfirm.item.id, first.item.id);
}

function testMultipleScopesOnePerson() {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [{ id: PERSON_AVA, name: "Ava Chen", role: "UX" }],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];

  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX sign-off",
    personName: "Ava Chen",
    personId: PERSON_AVA,
  }).state;
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "Journey freeze",
    personName: "Ava Chen",
    personId: PERSON_AVA,
  }).state;

  const bundle = getPersonBundle(state, PROJECT_A, PERSON_AVA)!;
  assert.equal(bundle.currentResponsibilities.length, 2);
  const scopes = bundle.currentResponsibilities.map((r) => r.scope).sort();
  assert.deepEqual(scopes, ["Journey freeze", "UX sign-off"]);
}

function testSharedResponsibilityTwoPeople() {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [
        { id: PERSON_MARK, name: "Mark", role: "Dev" },
        { id: PERSON_BRUNO, name: "Bruno", role: "Dev" },
      ],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];

  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "React bug fixing",
    personName: "Mark",
    personId: PERSON_MARK,
  }).state;

  const withBruno = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "React bug fixing",
    personName: "Bruno",
    personId: PERSON_BRUNO,
  });

  const owners = findConfirmedOwners(
    withBruno.state.knowledge.find((k) => k.projectId === PROJECT_A),
    "React bug fixing",
  );
  assert.equal(owners.length, 2, "shared ownership must keep both current");
  assert.ok(owners.some((o) => o.personId === PERSON_MARK));
  assert.ok(owners.some((o) => o.personId === PERSON_BRUNO));

  // Mark must still be current (not auto-superseded)
  const markItem = owners.find((o) => o.personId === PERSON_MARK)!;
  assert.equal(markItem.item.lifecycle, "current");
}

function testExplicitReplacePreservesHistory() {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [
        { id: PERSON_BOB, name: "Bob", role: "PM" },
        { id: PERSON_MARY, name: "Mary", role: "PM" },
      ],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];

  const bob = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "release tasks",
    personName: "Bob",
    personId: PERSON_BOB,
  });
  state = bob.state;

  const mary = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "release tasks",
    personName: "Mary",
    personId: PERSON_MARY,
    replacePersonId: PERSON_BOB,
  });

  const owners = findConfirmedOwners(
    mary.state.knowledge.find((k) => k.projectId === PROJECT_A),
    "release tasks",
  );
  assert.equal(owners.length, 1);
  assert.equal(owners[0]!.personId, PERSON_MARY);

  const bobBundle = getPersonBundle(mary.state, PROJECT_A, PERSON_BOB)!;
  assert.equal(bobBundle.currentResponsibilities.length, 0);
  assert.equal(bobBundle.historicalResponsibilities.length, 1);
  assert.equal(bobBundle.historicalResponsibilities[0]!.scope, "release tasks");
  assert.equal(
    bobBundle.historicalResponsibilities[0]!.item.lifecycle,
    "superseded",
  );
  assert.ok(
    bobBundle.historicalResponsibilities[0]!.item.provenance?.some(
      (p) => p.type === "user_confirmation",
    ),
  );
}

function testAmbiguousSharedVsReplaceDoesNotSilentlyOverwrite() {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [
        { id: PERSON_BOB, name: "Bob", role: "PM" },
        { id: PERSON_MARY, name: "Mary", role: "PM" },
      ],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];

  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "release tasks",
    personName: "Bob",
    personId: PERSON_BOB,
  }).state;

  // No replacePersonId → share, do not silently end Bob
  const mary = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "release tasks",
    personName: "Mary",
    personId: PERSON_MARY,
  });

  const owners = findConfirmedOwners(
    mary.state.knowledge.find((k) => k.projectId === PROJECT_A),
    "release tasks",
  );
  assert.equal(owners.length, 2);
  assert.ok(owners.some((o) => o.personId === PERSON_BOB));
  assert.ok(owners.some((o) => o.personId === PERSON_MARY));
}

function testSimilarlyNamedPeopleRemainSeparate() {
  const state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [
        { id: PERSON_AVA, name: "Ava Chen", role: "UX" },
        { id: PERSON_AVA_OTHER, name: "Ava Smith", role: "QA" },
      ],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];

  const a = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX sign-off",
    personName: "Ava Chen",
    personId: PERSON_AVA,
  });
  const b = confirmResponsibilityOwner({
    state: a.state,
    projectId: PROJECT_A,
    scope: "QA pack",
    personName: "Ava Smith",
    personId: PERSON_AVA_OTHER,
  });

  assert.equal(
    b.state.projects[0]!.stakeholders.length,
    2,
    "must not merge Ava Chen and Ava Smith",
  );
  assert.equal(
    getPersonBundle(b.state, PROJECT_A, PERSON_AVA)!.currentResponsibilities[0]!
      .scope,
    "UX sign-off",
  );
  assert.equal(
    getPersonBundle(b.state, PROJECT_A, PERSON_AVA_OTHER)!
      .currentResponsibilities[0]!.scope,
    "QA pack",
  );
}

function testPersonBundleRetrievalAndProvenance() {
  const state0 = emptyState();
  state0.projects = [
    baseProject({ id: PROJECT_A, name: "A", code: "A", stakeholders: [] }),
  ];
  state0.knowledge = [emptyKnowledge(PROJECT_A)];

  const confirmed = confirmResponsibilityOwner({
    state: state0,
    projectId: PROJECT_A,
    scope: "CAB pack",
    personName: "Priya Nair",
  });

  const bundle = getPersonBundle(
    confirmed.state,
    PROJECT_A,
    confirmed.person.id,
  )!;
  assert.equal(bundle.person.name, "Priya Nair");
  assert.equal(bundle.currentResponsibilities.length, 1);
  assert.equal(bundle.currentResponsibilities[0]!.scope, "CAB pack");
  assert.ok(
    bundle.currentResponsibilities[0]!.item.provenance?.some(
      (p) => p.type === "user_confirmation",
    ),
  );
  assert.ok(
    bundle.legacyPeopleBullets.some((b) => /Priya Nair/i.test(b)),
  );
}

function testProjectIsolation() {
  const state = emptyState();
  state.projects = [
    baseProject({ id: PROJECT_A, name: "A", code: "A" }),
    baseProject({
      id: PROJECT_B,
      name: "B",
      code: "B",
      stakeholders: [{ id: PERSON_MARK, name: "Mark", role: "Dev" }],
    }),
  ];
  const kb = emptyKnowledge(PROJECT_B);
  kb.sections.people = ["Mark — React"];
  state.knowledge = [emptyKnowledge(PROJECT_A), kb];

  const result = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "Security",
    personName: "Nina",
  });

  const b = result.state.projects.find((p) => p.id === PROJECT_B)!;
  assert.equal(b.stakeholders.length, 1);
  assert.equal(b.stakeholders[0]!.id, PERSON_MARK);
  const kbAfter = result.state.knowledge.find((k) => k.projectId === PROJECT_B)!;
  assert.deepEqual(kbAfter.sections.people, ["Mark — React"]);
}

function testUnrelatedScopeNotCorruptedOnReplace() {
  let state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [
        { id: PERSON_AVA, name: "Ava Chen", role: "UX" },
        { id: PERSON_MARY, name: "Mary", role: "UX" },
      ],
    }),
  ];
  state.knowledge = [emptyKnowledge(PROJECT_A)];

  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX sign-off",
    personName: "Ava Chen",
    personId: PERSON_AVA,
  }).state;
  state = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "Research summary",
    personName: "Ava Chen",
    personId: PERSON_AVA,
  }).state;

  const replaced = confirmResponsibilityOwner({
    state,
    projectId: PROJECT_A,
    scope: "UX sign-off",
    personName: "Mary",
    personId: PERSON_MARY,
    replacePersonId: PERSON_AVA,
  });

  const ava = getPersonBundle(replaced.state, PROJECT_A, PERSON_AVA)!;
  assert.ok(
    ava.currentResponsibilities.some((r) => r.scope === "Research summary"),
  );
  assert.ok(
    ava.historicalResponsibilities.some((r) => r.scope === "UX sign-off"),
  );
}

testNewPersonConfirmOwnerCreatesDurableIdentity();
testExistingPersonReuseNoDuplicate();
testMultipleScopesOnePerson();
testSharedResponsibilityTwoPeople();
testExplicitReplacePreservesHistory();
testAmbiguousSharedVsReplaceDoesNotSilentlyOverwrite();
testSimilarlyNamedPeopleRemainSeparate();
testPersonBundleRetrievalAndProvenance();
testProjectIsolation();
testUnrelatedScopeNotCorruptedOnReplace();

console.log("verify-people-entities: OK");
