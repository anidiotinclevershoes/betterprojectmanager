/**
 * Atomic Issue edit: Title + Notes + tags in one transaction.
 * Run: npx tsx scripts/verify-issue-edit.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCaptureContext } from "../src/lib/capture/context";
import { serializeCanonicalTruth } from "../src/lib/canonical-truth/serialize";
import {
  emptyMissionState,
  loadMissionStateFromSupabase,
} from "../src/lib/data/supabase/load-mission-state";
import { persistRiskEdit } from "../src/lib/data/supabase/persist-mutations";
import { buildOpenRiskRows } from "../src/lib/knowledge-centre/ocean-frames";
import { historyEventsForItem } from "../src/lib/knowledge-centre/item-history";
import { emptyKnowledge } from "../src/lib/knowledge";
import { applyRiskEditLocal } from "../src/lib/risks/issue-edit";
import { tagDisplayName, tagSlug } from "../src/lib/tags/normalize";
import type { MissionState } from "../src/lib/types";
import { FakeWorkspaceClient, type FakeRow } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");
const PROJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const RISK_A = "33333333-3333-4333-8333-333333333333";
const RISK_B = "44444444-4444-4444-8444-444444444444";
const FOREIGN_WS = "55555555-5555-4555-8555-555555555555";
const TAG_ID = "99999999-9999-4999-8999-999999999999";
const LINK_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";
const LEGACY_ID = "88888888-8888-4888-8888-888888888888";
const OLD_TITLE = "Shared issue title";
const NEW_TITLE = "Renamed issue";
const NOTES = "supplementary mould note";
const LEGACY = "Shared issue title";
const UPDATED = "2026-01-01T00:00:00.000Z";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  console.log(`✓ ${name}`);
}

function asClient(fake: FakeWorkspaceClient) {
  return fake as never;
}

function seedProject(fake: FakeWorkspaceClient, projectId: string) {
  if (fake.tables.projects.some((row) => row.id === projectId)) return;
  fake.seedProject({
    id: projectId,
    workspace_id: fake.workspaceId,
    name: "Old project",
    code: projectId === PROJECT ? "OLD" : "OTHER",
    summary: "",
    status: "healthy",
    kind: "delivery",
    current_focus: "",
  });
}

function seedRisk(
  fake: FakeWorkspaceClient,
  projectId: string,
  riskId: string,
  title = OLD_TITLE,
  notes: string | null = null,
) {
  seedProject(fake, projectId);
  const row: FakeRow = {
    id: riskId,
    workspace_id: fake.workspaceId,
    project_id: projectId,
    title,
    status: "open",
    source: "manual",
    created_at: UPDATED,
    updated_at: UPDATED,
  };
  if (notes !== null) row.notes = notes;
  fake.tables.risks.push(row);
  return row;
}

function seedLegacy(fake: FakeWorkspaceClient, body = LEGACY) {
  const row: FakeRow = {
    id: LEGACY_ID,
    workspace_id: fake.workspaceId,
    project_id: PROJECT,
    section: "risks",
    body,
    kind: "risk",
    lifecycle: "current",
    created_at: UPDATED,
    updated_at: UPDATED,
  };
  fake.tables.knowledge_items.push(row);
  return row;
}

function seedTag(
  fake: FakeWorkspaceClient,
  projectId: string,
  riskId: string,
  name: string,
  slug: string,
  origin: "predefined" | "custom" = "custom",
) {
  fake.tables.project_tags.push({
    id: TAG_ID,
    workspace_id: fake.workspaceId,
    project_id: projectId,
    name,
    slug,
    origin,
  });
  fake.tables.item_tags.push({
    id: LINK_ID,
    workspace_id: fake.workspaceId,
    project_id: projectId,
    tag_id: TAG_ID,
    target_kind: "risk",
    target_id: riskId,
  });
}

async function reload(fake: FakeWorkspaceClient): Promise<MissionState> {
  const loaded = await loadMissionStateFromSupabase(asClient(fake));
  return loaded.state;
}

function riskRow(fake: FakeWorkspaceClient, riskId: string) {
  const row = fake.tables.risks.find((item) => item.id === riskId);
  assert.ok(row);
  return row;
}

function slugsFor(fake: FakeWorkspaceClient, riskId: string) {
  return fake.tables.item_tags
    .filter((row) => row.target_kind === "risk" && row.target_id === riskId)
    .map((row) =>
      fake.tables.project_tags.find((tag) => tag.id === row.tag_id)?.slug,
    )
    .filter((slug): slug is string => typeof slug === "string")
    .sort();
}

function currentFacts(block: string): string {
  const start = block.indexOf("CURRENT FACTS:");
  const end = block.indexOf("RISKS (domain lifecycle):");
  assert.ok(start >= 0 && end > start);
  return block.slice(start, end);
}

async function edit(
  fake: FakeWorkspaceClient,
  input: {
    projectId?: string;
    riskId?: string;
    title?: string;
    notes?: string | null;
    tagNames?: string[];
  },
) {
  return persistRiskEdit(asClient(fake), fake.workspaceId, fake.userId, {
    projectId: input.projectId ?? PROJECT,
    riskId: input.riskId ?? RISK_A,
    title: input.title ?? OLD_TITLE,
    notes: input.notes ?? null,
    tagNames: input.tagNames ?? [],
  });
}

async function main() {
  await check("migration is one invoker transaction and does not rewrite knowledge", () => {
    const sql = read("supabase/migrations/20260929140000_save_risk_edit.sql");
    assert.match(sql, /create or replace function public\.save_risk_edit/);
    assert.match(sql, /security invoker/i);
    assert.doesNotMatch(sql, /security definer/i);
    assert.match(sql, /for update/);
    assert.match(sql, /is_workspace_member/);
    assert.match(sql, /project is not in this workspace/);
    assert.match(sql, /issue is not in this project/);
    assert.match(sql, /issue title is blank/);
    assert.match(sql, /tag name is not display-canonical/);
    assert.match(sql, /on conflict \(project_id, slug\) do nothing/);
    assert.match(sql, /Issue title updated/);
    assert.match(sql, /Previous title:/);
    assert.match(sql, /Current title:/);
    assert.match(sql, /Issue notes added/);
    assert.match(sql, /Issue notes updated/);
    assert.match(sql, /Issue notes cleared/);
    assert.match(sql, /char_length\(v_word\) <= 4/);
    assert.match(sql, /grant execute on function public\.save_risk_edit/);
    assert.doesNotMatch(sql, /knowledge_items/);
    assert.doesNotMatch(sql, /delete from public\.project_tags/i);
    assert.doesNotMatch(sql, /add column/i);
    assert.doesNotMatch(sql, /references public\.knowledge/i);
    const executable = sql.replace(/--[^\n]*/g, "");
    assert.doesNotMatch(executable, /drop table|truncate/i);
  });

  await check("old projects without this mutation still load", async () => {
    const fake = new FakeWorkspaceClient();
    seedRisk(fake, PROJECT, RISK_A);
    fake.tables.history_events.push({
      id: "77777777-7777-4777-8777-777777777777",
      workspace_id: fake.workspaceId,
      project_id: PROJECT,
      type: "other",
      title: OLD_TITLE,
      detail: "older untargeted row",
      source: "user",
      created_at: "2026-01-02T00:00:00.000Z",
    });
    const state = await reload(fake);
    const risk = state.risks?.find((row) => row.id === RISK_A);
    assert.equal(risk?.title, OLD_TITLE);
    assert.equal(risk?.notes ?? null, null);
    const readHistory = historyEventsForItem(state, PROJECT, {
      kind: "risk",
      riskId: RISK_A,
    });
    assert.equal(readHistory.events.length, 0);
    assert.equal(readHistory.limitation, "D-004");
  });

  await check("title-only save persists and reloads with targeted history", async () => {
    const fake = new FakeWorkspaceClient();
    seedRisk(fake, PROJECT, RISK_A, OLD_TITLE, NOTES);
    seedLegacy(fake);
    const knowledgeBefore = JSON.stringify(fake.tables.knowledge_items);
    const saved = await edit(fake, { title: `  ${NEW_TITLE}  `, notes: NOTES });
    assert.equal(saved.ok, true);
    assert.equal(saved.titleChanged, true);
    assert.equal(saved.notesChanged, false);
    assert.equal(saved.tagsChanged, false);
    assert.equal(saved.history?.length, 1);
    assert.equal(saved.history?.[0]?.title, "Issue title updated");
    assert.match(saved.history?.[0]?.detail ?? "", /Previous title:\nShared issue title/);
    assert.match(saved.history?.[0]?.detail ?? "", /Current title:\nRenamed issue/);
    const row = riskRow(fake, RISK_A);
    assert.equal(row.title, NEW_TITLE);
    assert.equal(row.notes, NOTES);
    assert.equal(row.status, "open");
    assert.notEqual(row.updated_at, UPDATED);
    assert.equal(JSON.stringify(fake.tables.knowledge_items), knowledgeBefore);
    const state = await reload(fake);
    assert.equal(state.risks?.find((risk) => risk.id === RISK_A)?.title, NEW_TITLE);
    const history = historyEventsForItem(state, PROJECT, {
      kind: "risk",
      riskId: RISK_A,
    });
    assert.equal(history.events.length, 1);
    assert.equal(history.events[0]?.targetKind, "risk");
    assert.equal(history.events[0]?.targetId, RISK_A);
    assert.equal(history.events[0]?.title, "Issue title updated");
  });

  await check("notes-only save keeps add, update, and clear evidence", async () => {
    const fake = new FakeWorkspaceClient();
    seedRisk(fake, PROJECT, RISK_A);
    const added = await edit(fake, { notes: `  ${NOTES}  ` });
    assert.equal(added.ok, true);
    assert.equal(added.notesChanged, true);
    assert.equal(added.titleChanged, false);
    assert.equal(added.history?.[0]?.title, "Issue notes added");
    assert.match(added.history?.[0]?.detail ?? "", /Current notes:\nsupplementary mould note/);
    assert.equal(riskRow(fake, RISK_A).title, OLD_TITLE);
    const updated = await edit(fake, { notes: "updated note" });
    assert.equal(updated.history?.[0]?.title, "Issue notes updated");
    assert.match(updated.history?.[0]?.detail ?? "", /Previous notes:\nsupplementary mould note/);
    assert.match(updated.history?.[0]?.detail ?? "", /Current notes:\nupdated note/);
    const cleared = await edit(fake, { notes: "   " });
    assert.equal(cleared.history?.[0]?.title, "Issue notes cleared");
    assert.match(cleared.history?.[0]?.detail ?? "", /Previous notes:\nupdated note/);
    assert.match(cleared.history?.[0]?.detail ?? "", /Current notes:\n$/);
    assert.equal(riskRow(fake, RISK_A).notes, null);
    const state = await reload(fake);
    assert.equal(state.risks?.find((risk) => risk.id === RISK_A)?.notes ?? null, null);
    const titles = historyEventsForItem(state, PROJECT, {
      kind: "risk",
      riskId: RISK_A,
    }).events.map((event) => event.title);
    assert.deepEqual(titles.sort(), [
      "Issue notes added",
      "Issue notes cleared",
      "Issue notes updated",
    ]);
  });

  await check("title and notes in one save record both before and after", async () => {
    const fake = new FakeWorkspaceClient();
    seedRisk(fake, PROJECT, RISK_A, OLD_TITLE, "first");
    const saved = await edit(fake, { title: NEW_TITLE, notes: "second" });
    assert.equal(saved.ok, true);
    assert.equal(saved.titleChanged, true);
    assert.equal(saved.notesChanged, true);
    assert.equal(saved.history?.length, 2);
    const titles = (saved.history ?? []).map((event) => event.title).sort();
    assert.deepEqual(titles, ["Issue notes updated", "Issue title updated"]);
    const notesEvent = saved.history?.find((event) => event.title === "Issue notes updated");
    assert.match(notesEvent?.detail ?? "", /Previous notes:\nfirst/);
    assert.match(notesEvent?.detail ?? "", /Current notes:\nsecond/);
    const state = await reload(fake);
    const risk = state.risks?.find((row) => row.id === RISK_A);
    assert.equal(risk?.title, NEW_TITLE);
    assert.equal(risk?.notes, "second");
    assert.equal(
      historyEventsForItem(state, PROJECT, { kind: "risk", riskId: RISK_A }).events.length,
      2,
    );
  });

  await check("tags-only save changes metadata and not canonical history", async () => {
    const fake = new FakeWorkspaceClient();
    seedRisk(fake, PROJECT, RISK_A, OLD_TITLE, NOTES);
    seedTag(fake, PROJECT, RISK_A, "Vendor", "vendor", "predefined");
    const saved = await edit(fake, {
      notes: NOTES,
      tagNames: ["Cab"],
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.changed, true);
    assert.equal(saved.tagsChanged, true);
    assert.equal(saved.titleChanged, false);
    assert.equal(saved.notesChanged, false);
    assert.deepEqual(saved.history ?? [], []);
    const row = riskRow(fake, RISK_A);
    assert.equal(row.title, OLD_TITLE);
    assert.equal(row.notes, NOTES);
    assert.equal(row.updated_at, UPDATED);
    assert.equal(row.status, "open");
    assert.deepEqual(slugsFor(fake, RISK_A), ["cab"]);
    assert.equal(
      fake.tables.project_tags.filter((tag) => tag.slug === "vendor").length,
      1,
    );
    assert.equal(fake.tables.history_events.length, 0);
    const state = await reload(fake);
    assert.equal(
      historyEventsForItem(state, PROJECT, { kind: "risk", riskId: RISK_A }).events.length,
      0,
    );
    assert.equal(state.projectTags?.some((tag) => tag.slug === "vendor"), true);
    assert.equal(state.projectTags?.some((tag) => tag.slug === "cab"), true);
  });

  await check("mixed title, notes, and tags succeed atomically", async () => {
    const fake = new FakeWorkspaceClient();
    seedRisk(fake, PROJECT, RISK_A, OLD_TITLE, "first");
    seedTag(fake, PROJECT, RISK_A, "Vendor", "vendor");
    const saved = await edit(fake, {
      title: NEW_TITLE,
      notes: "second",
      tagNames: ["Vendor", "Cab"],
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.titleChanged, true);
    assert.equal(saved.notesChanged, true);
    assert.equal(saved.tagsChanged, true);
    assert.equal(saved.history?.some((event) => event.title.includes("tag")), false);
    assert.equal(saved.tags?.some((tag) => tag.id === TAG_ID && tag.slug === "vendor"), true);
    assert.equal(saved.tags?.some((tag) => tag.slug === "cab" && tag.id !== TAG_ID), true);
    const state = await reload(fake);
    const risk = state.risks?.find((row) => row.id === RISK_A);
    assert.equal(risk?.title, NEW_TITLE);
    assert.equal(risk?.notes, "second");
    assert.equal(risk?.status, "open");
    const attached = (state.itemTags ?? []).filter((row) => row.targetId === RISK_A);
    assert.equal(attached.length, 2);
    assert.equal(
      historyEventsForItem(state, PROJECT, { kind: "risk", riskId: RISK_A }).events.length,
      2,
    );
  });

  await check("a tag failure after the write begins rolls the save back", async () => {
    const fake = new FakeWorkspaceClient();
    seedRisk(fake, PROJECT, RISK_A, OLD_TITLE, NOTES);
    seedTag(fake, PROJECT, RISK_A, "Vendor", "vendor");
    fake.tables.history_events.push({
      id: "77777777-7777-4777-8777-777777777777",
      workspace_id: fake.workspaceId,
      project_id: PROJECT,
      type: "other",
      title: "Earlier",
      detail: "keep",
      source: "user",
      created_at: UPDATED,
      target_kind: "risk",
      target_id: RISK_A,
    });
    const before = {
      risks: JSON.stringify(fake.tables.risks),
      tags: JSON.stringify(fake.tables.project_tags),
      links: JSON.stringify(fake.tables.item_tags),
      history: JSON.stringify(fake.tables.history_events),
    };
    fake.armFailOnTable("item_tags");
    const saved = await edit(fake, {
      title: NEW_TITLE,
      notes: "changed",
      tagNames: ["Brand New"],
    });
    assert.equal(saved.ok, false);
    assert.match(saved.error ?? "", /item_tags/);
    assert.equal(JSON.stringify(fake.tables.risks), before.risks);
    assert.equal(JSON.stringify(fake.tables.project_tags), before.tags);
    assert.equal(JSON.stringify(fake.tables.item_tags), before.links);
    assert.equal(JSON.stringify(fake.tables.history_events), before.history);
    assert.equal(
      fake.tables.project_tags.some((tag) => tag.slug === "brand new"),
      false,
    );
  });

  await check("a history insert failure leaves title and notes unchanged", async () => {
    const fake = new FakeWorkspaceClient();
    seedRisk(fake, PROJECT, RISK_A, OLD_TITLE, NOTES);
    fake.armFailOnTable("history_events");
    const saved = await edit(fake, { title: NEW_TITLE, notes: "changed" });
    assert.equal(saved.ok, false);
    assert.match(saved.error ?? "", /history_events/);
    const row = riskRow(fake, RISK_A);
    assert.equal(row.title, OLD_TITLE);
    assert.equal(row.notes, NOTES);
    assert.equal(row.updated_at, UPDATED);
    assert.equal(fake.tables.history_events.length, 0);
  });

  await check("a no-op writes nothing", async () => {
    const fake = new FakeWorkspaceClient();
    seedRisk(fake, PROJECT, RISK_A, OLD_TITLE, NOTES);
    seedTag(fake, PROJECT, RISK_A, "Vendor", "vendor");
    const before = JSON.stringify({
      risks: fake.tables.risks,
      tags: fake.tables.project_tags,
      links: fake.tables.item_tags,
      history: fake.tables.history_events,
    });
    const saved = await edit(fake, {
      title: `  ${OLD_TITLE}  `,
      notes: `  ${NOTES}  `,
      tagNames: [" vendor "],
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.changed, false);
    assert.deepEqual(saved.history ?? [], []);
    const after = JSON.stringify({
      risks: fake.tables.risks,
      tags: fake.tables.project_tags,
      links: fake.tables.item_tags,
      history: fake.tables.history_events,
    });
    assert.equal(after, before);
  });

  await check("duplicate tag text converges and existing tags are reused", async () => {
    const fake = new FakeWorkspaceClient();
    seedRisk(fake, PROJECT, RISK_A);
    seedTag(fake, PROJECT, RISK_A, "Vendor", "vendor", "predefined");
    const saved = await edit(fake, {
      tagNames: ["  vendor delay ", "Vendor   Delay", "VENDOR DELAY", " vendor "],
    });
    assert.equal(saved.ok, true);
    assert.deepEqual(slugsFor(fake, RISK_A), ["vendor", "vendor delay"]);
    assert.equal(fake.tables.project_tags.filter((tag) => tag.slug === "vendor").length, 1);
    assert.equal(
      fake.tables.project_tags.find((tag) => tag.slug === "vendor")?.id,
      TAG_ID,
    );
    assert.equal(
      fake.tables.project_tags.find((tag) => tag.slug === "vendor")?.origin,
      "predefined",
    );
    assert.equal(fake.tables.project_tags.filter((tag) => tag.slug === "vendor delay").length, 1);
    assert.equal(tagDisplayName("  vendor delay "), "Vendor Delay");
    assert.equal(tagSlug("Vendor Delay"), "vendor delay");
  });

  await check("malformed tags are rejected and do not write", async () => {
    const fake = new FakeWorkspaceClient();
    seedRisk(fake, PROJECT, RISK_A, OLD_TITLE, NOTES);
    const before = JSON.stringify(fake.tables.risks);
    const bad = await fake.rpc("save_risk_edit", {
      p_workspace_id: fake.workspaceId,
      p_project_id: PROJECT,
      p_risk_id: RISK_A,
      p_title: NEW_TITLE,
      p_notes: NOTES,
      p_tags: [{ name: "  vendor ", slug: "vendor" }],
      p_created_by: fake.userId,
    });
    assert.ok(bad.error);
    assert.match(bad.error?.message ?? "", /display-canonical/);
    assert.equal(JSON.stringify(fake.tables.risks), before);
    const blank = await edit(fake, { title: "   " });
    assert.equal(blank.ok, false);
    assert.match(blank.error ?? "", /issue title is blank/);
    assert.equal(riskRow(fake, RISK_A).title, OLD_TITLE);
  });

  await check("same titles stay independent and foreign risks fail closed", async () => {
    const fake = new FakeWorkspaceClient();
    seedRisk(fake, PROJECT, RISK_A, OLD_TITLE);
    seedRisk(fake, PROJECT, RISK_B, OLD_TITLE);
    seedRisk(fake, OTHER, RISK_A, OLD_TITLE);
    const saved = await edit(fake, { riskId: RISK_B, title: NEW_TITLE });
    assert.equal(saved.ok, true);
    assert.equal(riskRow(fake, RISK_A).title, OLD_TITLE);
    assert.equal(
      fake.tables.risks.find((row) => row.id === RISK_B && row.project_id === PROJECT)?.title,
      NEW_TITLE,
    );
    const wrongProject = await edit(fake, {
      projectId: OTHER,
      riskId: RISK_B,
      title: "Should not land",
    });
    assert.equal(wrongProject.ok, false);
    assert.match(wrongProject.error ?? "", /issue is not in this project/);
    assert.equal(
      fake.tables.risks.find((row) => row.id === RISK_B)?.title,
      NEW_TITLE,
    );
    const foreignWorkspace = await fake.rpc("save_risk_edit", {
      p_workspace_id: FOREIGN_WS,
      p_project_id: PROJECT,
      p_risk_id: RISK_A,
      p_title: "Foreign",
      p_notes: null,
      p_tags: [],
      p_created_by: fake.userId,
    });
    assert.match(foreignWorkspace.error?.message ?? "", /not a workspace member/);
    assert.equal(riskRow(fake, RISK_A).title, OLD_TITLE);
  });

  await check("title edit leaves legacy prose and current readers use the new title", async () => {
    const fake = new FakeWorkspaceClient();
    seedRisk(fake, PROJECT, RISK_A, OLD_TITLE, NOTES);
    seedLegacy(fake, LEGACY);
    fake.tables.knowledge_items.push({
      id: "88888888-8888-4888-8888-888888888889",
      workspace_id: fake.workspaceId,
      project_id: PROJECT,
      section: "decisions",
      body: "Keep the Friday CAB.",
      kind: "fact",
      lifecycle: "current",
      created_at: UPDATED,
      updated_at: UPDATED,
    });
    const knowledgeBefore = JSON.stringify(fake.tables.knowledge_items);
    const saved = await edit(fake, { title: NEW_TITLE, notes: NOTES });
    assert.equal(saved.ok, true);
    assert.equal(JSON.stringify(fake.tables.knowledge_items), knowledgeBefore);
    const state = await reload(fake);
    const rows = buildOpenRiskRows(state, PROJECT);
    assert.deepEqual(rows.map((row) => row.title), [NEW_TITLE]);
    const bundle = serializeCanonicalTruth({
      state,
      projectId: PROJECT,
      question: "What are the current issues?",
    });
    const facts = currentFacts(bundle.promptBlock);
    assert.doesNotMatch(facts, /Shared issue title/);
    assert.match(bundle.promptBlock, /Renamed issue/);
    assert.match(facts, /Keep the Friday CAB/);
    const ctx = buildCaptureContext({
      projectId: PROJECT,
      captureText: NEW_TITLE,
      state,
    });
    assert.equal(
      ctx.knowledge.some((row) => row.type === "knowledge:risks"),
      false,
    );
    assert.equal(ctx.risks.some((row) => row.title === NEW_TITLE), true);
    assert.equal(ctx.risks.some((row) => row.title === OLD_TITLE), false);
  });

  await check("local edit is one transition and matches the durable contract", () => {
    const state = emptyMissionState();
    state.projects = [
      {
        id: PROJECT,
        name: "Old project",
        code: "OLD",
        summary: "",
        status: "healthy",
        currentFocus: "",
        stakeholders: [],
      },
      {
        id: OTHER,
        name: "Other",
        code: "OTH",
        summary: "",
        status: "healthy",
        currentFocus: "",
        stakeholders: [],
      },
    ];
    const knowledge = emptyKnowledge(PROJECT);
    knowledge.sections.risks = [LEGACY];
    state.knowledge = [knowledge];
    const knowledgeBefore = JSON.stringify(state.knowledge);
    state.risks = [
      {
        id: RISK_A,
        projectId: PROJECT,
        title: OLD_TITLE,
        status: "open",
        notes: NOTES,
        updatedAt: UPDATED,
      },
      {
        id: RISK_B,
        projectId: PROJECT,
        title: OLD_TITLE,
        status: "watch",
        updatedAt: UPDATED,
      },
    ];
    state.projectTags = [
      {
        id: TAG_ID,
        projectId: PROJECT,
        name: "Vendor",
        slug: "vendor",
        origin: "predefined",
      },
    ];
    state.itemTags = [
      {
        id: LINK_ID,
        projectId: PROJECT,
        tagId: TAG_ID,
        targetKind: "risk",
        targetId: RISK_A,
      },
    ];
    const before = JSON.stringify(state);
    const blank = applyRiskEditLocal(state, {
      projectId: PROJECT,
      riskId: RISK_A,
      title: "   ",
      notes: "nope",
      tagNames: ["New"],
    });
    assert.equal(blank.ok, false);
    assert.equal(JSON.stringify(state), before);
    const missing = applyRiskEditLocal(state, {
      projectId: OTHER,
      riskId: RISK_A,
      title: NEW_TITLE,
      notes: NOTES,
      tagNames: [],
    });
    assert.equal(missing.ok, false);
    assert.match(missing.ok ? "" : missing.error, /issue is not in this project/);
    const noop = applyRiskEditLocal(state, {
      projectId: PROJECT,
      riskId: RISK_A,
      title: ` ${OLD_TITLE} `,
      notes: NOTES,
      tagNames: ["VENDOR"],
    });
    assert.equal(noop.ok, true);
    if (noop.ok) {
      assert.equal(noop.changed, false);
      assert.equal(noop.state, state);
    }
    const saved = applyRiskEditLocal(state, {
      projectId: PROJECT,
      riskId: RISK_A,
      title: NEW_TITLE,
      notes: null,
      tagNames: [" vendor ", "  cab delay "],
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(saved.result.titleChanged, true);
    assert.equal(saved.result.notesChanged, true);
    assert.equal(saved.result.tagsChanged, true);
    assert.equal(saved.result.history?.map((event) => event.title).sort().join("|"), "Issue notes cleared|Issue title updated");
    const nextA = saved.state.risks?.find((row) => row.id === RISK_A);
    const nextB = saved.state.risks?.find((row) => row.id === RISK_B);
    assert.equal(nextA?.title, NEW_TITLE);
    assert.equal(nextA?.notes ?? null, null);
    assert.equal(nextA?.status, "open");
    assert.notEqual(nextA?.updatedAt, UPDATED);
    assert.equal(nextB?.title, OLD_TITLE);
    assert.equal(nextB?.status, "watch");
    assert.equal(nextB?.updatedAt, UPDATED);
    assert.equal(JSON.stringify(saved.state.knowledge), knowledgeBefore);
    const tagSlugs = (saved.state.itemTags ?? [])
      .filter((row) => row.targetId === RISK_A)
      .map((row) => saved.state.projectTags?.find((tag) => tag.id === row.tagId)?.slug)
      .sort();
    assert.deepEqual(tagSlugs, ["cab delay", "vendor"]);
    assert.equal(
      saved.state.projectTags?.filter((tag) => tag.slug === "vendor").length,
      1,
    );
    const tagsOnly = applyRiskEditLocal(saved.state, {
      projectId: PROJECT,
      riskId: RISK_A,
      title: NEW_TITLE,
      notes: null,
      tagNames: ["Cab Delay"],
    });
    assert.equal(tagsOnly.ok, true);
    if (!tagsOnly.ok) return;
    assert.equal(tagsOnly.result.tagsChanged, true);
    assert.equal(tagsOnly.result.titleChanged, false);
    assert.deepEqual(tagsOnly.result.history ?? [], []);
    assert.equal(
      tagsOnly.state.risks?.find((row) => row.id === RISK_A)?.updatedAt,
      nextA?.updatedAt,
    );
    assert.equal(
      tagsOnly.state.projectTags?.some((tag) => tag.slug === "vendor"),
      true,
    );
  });

  await check("the editor mounts on one saveRiskEdit call and the store does not compose three writes", () => {
    const store = read("src/lib/store.tsx");
    const fn = store.slice(
      store.indexOf("const saveRiskEdit"),
      store.indexOf("const setKnowledgeOnlyRiskResolved"),
    );
    assert.match(fn, /persistRiskEdit/);
    assert.match(fn, /applyRiskEditLocal/);
    assert.doesNotMatch(fn, /setRiskNotes|saveItemTags|persistRiskNotes/);
    assert.doesNotMatch(store, /setRiskTitle|persistRiskTitle/);
    const view = read("src/components/knowledge-centre/IssueDetailView.tsx");
    assert.match(view, />\s*Edit issue\s*</);
    assert.doesNotMatch(view, /Save changes|<textarea|Discard|saveRiskEdit/);
    const edit = read("src/components/knowledge-centre/IssueEditView.tsx");
    assert.match(edit, /Save changes/);
    assert.doesNotMatch(edit, /saveRiskEdit|saveItemTags|setRiskNotes|persistEnsureProjectTag/);
    const drawer = read("src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx");
    const saveFn = drawer.slice(
      drawer.indexOf("async function saveIssueEdit"),
      drawer.indexOf("function goBack"),
    );
    assert.equal((saveFn.match(/saveRiskEdit\(/g) ?? []).length, 1);
    assert.doesNotMatch(saveFn, /setRiskNotes|saveItemTags|persistEnsureProjectTag|updateKnowledgeSection/);
    assert.match(drawer, /finishIssueSave\(current, saved\)/);
    assert.doesNotMatch(drawer, /setRiskTitle|persistRiskTitle|set_risk_notes/);
  });

  console.log("verify-issue-edit: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
