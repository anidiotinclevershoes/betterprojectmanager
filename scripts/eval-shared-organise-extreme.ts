/**
 * Shared Organise extreme reliability gate.
 *
 * Measurement only. Does not retune prompts or rewrite expectations.
 * Live spend is capped at USD 25 using published GPT-6 Luna and
 * gpt-4o-mini list prices (input/output per 1M tokens).
 *
 * Not part of npm test.
 * Run: npx tsx scripts/eval-shared-organise-extreme.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { applyApprovedCaptureSuggestion } from "../src/lib/capture/apply/apply-approved";
import { memoryCaptureApplyHooks } from "../src/lib/capture/apply/memory-execute";
import { recordedTitleEvidencedInText } from "../src/lib/capture/apply/recorded-title-evidence";
import type { CaptureLegalOperation } from "../src/lib/capture/apply/types";
import { captureApplyWorldFromState } from "../src/lib/capture/apply/world";
import { buildReviewChangeViewModels } from "../src/lib/capture/review/viewModel";
import { buildSuggestions } from "../src/lib/capture/suggestions";
import { extractObservationsWithOpenAI } from "../src/lib/capture-v2/extract";
import { contextRecordsFromWorld, formatAuthoritativeStateForPrompt } from "../src/lib/capture-v2/context";
import { runCaptureV2FromModelJson } from "../src/lib/capture-v2/run";
import { CAPTURE_V2_EVAL_CORPUS } from "../src/lib/eval-capture-v2/corpus";
import { experimentalMissionState } from "../src/lib/eval-capture-v2/mission-state";
import { seedEarlyHarbourline } from "../src/lib/eval-capture-v2/stress/harbourline";
import { MARATHON_STEPS } from "../src/lib/eval-capture-v2/stress/marathon";
import { HARBOURLINE_ID } from "../src/lib/eval-capture-v2/stress/harbourline";
import { CANDYLAND_ID, GAMING_ID, TOYWORLD_ID } from "../src/lib/experiments/worlds";
import { shiftIsoDate } from "../src/lib/shared-organise/date";
import { extractProjectChangesWithLuna, SHARED_ORGANISE_MODEL } from "../src/lib/shared-organise/extract";
import { buildSharedOrganiseContext } from "../src/lib/shared-organise/context";
import { runSharedOrganiseFromModelJson } from "../src/lib/shared-organise/run";
import type { ReviewedChange } from "../src/lib/shared-organise/validate";
import type { MissionState } from "../src/lib/types";
import { makeHistoryEvent, pushHistory } from "../src/lib/workspace/history";

const BUDGET_USD = 25;
const REF = "2026-10-03";
const OUT_DIR = "/opt/cursor/artifacts";

type Engine = "shared" | "classic";
type Kind =
  | "correct"
  | "wrong_write"
  | "silent_omission"
  | "unnecessary_needs_you"
  | "persistence"
  | "model_error";

type Issue = { kind: Exclude<Kind, "correct">; detail: string };

type Scored = {
  id: string;
  engine: Engine;
  suite: string;
  primary: Kind;
  issues: Issue[];
  labels: string[];
  wrote: string[];
  elapsedMs: number;
  usd: number;
};

const spend = { usd: 0, prompt: 0, completion: 0, calls: 0, stopped: false };
const latencies: number[] = [];

function price(model: string, prompt: number, completion: number): number {
  const luna = model.includes("luna") || model.includes("gpt-6");
  const inputRate = luna ? 0.1 : 0.15;
  const outputRate = luna ? 0.5 : 0.6;
  return (prompt / 1_000_000) * inputRate + (completion / 1_000_000) * outputRate;
}

function charge(model: string, usage: { prompt_tokens?: number; completion_tokens?: number; reasoning_tokens?: number } | null): number {
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = Math.max(usage?.completion_tokens ?? 0, usage?.reasoning_tokens ?? 0);
  const usd = price(model, promptTokens, completionTokens);
  spend.usd += usd;
  spend.prompt += promptTokens;
  spend.completion += completionTokens;
  spend.calls += 1;
  if (spend.usd > BUDGET_USD) spend.stopped = true;
  return usd;
}

function worst(issues: Issue[]): Kind {
  if (issues.some((row) => row.kind === "wrong_write")) return "wrong_write";
  if (issues.some((row) => row.kind === "persistence")) return "persistence";
  if (issues.some((row) => row.kind === "silent_omission")) return "silent_omission";
  if (issues.some((row) => row.kind === "unnecessary_needs_you")) return "unnecessary_needs_you";
  if (issues.some((row) => row.kind === "model_error")) return "model_error";
  return "correct";
}

function blob(op: CaptureLegalOperation): string {
  return JSON.stringify(op).toLowerCase();
}

function has(wrote: CaptureLegalOperation[], type: string, needle?: string): boolean {
  return wrote.some((op) => op.type === type && (needle == null || blob(op).includes(needle.toLowerCase())));
}

function surfaced(cards: Array<{ label: string; evidence?: string; reason?: string; statement?: string }>, needle?: string): boolean {
  return cards.some((card) => {
    if (card.label !== "Needs You" && card.label !== "Left untouched") return false;
    if (!needle) return true;
    const hay = `${card.evidence ?? ""} ${card.reason ?? ""} ${card.statement ?? ""}`.toLowerCase();
    return hay.includes(needle.toLowerCase());
  });
}

function snapshot(state: MissionState, projectId: string): string {
  const project = state.projects.find((row) => row.id === projectId);
  const people = [...(project?.stakeholders ?? [])]
    .map((row) => ({ id: row.id, name: row.name, role: row.role ?? "" }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const todos = state.todos
    .filter((row) => row.projectId === projectId)
    .map((row) => ({ id: row.id, title: row.title, done: row.done === true, due: row.dueAt ?? "" }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const risks = (state.risks ?? [])
    .filter((row) => row.projectId === projectId)
    .map((row) => ({ id: row.id, title: row.title, status: row.status }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const dates = state.timeline
    .filter((row) => row.projectId === projectId)
    .map((row) => ({ id: row.id, label: row.label, start: (row.startAt ?? "").slice(0, 10) }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const knowledge = (state.knowledge ?? [])
    .filter((row) => row.projectId === projectId)
    .map((row) => ({
      sections: row.sections,
      structured: [...(row.structured ?? [])].map((item) => ({
        id: item.id,
        kind: item.kind,
        lifecycle: item.lifecycle,
        body: item.body,
      })),
    }));
  return JSON.stringify({ people, todos, risks, dates, knowledge });
}

function duplicateTitles(before: MissionState, after: MissionState, projectId: string): string[] {
  const count = (state: MissionState, titles: string[]) => {
    const seen = new Map<string, number>();
    for (const title of titles) {
      const key = title.trim().toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return seen;
  };
  const beforeTodos = count(before, before.todos.filter((row) => row.projectId === projectId).map((row) => row.title));
  const afterTodos = after.todos.filter((row) => row.projectId === projectId).map((row) => row.title);
  const afterCounts = count(after, afterTodos);
  const dupes: string[] = [];
  for (const [title, n] of afterCounts) {
    if (n > 1 && n > (beforeTodos.get(title) ?? 0)) dupes.push(title);
  }
  return dupes;
}

function wrongTargets(transcript: string, wrote: CaptureLegalOperation[], before: MissionState): string[] {
  const bad: string[] = [];
  for (const op of wrote) {
    if (op.type === "complete_todo" || op.type === "update_todo" || op.type === "delete_todo") {
      const todo = before.todos.find((row) => row.id === op.todoId);
      if (todo && !recordedTitleEvidencedInText(transcript, todo.title)) bad.push(`todo:${todo.title}`);
    }
    if (op.type === "update_risk_status") {
      const risk = (before.risks ?? []).find((row) => row.id === op.riskId);
      if (risk && !recordedTitleEvidencedInText(transcript, risk.title)) bad.push(`risk:${risk.title}`);
    }
    if (op.type === "update_milestone") {
      const milestone = before.timeline.find((row) => row.id === op.milestoneId);
      if (milestone && !recordedTitleEvidencedInText(transcript, milestone.label)) bad.push(`milestone:${milestone.label}`);
    }
  }
  return bad;
}

function requireWrite(
  issues: Issue[],
  ok: boolean,
  cards: Array<{ label: string; evidence?: string; reason?: string; statement?: string }>,
  detail: string,
  needle?: string,
) {
  if (ok) return;
  if (surfaced(cards, needle) || surfaced(cards)) {
    issues.push({ kind: "unnecessary_needs_you", detail });
    return;
  }
  issues.push({ kind: "silent_omission", detail });
}

function requireNoWrite(issues: Issue[], wrote: CaptureLegalOperation[], detail: string) {
  if (wrote.length) issues.push({ kind: "wrong_write", detail: `${detail}: ${wrote.map((op) => op.type).join(",")}` });
}

function requireNeedsYou(issues: Issue[], wrote: CaptureLegalOperation[], cards: ReviewedChange[], detail: string) {
  requireNoWrite(issues, wrote, detail);
  if (!wrote.length && !surfaced(cards)) issues.push({ kind: "silent_omission", detail });
}

async function analyseAndApply(args: {
  engine: Engine;
  state: MissionState;
  projectId: string;
  transcript: string;
}): Promise<{
  state: MissionState;
  wrote: CaptureLegalOperation[];
  cards: ReviewedChange[];
  labels: string[];
  elapsedMs: number;
  usd: number;
  refused: number;
  reconcileFailed: number;
  historyAdded: number;
}> {
  if (spend.stopped) throw new Error("budget cap reached");
  const world = captureApplyWorldFromState(args.state);
  const started = Date.now();
  let raw: unknown;
  let usd = 0;
  if (args.engine === "shared") {
    const context = buildSharedOrganiseContext({
      world,
      projectId: args.projectId,
      referenceDate: REF,
    });
    const extraction = await extractProjectChangesWithLuna({
      transcript: args.transcript,
      projectBlock: context.prompt,
    });
    usd = charge(extraction.responseModel || SHARED_ORGANISE_MODEL, extraction.providerUsage);
    raw = extraction.rawModelJson;
  } else {
    const project = world.projects.find((row) => row.id === args.projectId);
    const records = contextRecordsFromWorld(world, args.projectId);
    const projectBlock = project
      ? formatAuthoritativeStateForPrompt(records, project)
      : "Current project: (unscoped)";
    const extraction = await extractObservationsWithOpenAI({
      transcript: args.transcript,
      projectBlock,
      referenceDate: REF,
    });
    usd = charge(extraction.responseModel || extraction.model, extraction.providerUsage);
    raw = extraction.rawModelJson;
  }
  const elapsedMs = Date.now() - started;
  latencies.push(elapsedMs);
  const run =
    args.engine === "shared"
      ? runSharedOrganiseFromModelJson({
          transcript: args.transcript,
          rawModelJson: raw,
          world,
          projectId: args.projectId,
          referenceDate: REF,
        })
      : null;
  const classic = args.engine === "classic"
    ? runCaptureV2FromModelJson({
        transcript: args.transcript,
        rawModelJson: raw,
        world,
        projectId: args.projectId,
        referenceDate: REF,
      })
    : null;
  const result = run?.result ?? classic!.result;
  const reviewed = run?.reviewed ?? [];
  const suggestions = buildSuggestions(result);
  const view = buildReviewChangeViewModels(suggestions, result, args.transcript, {}, {
    world,
    captureEntryProjectId: args.projectId,
  });
  const box: { state: MissionState; receipts: Map<string, { entityType: string; entityId: string }> } = {
    state: structuredClone(args.state),
    receipts: new Map(),
  };
  const beforeHistory = box.state.history?.length ?? 0;
  const wrote: CaptureLegalOperation[] = [];
  let refused = 0;
  let reconcileFailed = 0;
  for (const card of view) {
    if (!(card.readiness === "ready" && card.canApprove)) continue;
    const applied = await applyApprovedCaptureSuggestion({
      item: card.suggestion,
      text: args.transcript,
      projectId: args.projectId,
      expectedTarget: card.suggestion.expectedTarget,
      loadWorkspace: async () => ({
        workspaceId: "ws-extreme",
        userId: "user-extreme",
        state: box.state,
      }),
      hooks: memoryCaptureApplyHooks(box),
      recordHistory: async (event) => {
        box.state = pushHistory(box.state, makeHistoryEvent(event));
      },
      reloadWorkspace: async () => box.state,
    });
    if (applied.reconcileFailed) reconcileFailed += 1;
    if (applied.executed.kind === "wrote" && applied.decision.kind === "write") {
      wrote.push(applied.decision.operation);
      if (applied.state) box.state = applied.state;
    } else if (card.readiness === "ready") {
      refused += 1;
    }
  }
  const historyAdded = (box.state.history?.length ?? 0) - beforeHistory;
  const labels = args.engine === "shared"
    ? reviewed.map((row) => row.label)
    : view.map((card) => card.readiness);
  return {
    state: box.state,
    wrote,
    cards: reviewed,
    labels,
    elapsedMs,
    usd,
    refused,
    reconcileFailed,
    historyAdded,
  };
}

function integrity(args: {
  transcript: string;
  before: MissionState;
  after: MissionState;
  projectId: string;
  wrote: CaptureLegalOperation[];
  historyAdded: number;
  reconcileFailed: number;
  engine: Engine;
}): Issue[] {
  const issues: Issue[] = [];
  for (const projectId of [CANDYLAND_ID, TOYWORLD_ID, GAMING_ID, HARBOURLINE_ID]) {
    if (projectId === args.projectId) continue;
    if (snapshot(args.before, projectId) !== snapshot(args.after, projectId)) {
      issues.push({ kind: "wrong_write", detail: `sibling project changed: ${projectId}` });
    }
  }
  for (const id of args.wrote) {
    if (id.projectId !== args.projectId) {
      issues.push({ kind: "wrong_write", detail: `write escaped project: ${id.type}` });
    }
  }
  for (const title of wrongTargets(args.transcript, args.wrote, args.before)) {
    issues.push({ kind: "wrong_write", detail: `wrong target ${title}` });
  }
  for (const title of duplicateTitles(args.before, args.after, args.projectId)) {
    issues.push({ kind: "wrong_write", detail: `duplicate title ${title}` });
  }
  if (args.reconcileFailed) {
    issues.push({ kind: "persistence", detail: "reload did not contain the write" });
  }
  if (args.wrote.length > 0 && args.historyAdded < args.wrote.length) {
    issues.push({
      kind: "persistence",
      detail: `history ${args.historyAdded} for ${args.wrote.length} writes`,
    });
  }
  if (args.engine === "shared") {
    const prompt = buildSharedOrganiseContext({
      world: captureApplyWorldFromState(args.after),
      projectId: args.projectId,
      referenceDate: REF,
    }).prompt.toLowerCase();
    for (const op of args.wrote) {
      const title =
        op.type === "create_todo" || op.type === "create_risk"
          ? op.title
          : op.type === "ensure_person"
            ? op.name
            : op.type === "create_milestone"
              ? op.label
              : "";
      if (title && !prompt.includes(title.toLowerCase())) {
        issues.push({ kind: "persistence", detail: `next context missing ${title}` });
      }
    }
  }
  return issues;
}

function judgeCorpus(
  id: string,
  wrote: CaptureLegalOperation[],
  cards: ReviewedChange[],
): Issue[] {
  const issues: Issue[] = [];
  const noPerson = (name: string) => {
    if (has(wrote, "ensure_person", name)) issues.push({ kind: "wrong_write", detail: `created ${name}` });
  };
  switch (id) {
    case "existing-person":
      noPerson("pippa");
      if (wrote.length) issues.push({ kind: "wrong_write", detail: "restated Pippa wrote" });
      break;
    case "new-person":
      requireWrite(issues, has(wrote, "ensure_person", "velvet sprocket"), cards, "Velvet Sprocket was not created", "velvet");
      if (has(wrote, "ensure_person", "brick") || has(wrote, "ensure_person", "buttons")) {
        issues.push({ kind: "wrong_write", detail: "bound the wrong person" });
      }
      break;
    case "ambiguous-same-first-name":
      requireNeedsYou(issues, wrote, cards, "ambiguous Brick must not write");
      break;
    case "responsibility-continues":
      requireNoWrite(issues, wrote, "explicit no change");
      break;
    case "responsibility-replacement":
      noPerson("brick");
      if (!wrote.length && !surfaced(cards)) issues.push({ kind: "silent_omission", detail: "replacement was dropped" });
      if (has(wrote, "confirm_responsibility") && blob(wrote.find((op) => op.type === "confirm_responsibility")!).includes("share") && !blob(wrote.find((op) => op.type === "confirm_responsibility")!).includes("pixel")) {
        issues.push({ kind: "wrong_write", detail: "replace interpreted as an unrelated share" });
      }
      break;
    case "share-vs-replace-ambiguous":
      requireNeedsYou(issues, wrote.filter((op) => op.type === "confirm_responsibility"), cards, "share versus replace must not be decided");
      break;
    case "existing-risk-update":
      if (has(wrote, "create_risk", "packaging") || has(wrote, "create_todo") || has(wrote, "update_risk_status", "resolved")) {
        issues.push({ kind: "wrong_write", detail: "packaging update took the wrong shape" });
      }
      if (!has(wrote, "update_risk_status", "risk-packaging") && !has(wrote, "create_risk")) {
        requireWrite(issues, false, cards, "packaging risk was not updated", "packaging");
      }
      break;
    case "new-risk":
      if (has(wrote, "update_risk_status", "risk-console")) issues.push({ kind: "wrong_write", detail: "retargeted console risk" });
      requireWrite(issues, has(wrote, "create_risk", "shader"), cards, "shader risk was not created", "shader");
      break;
    case "risk-resolution":
      if (has(wrote, "create_todo")) issues.push({ kind: "wrong_write", detail: "risk close became a to-do" });
      requireWrite(issues, has(wrote, "update_risk_status", "resolved"), cards, "bridge risk was not closed", "bridge");
      break;
    case "milestone-move":
      if (has(wrote, "create_todo") || has(wrote, "create_milestone")) issues.push({ kind: "wrong_write", detail: "date move created a record" });
      requireWrite(issues, has(wrote, "update_milestone", "2026-10-29"), cards, "parade day was not moved to 29 October 2026", "parade");
      break;
    case "unchanged-date":
      requireNoWrite(issues, wrote, "unchanged track freeze");
      break;
    case "todo-create":
      if (has(wrote, "complete_todo", "todo-pack") || has(wrote, "update_todo", "todo-pack")) {
        issues.push({ kind: "wrong_write", detail: "retargeted jelly pack" });
      }
      requireWrite(issues, has(wrote, "create_todo", "banner"), cards, "banner to-do was not created", "banner");
      break;
    case "availability":
      noPerson("fizz");
      if (has(wrote, "create_todo")) issues.push({ kind: "wrong_write", detail: "leave became a to-do" });
      requireWrite(issues, has(wrote, "write_availability", "fizz"), cards, "Fizz availability was not recorded", "fizz");
      break;
    case "duplicate-observation":
      if (wrote.filter((op) => op.type === "update_risk_status").length > 1) {
        issues.push({ kind: "wrong_write", detail: "duplicate resolve writes" });
      }
      if (has(wrote, "create_risk")) issues.push({ kind: "wrong_write", detail: "duplicate risk created" });
      requireWrite(issues, has(wrote, "update_risk_status", "resolved"), cards, "packaging was not resolved", "packaging");
      break;
    case "correction-of-wording":
      if (has(wrote, "create_risk", "shader")) issues.push({ kind: "wrong_write", detail: "retracted shader was written" });
      requireWrite(issues, has(wrote, "create_risk", "audio"), cards, "audio bus correction was dropped", "audio");
      break;
    case "mixed-domains":
      noPerson("pippa");
      if (has(wrote, "create_todo")) issues.push({ kind: "wrong_write", detail: "mixed capture collapsed into a to-do" });
      requireWrite(issues, has(wrote, "update_milestone", "2026-10-22"), cards, "parade date omitted", "parade");
      requireWrite(issues, has(wrote, "create_risk", "fountain") || has(wrote, "create_risk", "pump"), cards, "fountain risk omitted", "fountain");
      break;
    case "pronoun-ambiguity":
      requireNeedsYou(issues, wrote, cards, "unnamed she must not bind");
      break;
    case "irrelevant-commentary":
    case "explicit-no-change":
      requireNoWrite(issues, wrote, id);
      break;
    case "cross-project-bait":
      if (has(wrote, "update_risk_status", "risk-console") || has(wrote, "update_milestone", "ms-cert") || has(wrote, "ensure_person", "pixel")) {
        issues.push({ kind: "wrong_write", detail: "foreign project entity was written" });
      }
      requireNeedsYou(issues, wrote, cards, "cross-project bait must not write");
      break;
    case "toyworld-vocabulary-bait":
      if (has(wrote, "update_risk_status", "risk-packaging") || blob(wrote[0] ? wrote[0] : { type: "create_todo", projectId: "", title: "" }).includes("person-brick")) {
        issues.push({ kind: "wrong_write", detail: "foreign id written" });
      }
      if (wrote.some((op) => op.type !== "create_todo" && "todoId" in op && op.todoId === "person-brick")) {
        issues.push({ kind: "wrong_write", detail: "brick id written" });
      }
      if (wrote.some((op) => blob(op).includes("person-brick") || blob(op).includes("risk-packaging"))) {
        issues.push({ kind: "wrong_write", detail: "toyworld id written from candyland" });
      }
      requireNeedsYou(issues, wrote, cards, "vocabulary bait must not write");
      break;
    default:
      break;
  }
  return issues;
}

type Obs = {
  domain: string;
  disposition: string;
  statement?: string;
  proposedValues?: Record<string, unknown> | null;
};

function judgeMarathon(step: (typeof MARATHON_STEPS)[number], wrote: CaptureLegalOperation[], cards: ReviewedChange[]): Issue[] {
  const issues: Issue[] = [];
  const obs = ((step.rawModelJson as { observations?: Obs[] }).observations ?? []);
  if (step.expectedReview === "needs_you") {
    requireNeedsYou(issues, wrote, cards, step.id);
    return issues;
  }
  if (step.expectedReview === "no_change") {
    requireNoWrite(issues, wrote, step.id);
    return issues;
  }
  if (step.expectedReview === "apply_or_no_change") {
    if (wrote.some((op) => op.type === "create_risk" || op.type === "create_todo" || op.type === "ensure_person" || op.type === "create_milestone")) {
      issues.push({ kind: "wrong_write", detail: `${step.id} restatement created a record` });
    }
    return issues;
  }
  const actionable = obs.filter((row) => row.disposition === "create_new" || row.disposition === "update_existing");
  const ambiguous = obs.filter((row) => row.disposition === "ambiguous");
  if (step.expectedReview === "mixed") {
    if (ambiguous.length && wrote.length && !surfaced(cards) && ambiguous.some((row) => row.domain === "responsibility" || row.domain === "person")) {
      const unsafe = wrote.filter((op) => op.type === "confirm_responsibility" || op.type === "ensure_person");
      if (unsafe.length) issues.push({ kind: "wrong_write", detail: `${step.id} ambiguous sibling wrote` });
    }
    if (ambiguous.length && !surfaced(cards) && !issues.some((row) => row.kind === "wrong_write")) {
      issues.push({ kind: "silent_omission", detail: `${step.id} ambiguous sibling was not surfaced` });
    }
  }
  for (const row of actionable) {
    const values = row.proposedValues ?? {};
    const title = String(values.title ?? values.name ?? values.label ?? "");
    const date = String(values.startAt ?? values.date ?? "").slice(0, 10);
    let ok = false;
    if (row.domain === "todo" && row.disposition === "create_new") ok = has(wrote, "create_todo", title.slice(0, 18));
    if (row.domain === "risk" && row.disposition === "create_new") ok = has(wrote, "create_risk", title.slice(0, 18));
    if (row.domain === "person" && row.disposition === "create_new") ok = has(wrote, "ensure_person", title.slice(0, 18));
    if (row.domain === "milestone" && row.disposition === "create_new") {
      ok = has(wrote, "create_milestone", title.slice(0, 12)) && (!date || has(wrote, "create_milestone", date) || has(wrote, "update_milestone", date));
    }
    if (row.domain === "knowledge") ok = has(wrote, "write_knowledge");
    if (row.domain === "todo" && row.disposition === "update_existing") ok = has(wrote, "complete_todo") || has(wrote, "update_todo");
    if (row.domain === "risk" && row.disposition === "update_existing") ok = has(wrote, "update_risk_status");
    if (row.domain === "milestone" && row.disposition === "update_existing") ok = has(wrote, "update_milestone", date);
    if (row.domain === "availability") ok = has(wrote, "write_availability");
    if (row.domain === "decision") ok = has(wrote, "write_knowledge");
    if (step.id === "m37" && row.domain === "risk") {
      if (ok) issues.push({ kind: "wrong_write", detail: "retracted shader risk was written" });
      continue;
    }
    if (step.id === "m35" && row.domain === "risk") {
      ok = has(wrote, "create_risk", "dbs") || has(wrote, "update_risk_status", "resolved");
    }
    requireWrite(issues, ok, cards, `${step.id} missed ${row.domain} ${title || row.disposition}`, title.slice(0, 16) || undefined);
  }
  return issues;
}

type Wave = {
  id: string;
  transcript: string;
  judge: (before: MissionState, wrote: CaptureLegalOperation[], cards: ReviewedChange[]) => Issue[];
};

function milestone(state: MissionState, label: string) {
  return state.timeline.find(
    (row) => row.projectId === HARBOURLINE_ID && row.label.toLowerCase().includes(label.toLowerCase()),
  );
}

const WAVE: Wave[] = [
  {
    id: "w01-relative-later",
    transcript: "Make vendor kickoff two weeks later.",
    judge: (before, wrote, cards) => {
      const issues: Issue[] = [];
      const row = milestone(before, "vendor kickoff");
      if (!row?.startAt) {
        if (wrote.some((op) => op.type === "create_milestone" || op.type === "update_milestone")) {
          issues.push({ kind: "wrong_write", detail: "invented a vendor kickoff date" });
        } else if (!surfaced(cards)) issues.push({ kind: "silent_omission", detail: "relative move dropped" });
        return issues;
      }
      const expected = shiftIsoDate(row.startAt, "later", 2, "weeks");
      requireWrite(issues, Boolean(expected && has(wrote, "update_milestone", expected)), cards, `vendor kickoff should become ${expected}`, "kickoff");
      return issues;
    },
  },
  {
    id: "w02-ambiguous-back",
    transcript: "Move wet-store empty back two weeks.",
    judge: (_before, wrote, cards) => {
      const issues: Issue[] = [];
      if (wrote.some((op) => op.type === "update_milestone" || op.type === "create_milestone")) {
        issues.push({ kind: "wrong_write", detail: "ambiguous back calculated a date" });
      }
      if (!surfaced(cards)) issues.push({ kind: "silent_omission", detail: "ambiguous move was not surfaced" });
      return issues;
    },
  },
  {
    id: "w03-historical",
    transcript: "Wet-store empty was 1 August 2025.",
    judge: (_before, wrote) => {
      const issues: Issue[] = [];
      if (wrote.some((op) => op.type === "update_milestone" || op.type === "create_milestone")) {
        issues.push({ kind: "wrong_write", detail: "historical date wrote a milestone" });
      }
      return issues;
    },
  },
  {
    id: "w04-pronoun",
    transcript: "She will own the volunteer rota.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      requireNeedsYou(issues, wrote, cards, "unnamed she");
      return issues;
    },
  },
  {
    id: "w05-responsibility",
    transcript: "Nora Blake owns the volunteer rota.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      requireWrite(issues, has(wrote, "confirm_responsibility", "nora blake"), cards, "Nora responsibility missing", "nora");
      return issues;
    },
  },
  {
    id: "w06-duplicate-todo",
    transcript: "Add a to-do called Map analogue series list.",
    judge: (before, wrote) => {
      const issues: Issue[] = [];
      const exists = before.todos.some((row) => row.projectId === HARBOURLINE_ID && row.title.toLowerCase() === "map analogue series list");
      if (exists && has(wrote, "create_todo", "map analogue series list")) {
        issues.push({ kind: "wrong_write", detail: "duplicate series-list to-do" });
      }
      return issues;
    },
  },
  {
    id: "w07-risk-close-isolated",
    transcript: "Resolve the Civic SSO identity integration risk. Leave the mould risk as it is.",
    judge: (before, wrote, cards) => {
      const issues: Issue[] = [];
      const mould = (before.risks ?? []).find((row) => row.title.toLowerCase().includes("mould"));
      const sso = (before.risks ?? []).find((row) => row.title.toLowerCase().includes("sso"));
      if (wrote.some((op) => op.type === "update_risk_status" && mould && op.riskId === mould.id)) {
        issues.push({ kind: "wrong_write", detail: "mould risk changed" });
      }
      if (!sso) {
        if (wrote.some((op) => op.type === "update_risk_status" || op.type === "create_risk")) {
          issues.push({ kind: "wrong_write", detail: "SSO close wrote without that risk" });
        } else if (!surfaced(cards)) issues.push({ kind: "silent_omission", detail: "SSO close was dropped" });
        return issues;
      }
      requireWrite(issues, has(wrote, "update_risk_status", "resolved"), cards, "SSO risk was not resolved", "sso");
      return issues;
    },
  },
  {
    id: "w08-two-chrises",
    transcript: "Chris Lang and the other Chris from the cafe — Chris will own the finance gate.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      requireNeedsYou(issues, wrote.filter((op) => op.type === "confirm_responsibility" || op.type === "ensure_person"), cards, "which Chris");
      return issues;
    },
  },
  {
    id: "w09-availability",
    transcript: "Hannah Wells is away from 1 December 2026 until 5 December 2026.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      requireWrite(issues, has(wrote, "write_availability", "hannah"), cards, "Hannah availability missing", "hannah");
      return issues;
    },
  },
  {
    id: "w10-decision",
    transcript: "Decision: the public catalogue will include Welsh captions.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      requireWrite(issues, has(wrote, "write_knowledge", "welsh"), cards, "Welsh caption decision missing", "welsh");
      return issues;
    },
  },
  {
    id: "w11-explicit-delete",
    transcript: "Delete the to-do Confirm cabinet paper annex.",
    judge: (before, wrote, cards) => {
      const issues: Issue[] = [];
      const row = before.todos.find((todo) => todo.projectId === HARBOURLINE_ID && todo.title.toLowerCase().includes("cabinet paper"));
      if (!row) {
        if (has(wrote, "delete_todo") || has(wrote, "create_todo")) issues.push({ kind: "wrong_write", detail: "delete without the record" });
        return issues;
      }
      requireWrite(issues, wrote.some((op) => op.type === "delete_todo" && op.todoId === row.id), cards, "explicit delete did not remove the cabinet to-do", "cabinet");
      return issues;
    },
  },
  {
    id: "w12-complete",
    transcript: "The to-do Draft FOI redaction rules is done.",
    judge: (before, wrote, cards) => {
      const issues: Issue[] = [];
      const row = before.todos.find((todo) => todo.projectId === HARBOURLINE_ID && todo.title.toLowerCase().includes("foi redaction"));
      if (!row) {
        if (!surfaced(cards) && !wrote.length) issues.push({ kind: "silent_omission", detail: "FOI to-do completion dropped" });
        return issues;
      }
      if (row.done) return issues;
      requireWrite(issues, wrote.some((op) => op.type === "complete_todo" && op.todoId === row.id), cards, "FOI rules to-do was not completed", "foi");
      return issues;
    },
  },
  {
    id: "w13-create-todo",
    transcript: "Add a to-do to book the conservation freezer van.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      requireWrite(issues, has(wrote, "create_todo", "freezer"), cards, "freezer van to-do missing", "freezer");
      return issues;
    },
  },
  {
    id: "w14-new-person",
    transcript: "Amira Shah is the Welsh-language reviewer.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      requireWrite(issues, has(wrote, "ensure_person", "amira shah"), cards, "Amira Shah was not added", "amira");
      return issues;
    },
  },
  {
    id: "w15-explicit-date",
    transcript: "Conservation hold review is 28 January 2027.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      requireWrite(
        issues,
        has(wrote, "create_milestone", "2027-01-28") || has(wrote, "update_milestone", "2027-01-28"),
        cards,
        "conservation hold review date missing",
        "conservation",
      );
      return issues;
    },
  },
  {
    id: "w16-commentary",
    transcript: "The kettle in the search room boiled dry. Ignore that.",
    judge: (_b, wrote) => {
      const issues: Issue[] = [];
      requireNoWrite(issues, wrote, "commentary");
      return issues;
    },
  },
  {
    id: "w17-maybe-date",
    transcript: "I think public launch might move, or maybe not.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      if (wrote.some((op) => op.type === "update_milestone" || op.type === "create_milestone")) {
        issues.push({ kind: "wrong_write", detail: "uncertain launch date wrote" });
      }
      if (!surfaced(cards)) issues.push({ kind: "silent_omission", detail: "uncertain launch was not surfaced" });
      return issues;
    },
  },
  {
    id: "w18-new-risk",
    transcript: "Condensation on the reading-room glazing is a new risk.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      requireWrite(issues, has(wrote, "create_risk", "glazing") || has(wrote, "create_risk", "condensation"), cards, "glazing risk missing", "glazing");
      return issues;
    },
  },
  {
    id: "w19-role-edit",
    transcript: "Owen Hart is now the programme sponsor.",
    judge: (before, wrote, cards) => {
      const issues: Issue[] = [];
      const owens = (afterPeople(before).match(/owen hart/g) ?? []).length;
      if (has(wrote, "ensure_person", "owen hart") && owens > 0) {
        issues.push({ kind: "wrong_write", detail: "second Owen created for a role edit" });
      }
      if (!wrote.length && !surfaced(cards)) issues.push({ kind: "silent_omission", detail: "role change was dropped" });
      return issues;
    },
  },
  {
    id: "w20-contradiction",
    transcript: "The Helix scanning queue overruns autumn risk is resolved. Actually it is still open.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      if (wrote.some((op) => op.type === "update_risk_status")) {
        issues.push({ kind: "wrong_write", detail: "contradictory risk status was written" });
      }
      if (!surfaced(cards)) issues.push({ kind: "silent_omission", detail: "contradiction was not surfaced" });
      return issues;
    },
  },
  {
    id: "w21-priya-scope",
    transcript: "Priya Nair covers civic ICT.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      requireWrite(issues, has(wrote, "confirm_responsibility", "priya"), cards, "Priya responsibility missing", "priya");
      return issues;
    },
  },
  {
    id: "w22-foreign-person",
    transcript: "Pixel Ramos should own Harbourline UAT.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      requireNeedsYou(issues, wrote, cards, "foreign Pixel transfer");
      return issues;
    },
  },
  {
    id: "w23-foreign-id-words",
    transcript: "Mark risk-console resolved.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      if (wrote.length) issues.push({ kind: "wrong_write", detail: "foreign risk id language wrote" });
      if (!wrote.length && !surfaced(cards)) issues.push({ kind: "silent_omission", detail: "foreign id request was dropped" });
      return issues;
    },
  },
  {
    id: "w24-generic-owner",
    transcript: "Someone needs to chase the volunteer DBS checks.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      if (has(wrote, "ensure_person") || has(wrote, "confirm_responsibility")) {
        issues.push({ kind: "wrong_write", detail: "generic someone became a person" });
      }
      requireWrite(issues, has(wrote, "create_todo", "dbs") || has(wrote, "create_todo", "volunteer"), cards, "DBS chase to-do missing", "dbs");
      return issues;
    },
  },
  {
    id: "w25-named-then-she",
    transcript: "Lila Berg owns conservation. She is away from 20 January 2027 until 22 January 2027.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      if (has(wrote, "ensure_person", "she")) issues.push({ kind: "wrong_write", detail: "created a person named She" });
      requireWrite(issues, has(wrote, "confirm_responsibility", "lila"), cards, "Lila conservation responsibility missing", "lila");
      requireWrite(issues, has(wrote, "write_availability", "lila"), cards, "Lila availability missing", "lila");
      return issues;
    },
  },
  {
    id: "w26-explicit-existing-date",
    transcript: "Update the scan specification freeze to 16 October 2026.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      requireWrite(issues, has(wrote, "update_milestone", "2026-10-16"), cards, "spec freeze was not moved to 16 October 2026", "freeze");
      return issues;
    },
  },
  {
    id: "w27-historical-versus-current",
    transcript: "The scan specification freeze was moved to 9 October, but that was the old plan. It is 16 October 2026.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      if (has(wrote, "update_milestone", "2026-10-09") && !has(wrote, "update_milestone", "2026-10-16")) {
        issues.push({ kind: "wrong_write", detail: "historical 9 October overwrote the current date" });
      }
      requireWrite(issues, has(wrote, "update_milestone", "2026-10-16"), cards, "current 16 October date omitted", "october");
      return issues;
    },
  },
  {
    id: "w28-sign-off-knowledge",
    transcript: "Add knowledge that Owen Hart can sign the cabinet paper.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      if (has(wrote, "write_knowledge")) issues.push({ kind: "wrong_write", detail: "sign-off stored as knowledge" });
      if (!has(wrote, "write_knowledge") && !surfaced(cards) && !has(wrote, "confirm_responsibility")) {
        issues.push({ kind: "silent_omission", detail: "sign-off request was dropped" });
      }
      return issues;
    },
  },
  {
    id: "w29-other-project-todo",
    transcript: "Complete the to-do Boss balancing pass.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      requireNeedsYou(issues, wrote, cards, "other project to-do");
      return issues;
    },
  },
  {
    id: "w30-share",
    transcript: "Hannah Wells and Elena Voss will share the public catalogue UX sessions.",
    judge: (_b, wrote, cards) => {
      const issues: Issue[] = [];
      const shares = wrote.filter((op) => op.type === "confirm_responsibility");
      const both = shares.some((op) => blob(op).includes("hannah")) && shares.some((op) => blob(op).includes("elena"));
      requireWrite(issues, both, cards, "shared UX responsibility was not recorded for both people", "ux");
      return issues;
    },
  },
];

function afterPeople(state: MissionState): string {
  return (state.projects.find((row) => row.id === HARBOURLINE_ID)?.stakeholders ?? [])
    .map((row) => row.name.toLowerCase())
    .join(" ");
}

function deterministic(): Array<{ id: string; ok: boolean; detail: string }> {
  const state = experimentalMissionState();
  const world = captureApplyWorldFromState(state);
  const foreign = runSharedOrganiseFromModelJson({
    transcript: "Mark risk-console resolved.",
    rawModelJson: {
      changes: [
        {
          id: "chg-1",
          outcome: "ready",
          operation: "update_risk_status",
          targetId: "risk-console",
          evidence: "Mark risk-console resolved.",
          materialUncertainty: [],
          values: { status: "resolved" },
        },
      ],
    },
    world,
    projectId: CANDYLAND_ID,
    referenceDate: REF,
  });
  const pronoun = runSharedOrganiseFromModelJson({
    transcript: "She will own UAT.",
    rawModelJson: {
      changes: [
        {
          id: "chg-1",
          outcome: "ready",
          operation: "ensure_person",
          targetId: null,
          evidence: "She will own UAT.",
          materialUncertainty: [],
          values: { name: "She" },
        },
      ],
    },
    world,
    projectId: CANDYLAND_ID,
    referenceDate: REF,
  });
  const knowledge = runSharedOrganiseFromModelJson({
    transcript: "Add a knowledge note that Helen can sign the variation.",
    rawModelJson: {
      changes: [
        {
          id: "chg-1",
          outcome: "ready",
          operation: "write_knowledge",
          targetId: null,
          evidence: "Helen can sign the variation.",
          materialUncertainty: [],
          values: { text: "Helen can sign the variation.", section: "now" },
        },
      ],
    },
    world,
    projectId: CANDYLAND_ID,
    referenceDate: REF,
  });
  return [
    {
      id: "det-foreign-id",
      ok: foreign.reviewed.every((row) => row.label !== "Ready"),
      detail: foreign.reviewed.map((row) => row.label).join(","),
    },
    {
      id: "det-pronoun-person",
      ok: pronoun.reviewed.every((row) => row.label !== "Ready"),
      detail: pronoun.reviewed.map((row) => row.label).join(","),
    },
    {
      id: "det-knowledge-authority",
      ok: knowledge.reviewed.every((row) => row.label !== "Ready"),
      detail: knowledge.reviewed.map((row) => row.label).join(","),
    },
  ];
}

async function scoreCapture(args: {
  id: string;
  suite: string;
  engine: Engine;
  state: MissionState;
  projectId: string;
  transcript: string;
  judge: (wrote: CaptureLegalOperation[], cards: ReviewedChange[], before: MissionState) => Issue[];
}): Promise<{ scored: Scored; state: MissionState }> {
  try {
    const before = args.state;
    const applied = await analyseAndApply({
      engine: args.engine,
      state: before,
      projectId: args.projectId,
      transcript: args.transcript,
    });
    const issues = [
      ...args.judge(applied.wrote, applied.cards, before),
      ...integrity({
        transcript: args.transcript,
        before,
        after: applied.state,
        projectId: args.projectId,
        wrote: applied.wrote,
        historyAdded: applied.historyAdded,
        reconcileFailed: applied.reconcileFailed,
        engine: args.engine,
      }),
    ];
    if (applied.refused && applied.wrote.length === 0 && !issues.length) {
      issues.push({ kind: "persistence", detail: `${applied.refused} ready card(s) refused at Apply` });
    }
    const scored: Scored = {
      id: args.id,
      engine: args.engine,
      suite: args.suite,
      primary: worst(issues),
      issues,
      labels: applied.labels,
      wrote: applied.wrote.map((op) => op.type),
      elapsedMs: applied.elapsedMs,
      usd: applied.usd,
    };
    console.log(`${args.engine} ${args.id} ${scored.primary} ${applied.elapsedMs}ms $${applied.usd.toFixed(4)}`);
    return { scored, state: applied.state };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`${args.engine} ${args.id} ERROR ${message.slice(0, 160)}`);
    return {
      scored: {
        id: args.id,
        engine: args.engine,
        suite: args.suite,
        primary: "model_error",
        issues: [{ kind: "model_error", detail: message.slice(0, 300) }],
        labels: [],
        wrote: [],
        elapsedMs: 0,
        usd: 0,
      },
      state: args.state,
    };
  }
}

async function runCorpus(): Promise<Scored[]> {
  const live = CAPTURE_V2_EVAL_CORPUS.filter((row) => row.evaluationMode === "live");
  const rows: Scored[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < live.length) {
      const index = cursor;
      cursor += 1;
      const testCase = live[index]!;
      const state = experimentalMissionState();
      for (const engine of ["shared", "classic"] as const) {
        if (spend.stopped) return;
        const result = await scoreCapture({
          id: testCase.id,
          suite: "corpus",
          engine,
          state,
          projectId: testCase.projectId,
          transcript: testCase.transcript,
          judge: (wrote, cards) => judgeCorpus(testCase.id, wrote, cards),
        });
        rows.push(result.scored);
      }
    }
  }
  await Promise.all([worker(), worker()]);
  return rows;
}

async function runLong(engine: Engine, includeWave: boolean): Promise<Scored[]> {
  let state = seedEarlyHarbourline();
  const scored: Scored[] = [];
  for (const step of MARATHON_STEPS) {
    if (spend.stopped) break;
    const result = await scoreCapture({
      id: step.id,
      suite: "marathon",
      engine,
      state,
      projectId: HARBOURLINE_ID,
      transcript: step.transcript,
      judge: (wrote, cards) => judgeMarathon(step, wrote, cards),
    });
    scored.push(result.scored);
    state = result.state;
  }
  if (!includeWave) return scored;
  for (const step of WAVE) {
    if (spend.stopped) break;
    const result = await scoreCapture({
      id: step.id,
      suite: "wave",
      engine,
      state,
      projectId: HARBOURLINE_ID,
      transcript: step.transcript,
      judge: (wrote, cards, before) => step.judge(before, wrote, cards),
    });
    scored.push(result.scored);
    state = result.state;
  }
  return scored;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index]!;
}

function tally(rows: Scored[]) {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.primary] = (counts[row.primary] ?? 0) + 1;
  return counts;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`budget_usd ${BUDGET_USD} model ${SHARED_ORGANISE_MODEL} ref ${REF}`);
  const det = deterministic();
  console.log("deterministic", JSON.stringify(det));
  const onlyDet = process.argv.includes("--deterministic-only");
  const [corpus, shared, classic] = onlyDet
    ? [[], [], []]
    : await Promise.all([runCorpus(), runLong("shared", true), runLong("classic", false)]);
  const report = {
    budgetUsd: BUDGET_USD,
    spentUsd: Number(spend.usd.toFixed(4)),
    tokens: { prompt: spend.prompt, completion: spend.completion, calls: spend.calls },
    stoppedForBudget: spend.stopped,
    latencyMs: {
      median: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      max: percentile(latencies, 100),
    },
    deterministic: det,
    tally: {
      corpusShared: tally(corpus.filter((row) => row.engine === "shared")),
      corpusClassic: tally(corpus.filter((row) => row.engine === "classic")),
      marathonShared: tally(shared.filter((row) => row.suite === "marathon")),
      marathonClassic: tally(classic.filter((row) => row.suite === "marathon")),
      waveShared: tally(shared.filter((row) => row.suite === "wave")),
    },
    rows: [...corpus, ...shared, ...classic],
  };
  writeFileSync(`${OUT_DIR}/shared-organise-extreme.json`, JSON.stringify(report, null, 2));
  const lines = [
    `# Shared Organise extreme gate`,
    ``,
    `Spent $${report.spentUsd} of $${BUDGET_USD}. Calls ${spend.calls}. Median ${report.latencyMs.median}ms. p95 ${report.latencyMs.p95}ms.`,
    ``,
    `Deterministic injections: ${det.map((row) => `${row.id}:${row.ok}`).join(", ")}`,
    ``,
    `## Tallies`,
    ``,
    "```",
    JSON.stringify(report.tally, null, 2),
    "```",
    ``,
    `## Non-correct rows`,
    ``,
  ];
  for (const row of report.rows.filter((item) => item.primary !== "correct")) {
    lines.push(`- ${row.engine} ${row.suite} ${row.id} **${row.primary}** — ${row.issues.map((issue) => issue.detail).join("; ")}`);
  }
  writeFileSync(`${OUT_DIR}/shared-organise-extreme.md`, lines.join("\n"));
  console.log(JSON.stringify({ spent: report.spentUsd, tally: report.tally, latency: report.latencyMs }));
  if (det.some((row) => !row.ok)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
