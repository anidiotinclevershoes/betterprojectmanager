/**
 * Slice 1D: Ask context authority convergence — focused fixtures.
 * Deterministic. No OpenAI.
 *
 * Run: npm run verify:ask-context-authority
 */
import assert from "node:assert/strict";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  confirmResponsibilityOwner,
  findConfirmedOwners,
} from "../src/lib/people/identity";
import {
  findUnknownOwnerHints,
  serializeCanonicalTruth,
} from "../src/lib/canonical-truth/serialize";
import {
  answerTellMeQuestion,
  constrainScheduledDateConfidence,
  TELL_ME_SCHEDULED_DATE_AUTHORITY_MARKER,
  TELL_ME_SYSTEM,
  TELL_ME_SYSTEM_CANONICAL,
} from "../src/lib/tell-me/answer";
import { buildTellMeContext } from "../src/lib/tell-me/context";
import { questionLooksScheduledDate } from "../src/lib/tell-me/question-shape";
import type { MissionState, Project } from "../src/lib/types";

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const MARK = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BRUNO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BOB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MARY = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const RISK_OPEN = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const RISK_DONE = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const AVA = "99999999-9999-4999-8999-999999999999";

function baseProject(
  partial: Partial<Project> & Pick<Project, "id" | "name" | "code">,
): Project {
  return {
    summary: "Ship the release",
    status: "healthy",
    currentFocus: "CAB prep",
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

async function withCanonicalEnv<T>(fn: () => Promise<T> | T): Promise<T> {
  const prev = process.env.LUME_CANONICAL_TRUTH;
  process.env.LUME_CANONICAL_TRUTH = "1";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.LUME_CANONICAL_TRUTH;
    else process.env.LUME_CANONICAL_TRUTH = prev;
  }
}

function testMultiOwnerCurrentInSerializeAndAnswer() {
  return withCanonicalEnv(async () => {
    let state = emptyState();
    state.projects = [
      baseProject({
        id: PROJECT_A,
        name: "Alpha",
        code: "ALP",
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

    const owners = findConfirmedOwners(
      state.knowledge.find((k) => k.projectId === PROJECT_A),
      "React bug fixing",
    );
    assert.equal(owners.length, 2);

    const bundle = serializeCanonicalTruth({
      state,
      projectId: PROJECT_A,
      question: "Who can handle React bugs?",
    });
    assert.match(bundle.promptBlock, /@Mark → React bug fixing/);
    assert.match(bundle.promptBlock, /@Bruno → React bug fixing/);

    const answered = await answerTellMeQuestion({
      question: "Who owns React bug fixing?",
      state,
      selectedProjectId: PROJECT_A,
      useCanonicalTruth: true,
    });
    assert.match(answered.answer, /Mark/i);
    assert.match(answered.answer, /Bruno/i);
    assert.equal(answered.usedCanonicalTruth, true);
  });
}

function testOwnerHandoverCurrentVsHistorical() {
  return withCanonicalEnv(async () => {
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

    const current = serializeCanonicalTruth({
      state,
      projectId: PROJECT_A,
      question: "Who owns release tasks now?",
    });
    assert.match(current.promptBlock, /@Mary → release tasks/);
    assert.doesNotMatch(current.promptBlock, /@Bob → release tasks/);
    assert.equal(current.includedHistoryEvidence, false);

    const historical = serializeCanonicalTruth({
      state,
      projectId: PROJECT_A,
      question: "Who used to handle release tasks?",
    });
    assert.match(historical.promptBlock, /MODE: historical/);
    assert.match(historical.promptBlock, /@Bob → release tasks/);
    assert.match(historical.promptBlock, /superseded/);
  });
}

function testResolvedRiskExcludedFromCurrent() {
  const state = emptyState();
  state.projects = [baseProject({ id: PROJECT_A, name: "A", code: "A" })];
  const knowledge = emptyKnowledge(PROJECT_A);
  knowledge.sections.risks = [
    "[Resolved] Old cab risk",
    "Legacy open-looking string",
  ];
  state.knowledge = [knowledge];
  state.risks = [
    {
      id: RISK_OPEN,
      projectId: PROJECT_A,
      title: "Auth0 delay",
      status: "open",
    },
    {
      id: RISK_DONE,
      projectId: PROJECT_A,
      title: "Old cab risk",
      status: "resolved",
    },
  ];

  const bundle = serializeCanonicalTruth({
    state,
    projectId: PROJECT_A,
    question: "What are the open risks?",
  });
  assert.match(bundle.promptBlock, /Auth0 delay/);
  assert.match(bundle.promptBlock, /\(risk, open\) Auth0 delay/);
  // Durable resolved status is current truth, not omitted and not presented as open.
  assert.match(bundle.promptBlock, /\(risk, resolved\) Old cab risk/);
  assert.doesNotMatch(bundle.promptBlock, /\(risk, open\) Old cab risk/);
  assert.doesNotMatch(bundle.promptBlock, /\[Resolved\] Old cab risk/);
}

function testNoFabricatedUnknownOwnerGap() {
  const state = emptyState();
  state.projects = [
    baseProject({
      id: PROJECT_A,
      name: "A",
      code: "A",
      stakeholders: [{ id: AVA, name: "Ava Chen", role: "UX" }],
    }),
  ];
  const knowledge = emptyKnowledge(PROJECT_A);
  knowledge.sections.people = ["Ava Chen — UX Lead"];
  state.knowledge = [knowledge];

  const bundle = serializeCanonicalTruth({
    state,
    projectId: PROJECT_A,
    question: "Who owns Security sign-off?",
  });
  assert.equal(bundle.needsConfirmationHints.length, 0);
  assert.equal(findUnknownOwnerHints(bundle.items).length, 0);
  assert.match(bundle.promptBlock, /Ava Chen/);
}

function testCurrentStateOmitsHistoryDump() {
  const state = emptyState();
  state.projects = [baseProject({ id: PROJECT_A, name: "A", code: "A" })];
  state.knowledge = [emptyKnowledge(PROJECT_A)];
  state.knowledge[0]!.sections.now = ["Beta targeted for September"];
  state.history = [
    {
      id: "hist-1",
      type: "other",
      title: "Old go-live was June",
      detail: "Superseded plan",
      projectId: PROJECT_A,
      createdAt: new Date().toISOString(),
      source: "system",
    },
  ];

  const current = serializeCanonicalTruth({
    state,
    projectId: PROJECT_A,
    question: "What is the current focus?",
  });
  assert.equal(current.includedHistoryEvidence, false);
  assert.doesNotMatch(current.promptBlock, /EVIDENCE \(history/);
  assert.doesNotMatch(current.promptBlock, /Old go-live was June/);

  const historical = serializeCanonicalTruth({
    state,
    projectId: PROJECT_A,
    question: "What changed about the go-live?",
  });
  assert.equal(historical.includedHistoryEvidence, true);
  assert.match(historical.promptBlock, /Old go-live was June/);
}

function testPersonCentredAndDomainCoverage() {
  return withCanonicalEnv(async () => {
    let state = emptyState();
    state.projects = [
      baseProject({
        id: PROJECT_A,
        name: "Alpha",
        code: "ALP",
        stakeholders: [{ id: AVA, name: "Ava Chen", role: "UX Lead" }],
      }),
    ];
    state.knowledge = [emptyKnowledge(PROJECT_A)];
    state.knowledge[0]!.structured = [
      {
        id: "77777777-7777-4777-8777-777777777777",
        projectId: PROJECT_A,
        section: "people",
        body: "Ava Chen away 1–12 Sep",
        kind: "availability",
        epistemic: "confirmed",
        lifecycle: "current",
        meta: {
          availability: {
            personId: AVA,
            personName: "Ava Chen",
            label: "away",
            awayFromIso: "2026-09-01",
            awayToIso: "2026-09-12",
          },
        },
      },
    ];
    state = confirmResponsibilityOwner({
      state,
      projectId: PROJECT_A,
      scope: "UX sign-off",
      personName: "Ava Chen",
      personId: AVA,
    }).state;
    state.todos = [
      {
        id: "todo-1",
        projectId: PROJECT_A,
        title: "Chase CAB pack",
        done: false,
        createdAt: new Date().toISOString(),
        kind: "CHASE",
        waitingOn: "Priya",
      },
      {
        id: "todo-2",
        projectId: PROJECT_A,
        title: "Prep demo script",
        done: false,
        createdAt: new Date().toISOString(),
        kind: "ACTION",
      },
    ];
    state.timeline = [
      {
        id: "ms-1",
        projectId: PROJECT_A,
        label: "UX freeze",
        type: "milestone",
        startAt: "2026-09-15T12:00:00.000Z",
        source: "manual",
      },
    ];
    state.risks = [
      {
        id: RISK_OPEN,
        projectId: PROJECT_A,
        title: "No cover while Ava is away",
        status: "open",
      },
    ];

    const bundle = serializeCanonicalTruth({
      state,
      projectId: PROJECT_A,
      question: "What do we know about Ava and UX?",
    });
    assert.match(bundle.promptBlock, /person-.*Ava Chen/);
    assert.match(bundle.promptBlock, /@Ava Chen → UX sign-off/);
    assert.match(bundle.promptBlock, /availability/);
    assert.match(bundle.promptBlock, /No cover while Ava is away/);
    assert.match(bundle.promptBlock, /Prep demo script/);
    assert.match(bundle.promptBlock, /Chase CAB pack/);
    assert.match(bundle.promptBlock, /UX freeze/);
    assert.match(bundle.promptBlock, /FOCUS: CAB prep/);
  });
}

function testScheduledDateAuthorityBoundary() {
  assert.equal(
    questionLooksScheduledDate("What is the current target release date?"),
    true,
  );
  assert.ok(TELL_ME_SYSTEM.includes(TELL_ME_SCHEDULED_DATE_AUTHORITY_MARKER));
  assert.ok(
    TELL_ME_SYSTEM_CANONICAL.includes(TELL_ME_SCHEDULED_DATE_AUTHORITY_MARKER),
  );
  assert.equal(
    constrainScheduledDateConfidence({
      question: "What is the current target release date?",
      confidence: "direct_confirmation",
      sources: [
        {
          id: "dec-1",
          kind: "knowledge",
          label: "go on 27 October",
          projectId: PROJECT_A,
          projectCode: "ALP",
        },
      ],
    }),
    "related_context",
    "knowledge/decision prose is not a scheduled date record",
  );
  assert.equal(
    constrainScheduledDateConfidence({
      question: "What is the current target release date?",
      confidence: "direct_confirmation",
      sources: [
        {
          id: "ms-release",
          kind: "timeline",
          label: "Release",
          projectId: PROJECT_A,
          projectCode: "ALP",
          detail: "2026-10-27",
        },
      ],
    }),
    "direct_confirmation",
  );
}

function testProjectIsolationAndRollback() {
  return withCanonicalEnv(async () => {
    const state = emptyState();
    state.projects = [
      baseProject({ id: PROJECT_A, name: "A", code: "A" }),
      baseProject({ id: PROJECT_B, name: "B", code: "B" }),
    ];
    const ka = emptyKnowledge(PROJECT_A);
    ka.sections.now = ["Only A secret"];
    const kb = emptyKnowledge(PROJECT_B);
    kb.sections.now = ["Only B secret"];
    state.knowledge = [ka, kb];

    const ctx = buildTellMeContext({
      state,
      question: "What is current?",
      selectedProjectId: PROJECT_A,
      useCanonicalTruth: true,
    });
    assert.equal(ctx.usedCanonicalTruth, true);
    assert.match(ctx.promptBlock, /Only A secret/);
    assert.doesNotMatch(ctx.promptBlock, /Only B secret/);

    process.env.LUME_CANONICAL_TRUTH = "0";
    const legacy = buildTellMeContext({
      state,
      question: "What is current?",
      selectedProjectId: PROJECT_A,
      useCanonicalTruth: false,
    });
    assert.equal(Boolean(legacy.usedCanonicalTruth), false);
  });
}

async function main() {
  await testMultiOwnerCurrentInSerializeAndAnswer();
  console.log("✓ multi-owner current responsibility");
  await testOwnerHandoverCurrentVsHistorical();
  console.log("✓ owner handover current vs historical");
  testResolvedRiskExcludedFromCurrent();
  console.log("✓ resolved Risk excluded from current");
  testNoFabricatedUnknownOwnerGap();
  console.log("✓ no fabricated unknown-owner gap");
  testCurrentStateOmitsHistoryDump();
  console.log("✓ current-state omits History dump; historical includes evidence");
  await testPersonCentredAndDomainCoverage();
  console.log("✓ person-centred + cross-domain coverage");
  testScheduledDateAuthorityBoundary();
  console.log("✓ scheduled-date Ask authority is timeline/releases, not knowledge prose");
  await testProjectIsolationAndRollback();
  console.log("✓ project isolation + legacy rollback");
  console.log("verify-ask-context-authority: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
