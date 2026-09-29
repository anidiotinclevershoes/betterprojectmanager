/**
 * Page 09 Person detail is presentation over getPersonBundle.
 * No identity edit, no People tags, no fabricated history.
 *
 * Run: npm run verify:person-detail
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalTruthItem } from "../src/lib/canonical-truth/types";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import { emptyKnowledge } from "../src/lib/knowledge";
import { historyEventsForItem } from "../src/lib/knowledge-centre/item-history";
import {
  refForPerson,
  resolveKnowledgeItemDetail,
} from "../src/lib/knowledge-centre/knowledge-item-detail";
import { getPersonBundle } from "../src/lib/people/identity";
import type { MissionState } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const PROJECT = "11111111-1111-4111-8111-111111111111";
const ALEX_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ALEX_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MARIA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DAN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SAM = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const RESP_SITE = "12121212-1212-4121-8121-121212121212";
const RESP_BUDGET = "34343434-3434-4343-8343-343434343434";
const RESP_CUT_MARIA = "56565656-5656-4565-8565-565656565656";
const RESP_CUT_DAN = "78787878-7878-4787-8787-787878787878";
const RESP_OLD = "90909090-9090-4909-8909-909090909090";
const AVAIL = "abababab-abab-4aba-8aba-abababababab";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

function responsibility(
  id: string,
  personId: string,
  personName: string,
  scope: string,
  lifecycle: CanonicalTruthItem["lifecycle"] = "current",
): CanonicalTruthItem {
  return {
    id,
    projectId: PROJECT,
    section: "people",
    body: `${personName} — ${scope}`,
    kind: "responsibility",
    epistemic: "confirmed",
    lifecycle,
    meta: {
      responsibility: {
        personId,
        personName,
        scope,
        ownerConfirmed: true,
      },
    },
  };
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
      stakeholders: [
        {
          id: ALEX_A,
          name: "Alex Morgan",
          role: "Supplier liaison",
          lastContactAt: "2026-09-16T11:20:00.000Z",
        },
        { id: ALEX_B, name: "Alex Morgan", role: "Finance partner" },
        {
          id: MARIA,
          name: "Maria Chen",
          role: "Supplier contact",
          lastContactAt: "2026-09-16T11:20:00.000Z",
        },
        { id: DAN, name: "Dan Roberts", role: "Operations" },
        { id: SAM, name: "Sam Lee", role: "" },
      ],
    },
  ];
  const knowledge = emptyKnowledge(PROJECT);
  knowledge.sections.people = [
    "Maria Chen usually works Fridays in the office and is away next week.",
  ];
  knowledge.structured = [
    responsibility(RESP_SITE, ALEX_A, "Alex Morgan", "Site access"),
    responsibility(RESP_BUDGET, ALEX_B, "Alex Morgan", "Budget sign-off"),
    responsibility(
      RESP_CUT_MARIA,
      MARIA,
      "Maria Chen",
      "Cut-over communications",
    ),
    responsibility(RESP_CUT_DAN, DAN, "Dan Roberts", "Cut-over communications"),
    responsibility(RESP_OLD, MARIA, "Maria Chen", "Launch checklist", "historical"),
    {
      id: AVAIL,
      projectId: PROJECT,
      section: "people",
      body: "Away 29 Sep–2 Oct",
      kind: "availability",
      epistemic: "confirmed",
      lifecycle: "current",
      meta: { personId: MARIA },
    },
  ];
  state.knowledge = [knowledge];
  state.todos = [
    {
      id: "todo-exact",
      projectId: PROJECT,
      title: "Confirm supplier cut-over window",
      done: false,
      createdAt: "2026-09-16T11:20:00.000Z",
      waitingOn: "Maria Chen",
    },
    {
      id: "todo-joined",
      projectId: PROJECT,
      title: "Joined waiting string must stay hidden",
      done: false,
      createdAt: "2026-09-16T11:20:00.000Z",
      waitingOn: "Maria Chen and Dan Roberts",
    },
    {
      id: "todo-done",
      projectId: PROJECT,
      title: "Closed chase",
      done: true,
      createdAt: "2026-09-16T11:20:00.000Z",
      waitingOn: "Maria Chen",
    },
    {
      id: "todo-other",
      projectId: PROJECT,
      title: "Ask finance",
      done: false,
      createdAt: "2026-09-16T11:20:00.000Z",
      waitingOn: "Alex Morgan",
    },
  ];
  state.history = [
    {
      id: "hist-person-sample",
      type: "other",
      title: "Person added to the project",
      detail: "Maria Chen joined",
      projectId: PROJECT,
      createdAt: "2026-09-01T09:00:00.000Z",
      source: "system",
      targetKind: null,
      targetId: null,
    },
  ];
  return state;
}

check("1. stable personId selects the matching Person when names overlap", () => {
  const state = seeded();
  const site = getPersonBundle(state, PROJECT, ALEX_A);
  const budget = getPersonBundle(state, PROJECT, ALEX_B);
  assert.equal(site!.person.id, ALEX_A);
  assert.equal(budget!.person.id, ALEX_B);
  assert.equal(site!.person.name, budget!.person.name);
  assert.deepEqual(
    site!.currentResponsibilities.map((row) => row.scope),
    ["Site access"],
  );
  assert.deepEqual(
    budget!.currentResponsibilities.map((row) => row.scope),
    ["Budget sign-off"],
  );
});

check("2. name comes from Stakeholder.name", () => {
  const bundle = getPersonBundle(seeded(), PROJECT, MARIA);
  assert.equal(bundle!.person.name, "Maria Chen");
  const detail = resolveKnowledgeItemDetail(seeded(), PROJECT, refForPerson(MARIA));
  assert.equal(detail!.title, "Maria Chen");
});

check("3. role comes from Stakeholder.role", () => {
  const maria = getPersonBundle(seeded(), PROJECT, MARIA);
  const sam = getPersonBundle(seeded(), PROJECT, SAM);
  assert.equal(maria!.person.role, "Supplier contact");
  assert.equal(sam!.person.role, "");
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  assert.match(view, /roleLabel \|\| "No role recorded\."/);
  assert.doesNotMatch(view, /Team member/);
});

check("4. last contact appears only when lastContactAt exists", () => {
  const maria = getPersonBundle(seeded(), PROJECT, MARIA)!;
  const sam = getPersonBundle(seeded(), PROJECT, SAM)!;
  assert.equal(maria.person.lastContactAt, "2026-09-16T11:20:00.000Z");
  assert.equal(sam.person.lastContactAt, undefined);
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  assert.match(view, /lastContact \?/);
  assert.match(view, /Last contact/);
});

check("5. Added and Last updated are not fabricated", () => {
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  assert.doesNotMatch(view, /Last updated/);
  assert.doesNotMatch(view, /\bAdded\b/);
  assert.equal(
    "createdAt" in getPersonBundle(seeded(), PROJECT, MARIA)!.person,
    false,
  );
});

check("6. Person presentation does not mount People tags", () => {
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  const drawer = read(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.doesNotMatch(view, /tagsForItem|saveItemTags|>Tags</);
  assert.match(
    drawer,
    /if \(!detail \|\| detail\.ref\.kind === "person"\) return \[\];[\s\S]*tagsForItem/,
  );
});

check("7. current responsibilities render from the bundle", () => {
  const bundle = getPersonBundle(seeded(), PROJECT, MARIA)!;
  assert.deepEqual(
    bundle.currentResponsibilities.map((row) => row.scope),
    ["Cut-over communications"],
  );
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  assert.match(view, /currentResponsibilities\.map/);
  assert.match(view, /data-testid="person-detail-responsibility"/);
});

check("8. shared responsibilities name the stored co-owners", () => {
  const bundle = getPersonBundle(seeded(), PROJECT, MARIA)!;
  assert.equal(bundle.sharedScopes[0]?.scope, "Cut-over communications");
  assert.deepEqual(bundle.sharedScopes[0]?.coOwnerNames, ["Dan Roberts"]);
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  assert.match(view, /Shared with \$\{coOwners\.join\(", "\)\}/);
  assert.doesNotMatch(view, /namesMatchExact|findConfirmedOwners/);
});

check("9. historical responsibilities stay non-current", () => {
  const bundle = getPersonBundle(seeded(), PROJECT, MARIA)!;
  assert.equal(bundle.historicalResponsibilities.length, 1);
  assert.equal(bundle.historicalResponsibilities[0]?.scope, "Launch checklist");
  assert.equal(bundle.historicalResponsibilities[0]?.lifecycle, "historical");
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  assert.match(view, /Previous responsibilities/);
  assert.doesNotMatch(view, /historicalResponsibilities[\s\S]{0,180}current ownership/);
});

check("10. availability renders only structured availability", () => {
  const bundle = getPersonBundle(seeded(), PROJECT, MARIA)!;
  assert.deepEqual(
    bundle.availability.map((row) => row.body),
    ["Away 29 Sep–2 Oct"],
  );
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  assert.match(view, /availabilityLines\.length \?/);
  assert.match(view, /row\.body\.trim\(\)/);
});

check("11. prose is not inferred as availability", () => {
  const bundle = getPersonBundle(seeded(), PROJECT, MARIA)!;
  assert.equal(
    bundle.availability.some((row) => /Fridays|away next week/i.test(row.body)),
    false,
  );
  assert.ok(
    bundle.legacyPeopleBullets.some((line) => /Fridays/.test(line)),
  );
  const sam = getPersonBundle(seeded(), PROJECT, SAM)!;
  assert.equal(sam.availability.length, 0);
});

check("12. waiting lines are exact current matches only", () => {
  const maria = resolveKnowledgeItemDetail(
    seeded(),
    PROJECT,
    refForPerson(MARIA),
  )!;
  assert.deepEqual(maria.waitingLines, ["Confirm supplier cut-over window"]);
  const alex = resolveKnowledgeItemDetail(
    seeded(),
    PROJECT,
    refForPerson(ALEX_A),
  )!;
  assert.deepEqual(alex.waitingLines, ["Ask finance"]);
  const sam = resolveKnowledgeItemDetail(seeded(), PROJECT, refForPerson(SAM))!;
  assert.equal(sam.waitingLines?.length ?? 0, 0);
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  assert.match(view, /waitingLines\.length \?/);
});

check("13. Add responsibility prefills Confirm Owner for this Person", () => {
  const drawer = read(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.match(drawer, /function openAddResponsibility\(\)/);
  assert.match(drawer, /setAddingResponsibility\(true\)/);
  assert.match(drawer, /scope=\{addingResponsibility \? "" : handoverScope \?\? ""\}/);
  assert.match(drawer, /allowScopeEdit=\{addingResponsibility\}/);
  assert.match(
    drawer,
    /addingResponsibility\s*\?\s*detail\.personBundle\.person\.name/,
  );
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  assert.match(view, /Add responsibility/);
  assert.doesNotMatch(view, /confirmResponsibilityOwner|useMission/);
});

check("14. share vs replace wiring is unchanged", () => {
  const dialog = read("src/components/intelligence/ConfirmOwnerDialog.tsx");
  assert.match(dialog, /confirm-owner-intent-share/);
  assert.match(dialog, /confirm-owner-intent-replace/);
  assert.match(dialog, /resolveReplacePersonId/);
  assert.match(dialog, /confirmResponsibilityOwner/);
  const drawer = read(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.match(
    drawer,
    /addingResponsibility \? null : handoverReplacePersonId/,
  );
  assert.match(drawer, /defaultReplacePersonId/);
});

check("15. Edit person is not mounted", () => {
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  assert.doesNotMatch(view, /Edit person/i);
  assert.doesNotMatch(view, /<textarea/);
});

check("16. Remove person or item is not mounted", () => {
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  assert.doesNotMatch(view, /Remove/);
  const drawer = read(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.doesNotMatch(drawer, /removeStakeholder|deleteStakeholder/);
});

check("17. Person History is not fabricated from sample or title match", () => {
  const readHistory = historyEventsForItem(
    seeded(),
    PROJECT,
    refForPerson(MARIA),
  );
  assert.equal(readHistory.events.length, 0);
  assert.match(readHistory.notice, /D-004/);
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  assert.match(view, /data-testid="ocean-item-history-limited"/);
  assert.doesNotMatch(view, /Person added to the project|shared ownership change/i);
  const history = read("src/lib/knowledge-centre/item-history.ts");
  assert.match(history, /if \(!ref \|\| ref\.kind !== "risk"\) return unattributed\(\)/);
});

check("18. same display name stays distinguished by stable id", () => {
  const state = seeded();
  const first = resolveKnowledgeItemDetail(state, PROJECT, refForPerson(ALEX_A))!;
  const second = resolveKnowledgeItemDetail(state, PROJECT, refForPerson(ALEX_B))!;
  assert.equal(first.personBundle!.person.id, ALEX_A);
  assert.equal(second.personBundle!.person.id, ALEX_B);
  assert.equal(first.title, second.title);
  assert.notEqual(
    first.personBundle!.currentResponsibilities[0]?.scope,
    second.personBundle!.currentResponsibilities[0]?.scope,
  );
  assert.equal(first.personBundle!.person.role, "Supplier liaison");
  assert.equal(second.personBundle!.person.role, "Finance partner");
});

check("19. Issue drawer and editor remain mounted", () => {
  const issue = read("src/components/knowledge-centre/IssueDetailView.tsx");
  assert.match(issue, /Edit issue/);
  const drawer = read(
    "src/components/knowledge-centre/KnowledgeItemDetailDrawer.tsx",
  );
  assert.match(drawer, /saveRiskEdit\(/);
  assert.match(drawer, /IssueEditView/);
  assert.match(drawer, /IssueDetailView/);
});

check("20. narrow Person drawer reuses the 438px shell without a second model", () => {
  const css = read("src/app/globals.css");
  assert.match(
    css,
    /\.ocean-item-detail-drawer\.is-issue-detail,\s*\.ocean-item-detail-drawer\.is-person-detail\s*\{[^}]*width:\s*min\(438px,\s*100vw\)/,
  );
  assert.match(css, /data-testid="person-detail-add"\]\s*\{[^}]*min-width:\s*148px/);
  assert.match(css, /\.person-detail-handover\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  const view = read("src/components/knowledge-centre/PersonDetailView.tsx");
  assert.doesNotMatch(view, /390|mobile model|calendar/);
});

console.log("\nperson detail checks passed");
