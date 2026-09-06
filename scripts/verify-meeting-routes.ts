/**
 * Retired leftover Meeting Prep bookmarks.
 * /meetings and /meetings/[id] must not paint stored Meeting.prep.
 *
 * Run: npx tsx scripts/verify-meeting-routes.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  briefUsesStoredPrepAdvice,
  buildMeetingCatchUpBrief,
  nextKnownMeeting,
} from "../src/lib/knowledge-centre/meeting-catch-up";
import { createSeedState } from "../src/lib/seed";

const ROOT = join(import.meta.dirname, "..");
const ATLAS = "proj-atlas";
const PREP_FIELDS = [
  "openingScript",
  "talkingPoints",
  "decisionsToObtain",
  "questionsToAsk",
  "leadershipOpportunities",
  "stakeholderConcerns",
  "ownershipMoments",
  "Prepare to lead every room",
  "Edit meeting prep",
];

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function readSrc(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

check("GET /meetings redirects into current product and does not paint prep", () => {
  const page = readSrc("src/app/meetings/page.tsx");
  assert.match(page, /redirect\("\/"\)/);
  assert.doesNotMatch(page, /useMission/);
  assert.doesNotMatch(page, /meeting\.prep/);
  for (const field of PREP_FIELDS) {
    assert.doesNotMatch(page, new RegExp(field));
  }
});

check("GET /meetings/[id] opens that meeting's Knowledge Centre and does not paint prep", () => {
  const page = readSrc("src/app/meetings/[id]/page.tsx");
  assert.match(page, /router\.replace/);
  assert.match(page, /\/projects\/\$\{projectId\}/);
  assert.match(page, /Opening Knowledge Centre/);
  assert.doesNotMatch(page, /meeting\.prep/);
  assert.doesNotMatch(page, /openingScript/);
  assert.doesNotMatch(page, /decisionsToObtain/);
  assert.doesNotMatch(page, /talkingPoints/);
  assert.doesNotMatch(page, /PrepPanel/);
  assert.doesNotMatch(page, /updateMeeting/);
  assert.doesNotMatch(page, /persist/);
  const chrome = readSrc("src/components/AppShell.tsx");
  assert.doesNotMatch(chrome, /Briefs and preparation/);
  assert.doesNotMatch(chrome, /pathname\.startsWith\("\/meetings"\)/);
});

check("retired routes do not write or delete stored Meeting.prep", () => {
  const index = readSrc("src/app/meetings/page.tsx");
  const detail = readSrc("src/app/meetings/[id]/page.tsx");
  assert.doesNotMatch(index, /updateMeeting|persist|setState/);
  assert.doesNotMatch(detail, /updateMeeting|persist|setState/);
  const load = readSrc("src/lib/data/supabase/load-mission-state.ts");
  assert.match(load, /prep:/);
  const state = createSeedState();
  const before = JSON.stringify(state.meetings);
  const meeting = nextKnownMeeting(state, ATLAS);
  assert.ok(meeting?.prep);
  const brief = buildMeetingCatchUpBrief(state, meeting!);
  assert.equal(briefUsesStoredPrepAdvice(brief, meeting!), false);
  assert.equal(JSON.stringify(state.meetings), before);
});

check("meeting-scoped Catch Me Up still works after route retirement", () => {
  const frames = readSrc(
    "src/components/knowledge-centre/OceanKnowledgeFrames.tsx",
  );
  assert.match(frames, /MeetingCatchUpPanel/);
  assert.match(frames, /NextMeetingCue/);
  assert.doesNotMatch(frames, /MeetingPrepFrame/);
  const ui = readSrc("src/components/knowledge-centre/MeetingCatchUp.tsx");
  assert.match(ui, /Catch me up/);
  const state = createSeedState();
  const meeting = nextKnownMeeting(state, ATLAS);
  assert.ok(meeting);
  const brief = buildMeetingCatchUpBrief(state, meeting!);
  assert.equal(brief.meetingId, meeting!.id);
  assert.ok(brief.about.length >= 1);
});

console.log(`\n${passed} retired meeting-route checks passed.`);
