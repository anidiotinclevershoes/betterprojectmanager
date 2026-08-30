/**
 * LIVE 500-capture two-project durability soak.
 * Real OpenAI + disposable Supabase + production Analyse → Review → Apply.
 * Qualification only. Does not change production.
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
import {
  persistHistoryEvent,
  persistNewProject,
} from "../../src/lib/data/supabase/persist-mutations";
import { answerTellMeQuestion } from "../../src/lib/tell-me/answer";
import { buildTellMeContext } from "../../src/lib/tell-me/context";
import type { MissionState } from "../../src/lib/types";
import { estimateTokens } from "../../src/lib/evals/token-breakdown";
import {
  createSupabaseBackend,
  missingLivePersistReason,
  supabaseLiveConfigured,
  type PersistBackend,
} from "./persist";
import {
  ASK_QUESTIONS,
  TOYCITY_ID,
  TOYCITY_NAME,
  TOYCITY_CODE,
  TOYCITY_SENTINELS,
  TOYWORLD_CODE,
  TOYWORLD_ID,
  TOYWORLD_NAME,
  TOYWORLD_SENTINELS,
  buildSoakCaptures,
  projectIdFor,
  type SoakProject,
} from "./scenario";

const ROOT = join(import.meta.dirname, "../..");

export type LedgerRow = {
  n: number;
  project: SoakProject;
  projectId: string;
  operationId: string | null;
  observationId: string | null;
  domain: string;
  reviewed: string;
  date: string | null;
  executedKind: string;
  executedReason: string | null;
  entityId: string | null;
  silentFailure: string | null;
};

type ProjectSnap = {
  people: Array<{ id: string; name: string }>;
  todos: Array<{ id: string; title: string; done: boolean }>;
  risks: Array<{ id: string; title: string; status: string }>;
  milestones: Array<{ id: string; label: string; startAt: string }>;
  knowledge: string[];
};

function gitSha() {
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function asClient(backend: PersistBackend) {
  return backend.client as never;
}

function workspaceFrom(backend: PersistBackend, state: MissionState) {
  return { workspaceId: backend.workspaceId, userId: backend.userId, state };
}

function snap(state: MissionState, projectId: string): ProjectSnap {
  const project = state.projects.find((p) => p.id === projectId);
  const knowledge = state.knowledge.find((k) => k.projectId === projectId);
  const bullets = knowledge
    ? Object.values(knowledge.sections).flat().map((b) => String(b))
    : [];
  return {
    people: (project?.stakeholders ?? []).map((s) => ({ id: s.id, name: s.name })),
    todos: (state.todos ?? [])
      .filter((t) => t.projectId === projectId)
      .map((t) => ({ id: t.id, title: t.title, done: Boolean(t.done) })),
    risks: (state.risks ?? [])
      .filter((r) => r.projectId === projectId)
      .map((r) => ({ id: r.id, title: r.title, status: String(r.status) })),
    milestones: (state.timeline ?? [])
      .filter((t) => t.projectId === projectId)
      .map((t) => ({ id: t.id, label: t.label, startAt: t.startAt })),
    knowledge: bullets,
  };
}

function snapEqual(a: ProjectSnap, b: ProjectSnap) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function objectCounts(s: ProjectSnap) {
  return {
    people: s.people.length,
    todos: s.todos.length,
    risks: s.risks.length,
    milestones: s.milestones.length,
    knowledge: s.knowledge.length,
  };
}

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function mentions(hay: string, needle: string) {
  const h = norm(hay);
  const n = norm(needle);
  return Boolean(n) && h.includes(n);
}

function matchEntity(after: ProjectSnap, domain: string, reviewed: string, date: string | null) {
  const r = reviewed.trim();
  if (domain === "person" || domain === "availability" || domain === "responsibility") {
    return after.people.find((p) => mentions(p.name, r) || mentions(r, p.name)) ?? null;
  }
  if (domain === "todo") {
    return after.todos.find((t) => mentions(t.title, r) || mentions(r, t.title)) ?? null;
  }
  if (domain === "risk") {
    return after.risks.find((t) => mentions(t.title, r) || mentions(r, t.title)) ?? null;
  }
  if (domain === "milestone") {
    const byLabel = after.milestones.find((m) => mentions(m.label, r) || mentions(r, m.label));
    if (byLabel) return byLabel;
    if (date) {
      const day = date.slice(0, 10);
      return after.milestones.find((m) => (m.startAt ?? "").startsWith(day)) ?? null;
    }
  }
  return null;
}

function foreignRows(state: MissionState, projectId: string, otherId: string) {
  const hits: string[] = [];
  for (const t of state.todos ?? []) {
    if (t.projectId === projectId) continue;
    if (t.projectId === otherId) hits.push(`todo ${t.id} owned by other project`);
  }
  for (const r of state.risks ?? []) {
    if (r.projectId === otherId && r.projectId !== projectId) {
      /* other project's own rows are fine — bleed is wrong ownership */
    }
  }
  const project = state.projects.find((p) => p.id === projectId);
  const other = state.projects.find((p) => p.id === otherId);
  const otherNames = new Set((other?.stakeholders ?? []).map((s) => s.name));
  for (const person of project?.stakeholders ?? []) {
    if (otherNames.has(person.name) && person.name.length > 4) {
      hits.push(`shared person name on both boards: ${person.name}`);
    }
  }
  return hits;
}

