/**
 * Manual Add must not drop text the form offers.
 * Issue Detail is canonical Notes. Knowledge is one body.
 *
 * Run: npm run verify:manual-add-honesty
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadMissionStateFromSupabase } from "../src/lib/data/supabase/load-mission-state";
import {
  persistKnowledgeBullet,
  persistRiskCreate,
} from "../src/lib/data/supabase/persist-mutations";
import {
  refForRisk,
  resolveKnowledgeItemDetail,
} from "../src/lib/knowledge-centre/knowledge-item-detail";
import { canonicalRiskNotes } from "../src/lib/risks/issue-notes";
import { FakeWorkspaceClient } from "./lib/fake-supabase-workspace";

const ROOT = join(import.meta.dirname, "..");
const PROJECT = "11111111-1111-4111-8111-111111111111";
const ISSUE_TITLE = "Audit issue detail persists";
const ISSUE_NOTES = "This issue note must persist";
const KNOWLEDGE_BODY = "This knowledge detail must persist";
const KNOWLEDGE_ID = "66666666-6666-4666-8666-666666666666";

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

function seedProject(fake: FakeWorkspaceClient) {
  fake.seedProject({
    id: PROJECT,
    workspace_id: fake.workspaceId,
    name: "Candyland",
    code: "CANDY",
    summary: "",
    status: "healthy",
    kind: "delivery",
    current_focus: "",
  });
}

async function main() {
  await check("Issue create stores canonical Notes and reload returns them", async () => {
    const fake = new FakeWorkspaceClient();
    seedProject(fake);
    const beforeHistory = fake.tables.history_events.length;
    const created = await persistRiskCreate(
      asClient(fake),
      fake.workspaceId,
      fake.userId,
      {
        projectId: PROJECT,
        title: `  ${ISSUE_TITLE}  `,
        source: "manual",
        notes: `  ${ISSUE_NOTES}  `,
      },
    );
    assert.equal(created.title, ISSUE_TITLE);
    assert.equal(created.notes, ISSUE_NOTES);
    const row = fake.tables.risks.find((risk) => risk.id === created.id);
    assert.ok(row);
    assert.equal(row.notes, ISSUE_NOTES);
    assert.equal(fake.tables.history_events.length, beforeHistory);

    const loaded = await loadMissionStateFromSupabase(asClient(fake));
    const risk = loaded.state.risks?.find((item) => item.id === created.id);
    assert.equal(risk?.title, ISSUE_TITLE);
    assert.equal(risk?.notes, ISSUE_NOTES);
    const detail = resolveKnowledgeItemDetail(
      loaded.state,
      PROJECT,
      refForRisk(created.id),
    );
    assert.equal(detail?.issueNotes, ISSUE_NOTES);
    assert.equal(detail?.body, ISSUE_TITLE);
  });

  await check("blank Notes are absent and omitted Notes stay optional", async () => {
    const fake = new FakeWorkspaceClient();
    seedProject(fake);
    const blank = await persistRiskCreate(
      asClient(fake),
      fake.workspaceId,
      fake.userId,
      {
        projectId: PROJECT,
        title: "Blank notes",
        source: "manual",
        notes: "   ",
      },
    );
    assert.equal(blank.notes, null);
    assert.equal(canonicalRiskNotes("   "), null);
    const blankRow = fake.tables.risks.find((risk) => risk.id === blank.id);
    assert.ok(blankRow);
    assert.equal("notes" in blankRow, false);

    const omitted = await persistRiskCreate(
      asClient(fake),
      fake.workspaceId,
      fake.userId,
      {
        projectId: PROJECT,
        title: "Omitted notes",
        source: "manual",
      },
    );
    assert.equal(omitted.notes, null);
    const omittedRow = fake.tables.risks.find((risk) => risk.id === omitted.id);
    assert.ok(omittedRow);
    assert.equal("notes" in omittedRow, false);
  });

  await check("Knowledge Manual Add persists one body and reload keeps it", async () => {
    const fake = new FakeWorkspaceClient();
    seedProject(fake);
    await persistKnowledgeBullet(
      asClient(fake),
      fake.workspaceId,
      PROJECT,
      "now",
      KNOWLEDGE_BODY,
      fake.userId,
      { id: KNOWLEDGE_ID, kind: "fact" },
    );
    const loaded = await loadMissionStateFromSupabase(asClient(fake));
    const knowledge = loaded.state.knowledge?.find((item) => item.projectId === PROJECT);
    assert.ok(knowledge);
    assert.deepEqual(
      knowledge.sections.now.filter((body) => body === KNOWLEDGE_BODY),
      [KNOWLEDGE_BODY],
    );
    const structured = (knowledge.structured ?? []).filter(
      (item) => item.body === KNOWLEDGE_BODY,
    );
    assert.equal(structured.length, 1);
    assert.equal(structured[0]?.body, KNOWLEDGE_BODY);
  });

  await check("form and footer copy match the save contract", () => {
    const drawer = read("src/components/knowledge-centre/AddItemDrawer.tsx");
    assert.match(drawer, /ocean-add-knowledge-body/);
    assert.match(drawer, /type === "knowledge"/);
    assert.doesNotMatch(drawer, /title \+ detail|`\$\{title\}.*\$\{detail\}`/);
    const detail = read("src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx");
    assert.doesNotMatch(detail, /Close keeps the item and its history/);
    const ask = read("src/components/knowledge-centre/KnowledgeSearchAskBar.tsx");
    assert.match(ask, /Lume noticed/);
    assert.match(ask, /<MeMark size="micro" \/>/);
    assert.doesNotMatch(ask, /✦/);
    const todo = read("src/components/knowledge-centre/TodoDetailView.tsx");
    assert.match(todo, /Close completes this To Do and keeps the record/);
  });

  console.log("manual add honesty: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
