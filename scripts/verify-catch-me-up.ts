/**
 * Catch Me Up v0.9 — contract and safety verification.
 * Deterministic. No live OpenAI. Does not test model prose.
 *
 * Run: npm run verify:catch-me-up
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  CATCH_ME_UP_INFERRED_RULE,
  CATCH_ME_UP_KNOWN_RULE,
  CATCH_ME_UP_SYSTEM,
  CATCH_ME_UP_TRUTH_QUESTION,
} from "../src/lib/catch-me-up/prompt";
import {
  CatchMeUpRequestError,
  readCatchMeUpRequest,
} from "../src/lib/catch-me-up/request";
import { scopeMissionStateToProject } from "../src/lib/catch-me-up/scope";
import {
  buildCatchMeUpTruthView,
  isCatchMeUpProjectThin,
} from "../src/lib/catch-me-up/truth";
import { loadAuthoritativeProjectTruth } from "../src/lib/catch-me-up/load-truth";
import { generateCatchMeUpBriefing } from "../src/lib/catch-me-up/briefing";
import { parseCatchMeUpModelJson } from "../src/lib/catch-me-up/parse";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import { PINNED_OPENAI_CHAT_MODEL } from "../src/lib/openai-model";
import { CATCH_ME_UP_INTEGRATION } from "../src/components/catch-me-up/iron-man-contract";
import type { MissionState, Project } from "../src/lib/types";
import type { CanonicalTruthItem } from "../src/lib/canonical-truth/types";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");
const ATLAS = "11111111-1111-4111-8111-111111111111";
const HORIZON = "22222222-2222-4222-8222-222222222222";
const HORIZON_SECRET = "HORIZON-ONLY-SECRET-FACT";
const UAT_ID = "ms-uat-atlas";
const DEP_ID = "dep-docuflow";
const SARAH_AWAY_ID = "avail-sarah";
const OLD_RISK_ID = "risk-vendor-sla";
const TODO_PACK_ID = "todo-cab-pack";
const TODO_ROLLBACK_ID = "todo-rollback";
const TODO_EVIDENCE_ID = "todo-evidence";
const PERSON_SARAH = "person-sarah";
const RESP_UNCONFIRMED = "resp-readiness";

let passed = 0;

function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      passed += 1;
      console.log(`✓ ${name}`);
    } catch (err) {
      console.error(`✗ ${name}`);
      throw err;
    }
  })();
}

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
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

function structuredItem(
  partial: Pick<CanonicalTruthItem, "id" | "projectId" | "body" | "kind"> &
    Partial<CanonicalTruthItem>,
): CanonicalTruthItem {
  return {
    epistemic: "confirmed",
    lifecycle: "current",
    meta: null,
    provenance: [],
    ...partial,
  };
}

function atlasHorizonState(): MissionState {
  const knowledge = emptyKnowledge(ATLAS);
  knowledge.sections.now = [
    "CAB pack due Friday",
    "UAT scheduled for 14 September",
  ];
  knowledge.sections.decisions = [
    "CAB requires evidence 48 hours before the board.",
  ];
  knowledge.structured = [
    structuredItem({
      id: DEP_ID,
      projectId: ATLAS,
      body: "UAT depends on DocuFlow staging being ready",
      kind: "dependency",
      section: "now",
    }),
    structuredItem({
      id: SARAH_AWAY_ID,
      projectId: ATLAS,
      body: "Sarah Chen away 12–20 September",
      kind: "availability",
      meta: {
        availability: {
          personId: PERSON_SARAH,
          personName: "Sarah Chen",
          awayFromIso: "2026-09-12",
          awayToIso: "2026-09-20",
        },
      },
    }),
    structuredItem({
      id: RESP_UNCONFIRMED,
      projectId: ATLAS,
      body: "Release readiness owner not confirmed",
      kind: "responsibility",
      epistemic: "pending",
      meta: {
        responsibility: {
          scope: "release readiness",
          ownerConfirmed: false,
        },
      },
    }),
  ];

  const horizonKnowledge = emptyKnowledge(HORIZON);
  horizonKnowledge.sections.now = [HORIZON_SECRET];

  return {
    ...emptyState(),
    projects: [
      baseProject({
        id: ATLAS,
        name: "Atlas Modernisation",
        code: "ATLAS",
        currentFocus: "CAB pack and UAT readiness",
        summary: "Replace the core platform before winter peak.",
        stakeholders: [
          { id: PERSON_SARAH, name: "Sarah Chen", role: "Business owner" },
          { id: "person-nina", name: "Nina Patel", role: "Tech lead" },
        ],
      }),
      baseProject({
        id: HORIZON,
        name: "Horizon Customer Portal",
        code: "HORIZON",
        currentFocus: "Security sign-off",
        stakeholders: [{ id: "person-lex", name: "Lex", role: "Sponsor" }],
      }),
    ],
    knowledge: [knowledge, horizonKnowledge],
    risks: [
      {
        id: OLD_RISK_ID,
        projectId: ATLAS,
        title: "Vendor SLA still unsigned",
        status: "open",
        source: "manual",
      },
      {
        id: "risk-horizon-only",
        projectId: HORIZON,
        title: "Horizon secret risk",
        status: "open",
        source: "manual",
      },
    ],
    todos: [
      {
        id: TODO_PACK_ID,
        projectId: ATLAS,
        title: "Finish CAB pack",
        done: false,
        createdAt: "2026-08-01T00:00:00.000Z",
        kind: "ACTION",
      },
      {
        id: TODO_ROLLBACK_ID,
        projectId: ATLAS,
        title: "Confirm rollback owner",
        done: false,
        createdAt: "2026-08-01T00:00:00.000Z",
        kind: "ACTION",
      },
      {
        id: TODO_EVIDENCE_ID,
        projectId: ATLAS,
        title: "Attach security evidence",
        done: false,
        createdAt: "2026-08-01T00:00:00.000Z",
        kind: "ACTION",
      },
      {
        id: "todo-horizon-secret",
        projectId: HORIZON,
        title: "Horizon-only todo that must not leak",
        done: false,
        createdAt: "2026-08-01T00:00:00.000Z",
        kind: "ACTION",
      },
    ],
    timeline: [
      {
        id: UAT_ID,
        projectId: ATLAS,
        label: "UAT window",
        type: "milestone",
        startAt: "2026-09-14T12:00:00.000Z",
        source: "manual",
      },
      {
        id: "ms-horizon",
        projectId: HORIZON,
        label: "Horizon go-live",
        type: "deadline",
        startAt: "2026-10-01T12:00:00.000Z",
        source: "manual",
      },
    ],
  };
}

function asClient(fake: FakeWorkspaceClient) {
  return fake as unknown as Parameters<typeof loadMissionStateFromSupabase>[0];
}

function seedWorkspace(fake: FakeWorkspaceClient) {
  const ws = fake.workspaceId;
  fake.seedProject({
    id: ATLAS,
    workspace_id: ws,
    name: "Atlas Modernisation",
    code: "ATLAS",
    summary: "Replace the core platform",
    status: "healthy",
    current_focus: "CAB pack and UAT readiness",
  });
  fake.seedProject({
    id: HORIZON,
    workspace_id: ws,
    name: "Horizon Customer Portal",
    code: "HORIZON",
    summary: "Portal rebuild",
    status: "watch",
    current_focus: "Security sign-off",
  });
  fake.tables.stakeholders.push(
    {
      id: PERSON_SARAH,
      workspace_id: ws,
      project_id: ATLAS,
      name: "Sarah Chen",
      role: "Business owner",
    },
    {
      id: "person-lex",
      workspace_id: ws,
      project_id: HORIZON,
      name: "Lex",
      role: "Sponsor",
    },
  );
  fake.tables.todos.push(
    {
      id: TODO_PACK_ID,
      workspace_id: ws,
      project_id: ATLAS,
      title: "Finish CAB pack",
      done: false,
      created_at: "2026-08-01T00:00:00.000Z",
      kind: "ACTION",
    },
    {
      id: "todo-horizon-secret",
      workspace_id: ws,
      project_id: HORIZON,
      title: "Horizon-only todo that must not leak",
      done: false,
      created_at: "2026-08-01T00:00:00.000Z",
      kind: "ACTION",
    },
  );
  fake.tables.risks.push({
    id: OLD_RISK_ID,
    workspace_id: ws,
    project_id: ATLAS,
    title: "Vendor SLA still unsigned",
    status: "open",
    source: "manual",
  });
  fake.tables.knowledge_items.push(
    {
      id: "know-atlas-now",
      workspace_id: ws,
      project_id: ATLAS,
      section: "now",
      body: "UAT scheduled for 14 September",
      position: 0,
      kind: "fact",
      lifecycle: "current",
    },
    {
      id: "know-horizon-secret",
      workspace_id: ws,
      project_id: HORIZON,
      section: "now",
      body: HORIZON_SECRET,
      position: 0,
      kind: "fact",
      lifecycle: "current",
    },
  );
  fake.tables.milestones.push({
    id: UAT_ID,
    workspace_id: ws,
    project_id: ATLAS,
    label: "UAT window",
    type: "milestone",
    start_on: "2026-09-14",
    source: "manual",
    created_at: "2026-08-01T00:00:00.000Z",
  });
}

async function main() {
  await check("route requires requireAiCaller catch-me-up", () => {
    const route = readSrc("src/app/api/catch-me-up/route.ts");
    assert.match(route, /requireAiCaller\("catch-me-up"\)/);
    assert.match(route, /runtime = "nodejs"/);
  });

  await check("route loads server truth and ignores posted MissionState", () => {
    const route = readSrc("src/app/api/catch-me-up/route.ts");
    assert.match(route, /loadMissionStateFromSupabase/);
    assert.match(route, /loadAuthoritativeProjectTruth/);
    assert.match(route, /readCatchMeUpRequest/);
    assert.doesNotMatch(route, /generateCatchMeUpBriefing\(\{[\s\S]*body\.state/);
    assert.match(route, /Client-posted MissionState is ignored/);
  });

  await check("readCatchMeUpRequest keeps only projectId", () => {
    const parsed = readCatchMeUpRequest({
      projectId: `  ${ATLAS}  `,
      state: atlasHorizonState(),
      snapshot: { summary: "forged" },
    });
    assert.equal(parsed.projectId, ATLAS);
    assert.equal("state" in parsed, false);
    try {
      readCatchMeUpRequest({});
      assert.fail("expected missing projectId to throw");
    } catch (err) {
      assert.equal(err instanceof CatchMeUpRequestError, true);
      assert.equal((err as CatchMeUpRequestError).status, 400);
    }
  });

  await check("server loader scopes to the requested project", async () => {
    const fake = new FakeWorkspaceClient();
    seedWorkspace(fake);
    const loaded = await loadAuthoritativeProjectTruth({
      projectId: ATLAS,
      loadWorkspace: () => loadMissionStateFromSupabase(asClient(fake)),
    });
    assert.deepEqual(
      loaded.state.projects.map((p) => p.id),
      [ATLAS],
    );
    assert.equal(
      loaded.state.todos.some((t) => t.projectId === HORIZON),
      false,
    );
    assert.equal(
      loaded.state.knowledge.some((k) =>
        k.sections.now.includes(HORIZON_SECRET),
      ),
      false,
    );
  });

  await check("unknown project in workspace is not found", async () => {
    const fake = new FakeWorkspaceClient();
    seedWorkspace(fake);
    try {
      await loadAuthoritativeProjectTruth({
        projectId: "00000000-0000-4000-8000-000000000000",
        loadWorkspace: () => loadMissionStateFromSupabase(asClient(fake)),
      });
      assert.fail("expected project_not_found");
    } catch (err) {
      assert.equal(err instanceof CatchMeUpRequestError, true);
      assert.equal((err as CatchMeUpRequestError).code, "project_not_found");
      assert.equal((err as CatchMeUpRequestError).status, 404);
    }
  });

  await check("cross-project facts do not enter the briefing prompt", () => {
    const view = buildCatchMeUpTruthView({
      state: atlasHorizonState(),
      projectId: ATLAS,
    });
    assert.doesNotMatch(view.promptBlock, new RegExp(HORIZON_SECRET));
    assert.doesNotMatch(view.promptBlock, /Horizon-only todo/);
    assert.doesNotMatch(view.promptBlock, /Horizon secret risk/);
    assert.match(view.promptBlock, /ATLAS/);
    assert.match(view.promptBlock, /Vendor SLA still unsigned/);
    assert.match(view.promptBlock, /DocuFlow staging/);
    assert.equal(view.includedHistoryEvidence, false);
    assert.equal(view.thinProject, false);
  });

  await check("scopeMissionStateToProject drops the other project", () => {
    const scoped = scopeMissionStateToProject(atlasHorizonState(), ATLAS);
    assert.equal(scoped.projects.length, 1);
    assert.equal(scoped.projects[0]?.id, ATLAS);
    assert.equal(scoped.todos.every((t) => t.projectId === ATLAS), true);
    assert.equal(scoped.timeline.every((t) => t.projectId === ATLAS), true);
  });

  await check("thin / empty projects are handled without calling the model", async () => {
    const state = emptyState();
    state.projects = [
      baseProject({
        id: ATLAS,
        name: "Blank Harbour",
        code: "HARBOUR",
      }),
    ];
    assert.equal(isCatchMeUpProjectThin(state, ATLAS), true);
    let called = false;
    const briefing = await generateCatchMeUpBriefing({
      state,
      projectId: ATLAS,
      completeChat: async () => {
        called = true;
        return { content: "{}" };
      },
    });
    assert.equal(called, false);
    assert.equal(briefing.thinProject, true);
    assert.equal(briefing.provider, "none");
    assert.equal(briefing.whereWeAre?.epistemic, "known");
    assert.match(briefing.whereWeAre?.prose ?? "", /doesn’t know much|doesn't know much/i);
    assert.equal(briefing.connections.length, 0);
    assert.doesNotMatch(briefing.whereWeAre?.prose ?? "", /DocuFlow|UAT window/);
  });

  await check("structured output distinguishes known from inferred", async () => {
    const state = atlasHorizonState();
    const view = buildCatchMeUpTruthView({ state, projectId: ATLAS });
    const briefing = await generateCatchMeUpBriefing({
      state,
      projectId: ATLAS,
      completeChat: async ({ user, system }) => {
        assert.match(system, /READ-ONLY/);
        assert.match(system, new RegExp(CATCH_ME_UP_KNOWN_RULE));
        assert.match(system, new RegExp(CATCH_ME_UP_INFERRED_RULE));
        assert.doesNotMatch(user, new RegExp(HORIZON_SECRET));
        return {
          content: JSON.stringify({
            whereWeAre: {
              prose: "Atlas is in CAB / UAT prep.",
              factIds: [`ms-${UAT_ID}`],
              epistemic: "inferred",
            },
            needsAttention: [
              {
                epistemic: "known",
                prose: "Vendor SLA is still open.",
                factIds: [`risk-${OLD_RISK_ID}`],
              },
            ],
            mightHaveMissed: [
              {
                epistemic: "inferred",
                prose: "The unsigned vendor SLA is easy to lose during CAB prep.",
                factIds: [`risk-${OLD_RISK_ID}`],
              },
            ],
            connections: [
              {
                epistemic: "known",
                prose:
                  "UAT appears dependent on DocuFlow staging being ready.",
                factIds: [DEP_ID, `ms-${UAT_ID}`],
              },
              {
                prose: "Invented link with no facts.",
                factIds: [],
              },
              {
                prose: "Horizon leak attempt",
                factIds: ["know-horizon-secret"],
              },
            ],
          }),
        };
      },
    });
    assert.equal(briefing.whereWeAre?.epistemic, "known");
    assert.equal(briefing.needsAttention.some((i) => i.epistemic === "known"), true);
    assert.equal(
      briefing.mightHaveMissed.every((i) => i.epistemic === "inferred") ||
        briefing.mightHaveMissed.length > 0,
      true,
    );
    assert.ok(briefing.connections.length >= 1);
    assert.equal(
      briefing.connections.every((i) => i.epistemic === "inferred"),
      true,
    );
    assert.equal(
      briefing.connections.some((i) => /Invented link/i.test(i.prose)),
      false,
    );
    assert.equal(
      briefing.connections.some((i) => /Horizon leak/i.test(i.prose)),
      false,
    );
    assert.match(
      briefing.connections[0]?.prose ?? "",
      /DocuFlow staging/,
    );
    assert.ok((briefing.connections[0]?.factIds.length ?? 0) >= 1);
    const storedNeedsYou = briefing.needsAttention.some((i) =>
      /readiness|not confirmed/i.test(i.prose),
    );
    assert.equal(storedNeedsYou, true);
    assert.ok(view.facts.some((f) => f.id === DEP_ID));
  });

  await check("ungrounded inference is dropped; known facts keep ids in catalogue", () => {
    const parsed = parseCatchMeUpModelJson({
      raw: {
        whereWeAre: { prose: "We are in UAT prep." },
        connections: [
          { prose: "Guess with fake id", factIds: ["not-a-real-id"] },
          { prose: "Grounded notice", factIds: [DEP_ID] },
        ],
      },
      factIds: new Set([DEP_ID]),
      needsConfirmationHints: [],
      fallbackWhereWeAre: "Atlas.",
    });
    assert.equal(parsed.whereWeAre?.epistemic, "known");
    assert.equal(parsed.connections.length, 1);
    assert.equal(parsed.connections[0]?.epistemic, "inferred");
    assert.deepEqual(parsed.connections[0]?.factIds, [DEP_ID]);
  });

  await check("provider failure does not return template project content", async () => {
    await assert.rejects(
      () =>
        generateCatchMeUpBriefing({
          state: atlasHorizonState(),
          projectId: ATLAS,
          completeChat: async () => {
            throw new Error("provider 500 org-secret");
          },
        }),
      /provider 500/,
    );
    await assert.rejects(
      () =>
        generateCatchMeUpBriefing({
          state: atlasHorizonState(),
          projectId: ATLAS,
          completeChat: async () => ({ content: "not-json" }),
        }),
      /malformed/,
    );
  });

  await check("Catch Me Up performs no writes", () => {
    const files = [
      ...walkFiles(join(ROOT, "src/lib/catch-me-up")),
      ...walkFiles(join(ROOT, "src/components/catch-me-up")),
      join(ROOT, "src/app/api/catch-me-up/route.ts"),
    ];
    const joined = files.map((f) => readFileSync(f, "utf8")).join("\n");
    assert.doesNotMatch(joined, /persist-mutations/);
    assert.doesNotMatch(joined, /persistTodoCreate|persistRiskStatus|persistEnsureStakeholder/);
    assert.doesNotMatch(joined, /persistTimelineItem|persistKnowledgeBullet/);
    assert.doesNotMatch(joined, /from\("todos"\)\.insert|from\("risks"\)\.insert/);
    assert.doesNotMatch(joined, /setState\(/);
    const route = readSrc("src/app/api/catch-me-up/route.ts");
    assert.doesNotMatch(route, /\.insert\(/);
    assert.doesNotMatch(route, /\.update\(/);
    assert.doesNotMatch(route, /\.upsert\(/);
    assert.doesNotMatch(route, /\.delete\(/);
  });

  await check("route fails visibly and does not persist briefing output", () => {
    const route = readSrc("src/app/api/catch-me-up/route.ts");
    assert.match(route, /publicAiFailureMessage/);
    assert.match(route, /Catch Me Up could not brief this project/);
    assert.doesNotMatch(route, /localStorage/);
    assert.doesNotMatch(route, /project_intelligence_snapshots/);
    const surface = readSrc("src/components/catch-me-up/CatchMeUpSurface.tsx");
    assert.match(surface, /Try again/);
    assert.match(surface, /setBriefing\(null\)/);
    assert.match(surface, /JSON\.stringify\(\{ projectId \}\)/);
    assert.doesNotMatch(surface, /state:/);
    assert.doesNotMatch(surface, /localStorage/);
  });

  await check("UI distinguishes known vs inferred and omits empty sections", () => {
    const view = readSrc("src/components/catch-me-up/CatchMeUpBriefingView.tsx");
    assert.match(view, /data-epistemic/);
    assert.match(view, /I noticed/);
    assert.match(view, /From the project/);
    assert.match(view, /What Lume knows/);
    assert.match(view, /What Lume notices/);
    assert.match(view, /Supporting facts/);
    assert.match(view, /if \(!items\.length\) return null/);
    assert.doesNotMatch(view, /chat history|conversation/);
    const surface = readSrc("src/components/catch-me-up/CatchMeUpSurface.tsx");
    assert.match(surface, /Refresh briefing/);
    assert.match(surface, /data-ai="true"/);
    assert.doesNotMatch(surface, /Ask Lume anything/);
  });

  await check("Iron Man integration contract is explicit and shell is the one seam", () => {
    assert.equal(CATCH_ME_UP_INTEGRATION.modeId, "catch-me-up");
    assert.equal(CATCH_ME_UP_INTEGRATION.apiPath, "/api/catch-me-up");
    assert.match(CATCH_ME_UP_INTEGRATION.mountExample, /CatchMeUpSurface/);
    const mode = readSrc("src/components/knowledge-centre/ProjectModeSelector.tsx");
    assert.match(mode, /catch-me-up/);
    assert.match(mode, /Catch Me Up/);
    const workspace = readSrc(
      "src/components/knowledge-centre/OceanProjectWorkspace.tsx",
    );
    assert.match(workspace, /CatchMeUpPanel/);
    assert.doesNotMatch(workspace, /CatchMeUpSurface/);
    const panel = readSrc("src/components/catch-me-up/CatchMeUpPanel.tsx");
    assert.match(panel, /<CatchMeUpSurface projectId=\{projectId\} \/>/);
    assert.doesNotMatch(panel, /MissionState/);
    const sidebar = readSrc("src/components/app-shell/Sidebar.tsx");
    assert.doesNotMatch(sidebar, /Catch Me Up/);
    const strip = readSrc(
      "src/components/knowledge-centre/ProjectIntelligenceStrip.tsx",
    );
    assert.doesNotMatch(strip, /CatchMeUpSurface|\/api\/catch-me-up/);
  });

  await check("Tell Me / Ask server-truth behaviour remains unaffected", () => {
    const tellMe = readSrc("src/app/api/tell-me/route.ts");
    assert.match(tellMe, /body\.state/);
    assert.match(tellMe, /answerTellMeQuestion/);
    assert.match(tellMe, /requireAiCaller\("tell-me"\)/);
    const serialize = readSrc("src/lib/canonical-truth/serialize.ts");
    assert.match(serialize, /export function serializeCanonicalTruth/);
    const askBar = readSrc(
      "src/components/knowledge-centre/KnowledgeSearchAskBar.tsx",
    );
    assert.match(askBar, /Ask Lume/);
    assert.match(
      CATCH_ME_UP_TRUTH_QUESTION,
      /current project position/,
    );
    assert.match(CATCH_ME_UP_SYSTEM, /Never create, update/);
  });

  await check("central model pin is reused; no separate provider", () => {
    const briefing = readSrc("src/lib/catch-me-up/briefing.ts");
    assert.match(briefing, /resolveOpenAIChatModel/);
    assert.match(briefing, /withOpenAiChatPrivacy/);
    assert.match(briefing, /api\.openai\.com\/v1\/chat\/completions/);
    assert.equal(PINNED_OPENAI_CHAT_MODEL, "gpt-4o-mini-2024-07-18");
    assert.doesNotMatch(briefing, /anthropic|pgvector|embeddings/i);
  });

  await check("mobile styles stack the briefing header", () => {
    const css = readSrc("src/app/globals.css");
    assert.match(css, /\.ocean-catch-me-up/);
    assert.match(
      css,
      /@media \(max-width: 720px\) \{[\s\S]*ocean-catch-me-up-header/,
    );
  });

  console.log(`\nCatch Me Up verification: ${passed} checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
