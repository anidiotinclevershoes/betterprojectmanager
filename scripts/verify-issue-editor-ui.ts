/**
 * Page 09 Issue editor is draft presentation over one saveRiskEdit.
 *
 * Run: npx tsx scripts/verify-issue-editor-ui.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCaptureContext } from "../src/lib/capture/context";
import { serializeCanonicalTruth } from "../src/lib/canonical-truth/serialize";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  beginIssueSave,
  canMountIssueEditor,
  changeIssueDraft,
  discardIssueEdit,
  finishIssueSave,
  idleIssueEditor,
  ISSUE_EDIT_BLANK_TITLE,
  ISSUE_EDIT_LOCK,
  requestIssueEditExit,
  retainIssueDraft,
  startIssueEdit,
} from "../src/lib/knowledge-centre/issue-editor-state";
import { buildOpenRiskRows } from "../src/lib/knowledge-centre/ocean-frames";
import { applyRiskEditLocal } from "../src/lib/risks/issue-edit";
import type { MissionState } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const PROJECT = "11111111-1111-4111-8111-111111111111";
const RISK = "33333333-3333-4333-8333-333333333333";
const TITLE = "Vendor delay on the bridge";
const NOTES = "Wet-store mould is supplementary context.";
const LEFTOVER = "Vendor delay on the bridge remains open in the old notes.";
const NEW_TITLE = "Vendor data feed is two weeks late";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

function currentFacts(prompt: string): string {
  const start = prompt.indexOf("CURRENT FACTS:");
  const end = prompt.indexOf("RISKS (domain lifecycle):");
  return prompt.slice(start, end);
}

function seeded(): MissionState {
  const state = emptyMissionState();
  state.projects = [
    {
      id: PROJECT,
      name: "Bridge",
      code: "BRG",
      summary: "",
      status: "healthy",
      currentFocus: "",
      stakeholders: [],
    },
  ];
  const knowledge = emptyKnowledge(PROJECT);
  knowledge.sections.risks = [LEFTOVER];
  knowledge.sections.decisions = ["Keep the Friday CAB."];
  state.knowledge = [knowledge];
  state.risks = [
    {
      id: RISK,
      projectId: PROJECT,
      title: TITLE,
      status: "open",
      notes: NOTES,
      createdAt: "2026-09-15T14:05:00.000Z",
      updatedAt: "2026-09-15T14:05:00.000Z",
    },
  ];
  state.projectTags = [
    {
      id: "tag-vendor",
      projectId: PROJECT,
      name: "Vendor",
      slug: "vendor",
      origin: "custom",
    },
  ];
  state.itemTags = [
    {
      id: "link-vendor",
      projectId: PROJECT,
      tagId: "tag-vendor",
      targetKind: "risk",
      targetId: RISK,
    },
  ];
  return state;
}

check("edit mounts for open and watch, not resolved or accepted", () => {
  assert.equal(canMountIssueEditor("open"), true);
  assert.equal(canMountIssueEditor("watch"), true);
  assert.equal(canMountIssueEditor("resolved"), false);
  assert.equal(canMountIssueEditor("accepted"), false);
  const view = read("src/components/knowledge-centre/IssueDetailView.tsx");
  assert.match(view, /action === "resolve" && onEdit/);
  assert.match(view, />\s*Edit issue\s*</);
  assert.match(view, /Reopen issue/);
  assert.doesNotMatch(view, /<textarea|Save changes|TYPE|WAITING ON|Saved source/);
});

check("entering edit preloads canonical title, notes, and tags", () => {
  const started = startIssueEdit(idleIssueEditor(), {
    riskId: RISK,
    title: TITLE,
    notes: NOTES,
    tagNames: ["Vendor"],
  });
  assert.equal(started.active, true);
  assert.equal(started.riskId, RISK);
  assert.equal(started.draft?.title, TITLE);
  assert.equal(started.draft?.notes, NOTES);
  assert.deepEqual(started.draft?.tagNames, ["Vendor"]);
  const emptyNotes = startIssueEdit(idleIssueEditor(), {
    riskId: RISK,
    title: TITLE,
    notes: null,
    tagNames: [],
  });
  assert.equal(emptyNotes.draft?.notes, "");
});

check("draft edits and new tags do not imply a write", () => {
  const started = startIssueEdit(idleIssueEditor(), {
    riskId: RISK,
    title: TITLE,
    notes: NOTES,
    tagNames: ["Vendor"],
  });
  const drafted = changeIssueDraft(started, {
    title: NEW_TITLE,
    notes: "Supplier data is late.",
    tagNames: ["Vendor", "Launch"],
  });
  assert.equal(drafted.draft?.title, NEW_TITLE);
  assert.deepEqual(drafted.draft?.tagNames, ["Vendor", "Launch"]);
  assert.equal(retainIssueDraft(drafted), drafted);
  const editor = read("src/components/knowledge-centre/IssueEditView.tsx");
  assert.doesNotMatch(
    editor,
    /saveRiskEdit|saveItemTags|persistEnsureProjectTag|setRiskNotes|updateKnowledgeSection/,
  );
  assert.match(
    read("src/components/knowledge-centre/ItemTagsEditor.tsx"),
    /New tags are created and attached only when you Save changes/,
  );
  assert.match(read("src/components/knowledge-centre/ItemTagsEditor.tsx"), /showKindLabel = false/);
});

check("blank title is rejected before a save intent", () => {
  const started = startIssueEdit(idleIssueEditor(), {
    riskId: RISK,
    title: TITLE,
    notes: NOTES,
    tagNames: ["Vendor"],
  });
  const blank = changeIssueDraft(started, { title: "   " });
  const begun = beginIssueSave(blank, true);
  assert.equal(begun.intent.ok, false);
  if (begun.intent.ok) return;
  assert.equal(begun.intent.reason, "blank-title");
  assert.equal(begun.state.error, ISSUE_EDIT_BLANK_TITLE);
  assert.equal(begun.state.active, true);
  assert.equal(begun.state.draft?.notes, NOTES);
  assert.deepEqual(begun.state.draft?.tagNames, ["Vendor"]);
  assert.equal(begun.state.saving, false);
});

check("a failed save keeps the draft and stays in edit", () => {
  const started = startIssueEdit(idleIssueEditor(), {
    riskId: RISK,
    title: TITLE,
    notes: NOTES,
    tagNames: ["Vendor"],
  });
  const drafted = changeIssueDraft(started, {
    title: NEW_TITLE,
    notes: "Still late.",
    tagNames: ["Vendor", "Launch"],
  });
  const begun = beginIssueSave(drafted, true);
  assert.equal(begun.intent.ok, true);
  const failed = finishIssueSave(begun.state, {
    ok: false,
    error: "issue is not in this project",
  });
  assert.equal(failed.active, true);
  assert.equal(failed.saving, false);
  assert.equal(failed.draft?.title, NEW_TITLE);
  assert.equal(failed.draft?.notes, "Still late.");
  assert.deepEqual(failed.draft?.tagNames, ["Vendor", "Launch"]);
  assert.match(failed.error ?? "", /issue is not in this project/);
  const busy = beginIssueSave({ ...failed, saving: true }, true);
  assert.equal(busy.intent.ok, false);
  if (!busy.intent.ok) assert.equal(busy.intent.reason, "busy");
  const changedWhileSaving = changeIssueDraft({ ...begun.state, saving: true }, {
    title: "raced",
  });
  assert.equal(changedWhileSaving.draft?.title, NEW_TITLE);
});

check("a missing issue fails closed and is not saved onto another record", () => {
  const started = startIssueEdit(idleIssueEditor(), {
    riskId: RISK,
    title: TITLE,
    notes: NOTES,
    tagNames: [],
  });
  const begun = beginIssueSave(started, false);
  assert.equal(begun.intent.ok, false);
  if (begun.intent.ok) return;
  assert.equal(begun.intent.reason, "missing-target");
  assert.equal(begun.state.active, true);
  assert.equal(begun.state.riskId, RISK);
});

check("discard restores the editor to detail without a write payload", () => {
  const started = startIssueEdit(idleIssueEditor(), {
    riskId: RISK,
    title: TITLE,
    notes: NOTES,
    tagNames: ["Vendor"],
  });
  const drafted = changeIssueDraft(started, { title: NEW_TITLE, tagNames: ["Launch"] });
  const discarded = discardIssueEdit(drafted);
  assert.equal(discarded.active, false);
  assert.equal(discarded.draft, null);
  assert.equal(discarded.riskId, null);
  const saving = discardIssueEdit({ ...drafted, saving: true });
  assert.equal(saving.active, true);
  assert.equal(saving.draft?.title, NEW_TITLE);
});

check("back, close, backdrop, and escape announce the lock and stay in edit", () => {
  const started = startIssueEdit(idleIssueEditor(), {
    riskId: RISK,
    title: TITLE,
    notes: NOTES,
    tagNames: ["Vendor"],
  });
  const locked = requestIssueEditExit(started);
  assert.equal(locked.active, true);
  assert.equal(locked.lockAnnounced, true);
  assert.equal(locked.draft?.title, TITLE);
  assert.ok(locked.announceTick > started.announceTick);
  const again = requestIssueEditExit(locked);
  assert.ok(again.announceTick > locked.announceTick);
  const whileSaving = requestIssueEditExit({ ...started, saving: true });
  assert.equal(whileSaving.lockAnnounced, false);
  assert.equal(whileSaving.saving, true);
  const edit = read("src/components/knowledge-centre/IssueEditView.tsx");
  const drawer = read("src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx");
  assert.match(edit, /ISSUE_EDIT_LOCK/);
  assert.match(
    read("src/lib/knowledge-centre/issue-editor-state.ts"),
    new RegExp(ISSUE_EDIT_LOCK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.match(edit, /onBlockedExit/);
  assert.match(drawer, /requestIssueEditExit/);
  assert.match(drawer, /if \(issueEditorRef\.current\.active\)/);
  assert.match(drawer, /holdIssueEditor\(\)/);
  assert.doesNotMatch(edit, /confirm\(/);
});

check("the editor omits stale Page 09 fields and keeps History read-only", () => {
  const edit = read("src/components/knowledge-centre/IssueEditView.tsx");
  assert.match(edit, /DomainBadge domain="issue" label="Issue"/);
  assert.match(edit, /Edit Issue/);
  assert.match(edit, /Changes must be saved to take effect/);
  assert.match(edit, /Discard restores the saved title, notes and tags\./);
  assert.match(edit, /historyEventsForItem|issueHistoryLine/);
  assert.match(edit, /ocean-item-history-limited/);
  assert.doesNotMatch(edit, /TYPE|DUE|WAITING ON|Saved source|Change status|<select/);
  assert.doesNotMatch(edit, />\s*Owner\s*</);
  assert.doesNotMatch(edit, /Saved/);
});

check("save calls saveRiskEdit once and does not compose the old writers", () => {
  const drawer = read("src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx");
  const saveFn = drawer.slice(
    drawer.indexOf("async function saveIssueEdit"),
    drawer.indexOf("function goBack"),
  );
  assert.equal((saveFn.match(/saveRiskEdit\(/g) ?? []).length, 1);
  assert.match(saveFn, /finishIssueSave\(current, saved\)/);
  assert.doesNotMatch(
    saveFn,
    /setRiskNotes|saveItemTags|persistEnsureProjectTag|setRiskStatus|updateKnowledgeSection|setRiskTitle/,
  );
  const detail = read("src/lib/knowledge-centre/knowledge-item-detail.ts");
  const riskBranch = detail.slice(
    detail.indexOf('if (ref.kind === "risk")'),
    detail.indexOf('if (ref.kind === "knowledge_risk")'),
  );
  assert.match(riskBranch, /canEditBody: false/);
  assert.match(drawer, /setKnowledgeOnlyRiskResolved/);
  assert.match(drawer, /ocean-item-detail-edit/);
  assert.match(drawer, /toggleTodo/);
  assert.match(drawer, /canConfirmOwner/);
});

check("a renamed Issue leaves legacy Knowledge prose stored and current reads follow the domain row", () => {
  const state = seeded();
  const knowledgeBefore = JSON.stringify(state.knowledge);
  const saved = applyRiskEditLocal(state, {
    projectId: PROJECT,
    riskId: RISK,
    title: NEW_TITLE,
    notes: "Supplier data is late.",
    tagNames: ["Vendor", "Launch"],
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(JSON.stringify(saved.state.knowledge), knowledgeBefore);
  assert.equal(
    saved.state.risks?.find((row) => row.id === RISK)?.title,
    NEW_TITLE,
  );
  assert.equal(saved.state.risks?.find((row) => row.id === RISK)?.status, "open");
  const rows = buildOpenRiskRows(saved.state, PROJECT);
  assert.deepEqual(
    rows.map((row) => row.title),
    [NEW_TITLE],
  );
  const bundle = serializeCanonicalTruth({
    state: saved.state,
    projectId: PROJECT,
    question: "What are the current issues?",
  });
  const facts = currentFacts(bundle.promptBlock);
  assert.doesNotMatch(facts, /remains open in the old notes/);
  assert.match(bundle.promptBlock, new RegExp(`\\(risk, open\\) ${NEW_TITLE}`));
  const capture = buildCaptureContext({
    projectId: PROJECT,
    captureText: "vendor feed",
    state: saved.state,
  });
  assert.equal(
    capture.knowledge.some((row) => row.type === "knowledge:risks"),
    false,
  );
  assert.deepEqual(
    capture.risks.map((row) => row.title),
    [NEW_TITLE],
  );
  assert.equal(
    saved.state.knowledge[0]?.sections.risks?.[0],
    LEFTOVER,
  );
});

check("tags-only local edit still adds no Issue history", () => {
  const state = seeded();
  const before = (state.history ?? []).length;
  const saved = applyRiskEditLocal(state, {
    projectId: PROJECT,
    riskId: RISK,
    title: TITLE,
    notes: NOTES,
    tagNames: ["Vendor", "Launch"],
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.result.tagsChanged, true);
  assert.equal(saved.result.titleChanged, false);
  assert.equal(saved.result.notesChanged, false);
  assert.deepEqual(saved.result.history ?? [], []);
  assert.equal((saved.state.history ?? []).length, before);
});

check("issue edit styles stay inside the issue drawer and keep a 438px cap", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /min\(438px, 100vw\)/);
  assert.match(css, /\.ocean-item-detail-drawer\.is-issue-edit/);
  assert.match(css, /issue-edit-save/);
  assert.match(css, /#7c5cff/);
  assert.match(css, /#be465a/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /width: 26rem/);
});

console.log("verify-issue-editor-ui: OK");
