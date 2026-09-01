/**
 * Knowledge Centre Timeline + meeting-scoped Catch Me Up.
 * Presentation only. No new truth types. No persistence.
 *
 * Run: npx tsx scripts/verify-kc-timeline-meeting-prep.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  NO_UNAVAILABILITY_RECORDED,
  SPARSE_TIMELINE_HINT,
  composeTimelineProjection,
} from "../src/lib/knowledge-centre/timeline-projection";
import {
  briefUsesStoredPrepAdvice,
  buildMeetingCatchUpBrief,
  nextKnownMeeting,
} from "../src/lib/knowledge-centre/meeting-catch-up";
import { formatWhenQuestion } from "../src/lib/tell-me/when-question";
import { buildCanonicalSuggestions } from "../src/lib/canonical-truth/suggestions";
import { createSeedState } from "../src/lib/seed";
import type { CanonicalTruthItem } from "../src/lib/canonical-truth/types";
import type { Meeting, MissionState } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const ATLAS = "proj-atlas";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function availabilityItem(partial: {
  id: string;
  projectId: string;
  personId: string;
  personName: string;
  from: string;
  to: string;
}): CanonicalTruthItem {
  return {
    id: partial.id,
    projectId: partial.projectId,
    section: "people",
    body: `${partial.personName} — away`,
    kind: "availability",
    epistemic: "confirmed",
    lifecycle: "current",
    meta: {
      availability: {
        personId: partial.personId,
        personName: partial.personName,
        awayFromIso: partial.from,
        awayToIso: partial.to,
      },
    },
  };
}

check("dated items render from existing timeline / meetings / todos", () => {
  const state = createSeedState();
  const view = composeTimelineProjection(state, ATLAS);
  assert.equal(view.empty, false);
  assert.ok(view.projectLane.events.some((e) => /CAB approval/i.test(e.title)));
  assert.ok(view.projectLane.events.some((e) => e.kind === "meeting"));
  assert.ok(view.projectLane.events.some((e) => e.source === "timeline"));
  assert.ok(view.events.some((e) => e.source === "todo" || e.kind === "deadline"));
});

check("no-unavailability-recorded does not become authoritative availability", () => {
  const state = createSeedState();
  const view = composeTimelineProjection(state, ATLAS);
  assert.ok(view.personLanes.length >= 1);
  for (const lane of view.personLanes) {
    if (!lane.hasExplicitUnavailability) {
      assert.equal(lane.availabilityNote, NO_UNAVAILABILITY_RECORDED);
      assert.doesNotMatch(lane.availabilityNote ?? "", /available/i);
    }
  }
});

check("Timeline performs no truth mutation", () => {
  const state = createSeedState();
  const before = JSON.stringify(state);
  composeTimelineProjection(state, ATLAS);
  assert.equal(JSON.stringify(state), before);
});

check("people remain the same durable People entities", () => {
  const state = createSeedState();
  const view = composeTimelineProjection(state, ATLAS);
  const ids = new Set(state.projects.find((p) => p.id === ATLAS)!.stakeholders.map((s) => s.id));
  for (const lane of view.personLanes) {
    assert.ok(lane.personId && ids.has(lane.personId));
  }
});

check("missing availability information does not generate false availability", () => {
  const state = createSeedState();
  const view = composeTimelineProjection(state, ATLAS);
  assert.ok(!view.events.some((e) => e.kind === "unavailability"));
  assert.ok(
    view.personLanes.every((l) => l.hasExplicitUnavailability === false),
  );
});

check("known unavailability is projected only from structured availability", () => {
  const state = createSeedState();
  const elena = state.projects
    .find((p) => p.id === ATLAS)!
    .stakeholders.find((s) => s.name === "Elena Rostova")!;
  const knowledge = state.knowledge.find((k) => k.projectId === ATLAS)!;
  knowledge.structured = [
    ...(knowledge.structured ?? []),
    availabilityItem({
      id: "avail-elena",
      projectId: ATLAS,
      personId: elena.id,
      personName: elena.name,
      from: new Date(Date.now() + 2 * 86400000).toISOString(),
      to: new Date(Date.now() + 5 * 86400000).toISOString(),
    }),
  ];
  const view = composeTimelineProjection(state, ATLAS);
  const lane = view.personLanes.find((l) => l.personId === elena.id);
  assert.ok(lane);
  assert.equal(lane!.hasExplicitUnavailability, true);
  assert.notEqual(lane!.availabilityNote, NO_UNAVAILABILITY_RECORDED);
  assert.doesNotMatch(lane!.availabilityNote ?? "", /^available$/i);
  assert.ok(lane!.events.some((e) => e.kind === "unavailability"));
});

check("empty/sparse Timeline behaves gracefully", () => {
  const empty: MissionState = {
    ...createSeedState(),
    timeline: [],
    meetings: [],
    todos: [],
    knowledge: [emptyKnowledge("proj-empty")],
    projects: [
      {
        id: "proj-empty",
        name: "Empty",
        code: "E",
        summary: "",
        status: "healthy",
        currentFocus: "",
        stakeholders: [],
      },
    ],
  };
  const none = composeTimelineProjection(empty, "proj-empty");
  assert.equal(none.empty, true);
  assert.equal(none.personLanes.length, 0);

  const sparse = clone(empty);
  sparse.timeline = [
    {
      id: "one",
      projectId: "proj-empty",
      label: "Kickoff",
      type: "milestone",
      startAt: new Date().toISOString(),
    },
  ];
  const few = composeTimelineProjection(sparse, "proj-empty");
  assert.equal(few.sparse, true);
  assert.match(SPARSE_TIMELINE_HINT, /milestones, deadlines, meetings and known unavailability/);
});

check("empty person lanes are omitted", () => {
  const state = createSeedState();
  state.projects.find((p) => p.id === ATLAS)!.stakeholders.push({
    id: "st-ghost",
    name: "Nobody Dated",
    role: "Observer",
  });
  const view = composeTimelineProjection(state, ATLAS);
  assert.ok(!view.personLanes.some((l) => l.personId === "st-ghost"));
});

check("scoped brief reads existing truth and does not persist", () => {
  const state = createSeedState();
  const before = JSON.stringify(state);
  const meeting = nextKnownMeeting(state, ATLAS);
  assert.ok(meeting);
  const brief = buildMeetingCatchUpBrief(state, meeting!);
  assert.equal(brief.meetingId, meeting!.id);
  assert.ok(brief.about.length >= 1);
  assert.ok(brief.evidence.some((l) => l.source === "meeting"));
  assert.ok(brief.evidence.some((l) => l.source === "focus" || l.source === "risk"));
  assert.equal(JSON.stringify(state), before);
});

check("Meeting Prep does not persist new facts", () => {
  const state = createSeedState();
  const meeting = nextKnownMeeting(state, ATLAS)!;
  const beforeMeetings = JSON.stringify(state.meetings);
  const beforeKnowledge = JSON.stringify(state.knowledge);
  buildMeetingCatchUpBrief(state, meeting);
  assert.equal(JSON.stringify(state.meetings), beforeMeetings);
  assert.equal(JSON.stringify(state.knowledge), beforeKnowledge);
});

check("generic unsupported advice is not manufactured", () => {
  const state = createSeedState();
  const meeting = nextKnownMeeting(state, ATLAS)!;
  const brief = buildMeetingCatchUpBrief(state, meeting);
  assert.equal(briefUsesStoredPrepAdvice(brief, meeting), false);
  const blob = brief.evidence.map((l) => l.text).join("\n");
  assert.doesNotMatch(blob, /remember to set an agenda/i);
  assert.doesNotMatch(blob, /leadership opportunit/i);
  assert.doesNotMatch(blob, /facilitation/i);
});

check("relevant meeting context is scoped correctly", () => {
  const state = createSeedState();
  const atlas = nextKnownMeeting(state, ATLAS)!;
  const horizon = nextKnownMeeting(state, "proj-horizon");
  const atlasBrief = buildMeetingCatchUpBrief(state, atlas);
  assert.match(atlasBrief.title, /CAB/i);
  assert.ok(atlasBrief.context.some((l) => /Priya|Marcus|Elena/i.test(l.text)));
  if (horizon) {
    const hz = buildMeetingCatchUpBrief(state, horizon);
    assert.ok(!hz.about.some((l) => l.text === atlas.title));
    assert.equal(hz.meetingId, horizon.id);
  }
});

check("absence of a known meeting does not create one", () => {
  const state = createSeedState();
  state.meetings = [];
  assert.equal(nextKnownMeeting(state, ATLAS), null);
  const view = composeTimelineProjection(state, ATLAS);
  assert.ok(!view.events.some((e) => e.source === "meeting"));
});

check("existing Catch Me Up machinery is reused", () => {
  const src = readFileSync(
    join(ROOT, "src/lib/knowledge-centre/meeting-catch-up.ts"),
    "utf8",
  );
  assert.match(src, /buildDeterministicSnapshot/);
  assert.doesNotMatch(src, /openai/i);
  assert.match(src, /Does not use stored generic Meeting.prep/);
  const ui = readFileSync(
    join(ROOT, "src/components/knowledge-centre/MeetingCatchUp.tsx"),
    "utf8",
  );
  assert.match(ui, /Catch me up/);
  assert.doesNotMatch(ui, /MeetingPrepFrame/);
});

check("thin brief when meeting has almost no project context", () => {
  const meeting: Meeting = {
    id: "mtg-thin",
    projectId: "proj-thin",
    title: "Standup",
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    attendees: ["You"],
    phase: "upcoming",
    prep: {
      objectives: [],
      openingScript: "",
      talkingPoints: ["Remember to set an agenda"],
      questionsToAsk: [],
      decisionsToObtain: [],
      risksToDiscuss: [],
      peopleToEngage: [],
      leadershipOpportunities: ["Be a facilitation tip"],
      stakeholderConcerns: [],
      ownershipMoments: [],
    },
    duringPrompts: [],
  };
  const state: MissionState = {
    projects: [
      {
        id: "proj-thin",
        name: "Thin",
        code: "T",
        summary: "",
        status: "healthy",
        currentFocus: "",
        stakeholders: [],
      },
    ],
    memories: [],
    recommendations: [],
    meetings: [meeting],
    releases: [],
    todos: [],
    knowledge: [emptyKnowledge("proj-thin")],
    risks: [],
    timeline: [],
  };
  const brief = buildMeetingCatchUpBrief(state, meeting);
  assert.equal(briefUsesStoredPrepAdvice(brief, meeting), false);
  assert.ok(brief.thin);
  assert.ok(brief.evidence.every((l) => l.source === "meeting" || l.source === "date"));
});

check("suggested when-questions use natural language", () => {
  assert.equal(
    formatWhenQuestion("Merge window closed", new Date(Date.now() - 86400000).toISOString()),
    "When did the merge window close?",
  );
  assert.equal(
    formatWhenQuestion("Merge window closed", new Date(Date.now() + 86400000).toISOString()),
    "When does the merge window close?",
  );
  assert.match(formatWhenQuestion("CAB approval"), /When is the CAB approval\?/);
  const state = createSeedState();
  const qs = buildCanonicalSuggestions({ state, projectId: ATLAS, limit: 8 });
  const merge = qs.find((q) => /merge window/i.test(q.question));
  assert.ok(merge);
  assert.doesNotMatch(merge!.question, /When is Merge window closed/);
});

check("KC cards no longer repeat bucket taxonomy", () => {
  const ui = readFileSync(
    join(ROOT, "src/components/knowledge-centre/OceanKnowledgeFrames.tsx"),
    "utf8",
  );
  assert.doesNotMatch(ui, /bucketLabel\(item\.bucket\) · \{item\.typeLabel\}/);
  assert.match(ui, /item\.typeLabel/);
  assert.doesNotMatch(ui, /MeetingPrepFrame/);
  assert.match(ui, /KcTimeline/);
  assert.match(ui, /Catch me up|NextMeetingCue/);
});

check("mode selector hides the raw mobile scrollbar", () => {
  const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
  assert.match(css, /ocean-mode-selector::-webkit-scrollbar/);
  assert.match(css, /scrollbar-width:\s*none/);
});

console.log(`\n${passed} Timeline / Meeting Prep checks passed.`);
