/**
 * Genuine Issue detail presentation.
 * Page 09 field order, exact Notes/History/tags.
 * Detail stays read-only. Edit issue is the affordance into the editor.
 *
 * Run: npx tsx scripts/verify-issue-detail.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import { emptyKnowledge } from "../src/lib/knowledge";
import { historyEventsForItem } from "../src/lib/knowledge-centre/item-history";
import {
  formatIssueStamp,
  issueHistoryLine,
  issueLifecycleAction,
  issueStatusLabel,
} from "../src/lib/knowledge-centre/issue-detail-presentation";
import { resolveKnowledgeItemDetail } from "../src/lib/knowledge-centre/knowledge-item-detail";
import { tagsForItem } from "../src/lib/tags/query";
import type { HistoryEvent, MissionState } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const PROJECT = "11111111-1111-4111-8111-111111111111";
const RISK_A = "33333333-3333-4333-8333-333333333333";
const RISK_B = "44444444-4444-4444-8444-444444444444";
const TITLE = "Vendor delay on the bridge";
const NOTES = "Wet-store mould is supplementary context.";
const STAMP = "2026-09-15T14:05:00.000Z";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

function event(partial: Partial<HistoryEvent> & Pick<HistoryEvent, "id" | "title">): HistoryEvent {
  return {
    type: "other",
    createdAt: STAMP,
    projectId: PROJECT,
    source: "user",
    ...partial,
  };
}

function baseState(): MissionState {
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
  knowledge.sections.risks = [TITLE];
  state.knowledge = [knowledge];
  return state;
}

check("status labels and lifecycle actions stay on stored status", () => {
  assert.equal(issueStatusLabel("open"), "Open");
  assert.equal(issueStatusLabel("watch"), "Watch");
  assert.equal(issueStatusLabel("resolved"), "Resolved");
  assert.equal(issueStatusLabel("accepted"), "Accepted");
  assert.equal(issueLifecycleAction("open"), "resolve");
  assert.equal(issueLifecycleAction("watch"), "resolve");
  assert.equal(issueLifecycleAction("resolved"), "reopen");
  assert.equal(issueLifecycleAction("accepted"), null);
});

check("dates are not invented and history detail stays raw", () => {
  assert.equal(formatIssueStamp(null, false), null);
  assert.equal(formatIssueStamp(undefined, true), null);
  assert.equal(formatIssueStamp("", false), null);
  assert.equal(formatIssueStamp(STAMP, false), "15 Sep");
  assert.equal(formatIssueStamp(STAMP, true), "15 Sep · 14:05");
  const detail = "Previous notes:\n\nold note\nCurrent notes:\n\nnew note";
  const line = issueHistoryLine(
    event({ id: "h1", title: "Issue notes updated", detail }),
  );
  assert.equal(line.when, "15 Sep · 14:05");
  assert.equal(line.title, "Issue notes updated");
  assert.equal(line.detail, detail);
  assert.deepEqual(Object.keys(line).sort(), ["detail", "title", "when"]);
});

check("genuine risk detail uses the stable risk id, title, and notes", () => {
  const state = baseState();
  state.risks = [
    {
      id: RISK_A,
      projectId: PROJECT,
      title: TITLE,
      status: "open",
      source: "capture",
      createdAt: STAMP,
      updatedAt: STAMP,
      notes: NOTES,
    },
    {
      id: RISK_B,
      projectId: PROJECT,
      title: TITLE,
      status: "resolved",
      notes: null,
    },
  ];
  const open = resolveKnowledgeItemDetail(state, PROJECT, {
    kind: "risk",
    riskId: RISK_A,
  });
  assert.equal(open?.ref.kind, "risk");
  if (open?.ref.kind === "risk") assert.equal(open.ref.riskId, RISK_A);
  assert.equal(open?.body, TITLE);
  assert.equal(open?.issueNotes, NOTES);
  assert.equal(open?.canEditBody, false);
  assert.equal(open?.canResolveRisk, true);
  assert.equal(open?.canResolveKnowledgeRisk, false);
  assert.deepEqual(open?.relations, []);
  assert.equal(open?.riskStatus, "open");

  const resolved = resolveKnowledgeItemDetail(state, PROJECT, {
    kind: "risk",
    riskId: RISK_B,
  });
  assert.equal(resolved?.issueNotes, null);
  assert.notEqual(resolved?.issueNotes, "No notes yet.");
  assert.equal(resolved?.canResolveRisk, false);
  assert.equal(resolved?.body, TITLE);
});

check("null notes do not become fabricated content", () => {
  const state = baseState();
  state.risks = [
    {
      id: RISK_A,
      projectId: PROJECT,
      title: TITLE,
      status: "open",
    },
  ];
  const detail = resolveKnowledgeItemDetail(state, PROJECT, {
    kind: "risk",
    riskId: RISK_A,
  });
  assert.equal(detail?.issueNotes ?? null, null);
});

check("tags and history match the exact risk target only", () => {
  const state = baseState();
  state.risks = [
    {
      id: RISK_A,
      projectId: PROJECT,
      title: TITLE,
      status: "open",
      notes: NOTES,
    },
    {
      id: RISK_B,
      projectId: PROJECT,
      title: TITLE,
      status: "open",
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
      id: "link-a",
      projectId: PROJECT,
      tagId: "tag-vendor",
      targetKind: "risk",
      targetId: RISK_A,
    },
    {
      id: "link-b",
      projectId: PROJECT,
      tagId: "tag-vendor",
      targetKind: "risk",
      targetId: RISK_B,
    },
  ];
  const tagsA = tagsForItem({
    projectTags: state.projectTags,
    itemTags: state.itemTags,
    projectId: PROJECT,
    targetKind: "risk",
    targetId: RISK_A,
  });
  const tagsB = tagsForItem({
    projectTags: state.projectTags,
    itemTags: state.itemTags.filter((row) => row.targetId === RISK_B),
    projectId: PROJECT,
    targetKind: "risk",
    targetId: RISK_A,
  });
  assert.deepEqual(tagsA.map((tag) => tag.name), ["Vendor"]);
  assert.deepEqual(tagsB, []);

  const targeted = event({
    id: "notes-a",
    title: "Issue notes added",
    detail: `Previous notes:\n\n\nCurrent notes:\n\n${NOTES}`,
    targetKind: "risk",
    targetId: RISK_A,
  });
  const otherRisk = event({
    id: "notes-b",
    title: "Issue notes added",
    detail: "Current notes:\n\nother risk",
    targetKind: "risk",
    targetId: RISK_B,
  });
  const untargeted = event({
    id: "old",
    title: TITLE,
    detail: "Added from Capture",
    targetKind: null,
    targetId: null,
  });
  state.history = [targeted, otherRisk, untargeted];

  const readA = historyEventsForItem(state, PROJECT, {
    kind: "risk",
    riskId: RISK_A,
  });
  assert.deepEqual(readA.events.map((row) => row.id), ["notes-a"]);
  assert.equal(readA.attributable, true);
  assert.match(readA.notice, /D-004/);
  assert.match(readA.events[0]?.detail ?? "", /Previous notes:/);
  assert.match(readA.events[0]?.detail ?? "", /Current notes:/);

  const readB = historyEventsForItem(state, PROJECT, {
    kind: "risk",
    riskId: RISK_B,
  });
  assert.deepEqual(readB.events.map((row) => row.id), ["notes-b"]);

  const knowledgeOnly = historyEventsForItem(state, PROJECT, {
    kind: "knowledge_risk",
    key: "kr-0",
    title: TITLE,
  });
  assert.deepEqual(knowledgeOnly.events, []);
  assert.equal(knowledgeOnly.attributable, false);
  assert.equal(knowledgeOnly.limitation, "D-004");
});

check("knowledge-only risk does not receive genuine Issue notes or lifecycle", () => {
  const state = baseState();
  state.risks = [];
  const detail = resolveKnowledgeItemDetail(state, PROJECT, {
    kind: "knowledge_risk",
    key: "kr-0",
    title: TITLE,
  });
  assert.equal(detail?.title, "Risk (Knowledge only)");
  assert.equal(detail?.issueNotes, undefined);
  assert.equal(detail?.canResolveRisk, false);
  assert.equal(detail?.canResolveKnowledgeRisk, true);
  assert.equal(detail?.domain, "risk");
});

check("Issue view and drawer stay presentation-only", () => {
  const view = read("src/components/knowledge-centre/IssueDetailView.tsx");
  const drawer = read(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  const css = read("src/app/globals.css");
  const presentation = read(
    "src/lib/knowledge-centre/issue-detail-presentation.ts",
  );

  assert.match(view, /DomainBadge domain="issue" label="Issue"/);
  assert.match(view, /Resolve issue/);
  assert.match(view, /Reopen issue/);
  assert.match(view, /No notes yet\./);
  assert.match(view, /\{historyNotice\}/);
  assert.match(view, />\s*Edit issue\s*</);
  assert.match(view, /action === "resolve" && onEdit/);
  assert.doesNotMatch(view, /Source: Capture|Close item|Remove item|<textarea|Change status|Save changes|Discard/);
  assert.doesNotMatch(view, /Earlier activity may not appear/);
  assert.doesNotMatch(view, /setRiskStatus|setRiskNotes|set_risk_notes|setRiskTitle|saveRiskEdit/);
  assert.doesNotMatch(view, /From meeting notes/);

  assert.match(drawer, /detail\?\.ref\.kind === "risk"/);
  assert.match(drawer, /title=\{genuineIssue\.title\}/);
  assert.match(drawer, /IssueDetailView/);
  assert.match(drawer, /setRiskStatus\(genuineIssue\.id, "resolved", projectId\)/);
  assert.match(drawer, /setRiskStatus\(genuineIssue\.id, "open", projectId\)/);
  assert.match(drawer, /setKnowledgeOnlyRiskResolved/);
  assert.match(drawer, /ItemTagsEditor/);
  assert.match(drawer, /ocean-item-detail-resolve-kr/);
  assert.match(drawer, /toggleTodo/);
  assert.match(drawer, /data-overlay="true"/);
  assert.match(drawer, /Escape/);
  assert.match(drawer, /onClose\(\)/);
  assert.match(drawer, /IssueEditView/);
  assert.match(drawer, /saveRiskEdit\(\{/);
  assert.match(drawer, /requestIssueEditExit/);
  assert.doesNotMatch(drawer, /setRiskTitle|persistRiskTitle|set_risk_notes/);
  assert.doesNotMatch(drawer, /Source: Capture/);

  assert.match(css, /min\(438px, 100vw\)/);
  assert.match(css, /rgba\(0, 0, 0, 0\.26\)/);
  assert.match(css, /width: 2px/);
  assert.match(css, /width: 26rem/);
  assert.match(css, /min-height: 44px/);

  assert.doesNotMatch(presentation, /from "@\/lib\/store"|persistRisk|setRiskStatus/);
  assert.doesNotMatch(
    read("src/lib/capture-v2/prompt.ts"),
    /IssueDetailView|issue-detail-presentation/,
  );
  assert.doesNotMatch(
    read("src/lib/capture/apply/apply-approved.ts"),
    /IssueDetailView|issue-detail-presentation/,
  );
});

console.log("verify-issue-detail: OK");
