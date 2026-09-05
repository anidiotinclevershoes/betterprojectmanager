/**
 * Meeting-scoped Catch Me Up — read-only, truth-grounded, no stored prep advice.
 *
 * Run: npx tsx scripts/verify-meeting-catch-up.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  briefUsesStoredPrepAdvice,
  buildMeetingCatchUpBrief,
  nextKnownMeeting,
} from "../src/lib/knowledge-centre/meeting-catch-up";
import { createSeedState } from "../src/lib/seed";
import type { Meeting, MissionState } from "../src/lib/types";

const ROOT = join(import.meta.dirname, "..");
const ATLAS = "proj-atlas";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

check("scoped brief reads existing truth and does not persist", () => {
  const state = createSeedState();
  const before = JSON.stringify(state);
  const meeting = nextKnownMeeting(state, ATLAS);
  assert.ok(meeting);
  const brief = buildMeetingCatchUpBrief(state, meeting!);
  assert.equal(brief.meetingId, meeting!.id);
  assert.ok(brief.about.length >= 1);
  assert.ok(brief.evidence.some((l) => l.source === "meeting"));
  assert.equal(JSON.stringify(state), before);
});

check("stored Meeting.prep is not deleted and is not used as advice", () => {
  const state = createSeedState();
  const meeting = nextKnownMeeting(state, ATLAS)!;
  assert.ok(meeting.prep);
  const beforeMeetings = JSON.stringify(state.meetings);
  const brief = buildMeetingCatchUpBrief(state, meeting);
  assert.equal(briefUsesStoredPrepAdvice(brief, meeting), false);
  assert.equal(JSON.stringify(state.meetings), beforeMeetings);
});

check("generic unsupported advice is not manufactured", () => {
  const state = createSeedState();
  const meeting = nextKnownMeeting(state, ATLAS)!;
  const brief = buildMeetingCatchUpBrief(state, meeting);
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
});

check("existing Catch Me Up machinery is reused without a new AI route", () => {
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
  const frames = readFileSync(
    join(ROOT, "src/components/knowledge-centre/OceanKnowledgeFrames.tsx"),
    "utf8",
  );
  assert.match(frames, /NextMeetingCue/);
  assert.match(frames, /MeetingCatchUpPanel/);
  assert.doesNotMatch(frames, /MeetingPrepFrame/);
  assert.match(frames, /TimelineFrame/);
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
  assert.ok(
    brief.evidence.every((l) => l.source === "meeting" || l.source === "date"),
  );
});

check("project AI Catch Me Up mode is unchanged", () => {
  const workspace = readFileSync(
    join(ROOT, "src/components/knowledge-centre/OceanProjectWorkspace.tsx"),
    "utf8",
  );
  assert.match(workspace, /CatchMeUpPanel/);
  assert.match(workspace, /mode === "catch-me-up"/);
  assert.equal(existsSync(join(ROOT, "src/app/api/catch-me-up/route.ts")), true);
});

console.log(`\n${passed} meeting Catch Me Up checks passed.`);
