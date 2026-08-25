/**
 * Phase 3A — data integrity & reactive-state foundation.
 * Credential-free. Fake Supabase client for failure injection.
 *
 * Run: npx tsx scripts/verify-phase3a-integrity.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildNewProject, type CreateProjectInput } from "../src/lib/create-project";
import {
  cleanupFailedNewProjectBundle,
  LEGAL_RISK_SOURCES,
  NEW_PROJECT_RISK_SOURCE,
  persistNewProject,
  PROJECT_BUNDLE_SET_NULL_TABLES,
} from "../src/lib/data/supabase/persist-mutations";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import { shouldWriteDurableMissionCache } from "../src/lib/mission-cache";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");
const PROJECT_A_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_B_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_C_ID = "33333333-3333-4333-8333-333333333333";

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

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function representativeDraft(
  overrides: Partial<CreateProjectInput> = {},
): CreateProjectInput {
  return {
    name: "Horizon Customer Portal",
    code: "HORIZON",
    summary: "Replace the customer portal before winter peak.",
    currentFocus: "CAB pack for 12 September",
    sourceMode: "talk",
    sourceNarrative:
      "Ava is sponsor. Biggest risk is vendor lock-in on auth. CAB is 12 September.",
    stakeholders: [
      {
        name: "Ava Chen",
        role: "Sponsor",
        concerns: ["Board visibility"],
      },
    ],
    risks: [{ title: "Vendor lock-in on auth" }],
    importantDates: [{ label: "CAB 12 September", date: "2026-09-12" }],
    todos: [{ title: "Send CAB pack 48 hours early" }],
    knowledgeRemember: [
      { text: "CAB needs the pack 48 hours before the meeting", remember: true },
    ],
    ...overrides,
  };
}

function asClient(fake: FakeWorkspaceClient) {
  return fake as unknown as Parameters<typeof persistNewProject>[0];
}

async function main() {
  await check("New Project Risk persistence uses a legal source value", async () => {
    assert.equal(NEW_PROJECT_RISK_SOURCE, "manual");
    assert.ok(LEGAL_RISK_SOURCES.includes(NEW_PROJECT_RISK_SOURCE));
    const persistSrc = readSrc("src/lib/data/supabase/persist-mutations.ts");
    assert.match(persistSrc, /NEW_PROJECT_RISK_SOURCE/);
    assert.doesNotMatch(
      persistSrc,
      /source:\s*"setup"/,
      "must not persist illegal risk source setup",
    );
    const fake = new FakeWorkspaceClient();
    const bundle = await persistNewProject(
      asClient(fake),
      fake.workspaceId,
      fake.userId,
      representativeDraft({ clientProjectId: PROJECT_A_ID }),
    );
    assert.ok(bundle.risks.length >= 1);
    for (const risk of bundle.risks) {
      assert.ok(
        (LEGAL_RISK_SOURCES as readonly string[]).includes(risk.source ?? ""),
        `illegal source ${risk.source}`,
      );
      assert.equal(risk.source, "manual");
    }
    for (const row of fake.tables.risks) {
      assert.equal(row.source, "manual");
      assert.notEqual(row.source, "setup");
    }
  });

  await check(
    "Reviewed draft → full durable bundle → hydrate → same maintained truth",
    async () => {
      const fake = new FakeWorkspaceClient();
      const draft = representativeDraft({ clientProjectId: PROJECT_A_ID });
      const persisted = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        draft,
      );

      assert.equal(persisted.project.id, PROJECT_A_ID);
      assert.equal(persisted.project.name, "Horizon Customer Portal");
      assert.ok(persisted.risks.some((r) => /vendor lock-in/i.test(r.title)));
      assert.ok(
        persisted.timeline.some((t) => /CAB 12 September/i.test(t.label)),
      );
      assert.ok(persisted.todos.some((t) => /CAB pack/i.test(t.title)));
      assert.ok(
        persisted.project.stakeholders.some((s) => s.name === "Ava Chen"),
      );

      const loaded = await loadMissionStateFromSupabase(asClient(fake));
      const project = loaded.state.projects.find((p) => p.id === PROJECT_A_ID);
      assert.ok(project, "hydrated project missing");
      assert.equal(project!.name, persisted.project.name);
      assert.equal(project!.code, persisted.project.code);
      assert.ok(project!.stakeholders.some((s) => s.name === "Ava Chen"));

      const risks = (loaded.state.risks ?? []).filter((r) => r.projectId === PROJECT_A_ID);
      assert.ok(risks.some((r) => /vendor lock-in/i.test(r.title)));
      assert.equal(risks.length, persisted.risks.length);

      const dates = loaded.state.timeline.filter((t) => t.projectId === PROJECT_A_ID);
      assert.ok(dates.some((t) => /CAB 12 September/i.test(t.label)));
      assert.equal(dates.length, persisted.timeline.length);

      const people = project!.stakeholders.map((s) => s.name).sort();
      assert.deepEqual(
        people,
        persisted.project.stakeholders.map((s) => s.name).sort(),
      );

      const todos = loaded.state.todos.filter((t) => t.projectId === PROJECT_A_ID);
      assert.ok(todos.some((t) => /CAB pack/i.test(t.title)));

      const knowledge = loaded.state.knowledge.find(
        (k) => k.projectId === PROJECT_A_ID,
      );
      assert.ok(
        knowledge?.sections.now.some((b) => /48 hours/i.test(b)) ||
          knowledge?.sections.decisions.some((b) => /48 hours/i.test(b)),
      );
    },
  );

  await check(
    "Failed bundle write does not leave a ghost/partial successful project",
    async () => {
      const fake = new FakeWorkspaceClient({ failOnTable: "risks" });
      const draft = representativeDraft({ clientProjectId: PROJECT_A_ID });
      await assert.rejects(
        () =>
          persistNewProject(asClient(fake), fake.workspaceId, fake.userId, draft),
        /create risks/,
      );
      assert.equal(fake.tables.projects.length, 0, "project row must be removed");
      assert.equal(fake.tables.stakeholders.length, 0);
      assert.equal(fake.tables.todos.length, 0);
      assert.equal(fake.tables.risks.length, 0);
      assert.equal(fake.tables.knowledge_items.length, 0);
      assert.equal(fake.tables.milestones.length, 0);
      assert.equal(
        fake.tables.todos.filter((row) => row.project_id == null).length,
        0,
        "SET NULL orphans must not remain",
      );
    },
  );

  await check(
    "Compensating cleanup cannot delete a pre-existing other project",
    async () => {
      const fake = new FakeWorkspaceClient();
      await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        representativeDraft({
          clientProjectId: PROJECT_A_ID,
          name: "Project A",
          code: "AA",
        }),
      );
      await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        representativeDraft({
          clientProjectId: PROJECT_B_ID,
          name: "Project B",
          code: "BB",
          risks: [{ title: "B-only risk" }],
        }),
      );

      const failing = new FakeWorkspaceClient({ failOnTable: "milestones" });
      failing.tables.projects = [...fake.tables.projects];
      failing.tables.stakeholders = [...fake.tables.stakeholders];
      failing.tables.todos = [...fake.tables.todos];
      failing.tables.risks = [...fake.tables.risks];
      failing.tables.knowledge_items = [...fake.tables.knowledge_items];
      failing.tables.milestones = [...fake.tables.milestones];
      failing.tables.recommendations = [...fake.tables.recommendations];
      failing.tables.memories = [...fake.tables.memories];
      failing.tables.history_events = [...fake.tables.history_events];

      await assert.rejects(
        () =>
          persistNewProject(
            asClient(failing),
            failing.workspaceId,
            failing.userId,
            representativeDraft({
              clientProjectId: PROJECT_C_ID,
              name: "Project C",
              code: "CC",
            }),
          ),
        /create milestones/,
      );

      assert.ok(failing.tables.projects.some((p) => p.id === PROJECT_A_ID));
      assert.ok(failing.tables.projects.some((p) => p.id === PROJECT_B_ID));
      assert.equal(
        failing.tables.projects.some((p) => p.id === PROJECT_C_ID),
        false,
      );
      assert.ok(
        failing.tables.risks.some(
          (r) => r.project_id === PROJECT_B_ID && /B-only risk/.test(String(r.title)),
        ),
      );
    },
  );

  await check(
    "Retry/repeated submission with the same clientProjectId does not create duplicates",
    async () => {
      const fake = new FakeWorkspaceClient();
      const draft = representativeDraft({ clientProjectId: PROJECT_A_ID });
      const first = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        draft,
      );
      const second = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        draft,
      );
      assert.equal(first.project.id, PROJECT_A_ID);
      assert.equal(second.project.id, PROJECT_A_ID);
      assert.equal(
        fake.tables.projects.filter((p) => p.id === PROJECT_A_ID).length,
        1,
      );
      assert.equal(fake.tables.projects.length, 1);
    },
  );

  await check("Project with Risks + Important Dates persists both", async () => {
    const fake = new FakeWorkspaceClient();
    const bundle = await persistNewProject(
      asClient(fake),
      fake.workspaceId,
      fake.userId,
      representativeDraft({ clientProjectId: PROJECT_A_ID }),
    );
    assert.ok(bundle.risks.length >= 1);
    assert.ok(bundle.timeline.length >= 1);
    assert.equal(fake.tables.risks.length, bundle.risks.length);
    assert.equal(fake.tables.milestones.length, bundle.timeline.length);
  });

  await check(
    "Important Dates are available to immediate reactive state after durable success",
    async () => {
      const fake = new FakeWorkspaceClient();
      const bundle = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        representativeDraft({ clientProjectId: PROJECT_A_ID }),
      );
      const cab = bundle.timeline.find((t) => /CAB 12 September/i.test(t.label));
      assert.ok(cab, "persist return must include the Important Date");
      assert.ok(cab!.startAt.includes("2026-09-12"));
      assert.equal(cab!.projectId, PROJECT_A_ID);
      const store = readSrc("src/lib/store.tsx");
      assert.match(store, /applyDurableWorkspace\(/);
      assert.match(store, /setSaveStatus\("saved"\)/);
      assert.doesNotMatch(store, /trying browser persist/);
    },
  );

  await check(
    "Fresh hydrate reproduces Risks, Important Dates, People and Todos from the bundle",
    async () => {
      const fake = new FakeWorkspaceClient();
      await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        representativeDraft({ clientProjectId: PROJECT_A_ID }),
      );
      const loaded = await loadMissionStateFromSupabase(asClient(fake));
      const pid = PROJECT_A_ID;
      assert.ok((loaded.state.risks ?? []).some((r) => r.projectId === pid));
      assert.ok(loaded.state.timeline.some((t) => t.projectId === pid));
      assert.ok(
        loaded.state.projects
          .find((p) => p.id === pid)
          ?.stakeholders.some((s) => s.name === "Ava Chen"),
      );
      assert.ok(loaded.state.todos.some((t) => t.projectId === pid));
    },
  );

  await check("Persistence failure produces visible save failure state", () => {
    const shell = readSrc("src/components/AppShell.tsx");
    assert.match(shell, /saveStatus === "error"/);
    assert.match(shell, /ocean-save-error/);
    assert.match(shell, /data-testid="ocean-save-error"/);
    assert.match(shell, /Could not save your last change/);
    const store = readSrc("src/lib/store.tsx");
    assert.match(store, /reportPersistFailure/);
    const css = readSrc("src/app/globals.css");
    assert.match(css, /\.ocean-save-error/);
  });

  await check(
    "Failed/unsaved MissionState is not eligible for the durable paint cache",
    () => {
      assert.equal(
        shouldWriteDurableMissionCache({
          reason: "state-change",
          persistenceMode: "supabase",
          workspaceId: "ws",
          userId: "user",
        }),
        false,
      );
      assert.equal(
        shouldWriteDurableMissionCache({
          reason: "hydrate",
          persistenceMode: "supabase",
          workspaceId: "ws",
          userId: "user",
        }),
        true,
      );
      assert.equal(
        shouldWriteDurableMissionCache({
          reason: "confirmed-persist",
          persistenceMode: "supabase",
          workspaceId: "ws",
          userId: "user",
        }),
        true,
      );
      assert.equal(
        shouldWriteDurableMissionCache({
          reason: "confirmed-persist",
          persistenceMode: "local",
          workspaceId: "ws",
          userId: "user",
        }),
        false,
      );
      const store = readSrc("src/lib/store.tsx");
      assert.match(store, /shouldWriteDurableMissionCache/);
      assert.match(store, /saveStatus !== "saved"/);
      assert.doesNotMatch(
        store,
        /writeMissionSupabaseCache\(\{[\s\S]*state,\s*\}\);\s*\n\s*\}, \[state, hydrated\]\)/,
      );
    },
  );

  await check(
    "After persistence failure, store reconciles from durable workspace state",
    () => {
      const store = readSrc("src/lib/store.tsx");
      assert.match(store, /reconcileFromDurableAuthority/);
      assert.match(store, /preserveSaveError/);
      assert.match(store, /\/api\/workspace\/state/);
      assert.match(store, /reportPersistFailure/);
    },
  );

  await check("Project A create path does not alter Project B", async () => {
    const fake = new FakeWorkspaceClient();
    await persistNewProject(
      asClient(fake),
      fake.workspaceId,
      fake.userId,
      representativeDraft({
        clientProjectId: PROJECT_A_ID,
        name: "Project A",
        code: "AA",
        risks: [{ title: "A-only risk" }],
        importantDates: [{ label: "A date", date: "2026-10-01" }],
      }),
    );
    const snapshotBBefore = {
      projects: fake.tables.projects.filter((p) => p.id === PROJECT_B_ID).length,
      risks: fake.tables.risks.filter((r) => r.project_id === PROJECT_B_ID).length,
    };
    await persistNewProject(
      asClient(fake),
      fake.workspaceId,
      fake.userId,
      representativeDraft({
        clientProjectId: PROJECT_B_ID,
        name: "Project B",
        code: "BB",
        risks: [{ title: "B-only risk" }],
        importantDates: [{ label: "B date", date: "2026-11-01" }],
      }),
    );
    const loaded = await loadMissionStateFromSupabase(asClient(fake));
    const aRisks = (loaded.state.risks ?? []).filter((r) => r.projectId === PROJECT_A_ID);
    const bRisks = (loaded.state.risks ?? []).filter((r) => r.projectId === PROJECT_B_ID);
    assert.ok(aRisks.every((r) => /A-only/.test(r.title)));
    assert.ok(bRisks.every((r) => /B-only/.test(r.title)));
    assert.ok(
      loaded.state.timeline
        .filter((t) => t.projectId === PROJECT_A_ID)
        .every((t) => /A date/.test(t.label)),
    );
    assert.ok(
      loaded.state.timeline
        .filter((t) => t.projectId === PROJECT_B_ID)
        .every((t) => /B date/.test(t.label)),
    );
    assert.equal(snapshotBBefore.projects, 0);
    assert.equal(snapshotBBefore.risks, 0);

    await cleanupFailedNewProjectBundle(asClient(fake), PROJECT_A_ID);
    assert.equal(fake.tables.projects.some((p) => p.id === PROJECT_A_ID), false);
    assert.ok(fake.tables.projects.some((p) => p.id === PROJECT_B_ID));
    assert.ok(
      fake.tables.risks.some(
        (r) => r.project_id === PROJECT_B_ID && /B-only/.test(String(r.title)),
      ),
    );
    assert.equal(fake.tables.risks.some((r) => r.project_id === PROJECT_A_ID), false);
  });

  await check("One deliberate New Project persistence path (no double persist)", () => {
    const store = readSrc("src/lib/store.tsx");
    assert.match(store, /\/api\/workspace\/projects/);
    assert.doesNotMatch(store, /trying browser persist/);
    const createFn = store.slice(store.indexOf("const createProject = useCallback"));
    const createFnEnd = createFn.indexOf("const cloneRelOps");
    const createBody = createFn.slice(0, createFnEnd);
    assert.ok(createBody.includes("/api/workspace/projects"));
    assert.doesNotMatch(createBody, /persistNewProject\(/);
    assert.doesNotMatch(createBody, /createBrowserSupabaseClient/);
    assert.match(store, /createProjectInFlightRef/);
    const experience = readSrc("src/components/onboarding/NewProjectExperience.tsx");
    assert.match(experience, /createLockRef/);
    assert.match(experience, /clientProjectId/);
    const schema = readSrc("supabase/migrations/20260812002748_workspace_schema.sql");
    assert.match(schema, /check \(source in \('manual', 'capture', 'seed'\)\)/);
    for (const table of PROJECT_BUNDLE_SET_NULL_TABLES) {
      assert.match(
        readSrc("src/lib/data/supabase/persist-mutations.ts"),
        new RegExp(`"${table}"`),
      );
    }
  });

  await check("History evidence is secondary and not written for a failed create", async () => {
    const persistSrc = readSrc("src/lib/data/supabase/persist-mutations.ts");
    assert.match(persistSrc, /History is secondary evidence/);
    const fake = new FakeWorkspaceClient({ failOnTable: "risks" });
    await assert.rejects(() =>
      persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        representativeDraft({ clientProjectId: PROJECT_A_ID }),
      ),
    );
    assert.equal(fake.tables.history_events.length, 0);
  });

  await check("buildNewProject still maps reviewed dates into timeline", () => {
    const bundle = buildNewProject(representativeDraft());
    assert.ok(bundle.timeline.some((t) => /CAB 12 September/i.test(t.label)));
    assert.ok(bundle.knowledge.sections.risks.some((t) => /vendor lock-in/i.test(t)));
  });

  console.log(`\n${passed} Phase 3A integrity checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
