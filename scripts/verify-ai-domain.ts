/**
 * Phase 1.5 — AI domain foundation tests.
 * Run: npx tsx scripts/verify-ai-domain.ts
 */
import assert from "node:assert/strict";
import {
  DEFAULT_DICTIONARY,
  adaptMeeting,
  adaptTodo,
  assemblePromptSections,
  buildCaptureAssembledPrompt,
  buildCaptureSection,
  buildContextSection,
  buildDictionarySection,
  buildDomainSection,
  buildRoleSection,
  buildSchemaSection,
  formatAIReadinessReport,
  formatStatusConsistencyReport,
  isValidAIRecord,
  loadProjectDomainDocument,
  projectStateToAIRecords,
} from "../src/ai/domain";
import { buildCaptureContext } from "../src/lib/capture/context";
import { buildCaptureUserPrompt } from "../src/lib/openai";
import { createSeedState } from "../src/lib/seed";
import type { Meeting, TodoItem } from "../src/lib/types";

const SECTION_IDS = [
  "role",
  "domain",
  "dictionary",
  "context",
  "capture",
  "schema",
] as const;

const CAPTURE_TEXT = "Jordan confirmed that CAB approval was received today.";

const todo: TodoItem = {
  id: "todo-cab",
  projectId: "proj-1",
  title: "Obtain CAB approval",
  detail: "Owner: Jordan",
  done: false,
  createdAt: "2026-07-01T10:00:00.000Z",
};

const meeting: Meeting = {
  id: "meet-1",
  projectId: "proj-1",
  title: "CAB review",
  startsAt: "2026-07-10T15:00:00.000Z",
  attendees: ["Jordan"],
  phase: "upcoming",
  prep: {
    objectives: ["Confirm approval evidence"],
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

// --- Project Domain included ---
{
  const domain = loadProjectDomainDocument();
  assert.ok(domain.includes("Lume Project Domain"));
  assert.ok(domain.includes("NO_CHANGE"));
  assert.ok(domain.includes("never silently modify"));

  const assembled = buildCaptureAssembledPrompt({
    rawText: CAPTURE_TEXT,
    projects: [],
    schemaHint: '{"ok":true}',
  });
  assert.ok(assembled.text.includes("## Project Domain"));
  assert.ok(assembled.text.includes("Prefer"));
  assert.ok(
    assembled.text.includes("UPDATE") || assembled.text.includes("NO_CHANGE"),
  );
}

// --- Dictionary entries appear ---
{
  const assembled = buildCaptureAssembledPrompt({
    rawText: CAPTURE_TEXT,
    projects: [],
    schemaHint: '{"ok":true}',
    dictionaryEntries: DEFAULT_DICTIONARY,
  });
  assert.ok(assembled.text.includes("## Project Dictionary"));
  assert.ok(assembled.text.includes("CAB"));
  assert.ok(assembled.text.includes("Change Advisory Board"));
  assert.ok(assembled.text.includes("Hypercare"));
  assert.equal(assembled.diagnostics.dictionaryEntryCount >= 4, true);
}

// --- Adapters produce valid AIRecord objects ---
{
  const aTodo = adaptTodo(todo);
  const aMeeting = adaptMeeting(meeting);
  assert.ok(isValidAIRecord(aTodo));
  assert.ok(isValidAIRecord(aMeeting));
  assert.equal(aTodo.type, "todo");
  assert.equal(aTodo.title, "Obtain CAB approval");
  assert.equal(aTodo.owner, "Jordan");
  assert.equal(aTodo.status, "OPEN");
  assert.equal(aMeeting.status, "UPCOMING");

  const seed = createSeedState();
  const records = projectStateToAIRecords({
    projects: seed.projects,
    todos: seed.todos,
    meetings: seed.meetings,
    timeline: seed.timeline,
    knowledge: seed.knowledge,
    recommendations: seed.recommendations,
    history: seed.history,
    releases: seed.releases,
  });
  assert.ok(records.length > 0);
  for (const r of records) assert.ok(isValidAIRecord(r), r.id);
}

// --- Prompt sections assemble correctly; none omitted ---
{
  const sections = [
    buildRoleSection(),
    buildDomainSection("Domain stub for unit test."),
    buildDictionarySection([{ term: "CAB", definition: "Change Advisory Board" }]),
    buildContextSection({ projectId: "p1", projects: [] }),
    buildCaptureSection({ rawText: CAPTURE_TEXT, sourceType: "note" }),
    buildSchemaSection('{"title":"string"}'),
  ];
  const assembled = assemblePromptSections(sections);
  assert.deepEqual(
    assembled.sections.map((s) => s.id),
    [...SECTION_IDS],
  );
  for (const id of SECTION_IDS) {
    assert.equal(assembled.diagnostics.sectionPresence[id], true);
  }
  assert.ok(assembled.diagnostics.approximateCharacters > 0);
  assert.ok(assembled.diagnostics.estimatedTokens > 0);
}

// --- Missing section throws ---
{
  assert.throws(() =>
    assemblePromptSections([
      buildRoleSection(),
      buildDomainSection("x"),
      // dictionary omitted
      buildContextSection({ projects: [] }),
      buildCaptureSection({ rawText: "x" }),
      buildSchemaSection("{}"),
    ]),
  );
}

// --- Deterministic assembly ---
{
  const args = {
    rawText: CAPTURE_TEXT,
    projectId: "proj-1",
    sourceType: "note" as const,
    projects: [],
    schemaHint: '{"a":1}',
    dictionaryEntries: DEFAULT_DICTIONARY,
    domainText: "Fixed domain text for determinism.",
  };
  const a = buildCaptureAssembledPrompt(args);
  const b = buildCaptureAssembledPrompt(args);
  assert.equal(a.text, b.text);
  assert.deepEqual(a.diagnostics, b.diagnostics);
}

// --- Capture user prompt path includes domain + dictionary + capture context ---
{
  const seed = createSeedState();
  const project = seed.projects[0];
  assert.ok(project);
  const captureContext = buildCaptureContext({
    projectId: project.id,
    captureText: CAPTURE_TEXT,
    state: seed,
  });
  const prompt = buildCaptureUserPrompt({
    rawText: CAPTURE_TEXT,
    projectId: project.id,
    projects: seed.projects,
    captureContext,
  });
  assert.ok(prompt.includes("## Project Domain"));
  assert.ok(prompt.includes("## Project Dictionary"));
  assert.ok(prompt.includes("CAB"));
  assert.ok(prompt.includes("## Capture"));
  assert.ok(prompt.includes(CAPTURE_TEXT));
  assert.ok(prompt.includes("## Output Schema"));
  assert.ok(prompt.includes("Relevant existing project context"));
}

// --- Audits render ---
{
  const statusReport = formatStatusConsistencyReport();
  assert.ok(statusReport.includes("To Do"));
  assert.ok(statusReport.includes("OPEN"));
  const ready = formatAIReadinessReport();
  assert.ok(ready.includes("adapter"));
  assert.ok(ready.includes("Milestone"));
}

console.log("verify-ai-domain: all checks passed");
console.log(formatStatusConsistencyReport().split("\n").slice(0, 6).join("\n"));
