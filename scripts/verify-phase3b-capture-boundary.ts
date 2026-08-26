/**
 * Phase 3B — Capture mutation boundary.
 * Proves legal-domain rules, not regression-transcript strings.
 *
 * Run: npx tsx scripts/verify-phase3b-capture-boundary.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyCaptureLegalDomain,
  executeCaptureApply,
  planCaptureApply,
  type CaptureApplyHooks,
  type CaptureApplyWorld,
  type CaptureLegalOperation,
} from "../src/lib/capture/apply";
import type { PendingSuggestion } from "../src/lib/capture/suggestions";
import { buildSuggestions } from "../src/lib/capture/suggestions";
import type { CaptureResult } from "../src/lib/types";
import { mapFindingToOperation } from "../src/lib/capture/findings/map";
import {
  extractLocalFindings,
  type CaptureFinding,
  type IndexedContextRecord,
} from "../src/lib/capture/findings";
import { validateCaptureFindings } from "../src/lib/capture/findings/validate";

let passed = 0;

async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function suggestion(
  partial: Partial<PendingSuggestion> &
    Pick<PendingSuggestion, "id" | "kind" | "op" | "content">,
): PendingSuggestion {
  return {
    destination: partial.destination ?? "test",
    ...partial,
  };
}

function world(partial?: Partial<CaptureApplyWorld>): CaptureApplyWorld {
  const projectA = {
    id: "proj-candy",
    name: "Candyland",
    code: "CANDY",
    stakeholders: [
      { id: "person-gumdrop", name: "Pippa Gumdrop", role: "UAT lead" },
    ],
  };
  const projectB = {
    id: "proj-toy",
    name: "Toyworld",
    code: "TOY",
    stakeholders: [
      { id: "person-brick", name: "Brick Oakley", role: "Sponsor" },
    ],
  };
  return {
    projectIds: new Set(["proj-candy", "proj-toy", "proj-game"]),
    projects: [
      projectA,
      projectB,
      {
        id: "proj-game",
        name: "GamingStudio5000",
        code: "GS5K",
        stakeholders: [],
      },
    ],
    risks: [
      {
        id: "risk-bridge",
        projectId: "proj-candy",
        title: "Gumdrop Bridge icing",
        status: "open",
      },
      {
        id: "risk-console",
        projectId: "proj-game",
        title: "Console certification slip",
        status: "open",
      },
    ],
    todos: [
      {
        id: "todo-pack",
        projectId: "proj-candy",
        title: "Prepare the jelly pack",
        done: false,
      },
    ],
    timeline: [
      {
        id: "ms-parade",
        projectId: "proj-candy",
        label: "Parade day",
        startAt: "2026-10-15T12:00:00.000Z",
      },
    ],
    knowledge: [
      {
        projectId: "proj-candy",
        sections: { people: ["Pippa Gumdrop — UAT lead"] },
        structured: [
          {
            id: "resp-uat",
            kind: "responsibility",
            lifecycle: "current",
            body: "Pippa Gumdrop — UAT lead",
            meta: {
              personId: "person-gumdrop",
              responsibility: {
                personId: "person-gumdrop",
                personName: "Pippa Gumdrop",
                scope: "UAT lead",
                ownerConfirmed: true,
              },
            },
          },
        ],
      },
    ],
    ...partial,
  };
}

function countingHooks(log: CaptureLegalOperation[]): CaptureApplyHooks {
  const push = (op: CaptureLegalOperation) => {
    log.push(op);
  };
  return {
    createTodo: async (op) => push(op),
    updateTodo: async (op) => push(op),
    completeTodo: async (op) => push(op),
    deleteTodo: async (op) => push(op),
    createRisk: async (op) => push(op),
    updateRiskStatus: async (op) => push(op),
    createMilestone: async (op) => push(op),
    updateMilestone: async (op) => push(op),
    ensurePerson: async (op) => push(op),
    confirmResponsibility: async (op) => push(op),
    writeAvailability: async (op) => push(op),
    writeKnowledge: async (op) => push(op),
    writeMemory: async (op) => push(op),
  };
}

async function apply(
  item: PendingSuggestion,
  opts?: { entry?: string | null; world?: CaptureApplyWorld },
) {
  const writes: CaptureLegalOperation[] = [];
  const decision = planCaptureApply({
    item,
    text: item.content,
    world: opts?.world ?? world(),
    captureEntryProjectId: opts?.entry ?? "proj-candy",
  });
  const executed = await executeCaptureApply(decision, countingHooks(writes));
  return { decision, executed, writes };
}

function productionCapture(
  op: NonNullable<CaptureResult["proposedOperations"]>[number],
): CaptureResult {
  return {
    memory: {
      id: "mem-prod",
      type: "voice_note",
      title: "Capture",
      content: op.evidence || op.targetTitle || "Capture",
      tags: [],
      occurredAt: "2026-08-25T00:00:00.000Z",
      createdAt: "2026-08-25T00:00:00.000Z",
      source: "capture",
      projectId: op.projectId ?? "proj-candy",
    },
    insights: [],
    assumptions: [],
    recommendations: [],
    proposedOperations: [op],
  };
}

async function applyProposed(
  op: NonNullable<CaptureResult["proposedOperations"]>[number],
) {
  const suggestions = buildSuggestions(productionCapture(op), []);
  assert.equal(suggestions.length, 1);
  const item = suggestions[0]!;
  const applied = await apply(item);
  return { item, ...applied };
}

const ACTIVE_CAPTURE_PATHS = [
  "src/lib/capture/apply/dispatch.ts",
  "src/lib/capture/apply/classify.ts",
  "src/lib/capture/findings/pipeline.ts",
  "src/lib/capture/review/observations.ts",
  "src/lib/capture/review/counts.ts",
  "src/lib/capture/findings/coverage.ts",
  "src/components/capture/CaptureSessionContext.tsx",
  "src/lib/knowledge.ts",
];

async function main() {
await check("1. every supported kind classifies to an explicit domain", () => {
  const kinds = [
    "action",
    "nudge",
    "risk",
    "milestone",
    "stakeholder",
    "availability",
    "knowledge",
    "decision",
    "memory",
    "meeting",
  ] as const;
  for (const kind of kinds) {
    const domain = classifyCaptureLegalDomain(
      suggestion({ id: kind, kind, op: "create", content: "x" }),
    );
    assert.ok(domain, kind);
    if (kind === "meeting") assert.equal(domain, "unsupported");
    else assert.notEqual(domain, "unsupported", kind);
  }
});

await check("2. unknown/unsupported finding cannot become a Todo", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "unk",
      kind: "meeting",
      op: "create",
      content: "Prep the stand-up",
      legalDomain: "unsupported",
      projectId: "proj-candy",
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("3. invalid payload cannot fall through into another domain", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "bad-risk",
      kind: "risk",
      op: "complete",
      content: "Something vague",
      projectId: "proj-candy",
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(decision.domain, "risk");
  assert.equal(writes.length, 0);
});

await check("4. verified Project A context writes only to A", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "todo-a",
      kind: "action",
      op: "create",
      content: "Prepare the jelly pack by 8 October",
      projectId: "proj-candy",
      date: "2026-10-08",
    }),
  );
  assert.equal(decision.kind, "write");
  assert.equal(writes[0]?.type, "create_todo");
  if (writes[0]?.type === "create_todo") {
    assert.equal(writes[0].projectId, "proj-candy");
  }
});

await check("5. unresolved project conflict produces Needs you / no write", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "conflict",
      kind: "action",
      op: "create",
      content: "Do the thing",
      projectUncertain: true,
      projectCandidates: [
        { id: "proj-candy", name: "Candyland" },
        { id: "proj-toy", name: "Toyworld" },
      ],
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("6. Project A apply leaves Project B unchanged", async () => {
  const { writes } = await apply(
    suggestion({
      id: "risk-a",
      kind: "risk",
      op: "complete",
      content: "Gumdrop Bridge icing",
      projectId: "proj-candy",
      targetEntityId: "risk-bridge",
    }),
  );
  assert.equal(writes.length, 1);
  if (writes[0]?.type === "update_risk_status") {
    assert.equal(writes[0].projectId, "proj-candy");
    assert.notEqual(writes[0].riskId, "risk-console");
  } else {
    assert.fail(String(writes[0]?.type));
  }
});

await check("7. existing Risk resolution updates Risk authority", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "risk-res",
      kind: "risk",
      op: "complete",
      content: "Gumdrop Bridge icing",
      projectId: "proj-candy",
      targetEntityId: "risk-bridge",
    }),
  );
  assert.equal(decision.kind, "write");
  assert.equal(decision.domain, "risk");
  assert.equal(writes[0]?.type, "update_risk_status");
});

await check("8. unresolved Risk target cannot create a Todo", async () => {
  const { writes } = await apply(
    suggestion({
      id: "risk-miss",
      kind: "risk",
      op: "complete",
      content: "Unheard-of licorice hazard",
      projectId: "proj-candy",
    }),
  );
  assert.equal(writes.length, 0);
});

await check("9. Risk identity uses durable/exact guardrail not fuzzy match", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "risk-fuzzy",
      kind: "risk",
      op: "complete",
      content: "Bridge",
      projectId: "proj-candy",
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("10. existing milestone/date update changes milestone authority", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "ms-move",
      kind: "milestone",
      op: "update",
      content: "Parade day",
      projectId: "proj-candy",
      targetEntityId: "ms-parade",
      date: "2026-10-22",
      proposedValues: { startAt: "2026-10-22T12:00:00.000Z" },
    }),
  );
  assert.equal(decision.kind, "write");
  assert.equal(writes[0]?.type, "update_milestone");
});

await check("11. milestone update cannot create a Todo", async () => {
  const { writes } = await apply(
    suggestion({
      id: "ms-fail",
      kind: "milestone",
      op: "update",
      content: "Unknown festival",
      projectId: "proj-candy",
    }),
  );
  assert.equal(writes.length, 0);
});

await check("12. milestone completion uses milestone authority or Needs you", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "ms-done",
      kind: "milestone",
      op: "complete",
      content: "Parade day",
      projectId: "proj-candy",
      targetEntityId: "ms-parade",
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(decision.domain, "milestone");
  assert.equal(writes.length, 0);
});

await check("13. unchanged milestone/date does not manufacture a Todo", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "ms-same",
      kind: "milestone",
      op: "update",
      content: "Parade day",
      projectId: "proj-candy",
      targetEntityId: "ms-parade",
      date: "2026-10-15",
      proposedValues: { startAt: "2026-10-15T12:00:00.000Z" },
    }),
  );
  assert.equal(decision.kind, "no_change");
  assert.equal(writes.length, 0);
});

await check("14. existing Person is reused; no duplicate identity", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "person-reuse",
      kind: "stakeholder",
      op: "create",
      content: "Pippa Gumdrop remains UAT lead",
      projectId: "proj-candy",
      personName: "Pippa Gumdrop",
      personId: "person-gumdrop",
    }),
  );
  assert.equal(decision.kind, "no_change");
  assert.equal(writes.length, 0);
});

await check("15. ambiguous Person identity produces Needs you", async () => {
  const crowded = world({
    projects: [
      {
        id: "proj-candy",
        name: "Candyland",
        stakeholders: [
          { id: "p1", name: "Alex Sweet" },
          { id: "p2", name: "Alex Sour" },
        ],
      },
    ],
  });
  const { decision, writes } = await apply(
    suggestion({
      id: "person-amb",
      kind: "stakeholder",
      op: "create",
      content: "Alex remains on the gate crew",
      projectId: "proj-candy",
    }),
    { world: crowded },
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("16. continuing responsibility does not create another Stakeholder", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "resp-cont",
      kind: "stakeholder",
      op: "update",
      content: "Pippa Gumdrop remains UAT lead",
      projectId: "proj-candy",
      legalDomain: "responsibility",
      ownershipSemantics: "continue",
      personName: "Pippa Gumdrop",
      personId: "person-gumdrop",
      responsibilityScope: "UAT lead",
    }),
  );
  assert.equal(decision.kind, "no_change");
  assert.ok(!writes.some((w) => w.type === "ensure_person"));
});

await check("17. share-vs-replace ambiguity cannot silently replace ownership", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "resp-amb",
      kind: "stakeholder",
      op: "update",
      content: "Pippa remains accountable but Brick will share coordination",
      projectId: "proj-candy",
      legalDomain: "responsibility",
      ownershipSemantics: "ambiguous",
      personName: "Brick Oakley",
      responsibilityScope: "UAT lead",
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.ok(decision.kind === "needs_you" && decision.confirmOwner);
  assert.ok(!writes.some((w) => w.type === "confirm_responsibility"));
});

await check("18. Confirm Owner pathway is the write used for legal replacement", async () => {
  const shared = world({
    projects: [
      {
        id: "proj-candy",
        name: "Candyland",
        stakeholders: [
          { id: "person-gumdrop", name: "Pippa Gumdrop", role: "UAT lead" },
          { id: "person-brick", name: "Brick Oakley", role: "Sponsor" },
        ],
      },
    ],
  });
  const { decision, writes } = await apply(
    suggestion({
      id: "resp-rep",
      kind: "stakeholder",
      op: "update",
      content: "Brick Oakley replaces Pippa Gumdrop as UAT lead",
      projectId: "proj-candy",
      legalDomain: "responsibility",
      ownershipSemantics: "replace",
      personName: "Brick Oakley",
      personId: "person-brick",
      responsibilityScope: "UAT lead",
      replacePersonId: "person-gumdrop",
    }),
    { world: shared },
  );
  assert.equal(decision.kind, "write");
  assert.equal(writes[0]?.type, "confirm_responsibility");
  if (writes[0]?.type === "confirm_responsibility") {
    assert.equal(writes[0].replacePersonId, "person-gumdrop");
  }
});

await check("19. explicit legal replacement updates responsibility authority", async () => {
  const { writes } = await apply(
    suggestion({
      id: "resp-rep2",
      kind: "stakeholder",
      op: "update",
      content: "Brick Oakley replaces Pippa as UAT lead",
      projectId: "proj-candy",
      legalDomain: "responsibility",
      ownershipSemantics: "replace",
      personName: "Brick Oakley",
      responsibilityScope: "UAT lead",
    }),
  );
  assert.equal(writes[0]?.type, "confirm_responsibility");
});

await check("20. valid availability writes structured availability", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "avail",
      kind: "availability",
      op: "create",
      content: "Pippa Gumdrop is away 2026-10-03",
      projectId: "proj-candy",
      personId: "person-gumdrop",
      personName: "Pippa Gumdrop",
      proposedValues: {
        kind: "availability",
        awayFromIso: "2026-10-03T12:00:00.000Z",
        awayToIso: "2026-10-03T12:00:00.000Z",
      },
    }),
  );
  assert.equal(decision.kind, "write");
  assert.equal(writes[0]?.type, "write_availability");
});

await check("21. availability for known Person links existing identity", async () => {
  const { writes } = await apply(
    suggestion({
      id: "avail2",
      kind: "availability",
      op: "create",
      content: "Pippa Gumdrop is away 2026-10-03 to 2026-10-05",
      projectId: "proj-candy",
      personName: "Pippa Gumdrop",
      proposedValues: {
        awayFromIso: "2026-10-03T12:00:00.000Z",
        awayToIso: "2026-10-05T12:00:00.000Z",
      },
    }),
  );
  assert.equal(writes[0]?.type, "write_availability");
  if (writes[0]?.type === "write_availability") {
    assert.equal(writes[0].personId, "person-gumdrop");
  }
});

await check("22. unresolved availability cannot become Stakeholder or Todo", async () => {
  const { writes } = await apply(
    suggestion({
      id: "avail-bad",
      kind: "availability",
      op: "create",
      content: "Someone is away next week",
      projectId: "proj-candy",
    }),
  );
  assert.equal(writes.length, 0);
});

await check("23. genuine action item still creates a Todo", async () => {
  const { writes } = await apply(
    suggestion({
      id: "todo-real",
      kind: "action",
      op: "create",
      content: "Prepare the CAB pack by 8 October",
      projectId: "proj-candy",
      date: "2026-10-08",
    }),
  );
  assert.equal(writes[0]?.type, "create_todo");
});

await check("24. active Capture path contains no prohibited demo-name heuristics", () => {
  const root = process.cwd();
  const prohibited =
    /\bSarah remains Business Owner\b|\bMarcus is supporting release notes\b|\bPriya Shah\b|\bMarcus Webb\b|\bnina\b.*own|\b19\s*aug/i;
  for (const rel of ACTIVE_CAPTURE_PATHS) {
    const body = readFileSync(join(root, rel), "utf8");
    assert.equal(
      prohibited.test(body),
      false,
      `prohibited demo heuristic in ${rel}`,
    );
  }
  const session = readFileSync(
    join(root, "src/components/capture/CaptureSessionContext.tsx"),
    "utf8",
  );
  assert.equal(
    /else \{\s*addTodo\(/.test(session),
    false,
    "generic addTodo fallback must not remain",
  );
});

await check("25-27. persist-first fake client: success vs failure", async () => {
  const writes: CaptureLegalOperation[] = [];
  let persistShouldFail = false;
  const hooks: CaptureApplyHooks = {
    ...countingHooks(writes),
    writeAvailability: async (op) => {
      if (persistShouldFail) throw new Error("injected persist failure");
      writes.push(op);
    },
  };
  const item = suggestion({
    id: "persist-ok",
    kind: "availability",
    op: "create",
    content: "Pippa Gumdrop is away 2026-10-03",
    projectId: "proj-candy",
    personId: "person-gumdrop",
    personName: "Pippa Gumdrop",
    proposedValues: {
      awayFromIso: "2026-10-03T12:00:00.000Z",
      awayToIso: "2026-10-03T12:00:00.000Z",
    },
  });
  const decision = planCaptureApply({
    item,
    text: item.content,
    world: world(),
    captureEntryProjectId: "proj-candy",
  });
  const ok = await executeCaptureApply(decision, hooks);
  assert.equal(ok.kind, "wrote");
  assert.equal(writes.length, 1);

  persistShouldFail = true;
  const failed = await executeCaptureApply(decision, hooks);
  assert.equal(failed.kind, "failed");
  assert.match(failed.reason, /injected persist failure/);
});

await check("cross-domain: milestone finding does not write todos", async () => {
  const { writes } = await apply(
    suggestion({
      id: "xd-ms",
      kind: "milestone",
      op: "update",
      content: "Parade day",
      projectId: "proj-candy",
      targetEntityId: "ms-parade",
      date: "2026-11-01",
      proposedValues: { startAt: "2026-11-01T12:00:00.000Z" },
    }),
  );
  assert.equal(writes.filter((w) => w.type.includes("todo")).length, 0);
  assert.equal(writes.filter((w) => w.type.includes("milestone")).length, 1);
});

await check("cross-domain: Risk finding does not write todos", async () => {
  const { writes } = await apply(
    suggestion({
      id: "xd-risk",
      kind: "risk",
      op: "complete",
      content: "Gumdrop Bridge icing",
      projectId: "proj-candy",
      targetEntityId: "risk-bridge",
    }),
  );
  assert.equal(writes.filter((w) => w.type.includes("todo")).length, 0);
});

await check("cross-domain: availability does not write stakeholders or todos", async () => {
  const { writes } = await apply(
    suggestion({
      id: "xd-av",
      kind: "availability",
      op: "create",
      content: "Pippa Gumdrop is away 2026-10-03",
      projectId: "proj-candy",
      personId: "person-gumdrop",
      personName: "Pippa Gumdrop",
      proposedValues: {
        awayFromIso: "2026-10-03T12:00:00.000Z",
        awayToIso: "2026-10-03T12:00:00.000Z",
      },
    }),
  );
  assert.equal(writes.filter((w) => w.type === "ensure_person").length, 0);
  assert.equal(writes.filter((w) => w.type.includes("todo")).length, 0);
});

await check("entry project is used when finding omits project and there is no conflict", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "hint",
      kind: "action",
      op: "create",
      content: "Order extra sprinkles",
    }),
    { entry: "proj-candy" },
  );
  assert.equal(decision.kind, "write");
  if (writes[0]?.type === "create_todo") {
    assert.equal(writes[0].projectId, "proj-candy");
  }
});

await check("open project is not used when finding is unresolved", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "no-silent",
      kind: "risk",
      op: "complete",
      content: "Gumdrop Bridge icing",
      projectUncertain: true,
    }),
    { entry: "proj-candy" },
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("todo delete on another project is Needs you", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "del-b",
      kind: "action",
      op: "delete",
      content: "Console cert slip follow-up",
      projectId: "proj-candy",
      targetTodoId: "todo-pack",
    }),
    {
      world: world({
        todos: [
          {
            id: "todo-pack",
            projectId: "proj-game",
            title: "Prepare the jelly pack",
          },
        ],
      }),
    },
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("unknown todo operation cannot become a create", async () => {
  const item = suggestion({
    id: "bad-op",
    kind: "action",
    op: "create",
    content: "Invented chore",
    projectId: "proj-candy",
  });
  (item as { op: string }).op = "explode";
  const { decision, writes } = await apply(item);
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("foreign Person id cannot write availability on Project A", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "foreign-person",
      kind: "availability",
      op: "create",
      content: "Brick Oakley is away 2026-10-03",
      projectId: "proj-candy",
      personId: "person-brick",
      personName: "Brick Oakley",
      proposedValues: {
        awayFromIso: "2026-10-03T12:00:00.000Z",
        awayToIso: "2026-10-03T12:00:00.000Z",
      },
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("replacePersonId that is not the current owner cannot silently replace", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "bad-replace",
      kind: "stakeholder",
      op: "update",
      content: "Brick replaces a stranger as UAT lead",
      projectId: "proj-candy",
      legalDomain: "responsibility",
      ownershipSemantics: "replace",
      personName: "Brick Oakley",
      responsibilityScope: "UAT lead",
      replacePersonId: "person-nobody",
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("unknown Risk id cannot create a duplicate Risk", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "typo-risk",
      kind: "risk",
      op: "create",
      content: "Gumdrop Bridge icing",
      projectId: "proj-candy",
      targetEntityId: "risk-typo",
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("ambiguous ownership maps to clarification, not a Todo", () => {
  const finding: CaptureFinding = {
    id: "f-own",
    fact: "Ownership change needs confirmation",
    evidence: "share day-to-day",
    findingType: "AMBIGUOUS",
    target: {
      entityType: "stakeholder",
      entityId: "person-gumdrop",
      title: "Pippa Gumdrop",
    },
    changes: {
      ownershipSemantics: { proposed: "ambiguous" },
      personId: { proposed: "person-gumdrop" },
      scope: { proposed: "UAT lead" },
    },
    confidence: 62,
    requiresClarification: true,
    clarificationQuestion: "Should this share or replace the current owner?",
    reasoningSummary: "Ownership language is ambiguous.",
    projectId: "proj-candy",
  };
  const op = mapFindingToOperation(finding);
  assert.ok(op);
  assert.equal(op!.entityType, "stakeholder");
  assert.notEqual(op!.entityType, "todo");
  assert.equal(op!.requiresClarification, true);
  assert.equal(op!.proposedValues?.ownershipSemantics, "ambiguous");
});

await check("unassigned Todo cannot be deleted from Project A", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "del-unassigned",
      kind: "action",
      op: "delete",
      content: "Orphan chore",
      projectId: "proj-candy",
      targetTodoId: "todo-loose",
    }),
    {
      world: world({
        todos: [
          {
            id: "todo-loose",
            projectId: null,
            title: "Orphan chore",
          },
        ],
      }),
    },
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("unknown person/availability/knowledge ops cannot write", async () => {
  const cases: Array<{
    kind: "stakeholder" | "availability" | "knowledge";
    extra?: Partial<PendingSuggestion>;
  }> = [
    { kind: "stakeholder", extra: { personName: "Pippa Gumdrop" } },
    {
      kind: "availability",
      extra: {
        personId: "person-gumdrop",
        personName: "Pippa Gumdrop",
        proposedValues: {
          awayFromIso: "2026-10-03T12:00:00.000Z",
          awayToIso: "2026-10-03T12:00:00.000Z",
        },
      },
    },
    { kind: "knowledge" },
  ];
  for (const row of cases) {
    const item = suggestion({
      id: `bad-${row.kind}`,
      kind: row.kind,
      op: "create",
      content: "Remember the carnival seating plan",
      projectId: "proj-candy",
      ...row.extra,
    });
    (item as { op: string }).op = "explode";
    const { decision, writes } = await apply(item);
    assert.equal(decision.kind, "needs_you", row.kind);
    assert.equal(writes.length, 0, row.kind);
  }
});

await check("typoed Risk id does not title-fallback onto another Risk", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "typo-title-fallback",
      kind: "risk",
      op: "complete",
      content: "Gumdrop Bridge icing",
      projectId: "proj-candy",
      targetEntityId: "risk-typo",
    }),
    {
      world: world({
        risks: [
          {
            id: "risk-bridge",
            projectId: "proj-candy",
            title: "Gumdrop Bridge icing",
            status: "open",
          },
          {
            id: "risk-icing-alias",
            projectId: "proj-candy",
            title: "Icing on the parade route",
            status: "open",
          },
        ],
      }),
    },
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("foreign Person id cannot change Project A ownership", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "foreign-owner",
      kind: "stakeholder",
      op: "update",
      content: "Brick Oakley replaces Pippa as UAT lead",
      projectId: "proj-candy",
      legalDomain: "responsibility",
      ownershipSemantics: "replace",
      personName: "Brick Oakley",
      personId: "person-brick",
      responsibilityScope: "UAT lead",
      replacePersonId: "person-gumdrop",
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("NEW_INFORMATION with unknown Risk id is invalid, not CREATE", () => {
  const index = new Map<string, IndexedContextRecord>();
  index.set("risk-bridge", {
    entityType: "risk",
    id: "risk-bridge",
    title: "Gumdrop Bridge icing",
    rawType: "risk",
    status: "open",
  });
  const report = validateCaptureFindings(
    [
      {
        fact: "Raise a new risk about gumdrop icing",
        evidence: "The existing icing risk is still open.",
        findingType: "NEW_INFORMATION",
        target: {
          entityType: "risk",
          entityId: "risk-not-in-context",
          title: "Gumdrop Bridge icing",
        },
        changes: {
          entityType: { proposed: "risk" },
          title: { proposed: "Gumdrop Bridge icing" },
        },
        confidence: 90,
        requiresClarification: false,
        reasoningSummary: "AI invented an id and asked to create",
      },
    ],
    index,
  );
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0]?.findingType, "AMBIGUOUS");
  assert.equal(report.findings[0]?.invalidTarget, true);
  assert.equal(report.invalidTargetCount, 1);
  assert.equal(report.findings[0]?.target, undefined);
  const op = mapFindingToOperation(report.findings[0]!);
  assert.equal(op, null);
});

await check("overlapping title tokens do not auto-update an unrelated Todo", () => {
  const index = new Map<string, IndexedContextRecord>();
  index.set("todo-pack", {
    entityType: "todo",
    id: "todo-pack",
    title: "Prepare the jelly pack",
    rawType: "todo",
    status: "open",
  });
  index.set("todo-cab", {
    entityType: "todo",
    id: "todo-cab",
    title: "Finalise CAB pack artefacts",
    rawType: "todo",
    status: "open",
  });
  const findings = extractLocalFindings(
    "Move the carnival pack deadline and mention cab seating.",
    index,
  );
  assert.equal(
    findings.some(
      (f) =>
        f.target?.entityId === "todo-pack" &&
        (f.findingType === "ENTITY_UPDATED" || f.findingType === "ENTITY_COMPLETED"),
    ),
    false,
  );
  assert.equal(
    findings.some(
      (f) =>
        f.target?.entityId === "todo-cab" &&
        (f.findingType === "ENTITY_UPDATED" || f.findingType === "ENTITY_COMPLETED"),
    ),
    false,
  );
});

await check("completion cue without exact title does not complete an unrelated To Do", () => {
  const index = new Map<string, IndexedContextRecord>();
  index.set("todo-pack", {
    entityType: "todo",
    id: "todo-pack",
    title: "Prepare the jelly pack",
    rawType: "todo",
    status: "open",
  });
  const findings = extractLocalFindings("The carnival pack is done.", index);
  assert.equal(
    findings.some(
      (f) =>
        f.target?.entityId === "todo-pack" && f.findingType === "ENTITY_COMPLETED",
    ),
    false,
  );
});

await check("exact title plus an unrelated completion cue elsewhere does not complete", () => {
  const index = new Map<string, IndexedContextRecord>();
  index.set("todo-pack", {
    entityType: "todo",
    id: "todo-pack",
    title: "Prepare the jelly pack",
    rawType: "todo",
    status: "open",
  });
  const findings = extractLocalFindings(
    "Prepare the jelly pack remains outstanding. The venue booking is done.",
    index,
  );
  assert.equal(
    findings.some(
      (f) =>
        f.target?.entityId === "todo-pack" && f.findingType === "ENTITY_COMPLETED",
    ),
    false,
  );
});

await check("exact title and completion cue in the same sentence still completes", () => {
  const index = new Map<string, IndexedContextRecord>();
  index.set("todo-pack", {
    entityType: "todo",
    id: "todo-pack",
    title: "Prepare the jelly pack",
    rawType: "todo",
    status: "open",
  });
  const findings = extractLocalFindings("Prepare the jelly pack is done.", index);
  assert.equal(
    findings.some(
      (f) =>
        f.target?.entityId === "todo-pack" && f.findingType === "ENTITY_COMPLETED",
    ),
    true,
  );
});

await check("Risk title plus unrelated resolution cue elsewhere does not resolve", () => {
  const index = new Map<string, IndexedContextRecord>();
  index.set("risk-bridge", {
    entityType: "risk",
    id: "risk-bridge",
    title: "Gumdrop Bridge icing",
    rawType: "risk",
    status: "open",
  });
  const findings = extractLocalFindings(
    "Gumdrop Bridge icing remains open. The other issue was resolved.",
    index,
  );
  assert.equal(
    findings.some(
      (f) =>
        f.target?.entityId === "risk-bridge" &&
        f.findingType === "ENTITY_COMPLETED",
    ),
    false,
  );
});

await check("Risk kind cannot be retargeted to Todo via legalDomain sticker", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "sticker",
      kind: "risk",
      op: "create",
      content: "Gumdrop Bridge icing",
      projectId: "proj-candy",
      legalDomain: "todo",
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
  assert.equal(
    classifyCaptureLegalDomain(
      suggestion({
        id: "sticker2",
        kind: "risk",
        op: "create",
        content: "x",
        legalDomain: "todo",
      }),
    ),
    "unsupported",
  );
});

await check("Risk complete without durable id cannot title-fallback", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "risk-no-id",
      kind: "risk",
      op: "complete",
      content: "Gumdrop Bridge icing",
      projectId: "proj-candy",
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("foreign targetEntityId cannot change Project A ownership", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "foreign-target",
      kind: "stakeholder",
      op: "update",
      content: "Brick Oakley replaces Pippa as UAT lead",
      projectId: "proj-candy",
      legalDomain: "responsibility",
      ownershipSemantics: "replace",
      personName: "Brick Oakley",
      targetEntityId: "person-brick",
      responsibilityScope: "UAT lead",
      replacePersonId: "person-gumdrop",
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("unknown ownership semantics cannot silently write", async () => {
  const item = suggestion({
    id: "bad-sem",
    kind: "stakeholder",
    op: "update",
    content: "Fizz Caramel takes UAT lead",
    projectId: "proj-candy",
    legalDomain: "responsibility",
    personName: "Fizz Caramel",
    responsibilityScope: "UAT lead",
  });
  (item as { ownershipSemantics: string }).ownershipSemantics = "explode";
  const { decision, writes } = await apply(item);
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("unknown ownership semantics through the production pipeline cannot write a Person", async () => {
  const result: CaptureResult = {
    memory: {
      id: "mem-transfer",
      type: "voice_note",
      title: "Capture",
      content: "Fizz Caramel takes UAT lead",
      tags: [],
      occurredAt: "2026-08-25T00:00:00.000Z",
      createdAt: "2026-08-25T00:00:00.000Z",
      source: "capture",
      projectId: "proj-candy",
    },
    insights: [],
    assumptions: [],
    recommendations: [],
    proposedOperations: [
      {
        id: "op-transfer",
        sourceFindingId: "f-transfer",
        operation: "CREATE",
        entityType: "stakeholder",
        targetTitle: "Fizz Caramel",
        projectId: "proj-candy",
        proposedValues: {
          ownershipSemantics: "transfer",
          personName: "Fizz Caramel",
        },
        reason: "Ownership transfer mentioned",
        evidence: "Fizz Caramel takes UAT lead",
        confidence: 80,
        destructive: false,
        requiresClarification: false,
      },
    ],
  };
  const suggestions = buildSuggestions(result, []);
  assert.equal(suggestions.length, 1);
  const item = suggestions[0]!;
  assert.equal(item.legalDomain, "unsupported");
  assert.equal(classifyCaptureLegalDomain(item), "unsupported");
  const { decision, writes } = await apply(item);
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
  assert.ok(writes.every((w) => w.type !== "ensure_person"));
});

await check("CREATE with an existing on-project To Do id does not duplicate", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "dup-todo",
      kind: "action",
      op: "create",
      content: "Prepare the jelly pack",
      projectId: "proj-candy",
      targetTodoId: "todo-pack",
    }),
  );
  assert.equal(decision.kind, "no_change");
  assert.equal(writes.length, 0);
});

await check("CREATE with an existing on-project milestone id does not duplicate", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "dup-ms",
      kind: "milestone",
      op: "create",
      content: "Parade day",
      projectId: "proj-candy",
      targetEntityId: "ms-parade",
    }),
  );
  assert.equal(decision.kind, "no_change");
  assert.equal(writes.length, 0);
});

await check("Risk CREATE without id does not duplicate an exact existing title", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "dup-risk",
      kind: "risk",
      op: "create",
      content: "Gumdrop Bridge icing",
      projectId: "proj-candy",
    }),
  );
  assert.equal(decision.kind, "no_change");
  assert.equal(writes.length, 0);
});

await check("typed Risk with availability fields cannot write Away", async () => {
  const { item, decision, writes } = await applyProposed({
    id: "op-risk-away",
    sourceFindingId: "f-risk-away",
    operation: "CREATE",
    entityType: "risk",
    targetTitle: "Gumdrop Bridge icing",
    projectId: "proj-candy",
    proposedValues: {
      kind: "availability",
      awayFromIso: "2026-10-03T12:00:00.000Z",
      awayToIso: "2026-10-03T12:00:00.000Z",
      personName: "Pippa Gumdrop",
      personId: "person-gumdrop",
    },
    reason: "Risk mentioned with an away date",
    evidence: "Gumdrop Bridge icing; Pippa is away 3 October",
    confidence: 80,
    destructive: false,
    requiresClarification: false,
  });
  assert.equal(item.kind, "risk");
  assert.equal(item.legalDomain, "unsupported");
  assert.equal(classifyCaptureLegalDomain(item), "unsupported");
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
  assert.ok(writes.every((w) => w.type !== "write_availability"));
});

await check("unknown stakeholder operation cannot coerce into Confirm Owner", async () => {
  const { item, decision, writes } = await applyProposed({
    id: "op-explode",
    sourceFindingId: "f-explode",
    operation: "EXPLODE" as unknown as "CREATE",
    entityType: "stakeholder",
    targetTitle: "Fizz Caramel",
    projectId: "proj-candy",
    proposedValues: {
      ownershipSemantics: "replace",
      personName: "Fizz Caramel",
      scope: "UAT lead",
    },
    reason: "Malformed ownership operation",
    evidence: "Fizz Caramel takes UAT lead",
    confidence: 80,
    destructive: false,
    requiresClarification: false,
  });
  assert.equal(item.legalDomain, "unsupported");
  assert.equal(classifyCaptureLegalDomain(item), "unsupported");
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
  assert.ok(writes.every((w) => w.type !== "confirm_responsibility"));
  assert.ok(writes.every((w) => w.type !== "ensure_person"));
});

await check("Person availability through the production pipeline still writes Away", async () => {
  const { decision, writes } = await applyProposed({
    id: "op-away",
    sourceFindingId: "f-away",
    operation: "CREATE",
    entityType: "stakeholder",
    targetTitle: "Pippa Gumdrop",
    targetId: "person-gumdrop",
    projectId: "proj-candy",
    proposedValues: {
      kind: "availability",
      awayFromIso: "2026-10-03T12:00:00.000Z",
      awayToIso: "2026-10-03T12:00:00.000Z",
      personName: "Pippa Gumdrop",
      personId: "person-gumdrop",
    },
    reason: "Pippa is away",
    evidence: "Pippa Gumdrop is away 2026-10-03",
    confidence: 84,
    destructive: false,
    requiresClarification: false,
  });
  assert.equal(decision.kind, "write");
  assert.equal(writes[0]?.type, "write_availability");
});

await check("Person UUID alone does not establish identity on incomplete evidence", async () => {
  const { decision, writes } = await apply(
    suggestion({
      id: "uuid-not-identity",
      kind: "availability",
      op: "create",
      content: "Pippa from the gate crew is away next week",
      projectId: "proj-candy",
      personId: "person-gumdrop",
      personName: "Pippa Gumdrop",
      proposedValues: {
        awayFromIso: "2026-10-03T12:00:00.000Z",
        awayToIso: "2026-10-03T12:00:00.000Z",
      },
    }),
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

await check("wrong Person UUID cannot write when another recorded name is evidenced", async () => {
  const shared = world({
    projects: [
      {
        id: "proj-candy",
        name: "Candyland",
        stakeholders: [
          { id: "person-gumdrop", name: "Pippa Gumdrop", role: "UAT lead" },
          { id: "person-fizz", name: "Fizz Caramel", role: "Designer" },
        ],
      },
    ],
  });
  const { decision, writes } = await apply(
    suggestion({
      id: "wrong-uuid",
      kind: "availability",
      op: "create",
      content: "Pippa Gumdrop is away 2026-10-03",
      projectId: "proj-candy",
      personId: "person-fizz",
      personName: "Fizz Caramel",
      proposedValues: {
        awayFromIso: "2026-10-03T12:00:00.000Z",
        awayToIso: "2026-10-03T12:00:00.000Z",
      },
    }),
    { world: shared },
  );
  assert.equal(decision.kind, "needs_you");
  assert.equal(writes.length, 0);
});

console.log(`\nverify-phase3b-capture-boundary: ${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