function sentinelBleed(text: string, project: SoakProject) {
  const foreign =
    project === "toyworld"
      ? [TOYCITY_SENTINELS.lead, TOYCITY_SENTINELS.loyalty, TOYCITY_SENTINELS.store]
      : [TOYWORLD_SENTINELS.lead, TOYWORLD_SENTINELS.payments, TOYWORLD_SENTINELS.wms, TOYWORLD_SENTINELS.warehouse];
  return foreign.filter((token) => mentions(text, token));
}

function titleDupes(snapRow: ProjectSnap) {
  const counts = new Map<string, number>();
  for (const t of snapRow.todos) {
    const key = norm(t.title);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1);
}

export async function runLive500(outDirRel: string) {
  const started = Date.now();
  const outDir = join(ROOT, outDirRel);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, "checkpoints"), { recursive: true });

  const openaiOk = isOpenAIConfigured() && Boolean(getOpenAIKey());
  const persistReason = missingLivePersistReason();
  const model = openaiOk ? resolveOpenAIChatModel() : "unconfigured";
  if (!openaiOk || !supabaseLiveConfigured()) {
    const blocked = !openaiOk
      ? "LIVE RUN BLOCKED — CREDENTIALS REQUIRED (OPENAI_API_KEY)"
      : persistReason ?? "LIVE RUN BLOCKED — TEST DATABASE REQUIRED";
    writeFileSync(
      join(outDir, "run-summary.json"),
      JSON.stringify({ liveBlocked: blocked, mainSha: "b448d51", harnessSha: gitSha() }, null, 2),
    );
    return { liveBlocked: blocked, outDir };
  }

  const backend = await createSupabaseBackend();
  const twDraft: CreateProjectInput = {
    name: TOYWORLD_NAME,
    code: TOYWORLD_CODE,
    summary: "Ecommerce and customer platform programme for a national toy retailer.",
    currentFocus: "Settle the team and first dates",
    sourceMode: "talk",
    clientProjectId: TOYWORLD_ID,
  };
  const tcDraft: CreateProjectInput = {
    name: TOYCITY_NAME,
    code: TOYCITY_CODE,
    summary: "Store-operations, loyalty and fulfilment programme for an independent retailer.",
    currentFocus: "Meadowhall pilot",
    sourceMode: "talk",
    clientProjectId: TOYCITY_ID,
  };
  await persistNewProject(asClient(backend), backend.workspaceId, backend.userId, twDraft);
  await persistNewProject(asClient(backend), backend.workspaceId, backend.userId, tcDraft);

  let state = await backend.load();
  const captures = buildSoakCaptures();
  const ledger: LedgerRow[] = [];
  const needsYou: Array<{ n: number; project: SoakProject; reasons: string[] }> = [];
  const silentFailures: LedgerRow[] = [];
  const bleedEvents: Array<{ n: number; detail: string }> = [];
  const reloadMismatches: Array<{ n: number; project: SoakProject }> = [];
  const checkpoints: unknown[] = [];
  const calls: unknown[] = [];
  const askLog: unknown[] = [];
  let stoppedAt: string | null = null;
  let liveExtracts = 0;

  const counters = {
    toyworld: { ready: 0, wrote: 0, legitimateNoChange: 0, needsYou: 0, receiptReplay: 0 },
    toycity: { ready: 0, wrote: 0, legitimateNoChange: 0, needsYou: 0, receiptReplay: 0 },
  };

  function bump(project: SoakProject) {
    return counters[project];
  }

  for (const spec of captures) {
    const projectId = projectIdFor(spec.project);
    const otherId = spec.project === "toyworld" ? TOYCITY_ID : TOYWORLD_ID;
    const world = worldFromCaptureState(state);
    const project = state.projects.find((p) => p.id === projectId);
    const records = contextRecordsFromWorld(world, projectId);
    const projectBlock = project
      ? formatAuthoritativeStateForPrompt(records, {
          id: project.id,
          name: project.name,
          code: project.code,
        })
      : "(none)";
    const ctx = buildCaptureContext({
      projectId,
      captureText: spec.input,
      state,
    });
    const prompt = buildObservationExtractionPrompt({
      transcript: spec.input,
      projectBlock,
    });
    const bleedInContext = sentinelBleed(`${projectBlock}\n${ctx.diagnostics ? "" : ""}`, spec.project);
    const contextBlob = `${projectBlock}\n${JSON.stringify(ctx.diagnostics ?? {})}`;
    const contextBleed = sentinelBleed(contextBlob, spec.project);
    if (contextBleed.length) {
      bleedEvents.push({
        n: spec.n,
        detail: `Capture context for ${spec.project} mentioned foreign sentinels: ${contextBleed.join(", ")}`,
      });
    }
    void bleedInContext;

    const extraction = await extractObservationsWithOpenAI({
      transcript: spec.input,
      projectBlock,
    });
    liveExtracts += 1;
    const pipeline = runCaptureV2FromModelJson({
      transcript: spec.input,
      rawModelJson: extraction.rawModelJson,
      world,
      projectId,
    });

    const writeRows = pipeline.resolved.filter((r) => r.decision.kind === "write" && r.suggestion);
    const needsRows = pipeline.resolved.filter((r) => r.decision.kind === "needs_you");
    const noChangeRows = pipeline.resolved.filter((r) => r.decision.kind === "no_change");
    if (needsRows.length) {
      bump(spec.project).needsYou += needsRows.length;
      needsYou.push({
        n: spec.n,
        project: spec.project,
        reasons: needsRows.map((r) =>
          r.decision.kind === "needs_you" ? r.decision.reason : "needs_you",
        ),
      });
    }

    calls.push({
      n: spec.n,
      project: spec.project,
      projectN: spec.projectN,
      kind: spec.kind,
      requestChars: prompt.length,
      projectBlockChars: projectBlock.length,
      captureContextChars: ctx.diagnostics.approxChars,
      estimatedInputTokens: estimateTokens(prompt),
      providerInput: extraction.providerUsage?.prompt_tokens ?? null,
      providerOutput: extraction.providerUsage?.completion_tokens ?? null,
      objects: objectCounts(snap(state, projectId)),
    });

    const before = snap(state, projectId);
    for (const row of writeRows) {
      bump(spec.project).ready += 1;
      const opProject =
        row.decision.kind === "write" ? row.decision.operation.projectId : projectId;
      if (opProject === otherId) {
        stoppedAt = `C${spec.n}: cross-project write targeting the other project`;
        bleedEvents.push({ n: spec.n, detail: stoppedAt });
        break;
      }
      const reviewed =
        row.suggestion?.content ||
        String(row.observation.proposedValues?.title ?? row.observation.proposedValues?.name ?? row.observation.statement);
      const date =
        row.suggestion?.date ??
        (typeof row.observation.proposedValues?.date === "string"
          ? row.observation.proposedValues.date
          : null);
      try {
        const appliedRow = await applyApprovedCaptureSuggestion({
          item: row.suggestion!,
          text: spec.input,
          projectId,
          expectedTarget: row.suggestion!.expectedTarget,
          loadWorkspace: async () => workspaceFrom(backend, await backend.load()),
          hooks: supabaseCaptureApplyHooks({
            client: asClient(backend),
            workspaceId: backend.workspaceId,
            userId: backend.userId,
            state: await backend.load(),
          }),
          recordHistory: (event) =>
            persistHistoryEvent(asClient(backend), backend.workspaceId, backend.userId, event),
          reloadWorkspace: async () => backend.load(),
        });
        state = await backend.load();
        const after = snap(state, projectId);
        const executed = appliedRow.executed;
        const reason = "reason" in executed ? executed.reason : null;
        if (executed.kind === "wrote") bump(spec.project).wrote += 1;
        else if (executed.kind === "no_change" && (reason ?? "").includes("already applied")) {
          bump(spec.project).receiptReplay += 1;
        } else if (executed.kind === "no_change") {
          bump(spec.project).legitimateNoChange += 1;
        }
        const entity =
          executed.kind === "wrote" ? matchEntity(after, row.observation.domain, reviewed, date) : null;
        let silent: string | null = null;
        if (executed.kind === "wrote" && !entity && row.observation.domain !== "knowledge" && row.observation.domain !== "decision") {
          silent = `Ready wrote ${row.observation.domain} “${reviewed}” but no matching durable row after reload`;
        }
        const entry: LedgerRow = {
          n: spec.n,
          project: spec.project,
          projectId,
          operationId: row.suggestion?.id ?? null,
          observationId: row.observation.id ?? null,
          domain: row.observation.domain,
          reviewed,
          date,
          executedKind: executed.kind,
          executedReason: reason,
          entityId: entity && "id" in entity ? entity.id : null,
          silentFailure: silent,
        };
        ledger.push(entry);
        if (silent) silentFailures.push(entry);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const entry: LedgerRow = {
          n: spec.n,
          project: spec.project,
          projectId,
          operationId: row.suggestion?.id ?? null,
          observationId: row.observation.id ?? null,
          domain: row.observation.domain,
          reviewed,
          date,
          executedKind: "thrown",
          executedReason: message,
          entityId: null,
          silentFailure: message,
        };
        ledger.push(entry);
        silentFailures.push(entry);
        state = await backend.load();
      }
    }

    const isolationHits = [
      ...foreignRows(state, TOYWORLD_ID, TOYCITY_ID).map((d) => `toyworld: ${d}`),
      ...foreignRows(state, TOYCITY_ID, TOYWORLD_ID).map((d) => `toycity: ${d}`),
    ];
    const twPeople = new Set(snap(state, TOYWORLD_ID).people.map((p) => p.name));
    const tcPeople = new Set(snap(state, TOYCITY_ID).people.map((p) => p.name));
    for (const name of twPeople) {
      if (tcPeople.has(name)) {
        isolationHits.push(`person ${name} on both boards`);
      }
    }
    if (isolationHits.length) {
      bleedEvents.push({ n: spec.n, detail: isolationHits.join("; ") });
    }

    if (spec.n % 25 === 0) {
      const preTw = snap(state, TOYWORLD_ID);
      const preTc = snap(state, TOYCITY_ID);
      const reloaded = await backend.load();
      const postTw = snap(reloaded, TOYWORLD_ID);
      const postTc = snap(reloaded, TOYCITY_ID);
      if (!snapEqual(preTw, postTw)) reloadMismatches.push({ n: spec.n, project: "toyworld" });
      if (!snapEqual(preTc, postTc)) reloadMismatches.push({ n: spec.n, project: "toycity" });
      state = reloaded;

      const twHist = await backend.historyCount(TOYWORLD_ID);
      const tcHist = await backend.historyCount(TOYCITY_ID);
      const lastCall = calls[calls.length - 1] as { requestChars?: number };
      const deep = spec.n % 100 === 0;
      const missingLedger = ledger.filter((row) => {
        if (row.executedKind !== "wrote" || !row.entityId) return false;
        const board = snap(state, row.projectId);
        const still =
          board.people.some((p) => p.id === row.entityId) ||
          board.todos.some((t) => t.id === row.entityId) ||
          board.risks.some((t) => t.id === row.entityId) ||
          board.milestones.some((t) => t.id === row.entityId);
        return !still;
      });
      for (const row of missingLedger) {
        silentFailures.push({
          ...row,
          silentFailure: `ledger entity ${row.entityId} missing at C${spec.n}`,
        });
      }

      const checkpoint = {
        n: spec.n,
        reloadOk: snapEqual(preTw, postTw) && snapEqual(preTc, postTc),
        toyworld: {
          counts: objectCounts(postTw),
          history: twHist,
          people: postTw.people.map((p) => p.name),
          milestones: postTw.milestones,
          risks: postTw.risks,
          todos: deep ? postTw.todos : postTw.todos.slice(0, 12),
          titleDupes: titleDupes(postTw),
        },
        toycity: {
          counts: objectCounts(postTc),
          history: tcHist,
          people: postTc.people.map((p) => p.name),
          milestones: postTc.milestones,
          risks: postTc.risks,
          todos: deep ? postTc.todos : postTc.todos.slice(0, 8),
          titleDupes: titleDupes(postTc),
        },
        isolationHits,
        ledgerMissing: missingLedger.length,
        requestChars: lastCall?.requestChars ?? null,
        deep,
      };
      checkpoints.push(checkpoint);
      writeFileSync(join(outDir, "checkpoints", `state-${spec.n}.json`), JSON.stringify(checkpoint, null, 2));

      if (spec.n % 50 === 0) {
        for (const askProject of ["toyworld", "toycity"] as SoakProject[]) {
          const askId = projectIdFor(askProject);
          for (const question of ASK_QUESTIONS) {
            const answered = await answerTellMeQuestion({
              question,
              state,
              selectedProjectId: askId,
              snapshot: null,
              useCanonicalTruth: true,
            });
            const sourceBleed = (answered.sources ?? []).filter(
              (s) => s.projectId && s.projectId !== askId,
            );
            const answerBleed = sentinelBleed(answered.answer ?? "", askProject);
            if (sourceBleed.length || answerBleed.length) {
              bleedEvents.push({
                n: spec.n,
                detail: `Ask ${askProject} “${question}” bleed sources=${sourceBleed.length} tokens=${answerBleed.join(",")}`,
              });
            }
            const bundle = buildTellMeContext({
              state,
              question,
              selectedProjectId: askId,
            });
            askLog.push({
              n: spec.n,
              project: askProject,
              question,
              confidence: answered.confidence,
              answer: answered.answer,
              sources: (answered.sources ?? []).map((s) => ({
                kind: s.kind,
                projectId: s.projectId,
                label: s.label,
              })),
              sourceBleed: sourceBleed.length,
              answerBleed,
              contextChars: bundle.approxChars,
            });
          }
        }
      }
    }

    if (stoppedAt) break;
    if (spec.n % 25 === 0) {
      console.log(`soak C${spec.n} twReady=${counters.toyworld.wrote} tcReady=${counters.toycity.wrote} silent=${silentFailures.length} bleed=${bleedEvents.length}`);
    }
  }

  const finalTw = snap(state, TOYWORLD_ID);
  const finalTc = snap(state, TOYCITY_ID);
  const growthAt = [1, 50, 100, 200, 300, 400, 500];
  const growth = (calls as Array<Record<string, unknown>>).filter((c) =>
    growthAt.includes(Number(c.n)),
  );

  const summary = {
    productionCandidate: "main @ b448d51ad870ed0ce267a12bfaa7654da20c58c0",
    harnessSha: gitSha(),
    mode: "live",
    persist: "disposable-supabase",
    productionUnchanged: true,
    fakeWorkspaceClient: false,
    oracleEnvelopes: false,
    model,
    capturesAttempted: captures.length,
    capturesCompleted: (calls as unknown[]).length,
    toyworldCaptures: 400,
    toycityCaptures: 100,
    liveExtracts,
    elapsedMs: Date.now() - started,
    stoppedAt,
    counters,
    silentFailures: silentFailures.length,
    bleedEvents: bleedEvents.length,
    reloadMismatches: reloadMismatches.length,
    needsYouCaptures: needsYou.length,
    ledgerWrote: ledger.filter((r) => r.executedKind === "wrote").length,
    uniqueOperationIds: new Set(ledger.map((r) => r.operationId).filter(Boolean)).size,
    receiptReplay: counters.toyworld.receiptReplay + counters.toycity.receiptReplay,
    final: {
      toyworld: { counts: objectCounts(finalTw), people: finalTw.people, milestones: finalTw.milestones, history: await backend.historyCount(TOYWORLD_ID) },
      toycity: { counts: objectCounts(finalTc), people: finalTc.people, milestones: finalTc.milestones, history: await backend.historyCount(TOYCITY_ID) },
    },
  };

  writeFileSync(join(outDir, "run-summary.json"), JSON.stringify(summary, null, 2));
  writeFileSync(join(outDir, "ledger.json"), JSON.stringify(ledger, null, 2));
  writeFileSync(join(outDir, "needs-you.json"), JSON.stringify(needsYou, null, 2));
  writeFileSync(join(outDir, "silent-failures.json"), JSON.stringify(silentFailures, null, 2));
  writeFileSync(join(outDir, "bleed-events.json"), JSON.stringify(bleedEvents, null, 2));
  writeFileSync(join(outDir, "reload-mismatches.json"), JSON.stringify(reloadMismatches, null, 2));
  writeFileSync(join(outDir, "checkpoints.json"), JSON.stringify(checkpoints, null, 2));
  writeFileSync(join(outDir, "calls.json"), JSON.stringify(calls, null, 2));
  writeFileSync(join(outDir, "ask.json"), JSON.stringify(askLog, null, 2));
  writeFileSync(join(outDir, "token-growth.json"), JSON.stringify(growth, null, 2));
  writeFileSync(
    join(outDir, "final-state.json"),
    JSON.stringify({ toyworld: finalTw, toycity: finalTc }, null, 2),
  );
  writeFileSync(
    join(outDir, "scenario.json"),
    JSON.stringify(
      captures.map((c) => ({ n: c.n, project: c.project, projectN: c.projectN, kind: c.kind, input: c.input })),
      null,
      2,
    ),
  );

  console.log("\n── soak 500 ──");
  console.log(JSON.stringify({ captures: summary.capturesCompleted, counters, silent: silentFailures.length, bleed: bleedEvents.length, reload: reloadMismatches.length, stoppedAt }, null, 2));
  return { liveBlocked: null, outDir, summary };
}
