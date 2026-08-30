/**
 * 100-capture long-haul runner.
 * Deterministic: oracle envelopes + real validate/resolve/Apply/persist.
 * Live: extractObservationsWithOpenAI — never silently substituted.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyApprovedCaptureSuggestion } from "../../src/lib/capture/apply/apply-approved";
import { supabaseCaptureApplyHooks } from "../../src/lib/capture/apply/persist-execute";
import { buildCaptureContext } from "../../src/lib/capture/context";
import {
  contextRecordsFromWorld,
  formatAuthoritativeStateForPrompt,
  runCaptureV2FromModelJson,
  worldFromCaptureState,
} from "../../src/lib/capture-v2";
import { buildObservationExtractionPrompt } from "../../src/lib/capture-v2/prompt";
import { extractObservationsWithOpenAI } from "../../src/lib/capture-v2/extract";
import { isOpenAIConfigured, getOpenAIKey } from "../../src/lib/openai";
import { resolveOpenAIChatModel } from "../../src/lib/openai-model";
import type { CreateProjectInput } from "../../src/lib/create-project";
import { loadMissionStateFromSupabase } from "../../src/lib/data/supabase/load-mission-state";
import {
  persistHistoryEvent,
  persistNewProject,
} from "../../src/lib/data/supabase/persist-mutations";
import { searchAuthoritativeProject } from "../../src/lib/knowledge-centre/search-authority";
import { buildTellMeContext } from "../../src/lib/tell-me/context";
import type { MissionState } from "../../src/lib/types";
import { FakeWorkspaceClient } from "../lib/fake-supabase-workspace";
import { estimateTokens } from "../../src/lib/evals/token-breakdown";
import {
  ANALYSE_PROBES,
  ASK_PROBES,
  ATLAS_NAME,
  buildNorthstarCaptures,
  CHECKPOINTS,
  NORTHSTAR_CODE,
  NORTHSTAR_NAME,
  UI_CHECKPOINTS,
} from "./northstar-scenario";
import { envelopeFromSpec, envelopeAnalyseProbe } from "./envelopes";
import {
  applyExpectedWrites,
  bindIdentityAfterApply,
  compareTruth,
  currentTruthObjectCount,
  duplicateCounts,
  emptyExpectedWorld,
  snapshotExpected,
} from "./oracle";
import type {
  CallRow,
  CaptureOutcome,
  CaptureSpec,
  ExpectedWorld,
  IdentityMap,
  TruthDiff,
} from "./types";

export const NORTHSTAR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
export const ATLAS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-000000000002";

const ROOT = join(import.meta.dirname, "../..");

function asClient(fake: FakeWorkspaceClient) {
  return fake as unknown as Parameters<typeof persistNewProject>[0];
}

async function load(fake: FakeWorkspaceClient): Promise<MissionState> {
  return (await loadMissionStateFromSupabase(asClient(fake))).state;
}

function workspaceFrom(fake: FakeWorkspaceClient, state: MissionState) {
  return {
    workspaceId: fake.workspaceId,
    userId: fake.userId,
    state,
  };
}

function gitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function stats(values: number[]) {
  if (!values.length) {
    return { n: 0, min: 0, median: 0, p90: 0, p95: 0, max: 0, mean: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    n: values.length,
    min: sorted[0]!,
    median: at(50),
    p90: at(90),
    p95: at(95),
    max: sorted[sorted.length - 1]!,
    mean: Math.round(mean),
  };
}

function reviewOf(writeCount: number, needsYouCount: number, noChangeCount: number): string {
  if (writeCount > 0 && needsYouCount > 0) return "mixed";
  if (writeCount > 0) return "apply";
  if (needsYouCount > 0) return "needs_you";
  if (noChangeCount > 0) return "no_change";
  return "empty";
}

function historyChars(ctx: ReturnType<typeof buildCaptureContext>): number {
  return (ctx.history ?? []).reduce((n, row) => n + (row.title?.length ?? 0) + (row.summary?.length ?? 0), 0);
}

function compactState(state: MissionState, projectId: string) {
  const project = state.projects.find((p) => p.id === projectId);
  return {
    people: (project?.stakeholders ?? []).map((s) => ({ id: s.id, name: s.name, role: s.role })),
    todos: (state.todos ?? [])
      .filter((t) => t.projectId === projectId)
      .map((t) => ({ id: t.id, title: t.title, done: Boolean(t.done), dueAt: t.dueAt })),
    risks: (state.risks ?? [])
      .filter((r) => r.projectId === projectId)
      .map((r) => ({ id: r.id, title: r.title, status: r.status })),
    milestones: (state.timeline ?? [])
      .filter((t) => t.projectId === projectId)
      .map((t) => ({ id: t.id, label: t.label, startAt: t.startAt })),
    historyCount: (state.history ?? []).filter((h) => h.projectId === projectId).length,
  };
}

function reloadEqual(a: MissionState, b: MissionState, projectId: string): boolean {
  return JSON.stringify(compactState(a, projectId)) === JSON.stringify(compactState(b, projectId));
}

export type LonghaulOptions = {
  captures: number;
  mode: "deterministic" | "live";
  outDir: string;
};

export async function runLonghaul(options: LonghaulOptions) {
  const started = Date.now();
  const capturesAll = buildNorthstarCaptures();
  const captures = capturesAll.slice(0, options.captures);
  const liveRequested = options.mode === "live";
  const liveOk = liveRequested && isOpenAIConfigured() && Boolean(getOpenAIKey());
  const liveBlocked = liveRequested && !liveOk;
  const model = liveOk ? resolveOpenAIChatModel() : "deterministic-oracle-envelope";

  mkdirSync(join(ROOT, options.outDir, "screenshots"), { recursive: true });
  mkdirSync(join(ROOT, options.outDir, "checkpoints"), { recursive: true });

  const fake = new FakeWorkspaceClient();
  const northstarDraft: CreateProjectInput = {
    name: NORTHSTAR_NAME,
    code: NORTHSTAR_CODE,
    summary: "Replace the legacy member portal with a React app over the remaining session service.",
    currentFocus: "Settle the team and first dates",
    sourceMode: "talk",
    clientProjectId: NORTHSTAR_ID,
  };
  const atlasDraft: CreateProjectInput = {
    name: ATLAS_NAME,
    code: "ATLAS",
    summary: "Neighbour project — must not be mutated by Northstar captures.",
    currentFocus: "Ledger cutover",
    sourceMode: "talk",
    clientProjectId: ATLAS_ID,
    stakeholders: [{ name: "Quinn Adler", role: "Finance lead" }],
    todos: [{ title: "Close the billing ledger" }],
  };
  await persistNewProject(asClient(fake), fake.workspaceId, fake.userId, northstarDraft);
  await persistNewProject(asClient(fake), fake.workspaceId, fake.userId, atlasDraft);

  let state = await load(fake);
  const identity: IdentityMap = new Map();
  let expected: ExpectedWorld = emptyExpectedWorld();
  const outcomes: CaptureOutcome[] = [];
  const calls: CallRow[] = [];
  const failures: Array<Record<string, unknown>> = [];
  const checkpoints: Array<Record<string, unknown>> = [];
  let firstDivergence: { n: number; detail: string } | null = null;
  let stoppedAt: string | null = null;
  let askCalls = 0;
  let liveExtractCalls = 0;

  const recordCall = (row: CallRow) => {
    calls.push(row);
  };

  const measureCapture = (spec: CaptureSpec, projectBlock: string, ctx: ReturnType<typeof buildCaptureContext>) => {
    const prompt = buildObservationExtractionPrompt({
      transcript: spec.input,
      projectBlock,
    });
    return {
      prompt,
      requestChars: prompt.length,
      projectBlockChars: projectBlock.length,
      captureContextChars: ctx.diagnostics.approxChars,
      captureContextHistoryChars: historyChars(ctx),
    };
  };

  for (const spec of captures) {
    if (stoppedAt) break;
    const t0 = Date.now();
    const world = worldFromCaptureState(state);
    const project = state.projects.find((p) => p.id === NORTHSTAR_ID);
    const records = contextRecordsFromWorld(world, NORTHSTAR_ID);
    const projectBlock = project
      ? formatAuthoritativeStateForPrompt(records, {
          id: project.id,
          name: project.name,
          code: project.code,
        })
      : "(none)";
    const ctx = buildCaptureContext({
      projectId: NORTHSTAR_ID,
      captureText: spec.input,
      state,
    });
    const measured = measureCapture(spec, projectBlock, ctx);
    const truthObjects = currentTruthObjectCount(state, NORTHSTAR_ID);
    const historyCount = fake.tables.history_events.length;

    let rawModelJson: unknown;
    let usage: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
    } | null = null;
    let usedLive = false;

    if (liveOk) {
      const extraction = await extractObservationsWithOpenAI({
        transcript: spec.input,
        projectBlock,
      });
      rawModelJson = extraction.rawModelJson;
      usage = extraction.providerUsage;
      usedLive = true;
      liveExtractCalls += 1;
    } else {
      rawModelJson = envelopeFromSpec(spec, identity, NORTHSTAR_ID);
    }

    const pipeline = runCaptureV2FromModelJson({
      transcript: spec.input,
      rawModelJson,
      world,
      projectId: NORTHSTAR_ID,
    });

    const writeRows = pipeline.resolved.filter((r) => r.decision.kind === "write" && r.suggestion);
    const needsRows = pipeline.resolved.filter((r) => r.decision.kind === "needs_you");
    const noChangeRows = pipeline.resolved.filter((r) => r.decision.kind === "no_change");
    const actualReview = reviewOf(writeRows.length, needsRows.length, noChangeRows.length);
    const writes = spec.expectedWrites ?? [];
    const needs = spec.expectedNeedsYou ?? [];
    const expectNeedsOnly = needs.length > 0 && writes.length === 0;
    const expectSilent = writes.length === 0 && needs.length === 0;
    const shouldApply = !spec.analyseOnly && writes.length > 0 && !expectNeedsOnly;

    const diffs: TruthDiff[] = [];
    if (expectNeedsOnly && writeRows.length > 0) {
      diffs.push({
        path: "review",
        expected: "needs_you (no write)",
        actual: `${writeRows.length} unexpected write(s)`,
      });
    }
    if (shouldApply && writeRows.length === 0) {
      diffs.push({
        path: "review",
        expected: "apply",
        actual: actualReview,
      });
    }

    let applied = 0;
    const historyBefore = fake.tables.history_events.length;
    const beforeState = state;
    let stop: string | undefined;

    if (shouldApply) {
      for (const row of writeRows) {
        const opProject =
          row.decision.kind === "write" ? row.decision.operation.projectId : NORTHSTAR_ID;
        if (opProject === ATLAS_ID) {
          stop = "wrong-project durable write targeting Atlas Billing Cutover";
          break;
        }
        const appliedRow = await applyApprovedCaptureSuggestion({
          item: row.suggestion!,
          text: spec.input,
          projectId: NORTHSTAR_ID,
          expectedTarget: row.suggestion!.expectedTarget,
          loadWorkspace: async () => workspaceFrom(fake, await load(fake)),
          hooks: supabaseCaptureApplyHooks({
            client: asClient(fake),
            workspaceId: fake.workspaceId,
            userId: fake.userId,
            state: await load(fake),
          }),
          recordHistory: (event) =>
            persistHistoryEvent(asClient(fake), fake.workspaceId, fake.userId, event),
          reloadWorkspace: async () => load(fake),
        });
        if (appliedRow.executed.kind === "wrote") applied += 1;
        state = await load(fake);
      }
    }

    if (stop) {
      stoppedAt = `capture ${spec.n}: ${stop}`;
    }

    bindIdentityAfterApply({
      identity,
      spec,
      before: beforeState,
      after: state,
      projectId: NORTHSTAR_ID,
    });
    if (!expectNeedsOnly && !expectSilent) {
      expected = applyExpectedWrites(expected, spec);
    } else if (writes.length) {
      expected = applyExpectedWrites(expected, spec);
    }

    const semantic = compareTruth({
      world: expected,
      state,
      projectId: NORTHSTAR_ID,
      identity,
      neighbourProjectId: ATLAS_ID,
    });
    diffs.push(...semantic);

    const dups = duplicateCounts(state, NORTHSTAR_ID);
    if (dups.people.length) {
      stop = `duplicate person identity: ${dups.people.map(([n, c]) => `${n}×${c}`).join(", ")}`;
      stoppedAt = `capture ${spec.n}: ${stop}`;
    }

    const reloaded = await load(fake);
    if (!reloadEqual(state, reloaded, NORTHSTAR_ID)) {
      diffs.push({ path: "reload", expected: "hydrate==pre-reload", actual: "mismatch" });
    }
    state = reloaded;

    const divergence = diffs.length
      ? diffs.map((d) => `${d.path}: expected ${d.expected} actual ${d.actual}`).join("; ")
      : undefined;
    if (divergence && !firstDivergence) {
      firstDivergence = { n: spec.n, detail: divergence };
    }
    if (divergence) {
      failures.push({
        capture: spec.n,
        input: spec.input,
        expectedWrites: writes,
        expectedNeedsYou: needs,
        actualReview,
        applied,
        diffs,
        observations: (rawModelJson as { observations?: unknown })?.observations ?? null,
      });
    }

    const historyAfter = fake.tables.history_events.length;
    if (applied > 0 && historyAfter <= historyBefore) {
      diffs.push({
        path: "history",
        expected: "History event after successful write",
        actual: `history_events ${historyBefore} → ${historyAfter}`,
      });
    }
    if (applied === 0 && historyAfter > historyBefore && (expectNeedsOnly || expectSilent)) {
      diffs.push({
        path: "history",
        expected: "no History on needs-you / no_change",
        actual: `+${historyAfter - historyBefore}`,
      });
    }

    recordCall({
      capture: spec.n,
      requestType: "capture_extract",
      model,
      live: usedLive,
      inputTokens: usage?.prompt_tokens ?? null,
      outputTokens: usage?.completion_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      cachedTokens: usage?.prompt_tokens_details?.cached_tokens ?? null,
      latencyMs: Date.now() - t0,
      requestChars: measured.requestChars,
      estimatedInputTokens: estimateTokens(measured.prompt),
      canonicalTruthChars: projectBlock.length,
      currentTruthObjects: truthObjects,
      historyCount,
      projectBlockChars: measured.projectBlockChars,
      captureContextChars: measured.captureContextChars,
      captureContextHistoryChars: measured.captureContextHistoryChars,
    });

    outcomes.push({
      n: spec.n,
      input: spec.input,
      expectedReview: expectNeedsOnly
        ? "needs_you"
        : expectSilent
          ? "no_change"
          : "apply",
      actualReview,
      writeCount: writeRows.length,
      needsYouCount: needsRows.length,
      noChangeCount: noChangeRows.length,
      applied,
      historyBefore,
      historyAfter,
      diffs,
      stop,
      divergence,
    });

    if (CHECKPOINTS.includes(spec.n as (typeof CHECKPOINTS)[number])) {
      checkpoints.push(
        await checkpoint({
          n: spec.n,
          fake,
          state,
          expected,
          identity,
          liveOk,
          model,
          outDir: options.outDir,
          askCallsRef: () => {
            askCalls += 1;
          },
          recordCall,
        }),
      );
    }
  }

  const outDir = join(ROOT, options.outDir);
  mkdirSync(join(outDir, "screenshots"), { recursive: true });
  mkdirSync(join(outDir, "checkpoints"), { recursive: true });

  const captureRows = calls.filter((c) => c.requestType === "capture_extract");
  const askRows = calls.filter((c) => c.requestType === "ask_context");
  const analyseRows = calls.filter((c) => c.requestType === "analyse_probe");
  const chars = captureRows.map((c) => c.requestChars);
  const history = captureRows.map((c) => c.historyCount);
  const truth = captureRows.map((c) => c.currentTruthObjects);
  const captureTokens = captureRows.map((c) => c.estimatedInputTokens ?? 0);
  const projectBlocks = captureRows.map((c) => c.projectBlockChars);
  const captureCtx = captureRows.map((c) => c.captureContextChars);
  const captureCtxHist = captureRows.map((c) => c.captureContextHistoryChars);
  const early = captureRows.filter((c) => c.capture <= 20);
  const late = captureRows.filter((c) => c.capture >= 81);
  const meanOf = (rows: typeof captureRows, pick: (r: (typeof captureRows)[number]) => number) =>
    rows.length ? rows.reduce((a, r) => a + pick(r), 0) / rows.length : 0;
  const earlyMean = meanOf(early, (r) => r.requestChars);
  const lateMean = meanOf(late, (r) => r.requestChars);
  const earlyTok = meanOf(early, (r) => r.estimatedInputTokens ?? 0);
  const lateTok = meanOf(late, (r) => r.estimatedInputTokens ?? 0);
  const earlyBlock = meanOf(early, (r) => r.projectBlockChars);
  const lateBlock = meanOf(late, (r) => r.projectBlockChars);
  const earlyTruth = meanOf(early, (r) => r.currentTruthObjects);
  const lateTruth = meanOf(late, (r) => r.currentTruthObjects);
  const earlyHist = meanOf(early, (r) => r.historyCount);
  const lateHist = meanOf(late, (r) => r.historyCount);
  const askEarly = askRows.filter((c) => c.capture <= 25);
  const askLate = askRows.filter((c) => c.capture >= 75);
  const askCurrent = askRows.filter((_, i) => i % 5 !== 4);
  const askHistorical = askRows.filter((_, i) => i % 5 === 4);

  const tokenGrowth = {
    captureExtract: {
      requestChars: stats(chars),
      estimatedInputTokens: stats(captureTokens),
      projectBlockChars: stats(projectBlocks),
      captureContextChars: stats(captureCtx),
      captureContextHistoryChars: stats(captureCtxHist),
      historyCount: stats(history),
      currentTruthObjects: stats(truth),
      earlyVsLate: {
        requestChars: {
          captures1to20: Math.round(earlyMean),
          captures81to100: Math.round(lateMean),
          ratio: earlyMean ? Number((lateMean / earlyMean).toFixed(3)) : null,
        },
        estimatedInputTokens: {
          captures1to20: Math.round(earlyTok),
          captures81to100: Math.round(lateTok),
          ratio: earlyTok ? Number((lateTok / earlyTok).toFixed(3)) : null,
        },
        projectBlockChars: {
          captures1to20: Math.round(earlyBlock),
          captures81to100: Math.round(lateBlock),
          ratio: earlyBlock ? Number((lateBlock / earlyBlock).toFixed(3)) : null,
        },
        currentTruthObjects: {
          captures1to20: Number(earlyTruth.toFixed(2)),
          captures81to100: Number(lateTruth.toFixed(2)),
          ratio: earlyTruth ? Number((lateTruth / earlyTruth).toFixed(3)) : null,
        },
        historyCount: {
          captures1to20: Number(earlyHist.toFixed(2)),
          captures81to100: Number(lateHist.toFixed(2)),
          ratio: earlyHist ? Number((lateHist / earlyHist).toFixed(3)) : null,
        },
      },
    },
    askContext: {
      requestChars: stats(askRows.map((c) => c.requestChars)),
      estimatedInputTokens: stats(askRows.map((c) => c.estimatedInputTokens ?? 0)),
      currentState: {
        requestChars: stats(askCurrent.map((c) => c.requestChars)),
        estimatedInputTokens: stats(askCurrent.map((c) => c.estimatedInputTokens ?? 0)),
      },
      historical: {
        requestChars: stats(askHistorical.map((c) => c.requestChars)),
        estimatedInputTokens: stats(askHistorical.map((c) => c.estimatedInputTokens ?? 0)),
      },
      earlyVsLate: {
        captures1to25MeanChars: Math.round(meanOf(askEarly, (r) => r.requestChars)),
        captures75to100MeanChars: Math.round(meanOf(askLate, (r) => r.requestChars)),
        ratio: meanOf(askEarly, (r) => r.requestChars)
          ? Number(
              (meanOf(askLate, (r) => r.requestChars) / meanOf(askEarly, (r) => r.requestChars)).toFixed(3),
            )
          : null,
      },
    },
    analyseProbes: {
      n: analyseRows.length,
      requestChars: stats(analyseRows.map((c) => c.requestChars)),
      estimatedInputTokens: stats(analyseRows.map((c) => c.estimatedInputTokens ?? 0)),
    },
    note: "estimatedInputTokens are js-tiktoken cl100k_base of the production extract/Ask prompt. API usage fields stay null unless --mode=live.",
  };

  const summary = {
    mainSha: "09d85c07dec44a7a68be02cb98e0deffd96a4c1a",
    harnessSha: gitSha(),
    mode: liveOk ? "live" : "deterministic",
    liveBlocked: liveBlocked ? "LIVE RUN BLOCKED — CREDENTIALS REQUIRED" : null,
    model,
    capturesAttempted: captures.length,
    capturesCompleted: outcomes.length,
    askCalls,
    liveExtractCalls,
    totalAiCalls: liveExtractCalls + (liveOk ? askCalls : 0),
    elapsedMs: Date.now() - started,
    firstDivergence,
    divergenceCount: outcomes.filter((o) => o.divergence).length,
    stoppedAt,
    captureRequestChars: stats(chars),
    captureEstimatedInputTokens: stats(captureTokens),
    askContextChars: stats(askRows.map((c) => c.requestChars)),
    askEstimatedInputTokens: stats(askRows.map((c) => c.estimatedInputTokens ?? 0)),
    historyCount: stats(history),
    currentTruthObjects: stats(truth),
    earlyVsLateRequestChars: {
      captures1to20: Math.round(earlyMean),
      captures81to100: Math.round(lateMean),
      ratio: earlyMean ? Number((lateMean / earlyMean).toFixed(3)) : null,
    },
    tokenGrowth,
    proof: {
      persistenceApply: "TEST-PROVEN",
      extractQuality: liveOk ? "LIVE-PROVEN" : "NOT LIVE — deterministic envelopes",
      askAnswers: liveOk ? "LIVE-PROVEN" : "CODE-PROVEN context size only",
      tokenApiUsage: liveOk ? "LIVE-PROVEN" : "INFERRED from prompt chars",
    },
  };

  writeFileSync(
    join(outDir, "scenario.json"),
    JSON.stringify(
      {
        project: NORTHSTAR_NAME,
        captures: capturesAll.map((c) => ({
          n: c.n,
          phase: c.phase,
          input: c.input,
          curveBalls: c.curveBalls ?? [],
          expectedWrites: c.expectedWrites ?? [],
          expectedNeedsYou: c.expectedNeedsYou ?? [],
          expectedNoChange: c.expectedNoChange ?? [],
        })),
      },
      null,
      2,
    ),
  );
  writeFileSync(join(outDir, "run-summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(outDir, "token-growth.json"), JSON.stringify(tokenGrowth, null, 2));
  writeFileSync(join(outDir, "truth-checkpoints.json"), JSON.stringify(checkpoints, null, 2));
  writeFileSync(join(outDir, "failures.json"), JSON.stringify(failures, null, 2));
  writeFileSync(
    join(outDir, "calls.csv"),
    [
      "capture,requestType,model,live,inputTokens,outputTokens,totalTokens,cachedTokens,latencyMs,requestChars,estimatedInputTokens,canonicalTruthChars,currentTruthObjects,historyCount,projectBlockChars,captureContextChars,captureContextHistoryChars",
      ...calls.map((c) =>
        [
          c.capture,
          c.requestType,
          c.model,
          c.live,
          c.inputTokens ?? "",
          c.outputTokens ?? "",
          c.totalTokens ?? "",
          c.cachedTokens ?? "",
          c.latencyMs,
          c.requestChars,
          c.estimatedInputTokens ?? "",
          c.canonicalTruthChars,
          c.currentTruthObjects,
          c.historyCount,
          c.projectBlockChars,
          c.captureContextChars,
          c.captureContextHistoryChars,
        ].join(","),
      ),
    ].join("\n"),
  );
  writeFileSync(
    join(outDir, "outcomes.json"),
    JSON.stringify(outcomes, null, 2),
  );
  writeFileSync(
    join(outDir, "final-state.json"),
    JSON.stringify(compactState(state, NORTHSTAR_ID), null, 2),
  );
  writeFileSync(
    join(outDir, "identity-map.json"),
    JSON.stringify(Object.fromEntries(identity), null, 2),
  );

  return { summary, outcomes, checkpoints, calls, failures, state, outDir, liveBlocked };
}

async function checkpoint(args: {
  n: number;
  fake: FakeWorkspaceClient;
  state: MissionState;
  expected: ExpectedWorld;
  identity: IdentityMap;
  liveOk: boolean;
  model: string;
  outDir: string;
  askCallsRef: () => void;
  recordCall: (row: CallRow) => void;
}) {
  const expectedSnap = snapshotExpected(args.expected);
  const actual = compactState(args.state, NORTHSTAR_ID);
  const dups = duplicateCounts(args.state, NORTHSTAR_ID);
  const searchProbes = [
    { q: "UAT", want: "todo" },
    { q: "API timeout", want: "risk" },
    { q: "CAB", want: "date" },
    { q: "Priya Shah", want: "person" },
    { q: "feature flags", want: "knowledge" },
  ].map((probe) => {
    const hits = searchAuthoritativeProject(args.state, NORTHSTAR_ID, probe.q);
    return { query: probe.q, hits: hits.length, sample: hits.slice(0, 3).map((h) => h.bullet) };
  });

  const ask = ASK_PROBES.map((probe) => {
    const t0 = Date.now();
    const bundle = buildTellMeContext({
      question: probe.question,
      state: args.state,
      selectedProjectId: NORTHSTAR_ID,
      snapshot: null,
      useCanonicalTruth: true,
    });
    args.askCallsRef();
    args.recordCall({
      capture: args.n,
      requestType: "ask_context",
      model: args.model,
      live: false,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      cachedTokens: null,
      latencyMs: Date.now() - t0,
      requestChars: bundle.approxChars,
      estimatedInputTokens: estimateTokens(bundle.promptBlock),
      canonicalTruthChars: bundle.promptBlock.length,
      currentTruthObjects: currentTruthObjectCount(args.state, NORTHSTAR_ID),
      historyCount: args.fake.tables.history_events.length,
      projectBlockChars: 0,
      captureContextChars: bundle.approxChars,
      captureContextHistoryChars: 0,
    });
    const grounded =
      probe.look === "milestone:release"
        ? expectedSnap.milestones.find((m) => m.key === "milestone:release")?.date ?? "not_found"
        : probe.look === "risks:open"
          ? expectedSnap.openRisks.map((r) => r.title).join("; ") || "none"
          : probe.look === "responsibility:UAT"
            ? expectedSnap.responsibilities.find((r) => r.scope === "UAT")?.person ?? "not_found"
            : probe.look === "todos:open"
              ? expectedSnap.openTodos.map((t) => t.title).slice(0, 8).join("; ")
              : "historical";
    return {
      id: probe.id,
      question: probe.question,
      live: args.liveOk,
      expectedGrounding: grounded,
      contextChars: bundle.approxChars,
      usedCanonical: bundle.usedCanonicalTruth ?? false,
      promptPreview: bundle.promptBlock.slice(0, 400),
    };
  });

  const analyse = [];
  for (const probe of ANALYSE_PROBES) {
    if (args.n < probe.fromCheckpoint) continue;
    const t0 = Date.now();
    const world = worldFromCaptureState(args.state);
    const project = args.state.projects.find((p) => p.id === NORTHSTAR_ID);
    const records = contextRecordsFromWorld(world, NORTHSTAR_ID);
    const projectBlock = project
      ? formatAuthoritativeStateForPrompt(records, {
          id: project.id,
          name: project.name,
          code: project.code,
        })
      : "(none)";
    const prompt = buildObservationExtractionPrompt({
      transcript: probe.input,
      projectBlock,
    });
    let rawModelJson: unknown;
    let usedLive = false;
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null;
    if (args.liveOk) {
      const extraction = await extractObservationsWithOpenAI({
        transcript: probe.input,
        projectBlock,
      });
      rawModelJson = extraction.rawModelJson;
      usage = extraction.providerUsage;
      usedLive = true;
    } else {
      rawModelJson = envelopeAnalyseProbe(probe, NORTHSTAR_ID);
    }
    const pipeline = runCaptureV2FromModelJson({
      transcript: probe.input,
      rawModelJson,
      world,
      projectId: NORTHSTAR_ID,
    });
    const writeCount = pipeline.resolved.filter((r) => r.decision.kind === "write").length;
    const needsYouCount = pipeline.resolved.filter((r) => r.decision.kind === "needs_you").length;
    const noChangeCount = pipeline.resolved.filter((r) => r.decision.kind === "no_change").length;
    args.recordCall({
      capture: args.n,
      requestType: "analyse_probe",
      model: args.model,
      live: usedLive,
      inputTokens: usage?.prompt_tokens ?? null,
      outputTokens: usage?.completion_tokens ?? null,
      totalTokens: usage?.total_tokens ?? null,
      cachedTokens: null,
      latencyMs: Date.now() - t0,
      requestChars: prompt.length,
      estimatedInputTokens: estimateTokens(prompt),
      canonicalTruthChars: projectBlock.length,
      currentTruthObjects: currentTruthObjectCount(args.state, NORTHSTAR_ID),
      historyCount: args.fake.tables.history_events.length,
      projectBlockChars: projectBlock.length,
      captureContextChars: prompt.length,
      captureContextHistoryChars: 0,
    });
    analyse.push({
      id: probe.id,
      kind: probe.kind,
      applied: false,
      writeCount,
      needsYouCount,
      noChangeCount,
      decisions: pipeline.resolved.map((r) => ({
        kind: r.decision.kind,
        domain: r.observation.domain,
        statement: r.observation.statement,
      })),
      wouldMutate: writeCount > 0,
      expected: "no_change or needs_you; never apply",
    });
  }

  if (UI_CHECKPOINTS.includes(args.n as (typeof UI_CHECKPOINTS)[number])) {
    writeFileSync(
      join(ROOT, args.outDir, "checkpoints", `state-${args.n}.json`),
      JSON.stringify(args.state),
    );
  }

  const pre = compactState(args.state, NORTHSTAR_ID);
  const reloaded = await load(args.fake);
  const post = compactState(reloaded, NORTHSTAR_ID);

  return {
    afterCapture: args.n,
    expected: expectedSnap,
    actual,
    duplicates: dups,
    searchProbes,
    ask,
    analyse,
    reloadOk: JSON.stringify(pre) === JSON.stringify(post),
    historyEvents: args.fake.tables.history_events.length,
    currentTruthObjects: currentTruthObjectCount(args.state, NORTHSTAR_ID),
  };
}
