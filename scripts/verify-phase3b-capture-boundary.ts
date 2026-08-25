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
import { mapFindingToOperation } from "../src/lib/capture/findings/map";
import type { CaptureFinding } from "../src/lib/capture/findings";

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

console.log(`\nverify-phase3b-capture-boundary: ${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
