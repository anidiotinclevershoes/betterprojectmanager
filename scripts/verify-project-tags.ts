/**
 * Retrieval tags — metadata only. Must not mutate or plan project truth.
 *
 * Run: npx tsx scripts/verify-project-tags.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  attachTagToItem,
  detachTagFromItem,
  itemVisibleForTagFilter,
  suggestTags,
  tagsAreSame,
  tagsForItem,
  tagsFromCreateDraft,
  tagSlug,
} from "../src/lib/tags";
import { buildNewProject, type CreateProjectInput } from "../src/lib/create-project";
import { persistNewProject } from "../src/lib/data/supabase/persist-mutations";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import type { MissionState } from "../src/lib/types";
import { risksFromSetup } from "../src/lib/new-project/materialise-setup";

const ROOT = join(import.meta.dirname, "..");

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  })();
}

function draft(): CreateProjectInput {
  return {
    name: "Member Claims Upload",
    code: "MCU",
    summary: "",
    currentFocus: "",
    sourceMode: "compose",
    risks: [{ title: "IDP delay", tags: ["Release", "Mobile"] }],
    todos: [{ title: "Book UAT lab", tags: ["UAT"] }],
    stakeholders: [
      { name: "Sarah Murphy", responsibilities: ["Product Owner"], tags: ["Release"] },
    ],
    importantDates: [{ label: "Go-live", date: "2026-10-22", tags: ["Release"] }],
    knowledgeRemember: [
      {
        text: "Release moved to 22 October",
        remember: true,
        kind: "decision",
        tags: ["Release", "Mobile"],
      },
    ],
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
    projectTags: [],
    itemTags: [],
  };
}

async function main() {
  await check("case/whitespace duplicates collapse to one tag", () => {
    assert.equal(tagSlug("Release"), tagSlug(" release "));
    assert.equal(tagsAreSame("Release", "release"), true);
    assert.equal(tagsAreSame("Go-live readiness", "go-live   readiness"), true);
  });

  await check("one item can have many tags; one tag can attach to many items", () => {
    const bundle = buildNewProject(draft());
    const risks = risksFromSetup(bundle.project.id, draft());
    const knowledgeIdsByBody = new Map<string, string>([
      ["release moved to 22 october", "know-1"],
    ]);
    const { projectTags, itemTags } = tagsFromCreateDraft({
      projectId: bundle.project.id,
      input: draft(),
      bundle,
      riskIdsByTitle: new Map(risks.map((r) => [r.title.toLowerCase(), r.id])),
      knowledgeIdsByBody,
    });
    const release = projectTags.find((t) => t.slug === "release");
    assert.ok(release);
    const releaseUses = itemTags.filter((r) => r.tagId === release!.id);
    assert.ok(releaseUses.length >= 3);
    const riskId = risks[0]!.id;
    const onRisk = tagsForItem({
      projectTags,
      itemTags,
      projectId: bundle.project.id,
      targetKind: "risk",
      targetId: riskId,
    });
    assert.ok(onRisk.some((t) => t.slug === "release"));
    assert.ok(onRisk.some((t) => t.slug === "mobile"));
  });

  await check("suggestions include project tags, predefined tags, and create-new", () => {
    const suggestions = suggestTags({
      query: "go-live read",
      projectTags: [
        {
          id: "t1",
          projectId: "p",
          name: "Release",
          slug: "release",
          origin: "predefined",
        },
      ],
    });
    assert.ok(suggestions.some((s) => s.kind === "create"));
    assert.ok(suggestions.some((s) => /go-live/i.test(s.name)));
    const projectHit = suggestTags({
      query: "rel",
      projectTags: [
        {
          id: "t1",
          projectId: "p",
          name: "Release",
          slug: "release",
          origin: "custom",
        },
      ],
    });
    assert.ok(projectHit.some((s) => s.kind === "project" && s.slug === "release"));
  });

  await check("removing all tags leaves authoritative fields untouched", () => {
    const before = buildNewProject(draft());
    const after = buildNewProject({
      ...draft(),
      risks: draft().risks?.map((r) => ({ ...r, tags: [] })),
      todos: draft().todos?.map((t) => ({ ...t, tags: [] })),
      stakeholders: draft().stakeholders?.map((s) => ({ ...s, tags: [] })),
      importantDates: draft().importantDates?.map((d) => ({ ...d, tags: [] })),
      knowledgeRemember: draft().knowledgeRemember?.map((k) => ({
        ...k,
        tags: [],
      })),
    });
    assert.equal(before.project.name, after.project.name);
    assert.deepEqual(
      before.todos.map((t) => t.title),
      after.todos.map((t) => t.title),
    );
    assert.deepEqual(before.knowledge.sections.risks, after.knowledge.sections.risks);
    assert.deepEqual(
      before.timeline.map((t) => t.startAt),
      after.timeline.map((t) => t.startAt),
    );
  });

  await check("changing a tag cannot mutate a decision body or date", () => {
    const bundle = buildNewProject(draft());
    const risks = risksFromSetup(bundle.project.id, draft());
    let { projectTags, itemTags } = tagsFromCreateDraft({
      projectId: bundle.project.id,
      input: draft(),
      bundle,
      riskIdsByTitle: new Map(risks.map((r) => [r.title.toLowerCase(), r.id])),
      knowledgeIdsByBody: new Map([["release moved to 22 october", "know-1"]]),
    });
    const release = projectTags.find((t) => t.slug === "release")!;
    itemTags = detachTagFromItem({
      itemTags,
      tagId: release.id,
      targetKind: "knowledge_item",
      targetId: "know-1",
    });
    const decisionBefore =
      bundle.knowledge.sections.decisions[0] ||
      bundle.knowledge.sections.now.find((b) => /22 October/i.test(b));
    const dateBefore = bundle.timeline[0]?.startAt;
    const next = attachTagToItem({
      projectTags,
      itemTags,
      projectId: bundle.project.id,
      tag: {
        id: "uat-tag",
        projectId: bundle.project.id,
        name: "UAT",
        slug: "uat",
        origin: "predefined",
      },
      targetKind: "knowledge_item",
      targetId: "know-1",
      itemTagId: "it-new",
    });
    assert.match(String(decisionBefore), /22 October/i);
    assert.equal(
      bundle.knowledge.sections.decisions[0] ||
        bundle.knowledge.sections.now.find((b) => /22 October/i.test(b)),
      decisionBefore,
    );
    assert.equal(bundle.timeline[0]?.startAt, dateBefore);
    assert.equal(bundle.timeline[0]?.label, "Go-live");
    assert.ok(next.itemTags.some((r) => r.tagId === "uat-tag"));
  });

  await check("tag filtering is view-only", () => {
    const itemTags = [
      {
        id: "1",
        projectId: "p",
        tagId: "release",
        targetKind: "risk" as const,
        targetId: "r1",
      },
    ];
    assert.equal(
      itemVisibleForTagFilter({
        itemTags,
        projectId: "p",
        targetKind: "risk",
        targetId: "r1",
        selectedTagIds: ["release"],
      }),
      true,
    );
    assert.equal(
      itemVisibleForTagFilter({
        itemTags,
        projectId: "p",
        targetKind: "risk",
        targetId: "r2",
        selectedTagIds: ["release"],
      }),
      false,
    );
    assert.equal(
      itemVisibleForTagFilter({
        itemTags,
        projectId: "p",
        targetKind: "risk",
        targetId: "r2",
        selectedTagIds: [],
      }),
      true,
    );
  });

  await check("persisted tags survive a fake reload and do not write history", async () => {
    const fake = new FakeWorkspaceClient();
    const client = fake as unknown as Parameters<typeof persistNewProject>[0];
    await persistNewProject(client, fake.workspaceId, fake.userId, draft());
    assert.ok(fake.tables.project_tags.length >= 1);
    assert.ok(fake.tables.item_tags.length >= 2);
    const historyTypes = fake.tables.history_events.map((row) => row.type);
    assert.deepEqual(historyTypes, ["project_created"]);
    assert.equal(
      fake.tables.project_tags.some(
        (row) => String(row.slug) === "release" && String(row.slug) !== "Release",
      ),
      true,
    );
  });

  await check("capture apply planning is identical with and without tags", () => {
    const base = emptyState();
    base.projects = [
      {
        id: "proj-candy",
        name: "Candyland",
        code: "CANDY",
        summary: "",
        status: "watch",
        currentFocus: "",
        stakeholders: [],
      },
    ];
    base.todos = [
      {
        id: "todo-1",
        projectId: "proj-candy",
        title: "Order sprinkles",
        done: false,
        createdAt: new Date().toISOString(),
      },
    ];
    const tagged: MissionState = {
      ...base,
      projectTags: [
        {
          id: "t",
          projectId: "proj-candy",
          name: "Release",
          slug: "release",
          origin: "custom",
        },
      ],
      itemTags: [
        {
          id: "it",
          projectId: "proj-candy",
          tagId: "t",
          targetKind: "todo",
          targetId: "todo-1",
        },
      ],
    };
    assert.deepEqual(
      captureApplyWorldFromState(base),
      captureApplyWorldFromState(tagged),
    );
  });

  await check("tag tables are not referenced by capture apply dispatch", () => {
    const src = readFileSync(join(ROOT, "src/lib/capture/apply/dispatch.ts"), "utf8");
    assert.doesNotMatch(src, /projectTags|item_tags|project_tags/);
    const world = readFileSync(join(ROOT, "src/lib/capture/apply/world.ts"), "utf8");
    assert.doesNotMatch(world, /projectTags|itemTags/);
  });

  console.log(`\n${passed} retrieval tag checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
