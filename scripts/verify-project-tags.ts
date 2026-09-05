/**
 * Retrieval tags are metadata only.
 * Run: npm run verify:project-tags
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import { buildNewProject } from "../src/lib/create-project";
import {
  attachTagToItem,
  cloneTruthWithoutTags,
  itemVisibleForTagFilter,
  tagsFromCreateDraft,
  tagSlug,
} from "../src/lib/tags";
import type { MissionState } from "../src/lib/types";

function check(name: string, fn: () => void) {
  fn();
  console.log(`ok  ${name}`);
}

const PROJECT = "proj-tag";

function baseState(): MissionState {
  return {
    projects: [
      {
        id: PROJECT,
        name: "Tagged",
        code: "TAG",
        summary: "s",
        status: "healthy",
        kind: "delivery",
        currentFocus: "",
        stakeholders: [{ id: "p1", name: "Olga", role: "PM" }],
      },
    ],
    memories: [],
    recommendations: [],
    meetings: [],
    releases: [],
    todos: [
      {
        id: "todo-1",
        projectId: PROJECT,
        title: "Pack CAB",
        done: false,
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    ],
    knowledge: [],
    risks: [{ id: "risk-1", projectId: PROJECT, title: "Vendor slip", status: "open" }],
    timeline: [
      {
        id: "ms-1",
        projectId: PROJECT,
        type: "milestone",
        label: "CAB",
        startAt: "2026-10-01T12:00:00.000Z",
      },
    ],
    history: [],
  };
}

check("migration is metadata-only with forced RLS", () => {
  const sql = readFileSync(
    "supabase/migrations/20260831160000_project_retrieval_tags.sql",
    "utf8",
  );
  assert.match(sql, /metadata only/i);
  assert.match(sql, /force row level security/);
  assert.match(sql, /create table public.project_tags/);
  assert.match(sql, /create table public.item_tags/);
  assert.doesNotMatch(sql, /update public\.todos/);
  assert.doesNotMatch(sql, /update public\.risks/);
});

check("persist-tags never writes truth tables", () => {
  const src = readFileSync("src/lib/data/supabase/persist-tags.ts", "utf8");
  assert.match(src, /project_tags/);
  assert.match(src, /item_tags/);
  assert.doesNotMatch(src, /\.from\("todos"\)/);
  assert.doesNotMatch(src, /\.from\("risks"\)/);
  assert.doesNotMatch(src, /\.from\("knowledge_items"\)/);
});

check("attach/detach does not mutate the To Do or Risk records", () => {
  const state = baseState();
  const todo = state.todos[0]!;
  const attached = attachTagToItem({
    projectTags: [],
    itemTags: [],
    projectId: PROJECT,
    tag: {
      id: "tag-1",
      projectId: PROJECT,
      name: "Governance",
      slug: tagSlug("Governance"),
      origin: "custom",
    },
    targetKind: "todo",
    targetId: todo.id,
    itemTagId: "it-1",
  });
  assert.equal(state.todos[0]?.title, "Pack CAB");
  assert.equal(state.todos[0]?.done, false);
  assert.equal(attached.itemTags.length, 1);
  assert.equal(todo.title, "Pack CAB");
});

check("Capture apply world is identical with or without tags", () => {
  const plain = baseState();
  const tagged: MissionState = {
    ...plain,
    projectTags: [
      {
        id: "tag-1",
        projectId: PROJECT,
        name: "Governance",
        slug: "governance",
        origin: "custom",
      },
    ],
    itemTags: [
      {
        id: "it-1",
        projectId: PROJECT,
        tagId: "tag-1",
        targetKind: "todo",
        targetId: "todo-1",
      },
    ],
  };
  assert.deepEqual(captureApplyWorldFromState(plain), captureApplyWorldFromState(tagged));
});

check("tag filter is view-only", () => {
  const itemTags = [
    {
      id: "it-1",
      projectId: PROJECT,
      tagId: "tag-1",
      targetKind: "todo" as const,
      targetId: "todo-1",
    },
  ];
  assert.equal(
    itemVisibleForTagFilter({
      itemTags,
      projectId: PROJECT,
      targetKind: "todo",
      targetId: "todo-1",
      selectedTagIds: ["tag-1"],
    }),
    true,
  );
  assert.equal(
    itemVisibleForTagFilter({
      itemTags,
      projectId: PROJECT,
      targetKind: "todo",
      targetId: "todo-1",
      selectedTagIds: ["other"],
    }),
    false,
  );
});

check("create-draft tags stay off the built To Do title", () => {
  const built = buildNewProject({
    name: "Tagged",
    code: "TAG",
    summary: "s",
    currentFocus: "focus",
    todos: [{ title: "Pack CAB", tags: ["Governance"] }],
  });
  assert.equal(built.todos[0]?.title, "Pack CAB");
  assert.ok(!("tags" in (built.todos[0] ?? {})));
  const tags = tagsFromCreateDraft({
    projectId: built.project.id,
    input: {
      name: "Tagged",
      code: "TAG",
      summary: "s",
      currentFocus: "focus",
      todos: [{ title: "Pack CAB", tags: ["Governance"] }],
    },
    bundle: built,
    riskIdsByTitle: new Map(),
    knowledgeIdsByBody: new Map(),
  });
  assert.equal(tags.projectTags.some((t) => t.slug === "governance"), true);
  assert.equal(tags.itemTags[0]?.targetKind, "todo");
  const stripped = cloneTruthWithoutTags({ title: "Pack CAB", tags: ["Governance"] });
  assert.deepEqual(stripped, { title: "Pack CAB" });
});

console.log("verify-project-tags: all checks passed");
