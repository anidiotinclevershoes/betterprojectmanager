/**
 * Legacy influence audit — deactivated Meeting Prep / Gantt write / leftover
 * Capture callers must not leak into current production behaviour.
 *
 * Run: npx tsx scripts/verify-legacy-influence.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCaptureContext } from "../src/lib/capture/context";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  briefUsesStoredPrepAdvice,
  buildMeetingCatchUpBrief,
  nextKnownMeeting,
} from "../src/lib/knowledge-centre/meeting-catch-up";
import { composeTimelineProjection } from "../src/lib/knowledge-centre/timeline-projection";
import { createSeedState } from "../src/lib/seed";
import type { Meeting, MissionState, TimelineItem } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const ATLAS = "proj-atlas";
const PREP_MARKER = "LEGACY-PREP-OPENING-DO-NOT-USE-IN-CATCH-UP";
const PREP_OBJECTIVE = "LEGACY-PREP-OBJECTIVE-MUST-NOT-REACH-CAPTURE";
const GANTT_LABEL = "Legacy Gantt CAB pack (historical row)";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function historicalPrepMeeting(): Meeting {
  return {
    id: "mtg-legacy-prep",
    projectId: ATLAS,
    title: "Legacy prep fixture",
    startsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
    attendees: ["Elena Rostova"],
    phase: "upcoming",
    prep: {
      objectives: [PREP_OBJECTIVE],
      openingScript: PREP_MARKER,
      talkingPoints: ["Remember to set an agenda for this leftover brief"],
      questionsToAsk: ["What facilitation tip should we reuse?"],
      decisionsToObtain: ["Sign the leftover brief"],
      risksToDiscuss: ["Stale stored prep leaking into Catch Me Up"],
      peopleToEngage: ["Elena"],
      leadershipOpportunities: ["Be a facilitation tip"],
      stakeholderConcerns: ["They may treat stored prep as advice"],
      ownershipMoments: ["Own the leftover brief"],
    },
    duringPrompts: [],
  };
}

function historicalGanttRow(): TimelineItem {
  return {
    id: "tl-legacy-gantt",
    projectId: ATLAS,
    label: GANTT_LABEL,
    type: "milestone",
    startAt: new Date(Date.now() + 4 * 86400000).toISOString(),
    source: "manual",
  };
}

function withHistoricalLegacy(state: MissionState): MissionState {
  const next = clone(state);
  next.meetings = [...next.meetings, historicalPrepMeeting()];
  next.timeline = [...(next.timeline ?? []), historicalGanttRow()];
  return next;
}

check("production KC no longer mounts leftover Meeting Prep", () => {
  const frames = readSrc(
    "src/components/knowledge-centre/OceanKnowledgeFrames.tsx",
  );
  assert.match(frames, /MeetingCatchUpPanel/);
  assert.match(frames, /NextMeetingCue/);
  assert.match(frames, /TimelineFrame/);
  assert.doesNotMatch(frames, /MeetingPrepFrame/);
  assert.doesNotMatch(frames, /ocean-frame-meeting-prep/);
  assert.doesNotMatch(frames, /buildMeetingPrepItems/);
  assert.equal(existsSync(join(ROOT, "src/components/frames/MeetingPrepFrame.tsx")), true);
  assert.equal(
    existsSync(join(ROOT, "src/components/meetings/MeetingBriefModal.tsx")),
    true,
  );
});

check("leftover Meeting Prep editor cannot write session truth", () => {
  const modal = readSrc("src/components/meetings/MeetingBriefModal.tsx");
  assert.match(modal, /Writes are disabled|writes are disabled|Editing retired/i);
  assert.doesNotMatch(modal, /updateMeeting\(/);
  assert.match(modal, /disabled/);
});

check("stale stored Meeting.prep does not replace meeting Catch Me Up", () => {
  const state = withHistoricalLegacy(createSeedState());
  const before = JSON.stringify(state);
  const meeting = state.meetings.find((m) => m.id === "mtg-legacy-prep");
  assert.ok(meeting);
  const brief = buildMeetingCatchUpBrief(state, meeting!);
  assert.equal(brief.meetingId, meeting!.id);
  assert.equal(briefUsesStoredPrepAdvice(brief, meeting!), false);
  const blob = brief.evidence.map((l) => l.text).join("\n");
  assert.doesNotMatch(blob, new RegExp(PREP_MARKER));
  assert.doesNotMatch(blob, new RegExp(PREP_OBJECTIVE));
  assert.doesNotMatch(blob, /remember to set an agenda/i);
  assert.equal(JSON.stringify(state), before);
});

check("loading historical Meeting.prep does not mutate or delete it", () => {
  const state = withHistoricalLegacy(createSeedState());
  const meeting = state.meetings.find((m) => m.id === "mtg-legacy-prep")!;
  const beforePrep = JSON.stringify(meeting.prep);
  nextKnownMeeting(state, ATLAS);
  buildMeetingCatchUpBrief(state, meeting);
  composeTimelineProjection(state, ATLAS);
  assert.equal(JSON.stringify(meeting.prep), beforePrep);
  assert.equal(meeting.prep.openingScript, PREP_MARKER);
  assert.ok(state.meetings.some((m) => m.id === "mtg-legacy-prep"));
});

check("seed meetings still hydrate stored prep without using it as advice", () => {
  const state = createSeedState();
  const meeting = nextKnownMeeting(state, ATLAS);
  assert.ok(meeting?.prep);
  const before = JSON.stringify(state.meetings);
  const brief = buildMeetingCatchUpBrief(state, meeting!);
  assert.equal(briefUsesStoredPrepAdvice(brief, meeting!), false);
  assert.equal(JSON.stringify(state.meetings), before);
});

check("Capture context no longer ranks or summarises meetings from stored prep", () => {
  const state = withHistoricalLegacy(createSeedState());
  const ctx = buildCaptureContext({
    projectId: ATLAS,
    captureText: `${PREP_MARKER} ${PREP_OBJECTIVE}`,
    state,
  });
  const serialized = JSON.stringify(ctx.meetings);
  assert.doesNotMatch(serialized, new RegExp(PREP_MARKER));
  assert.doesNotMatch(serialized, new RegExp(PREP_OBJECTIVE));
  const contextSrc = readSrc("src/lib/capture/context.ts");
  assert.doesNotMatch(contextSrc, /m\.prep\.openingScript/);
  assert.doesNotMatch(contextSrc, /m\.prep\.objectives/);
  const adapter = readSrc("src/ai/domain/adapters/index.ts");
  assert.doesNotMatch(adapter, /meeting\.prep\.objectives/);
});

check("production Timeline no longer mounts writable Gantt", () => {
  const frame = readSrc("src/components/frames/TimelineFrame.tsx");
  assert.match(frame, /KcTimeline/);
  assert.doesNotMatch(frame, /from \"@\/components\/ProjectTimelineGantt\"/);
  assert.doesNotMatch(frame, /addTimelineItem/);
  const gantt = readSrc("src/components/ProjectTimelineGantt.tsx");
  assert.doesNotMatch(gantt, /addTimelineItem/);
  assert.doesNotMatch(gantt, /timeline-add/);
  assert.doesNotMatch(gantt, /onAdd/);
  assert.equal(existsSync(join(ROOT, "src/components/ProjectTimelineGantt.tsx")), true);
});

check("modern Timeline still projects dated authoritative truth and stays read-only", () => {
  const state = withHistoricalLegacy(createSeedState());
  const before = JSON.stringify(state);
  const view = composeTimelineProjection(state, ATLAS);
  assert.equal(view.empty, false);
  assert.ok(view.events.some((e) => e.kind === "meeting"));
  assert.ok(view.events.some((e) => e.kind === "milestone" || e.kind === "deadline"));
  assert.ok(view.events.some((e) => e.source === "todo" || e.kind === "todo"));
  assert.ok(view.events.some((e) => e.title === GANTT_LABEL));
  const ui = readSrc("src/components/knowledge-centre/KcTimeline.tsx");
  assert.doesNotMatch(ui, /addTimelineItem/);
  assert.doesNotMatch(ui, /persistTimelineItem/);
  assert.doesNotMatch(ui, /onDrag|draggable|contentEditable/);
  const proj = readSrc("src/lib/knowledge-centre/timeline-projection.ts");
  assert.match(proj, /Does not persist/);
  assert.equal(JSON.stringify(state), before);
});

check("loading historical Gantt / timeline rows does not mutate or delete them", () => {
  const state = withHistoricalLegacy(createSeedState());
  const beforeTimeline = JSON.stringify(state.timeline);
  composeTimelineProjection(state, ATLAS);
  assert.equal(JSON.stringify(state.timeline), beforeTimeline);
  assert.ok(state.timeline?.some((t) => t.id === "tl-legacy-gantt"));
});

check("current Capture Review → Apply path remains the production writer", () => {
  assert.equal(existsSync(join(ROOT, "src/app/api/capture/route.ts")), true);
  assert.equal(existsSync(join(ROOT, "src/app/api/capture/apply/route.ts")), true);
  assert.equal(existsSync(join(ROOT, "src/app/api/extract/route.ts")), false);
  assert.equal(existsSync(join(ROOT, "src/app/api/plan/route.ts")), false);
  const apply = readSrc("src/app/api/capture/apply/route.ts");
  assert.match(apply, /applyApprovedCaptureSuggestion/);
  const capturePage = readSrc("src/app/capture/page.tsx");
  assert.match(capturePage, /redirect/);
  const np = readSrc("src/components/onboarding/NewProjectExperience.tsx");
  assert.doesNotMatch(np, /NewProjectCategorisation/);
  assert.doesNotMatch(np, /Talk it through/);
  assert.match(np, /sourceMode: "compose"/);
  assert.equal(
    existsSync(join(ROOT, "src/components/onboarding/NewProjectCategorisation.tsx")),
    true,
  );
});

check("hydrate still accepts historical Meeting.prep without requiring it", () => {
  const load = readSrc("src/lib/data/supabase/load-mission-state.ts");
  assert.match(load, /prep:/);
  assert.match(load, /openingScript: ""/);
  const persist = readSrc("src/lib/data/supabase/persist-mutations.ts");
  assert.doesNotMatch(persist, /updateMeeting/);
  const empty: MissionState = {
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
    meetings: [historicalPrepMeeting()],
    releases: [],
    todos: [],
    knowledge: [emptyKnowledge("proj-thin")],
    risks: [],
    timeline: [historicalGanttRow()],
  };
  empty.meetings[0] = { ...empty.meetings[0]!, projectId: "proj-thin" };
  empty.timeline[0] = { ...empty.timeline[0]!, projectId: "proj-thin" };
  const before = JSON.stringify(empty);
  composeTimelineProjection(empty, "proj-thin");
  assert.equal(JSON.stringify(empty), before);
});

console.log(`\n${passed} legacy-influence checks passed.`);
