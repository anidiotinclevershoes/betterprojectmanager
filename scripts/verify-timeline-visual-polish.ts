/**
 * Timeline visual polish — presentation only.
 * Does not persist, infer availability, or change Catch Me Up.
 *
 * Run: npx tsx scripts/verify-timeline-visual-polish.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  AVAILABILITY_NOT_PROVIDED,
  NO_UNAVAILABILITY_RECORDED,
  compactPreviewEvents,
  composeTimelineProjection,
  eventKindLabel,
  eventWhen,
  packLaneEvents,
  shortEventLabel,
  todayLeftPercent,
} from "../src/lib/knowledge-centre/timeline-projection";
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

function withElenaAway(state: MissionState): MissionState {
  const next = clone(state);
  const elena = next.projects
    .find((p) => p.id === ATLAS)!
    .stakeholders.find((s) => s.name === "Elena Rostova")!;
  const knowledge = next.knowledge.find((k) => k.projectId === ATLAS)!;
  knowledge.structured = [
    ...(knowledge.structured ?? []),
    availabilityItem({
      id: "avail-elena-visual",
      projectId: ATLAS,
      personId: elena.id,
      personName: elena.name,
      from: new Date(Date.now() + 2 * 86400000).toISOString(),
      to: new Date(Date.now() + 5 * 86400000).toISOString(),
    }),
  ];
  return next;
}

check("rich Timeline renders supported event classes with meaningful labels", () => {
  const view = composeTimelineProjection(createSeedState(), ATLAS);
  assert.equal(view.empty, false);
  assert.equal(view.sparse, false);
  const kinds = new Set(view.events.map((e) => e.kind));
  assert.ok(kinds.has("milestone") || kinds.has("deadline"));
  assert.ok(kinds.has("meeting"));
  assert.ok(kinds.has("todo"));
  const labels = view.projectLane.events.map((e) => shortEventLabel(e));
  assert.ok(labels.some((l) => l === "CAB" || l === "CAB prep" || l === "CAB pack"));
  assert.ok(labels.some((l) => l === "Production" || l === "Merge"));
  assert.ok(labels.every((l) => l.length > 1));
  assert.ok(!labels.includes("C"));
  assert.ok(!labels.includes("R"));
  assert.ok(!labels.includes("P"));
});

check("sparse Timeline stays compact", () => {
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
  const sparse = clone(empty);
  sparse.timeline = [
    {
      id: "one",
      projectId: "proj-empty",
      label: "UAT sign-off",
      type: "milestone",
      startAt: new Date().toISOString(),
    },
  ];
  const few = composeTimelineProjection(sparse, "proj-empty");
  assert.equal(few.sparse, true);
  assert.equal(few.personLanes.length, 0);
  assert.equal(few.projectLane.events.length, 1);
  assert.equal(shortEventLabel(few.projectLane.events[0]!), "UAT");
  assert.equal(compactPreviewEvents(few).length, 0);
  const spanDays = (few.endMs - few.startMs) / 86400000;
  assert.ok(spanDays <= 12);
});

check("known Away range displays as a range, not a point", () => {
  const view = composeTimelineProjection(withElenaAway(createSeedState()), ATLAS);
  const elena = view.personLanes.find((l) => l.label === "Elena Rostova");
  assert.ok(elena);
  assert.equal(elena!.hasExplicitUnavailability, true);
  const away = elena!.events.find((e) => e.kind === "unavailability");
  assert.ok(away?.endAt);
  assert.equal(shortEventLabel(away!), "Away");
  assert.match(elena!.availabilityNote ?? "", /Away/i);
  assert.ok(away!.endAt !== away!.startAt);
  const span = Math.max(view.endMs - view.startMs, 1);
  const packed = packLaneEvents([away!], view.startMs, span);
  assert.ok(packed[0]!.width > 4);
});

check("no availability information is never rendered as Available", () => {
  const view = composeTimelineProjection(createSeedState(), ATLAS);
  assert.equal(AVAILABILITY_NOT_PROVIDED, "availability not provided");
  assert.equal(NO_UNAVAILABILITY_RECORDED, AVAILABILITY_NOT_PROVIDED);
  for (const lane of view.personLanes) {
    assert.equal(lane.hasExplicitUnavailability, false);
    assert.equal(lane.availabilityNote, AVAILABILITY_NOT_PROVIDED);
    assert.doesNotMatch(lane.availabilityNote ?? "", /available/i);
    assert.doesNotMatch(lane.availabilityNote ?? "", /100%/);
    assert.doesNotMatch(lane.availabilityNote ?? "", /\bfree\b/i);
  }
  const ui = readFileSync(join(ROOT, "src/components/knowledge-centre/KcTimeline.tsx"), "utf8");
  assert.doesNotMatch(ui, /["']Available["']/);
  assert.doesNotMatch(ui, /100% available/i);
});

check("Person without dated facts does not create a misleading lane", () => {
  const state = createSeedState();
  state.projects.find((p) => p.id === ATLAS)!.stakeholders.push({
    id: "st-ghost-visual",
    name: "Nobody Dated",
    role: "Observer",
  });
  const view = composeTimelineProjection(state, ATLAS);
  assert.ok(!view.personLanes.some((l) => l.personId === "st-ghost-visual"));
  assert.ok(!view.events.some((e) => /Nobody Dated/i.test(e.title)));
});

check("meeting attendee relationship renders only where stored", () => {
  const state = createSeedState();
  const priyaOnly: Meeting = {
    id: "mtg-priya-only",
    projectId: ATLAS,
    title: "Finance briefing",
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    attendees: ["Priya Shah"],
    phase: "upcoming",
    prep: {
      objectives: [],
      openingScript: "",
      talkingPoints: [],
      questionsToAsk: [],
      decisionsToObtain: [],
      risksToDiscuss: [],
      peopleToEngage: [],
      leadershipOpportunities: [],
      stakeholderConcerns: [],
      ownershipMoments: [],
    },
    duringPrompts: [],
  };
  state.meetings = [...(state.meetings ?? []), priyaOnly];
  const view = composeTimelineProjection(state, ATLAS);
  const priya = view.personLanes.find((l) => l.label === "Priya Shah");
  const marcus = view.personLanes.find((l) => l.label === "Marcus Webb");
  assert.ok(priya?.events.some((e) => e.meetingId === "mtg-priya-only"));
  assert.ok(!marcus?.events.some((e) => e.meetingId === "mtg-priya-only"));
  const meeting = view.projectLane.events.find((e) => e.meetingId === "mtg-priya-only");
  assert.deepEqual(meeting?.attendees, ["Priya Shah"]);
});

check("busy period stacks overlapping labels instead of colliding", () => {
  const sameDay = new Date(Date.now() + 3 * 86400000).toISOString();
  const events = [
    { id: "a", kind: "milestone" as const, title: "CAB approval", startAt: sameDay, source: "timeline" as const },
    { id: "b", kind: "todo" as const, title: "Chase billing regression sign-off", startAt: sameDay, source: "todo" as const },
    { id: "c", kind: "deadline" as const, title: "Production deployment", startAt: sameDay, source: "timeline" as const },
  ];
  const start = Date.now();
  const packed = packLaneEvents(events, start, 14 * 86400000);
  assert.equal(packed.length, 3);
  assert.ok(packed.some((row) => row.stack > 0));
  const labels = packed.map((row) => row.label);
  assert.ok(labels.includes("CAB"));
  assert.ok(labels.includes("Production"));
  assert.ok(labels.some((l) => /billing|chase/i.test(l)));
});

check("date window includes Today and keeps past context", () => {
  const view = composeTimelineProjection(createSeedState(), ATLAS);
  const today = todayLeftPercent(view.startMs, view.endMs - view.startMs);
  assert.ok(today != null);
  assert.ok(today! >= 0 && today! <= 100);
  assert.ok(view.projectLane.events.some((e) => eventWhen(e) === "past"));
  assert.ok(view.projectLane.events.some((e) => eventWhen(e) === "upcoming"));
  assert.ok((view.endMs - Date.now()) / 86400000 >= 13);
});

check("Timeline interaction helpers perform no writes", () => {
  const state = createSeedState();
  const before = JSON.stringify(state);
  const view = composeTimelineProjection(state, ATLAS);
  packLaneEvents(view.projectLane.events, view.startMs, view.endMs - view.startMs);
  compactPreviewEvents(view);
  view.events.forEach((e) => {
    shortEventLabel(e);
    eventKindLabel(e.kind);
    eventWhen(e);
  });
  assert.equal(JSON.stringify(state), before);
});

check("collapsed preview is for rich projects only", () => {
  const rich = composeTimelineProjection(createSeedState(), ATLAS);
  const preview = compactPreviewEvents(rich, 3);
  assert.ok(preview.length >= 1 && preview.length <= 3);
  const ui = readFileSync(
    join(ROOT, "src/components/knowledge-centre/OceanKnowledgeFrames.tsx"),
    "utf8",
  );
  assert.match(ui, /KcTimelinePreview/);
  assert.match(ui, /!timelineOpen && !timeline.sparse/);
});

check("mobile layout scrolls inside Timeline and hides raw scrollbars", () => {
  const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
  assert.match(css, /\.kc-tl-scroll\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.kc-tl-scroll\s*\{[^}]*scrollbar-width:\s*none/);
  assert.match(css, /\.kc-tl-scroll::-webkit-scrollbar\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.kc-tl-label\s*\{[^}]*position:\s*sticky/);
  assert.match(css, /\.kc-tl-canvas\s*\{[^}]*min-width:\s*36rem/);
  assert.match(css, /minmax\(26rem,\s*1fr\)/);
  assert.doesNotMatch(
    css,
    /@media \(max-width: 720px\) \{[\s\S]*\.kc-tl-sublane \{\s*grid-template-columns: 1fr;/,
  );
});

check("quiet availability lives on the Person label, not as a track event", () => {
  const ui = readFileSync(join(ROOT, "src/components/knowledge-centre/KcTimeline.tsx"), "utf8");
  assert.match(ui, /kc-tl-quiet/);
  assert.match(ui, /availabilityNote/);
  assert.doesNotMatch(ui, /No unavailability recorded/);
  const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
  assert.match(css, /\.kc-tl-quiet\.is-unknown/);
});

check("Today marker and event detail stay read-only", () => {
  const ui = readFileSync(join(ROOT, "src/components/knowledge-centre/KcTimeline.tsx"), "utf8");
  assert.match(ui, /kc-tl-today/);
  assert.match(ui, /kc-tl-detail/);
  assert.match(ui, /Catch me up/);
  assert.doesNotMatch(ui, /onDrag|draggable|contentEditable/);
  assert.doesNotMatch(ui, /persist|writeTruth|mutate/);
  const proj = readFileSync(join(ROOT, "src/lib/knowledge-centre/timeline-projection.ts"), "utf8");
  assert.match(proj, /Does not persist/);
  assert.doesNotMatch(proj, /tokens\(/);
});

check("Meeting Catch Me Up modules remain unchanged by this pass", () => {
  const src = readFileSync(join(ROOT, "src/lib/knowledge-centre/meeting-catch-up.ts"), "utf8");
  assert.match(src, /buildDeterministicSnapshot/);
  assert.doesNotMatch(src, /openai/i);
  assert.match(src, /Does not use stored generic Meeting.prep/);
  const panel = readFileSync(
    join(ROOT, "src/components/knowledge-centre/MeetingCatchUp.tsx"),
    "utf8",
  );
  assert.match(panel, /Catch me up/);
  assert.doesNotMatch(panel, /MeetingPrepFrame/);
  assert.match(panel, /NextMeetingCue/);
});

check("Knowledge Centre four-bucket chrome is still the parent surface", () => {
  const ui = readFileSync(
    join(ROOT, "src/components/knowledge-centre/OceanKnowledgeFrames.tsx"),
    "utf8",
  );
  assert.match(ui, /kc-bucket-nav/);
  assert.match(ui, /ocean-frame-timeline/);
  assert.match(ui, /All \| Issues \| People \| To Do \| Knowledge|bucketLabel/);
  assert.match(ui, /KcTimeline/);
});

console.log(`\n${passed} Timeline visual polish checks passed.`);
