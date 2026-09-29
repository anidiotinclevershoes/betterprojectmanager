/**
 * Current Issue truth follows domain Risk rows.
 * Knowledge risk prose stays stored and is not current truth once any
 * genuine Risk exists. Legacy projects with zero Risk rows keep it.
 *
 * Run: npx tsx scripts/verify-risk-read-authority.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCaptureContext } from "../src/lib/capture/context";
import { serializeCanonicalTruth } from "../src/lib/canonical-truth/serialize";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import { emptyKnowledge } from "../src/lib/knowledge";
import { buildOpenRiskRows } from "../src/lib/knowledge-centre/ocean-frames";
import type { CanonicalTruthItem } from "../src/lib/canonical-truth/types";
import type { MissionState } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const PROJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const RISK = "33333333-3333-4333-8333-333333333333";
const DOMAIN_TITLE = "Vendor delay on the bridge";
const LEFTOVER = "Bridge icing remains open in the old notes";
const SAME_TITLE = "Vendor delay on the bridge";
const DECISION = "Keep the Friday CAB.";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

function project(id: string, name: string) {
  return {
    id,
    name,
    code: name.slice(0, 3).toUpperCase(),
    summary: "",
    status: "healthy" as const,
    currentFocus: "",
    stakeholders: [],
  };
}

function withKnowledge(
  state: MissionState,
  projectId: string,
  risks: string[],
  decisions: string[] = [DECISION],
) {
  const knowledge = emptyKnowledge(projectId);
  knowledge.sections.risks = [...risks];
  knowledge.sections.decisions = [...decisions];
  state.knowledge = [...(state.knowledge ?? []), knowledge];
  return knowledge;
}

function currentFacts(block: string): string {
  const start = block.indexOf("CURRENT FACTS:");
  const end = block.indexOf("RISKS (domain lifecycle):");
  assert.ok(start >= 0 && end > start);
  return block.slice(start, end);
}

check("current Ask omits leftover risk prose when any domain Risk exists", () => {
  const state = emptyMissionState();
  state.projects = [project(PROJECT, "Bridge")];
  const knowledge = withKnowledge(state, PROJECT, [LEFTOVER, SAME_TITLE, "[Resolved] Old cab"]);
  const before = JSON.stringify(knowledge);
  state.risks = [
    {
      id: RISK,
      projectId: PROJECT,
      title: DOMAIN_TITLE,
      status: "resolved",
    },
  ];

  const bundle = serializeCanonicalTruth({
    state,
    projectId: PROJECT,
    question: "What are the current issues?",
  });
  const facts = currentFacts(bundle.promptBlock);
  assert.doesNotMatch(facts, /Bridge icing remains open/);
  assert.doesNotMatch(facts, /Vendor delay on the bridge/);
  assert.doesNotMatch(facts, /Old cab/);
  assert.match(facts, /Keep the Friday CAB/);
  assert.match(bundle.promptBlock, /\(risk, resolved\) Vendor delay on the bridge/);
  assert.equal(
    bundle.items.some((item) => item.kind === "risk" || item.section === "risks"),
    false,
  );
  assert.equal(JSON.stringify(knowledge), before);
  assert.deepEqual(knowledge.sections.risks, [LEFTOVER, SAME_TITLE, "[Resolved] Old cab"]);
});

check("structured risk facts are excluded without title matching", () => {
  const state = emptyMissionState();
  state.projects = [project(PROJECT, "Bridge")];
  const knowledge = emptyKnowledge(PROJECT);
  const structured: CanonicalTruthItem[] = [
    {
      id: "fact-now",
      projectId: PROJECT,
      section: "now",
      body: "CAB is Friday",
      kind: "fact",
      epistemic: "confirmed",
      lifecycle: "current",
    },
    {
      id: "risk-kind",
      projectId: PROJECT,
      section: "now",
      body: "A differently worded blocker",
      kind: "risk",
      epistemic: null,
      lifecycle: "current",
    },
    {
      id: "risk-section",
      projectId: PROJECT,
      section: "risks",
      body: "Section prose that is not the domain title",
      kind: "fact",
      epistemic: null,
      lifecycle: "current",
    },
  ];
  knowledge.structured = structured;
  state.knowledge = [knowledge];
  state.risks = [
    {
      id: RISK,
      projectId: PROJECT,
      title: DOMAIN_TITLE,
      status: "open",
    },
  ];

  const bundle = serializeCanonicalTruth({
    state,
    projectId: PROJECT,
    question: "What is true now?",
  });
  const facts = currentFacts(bundle.promptBlock);
  assert.match(facts, /CAB is Friday/);
  assert.doesNotMatch(facts, /differently worded blocker/);
  assert.doesNotMatch(facts, /Section prose/);
  assert.match(bundle.promptBlock, /\(risk, open\) Vendor delay on the bridge/);
  assert.equal(knowledge.structured?.length, 3);
});

check("a project with no domain Risks still reads legacy risk prose", () => {
  const state = emptyMissionState();
  state.projects = [project(PROJECT, "Legacy")];
  withKnowledge(state, PROJECT, [LEFTOVER, "[Resolved] Hidden prose"]);
  state.risks = [];

  const bundle = serializeCanonicalTruth({
    state,
    projectId: PROJECT,
    question: "What are the current issues?",
  });
  const facts = currentFacts(bundle.promptBlock);
  assert.match(facts, /Bridge icing remains open/);
  assert.doesNotMatch(facts, /Hidden prose/);
  assert.match(bundle.promptBlock, /RISKS \(domain lifecycle\):\n\(none recorded\)/);
});

check("another project's domain Risks do not hide this project's legacy prose", () => {
  const state = emptyMissionState();
  state.projects = [project(PROJECT, "Legacy"), project(OTHER, "Live")];
  withKnowledge(state, PROJECT, [LEFTOVER]);
  withKnowledge(state, OTHER, ["Other leftover"]);
  state.risks = [
    {
      id: RISK,
      projectId: OTHER,
      title: LEFTOVER,
      status: "open",
    },
  ];

  const legacy = serializeCanonicalTruth({
    state,
    projectId: PROJECT,
    question: "What are the current issues?",
  });
  assert.match(currentFacts(legacy.promptBlock), /Bridge icing remains open/);

  const live = serializeCanonicalTruth({
    state,
    projectId: OTHER,
    question: "What are the current issues?",
  });
  assert.doesNotMatch(currentFacts(live.promptBlock), /Other leftover/);
  assert.match(live.promptBlock, /\(risk, open\) Bridge icing remains open/);
});

check("historical questions can still see stored risk prose", () => {
  const state = emptyMissionState();
  state.projects = [project(PROJECT, "Bridge")];
  withKnowledge(state, PROJECT, [LEFTOVER]);
  state.risks = [
    {
      id: RISK,
      projectId: PROJECT,
      title: DOMAIN_TITLE,
      status: "open",
    },
  ];
  const bundle = serializeCanonicalTruth({
    state,
    projectId: PROJECT,
    question: "What changed about the bridge risk?",
  });
  assert.match(bundle.promptBlock, /MODE: historical/);
  assert.match(bundle.promptBlock, /Bridge icing remains open/);
  assert.match(bundle.promptBlock, /\(risk, open\) Vendor delay on the bridge/);
});

check("Capture context uses domain Risks and keeps legacy prose stored", () => {
  const state = emptyMissionState();
  state.projects = [project(PROJECT, "Bridge"), project(OTHER, "Legacy")];
  const liveKnowledge = withKnowledge(state, PROJECT, [LEFTOVER], [DECISION]);
  const legacyKnowledge = withKnowledge(state, OTHER, ["Only prose risk"]);
  const liveBefore = JSON.stringify(liveKnowledge);
  state.risks = [
    {
      id: RISK,
      projectId: PROJECT,
      title: DOMAIN_TITLE,
      status: "watch",
    },
  ];

  const live = buildCaptureContext({
    projectId: PROJECT,
    captureText: "bridge",
    state,
  });
  assert.equal(
    live.knowledge.some((row) => row.type === "knowledge:risks"),
    false,
  );
  assert.ok(live.knowledge.some((row) => row.type === "knowledge:decisions"));
  assert.deepEqual(
    live.risks.map((row) => ({ id: row.id, title: row.title, status: row.status })),
    [{ id: RISK, title: DOMAIN_TITLE, status: "watch" }],
  );
  assert.equal(JSON.stringify(liveKnowledge), liveBefore);

  const legacy = buildCaptureContext({
    projectId: OTHER,
    captureText: "prose",
    state,
  });
  assert.ok(legacy.knowledge.some((row) => row.title === "Only prose risk"));
  assert.equal(legacy.risks.length, 0);
  assert.deepEqual(legacyKnowledge.sections.risks, ["Only prose risk"]);
});

check("Knowledge Centre open rows stay domain-only and this slice does not title-match", () => {
  const state = emptyMissionState();
  state.projects = [project(PROJECT, "Bridge")];
  withKnowledge(state, PROJECT, [LEFTOVER]);
  state.risks = [
    {
      id: RISK,
      projectId: PROJECT,
      title: DOMAIN_TITLE,
      status: "open",
    },
  ];
  const rows = buildOpenRiskRows(state, PROJECT);
  assert.deepEqual(rows.map((row) => row.id), [RISK]);

  const serialize = read("src/lib/canonical-truth/serialize.ts");
  const capture = read("src/lib/capture/context.ts");
  assert.doesNotMatch(serialize, /titlesMatch|stripResolvedPrefix/);
  assert.doesNotMatch(capture, /titlesMatch|ilike|similarity/);
  assert.match(serialize, /domainOwnsCurrentIssues/);
  assert.match(capture, /section === "risks"/);
});

console.log("verify-risk-read-authority: OK");
