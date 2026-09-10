/**
 * D-049 — authoritative Knowledge hydrate must not truncate section lists.
 * Credential-free. Production path:
 * persistNewProject → loadMissionStateFromSupabase → Knowledge Centre Correct
 * (buildCorrectedSectionBullets → persistKnowledgeReconcile) → rehydrate.
 *
 * Run: npx tsx scripts/verify-d049-hydrate-completeness.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CreateProjectInput } from "../src/lib/create-project";
import { persistNewProject } from "../src/lib/data/supabase/persist-mutations";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import {
  alignSectionItemIds,
  persistKnowledgeReconcile,
  remapStructuredForSections,
} from "../src/lib/data/supabase/reconcile-knowledge";
import { buildCorrectedSectionBullets } from "../src/lib/knowledge-centre/knowledge-item-detail";
import { composeKnowledgeCentreItems } from "../src/lib/knowledge-centre/four-bucket";
import { serializeCanonicalTruth } from "../src/lib/canonical-truth/serialize";
import type { KnowledgeSectionId, ProjectKnowledge } from "../src/lib/types";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

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

function numberedFacts(prefix: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `${prefix} ${String(i + 1).padStart(2, "0")} remains canonical project truth`,
  );
}

function factBodies(fake: FakeWorkspaceClient, projectId: string, section: string) {
  return fake.tables.knowledge_items
    .filter(
      (row) =>
        String(row.project_id) === projectId &&
        row.section === section &&
        String(row.lifecycle ?? "current") === "current",
    )
    .map((row) => String(row.body));
}

async function correctSection(
  fake: FakeWorkspaceClient,
  knowledge: ProjectKnowledge,
  projectId: string,
  section: KnowledgeSectionId,
  newBody: string,
) {
  const bullets = buildCorrectedSectionBullets(knowledge, section, {
    itemId: knowledge.sectionItemIds?.[section]?.[0] ?? null,
    oldBody: knowledge.sections[section]?.[0] ?? "",
    newBody,
  });
  assert.ok(bullets, "Correct must locate the visible hydrated line");
  const sections = { ...knowledge.sections, [section]: bullets };
  const desired: ProjectKnowledge = {
    ...knowledge,
    sections,
    sectionItemIds: alignSectionItemIds(knowledge, sections, [section]),
    structured: remapStructuredForSections(knowledge, sections, [section]),
  };
  return persistKnowledgeReconcile(
    asClient(fake),
    fake.workspaceId,
    projectId,
    desired,
    fake.userId,
    [section],
  );
}

async function main() {
  await check(
    "D-049: 30 now facts survive hydrate and Knowledge Centre Correct",
    async () => {
      const notes = numberedFacts("Now fact", 30);
      const fake = new FakeWorkspaceClient();
      const persisted = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        composeDraft({
          knowledgeRemember: notes.map((text) => ({ text, remember: true })),
        }),
      );
      const projectId = persisted.project.id;
      const dbBefore = factBodies(fake, projectId, "now");
      assert.equal(dbBefore.length, 30, "DB must hold all 30 facts before hydrate");
      assert.deepEqual(dbBefore, notes);

      const loaded = await loadMissionStateFromSupabase(asClient(fake));
      const knowledge = loaded.state.knowledge.find((k) => k.projectId === projectId);
      assert.ok(knowledge);
      const now = knowledge!.sections.now;
      const ids = knowledge!.sectionItemIds?.now ?? [];
      const structuredNow = (knowledge!.structured ?? []).filter(
        (item) => item.section === "now" && item.kind === "fact",
      );

      const corrected = `${notes[0]} — corrected`;
      const plan = await correctSection(fake, knowledge!, projectId, "now", corrected);
      const dbAfter = factBodies(fake, projectId, "now");
      const lost = notes.slice(1).filter((note) => !dbAfter.includes(note));

      assert.equal(
        now.length,
        30,
        `hydrate truncated sections.now to ${now.length}; structured=${structuredNow.length}; after Correct DB=${dbAfter.length} deleted=${plan.deleteIds.length} lost=${lost.length}`,
      );
      assert.equal(ids.length, 30);
      assert.equal(new Set(ids).size, 30);
      assert.equal(ids.length, now.length, "section bodies and sectionItemIds must stay aligned");
      assert.equal(structuredNow.length, 30);
      assert.deepEqual(
        structuredNow.map((item) => item.body),
        notes,
      );

      const kc = composeKnowledgeCentreItems(loaded.state, projectId);
      const kcFacts = kc
        .filter(
          (item) =>
            item.bucket === "knowledge" &&
            item.knowledgeSubtype === "information" &&
            notes.includes(item.title),
        )
        .map((item) => item.title);
      assert.deepEqual(kcFacts, notes);

      const ask = serializeCanonicalTruth({
        state: loaded.state,
        projectId,
        question: "What is true about this project now?",
      });
      for (const note of notes) {
        assert.match(ask.promptBlock, new RegExp(note.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }

      assert.equal(plan.deleteIds.length, 0, "Correct must not delete unseen canonical rows");
      assert.equal(plan.inserts.length, 0);
      assert.equal(dbAfter.length, 30);
      assert.ok(dbAfter.includes(corrected));
      assert.equal(dbAfter.filter((body) => body === notes[0]).length, 0);
      for (const note of notes.slice(1)) {
        assert.ok(dbAfter.includes(note), `lost canonical fact: ${note}`);
      }
      assert.equal(new Set(dbAfter).size, 30, "Correct must not duplicate rows");

      const reloaded = await loadMissionStateFromSupabase(asClient(fake));
      const again = reloaded.state.knowledge.find((k) => k.projectId === projectId);
      assert.equal(again!.sections.now.length, 30);
      assert.equal((again!.sectionItemIds?.now ?? []).length, 30);
      assert.ok(again!.sections.now.includes(corrected));
      assert.equal(
        (again!.structured ?? []).filter((item) => item.section === "now" && item.kind === "fact")
          .length,
        30,
      );
    },
  );

  await check(
    "D-049: 30 decisions survive the same hydrate fold and Correct",
    async () => {
      const decisions = numberedFacts("Decision", 30);
      const fake = new FakeWorkspaceClient();
      const persisted = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        composeDraft({
          knowledgeDecisions: decisions,
        }),
      );
      const projectId = persisted.project.id;
      assert.equal(factBodies(fake, projectId, "decisions").length, 30);

      const loaded = await loadMissionStateFromSupabase(asClient(fake));
      const knowledge = loaded.state.knowledge.find((k) => k.projectId === projectId);
      assert.ok(knowledge);
      assert.equal(knowledge!.sections.decisions.length, 30);
      assert.equal((knowledge!.sectionItemIds?.decisions ?? []).length, 30);
      assert.equal(
        (knowledge!.structured ?? []).filter((item) => item.section === "decisions").length,
        30,
      );

      const corrected = `${decisions[0]} — corrected`;
      const plan = await correctSection(
        fake,
        knowledge!,
        projectId,
        "decisions",
        corrected,
      );
      assert.equal(plan.deleteIds.length, 0);
      const dbAfter = factBodies(fake, projectId, "decisions");
      assert.equal(dbAfter.length, 30);
      assert.ok(dbAfter.includes(corrected));
      for (const body of decisions.slice(1)) {
        assert.ok(dbAfter.includes(body));
      }

      const reloaded = await loadMissionStateFromSupabase(asClient(fake));
      const again = reloaded.state.knowledge.find((k) => k.projectId === projectId);
      assert.equal(again!.sections.decisions.length, 30);
      assert.ok(again!.sections.decisions.includes(corrected));
    },
  );

  await check(
    "D-049: 30 open loops survive the same hydrate fold and Correct",
    async () => {
      const loops = numberedFacts("Open loop", 30);
      const fake = new FakeWorkspaceClient();
      const persisted = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        composeDraft({
          knowledgeOpenLoops: loops,
        }),
      );
      const projectId = persisted.project.id;
      assert.equal(factBodies(fake, projectId, "openLoops").length, 30);

      const loaded = await loadMissionStateFromSupabase(asClient(fake));
      const knowledge = loaded.state.knowledge.find((k) => k.projectId === projectId);
      assert.ok(knowledge);
      assert.equal(knowledge!.sections.openLoops.length, 30);
      assert.equal((knowledge!.sectionItemIds?.openLoops ?? []).length, 30);

      const corrected = `${loops[0]} — corrected`;
      const plan = await correctSection(
        fake,
        knowledge!,
        projectId,
        "openLoops",
        corrected,
      );
      assert.equal(plan.deleteIds.length, 0);
      const dbAfter = factBodies(fake, projectId, "openLoops");
      assert.equal(dbAfter.length, 30);
      assert.ok(dbAfter.includes(corrected));
      for (const body of loops.slice(1)) {
        assert.ok(dbAfter.includes(body));
      }
    },
  );

  await check(
    "D-049: risks-table overlay must not re-truncate canonical risk rows",
    async () => {
      const titles = numberedFacts("Risk fact", 30);
      const fake = new FakeWorkspaceClient();
      const persisted = await persistNewProject(
        asClient(fake),
        fake.workspaceId,
        fake.userId,
        composeDraft({
          knowledgeRisks: titles,
        }),
      );
      const projectId = persisted.project.id;
      fake.tables.risks.push({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        workspace_id: fake.workspaceId,
        project_id: projectId,
        title: "Domain-only risk 31 that must not collapse hydrate",
        status: "open",
        source: "manual",
        created_at: new Date().toISOString(),
      });

      const loaded = await loadMissionStateFromSupabase(asClient(fake));
      const knowledge = loaded.state.knowledge.find((k) => k.projectId === projectId);
      assert.ok(knowledge);
      assert.equal(knowledge!.sections.risks.length, 31);
      assert.equal((knowledge!.sectionItemIds?.risks ?? []).length, 30);
      assert.ok(
        knowledge!.sections.risks.includes(
          "Domain-only risk 31 that must not collapse hydrate",
        ),
      );
      for (const title of titles) {
        assert.ok(knowledge!.sections.risks.includes(title));
      }

      const corrected = `${titles[0]} — corrected`;
      const plan = await correctSection(
        fake,
        knowledge!,
        projectId,
        "risks",
        corrected,
      );
      assert.equal(plan.deleteIds.length, 0);
      const dbAfter = factBodies(fake, projectId, "risks");
      assert.ok(dbAfter.includes(corrected));
      for (const title of titles.slice(1)) {
        assert.ok(dbAfter.includes(title), `lost canonical risk: ${title}`);
      }
      assert.equal(dbAfter.filter((body) => body === titles[0]).length, 0);
    },
  );

  await check("authoritative hydrate no longer slices section lists at 24", () => {
    const hydrate = readFileSync(
      join(process.cwd(), "src/lib/data/supabase/load-mission-state.ts"),
      "utf8",
    );
    const fold = hydrate.slice(hydrate.indexOf("for (const row of knowledgeRes.data"));
    const foldFn = fold.slice(0, fold.indexOf("const risks:"));
    assert.doesNotMatch(foldFn, /\.slice\(\s*0\s*,\s*24\s*\)/);
  });

  await check("Capture/Ask/briefing still bound ranked presentation, not hydrate", () => {
    const capture = readFileSync(
      join(process.cwd(), "src/lib/capture/context.ts"),
      "utf8",
    );
    assert.match(capture, /takeRankedWithExclusions/);
    assert.match(capture, /limitsReached/);
    const snapshot = readFileSync(
      join(process.cwd(), "src/lib/tell-me/snapshot-deterministic.ts"),
      "utf8",
    );
    assert.match(snapshot, /sections\.now \?\? \[\]\)\.slice\(0, 6\)/);
    const serialize = readFileSync(
      join(process.cwd(), "src/lib/canonical-truth/serialize.ts"),
      "utf8",
    );
    assert.match(serialize, /knowledge\.structured/);
  });

  console.log(`\n${passed} D-049 hydrate-completeness checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
