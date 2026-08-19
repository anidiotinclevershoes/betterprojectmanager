/**
 * Tell Me V1 verification — deterministic suggestions, search, freshness, scope.
 * No live OpenAI calls required.
 */
import assert from "node:assert/strict";
import {
  buildDeterministicSnapshot,
  buildSuggestedQuestions,
  computeProjectRevision,
  assessFreshness,
  resolveTellMeScope,
  searchProjectKnowledge,
  highlightMatches,
  answerTellMeQuestion,
  pickSources,
} from "../src/lib/tell-me";
import { emptyKnowledge } from "../src/lib/knowledge";
import type { MissionState, Project } from "../src/lib/types";

function baseProject(partial: Partial<Project> & Pick<Project, "id" | "name" | "code">): Project {
  return {
    summary: partial.summary ?? "",
    status: partial.status ?? "healthy",
    currentFocus: partial.currentFocus ?? "",
    stakeholders: partial.stakeholders ?? [],
    ...partial,
  };
}

function fixtureState(): MissionState {
  const atlas = baseProject({
    id: "p-atlas",
    name: "Atlas Modernisation",
    code: "ATLAS",
    currentFocus: "CAB pack and rollback readiness",
    stakeholders: [
      { id: "s1", name: "Sarah Chen", role: "Business owner" },
      { id: "s2", name: "Nina Patel", role: "Tech lead" },
    ],
  });
  const horizon = baseProject({
    id: "p-horizon",
    name: "Horizon Customer Portal",
    code: "HORIZON",
    currentFocus: "Security sign-off",
  });

  const knowledge = emptyKnowledge("p-atlas");
  knowledge.sections.now = [
    "CAB pack due Friday",
    "Security sign-off outstanding",
  ];
  knowledge.sections.decisions = [
    "CAB requires evidence 48 hours before the board.",
  ];
  knowledge.sections.risks = ["Security sign-off may expose CAB readiness"];
  knowledge.sections.people = ["Nina owns the rollback plan for Release 9"];
  knowledge.sections.openLoops = ["Await Finance approval"];

  return {
    projects: [atlas, horizon],
    memories: [],
    recommendations: [
      {
        id: "r1",
        kind: "risk",
        urgency: "this_week",
        title: "Vendor response still outstanding",
        action: "Chase vendor",
        why: "Blocks testing",
        leadershipImpact: "Shows control",
        projectId: "p-atlas",
        createdAt: new Date().toISOString(),
        status: "active",
      },
    ],
    meetings: [
      {
        id: "m1",
        projectId: "p-atlas",
        title: "CAB board",
        startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        attendees: ["Sarah"],
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
      },
    ],
    releases: [
      {
        id: "rel1",
        projectId: "p-atlas",
        name: "Release 9",
        targetDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        currentStage: "cab_preparation",
        stages: [],
        risks: [],
      },
    ],
    todos: [
      {
        id: "t1",
        projectId: "p-atlas",
        title: "Rollback plan evidence",
        done: false,
        createdAt: new Date().toISOString(),
        kind: "WAITING",
        waitingOn: "vendor",
      },
      {
        id: "t2",
        projectId: "p-atlas",
        title: "Finance confirmation",
        done: false,
        createdAt: new Date().toISOString(),
        kind: "WAITING",
        waitingOn: "Finance",
      },
    ],
    knowledge: [knowledge],
    timeline: [
      {
        id: "tl1",
        projectId: "p-atlas",
        label: "CAB Friday",
        type: "deadline",
        startAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    history: [
      {
        id: "h1",
        type: "task_updated",
        title: "Release date moved after security delay",
        detail: "Moved one week",
        projectId: "p-atlas",
        createdAt: new Date().toISOString(),
        source: "system",
      },
    ],
  };
}

async function main() {
  const state = fixtureState();

  // Suggestions are contextual, not generic boilerplate
  const suggestions = buildSuggestedQuestions({
    state,
    projectId: "p-atlas",
    userDisplayName: "Tom Hughes",
  });
  assert.ok(suggestions.length >= 3, "expected contextual suggestions");
  assert.ok(
    suggestions.some((s) => /CAB|waiting|vendor|Sarah|Nina|risk|Finance/i.test(s.question)),
    "suggestions should reflect project signals",
  );
  assert.ok(
    !suggestions.every((s) =>
      /Summarise my project|What are my tasks\?|What are my risks\?/i.test(
        s.question,
      ),
    ),
    "must not be generic boilerplate only",
  );

  // Knowledge search (non-AI)
  const knowledge = state.knowledge[0]!;
  const hits = searchProjectKnowledge(knowledge, "CAB");
  assert.ok(hits.length >= 1, "CAB search should hit knowledge");
  const parts = highlightMatches(hits[0]!.bullet, hits[0]!.matchRanges);
  assert.ok(parts.some((p) => p.hit), "highlight ranges expected");

  // Scope
  const scoped = resolveTellMeScope({
    question: "What Risks are still open?",
    selectedProjectId: "p-atlas",
    state,
  });
  assert.equal(scoped.mode, "project");
  assert.equal(scoped.projectId, "p-atlas");

  const other = resolveTellMeScope({
    question: "What's happening with HORIZON security?",
    selectedProjectId: "p-atlas",
    state,
  });
  assert.equal(other.projectId, "p-horizon");
  assert.equal(other.mode, "explicit_project");

  const cross = resolveTellMeScope({
    question: "Which of my projects have CAB work this week?",
    selectedProjectId: "p-atlas",
    state,
  });
  assert.equal(cross.mode, "cross_project");

  // Snapshot + freshness
  const snap = buildDeterministicSnapshot({
    state,
    projectId: "p-atlas",
    userDisplayName: "Tom",
  });
  assert.equal(snap.kind, "deterministic");
  assert.ok(snap.suggestedQuestions.length > 0);
  const rev1 = computeProjectRevision(state, "p-atlas");
  assert.equal(snap.sourceRevision, rev1);

  const fresh = assessFreshness({
    state,
    projectId: "p-atlas",
    snapshot: snap,
  });
  assert.equal(fresh.isStale, false);

  // Mutate knowledge → stale
  const mutated = structuredClone(state);
  mutated.knowledge[0]!.sections.now.push("Testing window confirmed for 19 August");
  mutated.knowledge[0]!.updatedAt = new Date().toISOString();
  const stale = assessFreshness({
    state: mutated,
    projectId: "p-atlas",
    snapshot: snap,
  });
  assert.equal(stale.isStale, true);

  // Local grounded answers (no OpenAI)
  const prevKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const ownership = await answerTellMeQuestion({
    question: "Who owns rollback planning?",
    state,
    selectedProjectId: "p-atlas",
  });
  assert.match(ownership.answer, /Nina/i);

  const related = await answerTellMeQuestion({
    question: "Has Finance approved the budget?",
    state,
    selectedProjectId: "p-atlas",
  });
  assert.match(related.answer, /outstanding|Finance/i);

  // Evidence relevance: unsupported Finance must not cite Nina rollback
  const noEvidence = await answerTellMeQuestion({
    question: "Has Finance approved the budget?",
    state: {
      ...state,
      knowledge: [
        {
          ...knowledge,
          sections: {
            ...knowledge.sections,
            openLoops: [],
            now: knowledge.sections.now.filter((b) => !/Finance|approv/i.test(b)),
          },
        },
      ],
      todos: state.todos.filter((t) => !/Finance|approv|budget/i.test(t.title)),
    },
    selectedProjectId: "p-atlas",
  });
  assert.match(noEvidence.answer, /can.?t find confirmation/i);
  assert.equal(noEvidence.confidence, "not_found");
  assert.equal(noEvidence.sources.length, 0);
  assert.ok(
    !noEvidence.sources.some((s) => /Nina|rollback/i.test(s.label)),
    "must not cite unrelated Nina rollback evidence",
  );

  // pickSources never falls back to arbitrary catalogue on not_found
  const bogus = pickSources(
    [
      {
        id: "k1",
        kind: "knowledge",
        label: "Nina owns the rollback plan for Release 9",
      },
    ],
    ["k1"],
    {
      confidence: "not_found",
      question: "Has Finance approved the budget?",
    },
  );
  assert.equal(bogus.length, 0);

  // Scope includes real project identity
  assert.equal(scoped.projectCode, "ATLAS");
  assert.match(scoped.projectName ?? "", /Atlas/i);

  const empty = await answerTellMeQuestion({
    question: "What do we know?",
    state: {
      ...state,
      todos: [],
      knowledge: [emptyKnowledge("p-atlas")],
      timeline: [],
      history: [],
      recommendations: [],
      meetings: [],
      releases: [],
    },
    selectedProjectId: "p-atlas",
  });
  assert.match(empty.answer, /doesn.?t know much|Capture/i);

  if (prevKey) process.env.OPENAI_API_KEY = prevKey;

  console.log("verify-tell-me: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
