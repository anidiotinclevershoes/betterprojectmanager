/**
 * Shared FakeWorkspace + Apply helpers for the v0.9 adversarial pack.
 * Test-only. Mirrors production CaptureSessionContext: text = item.content.
 */
import { applyApprovedCaptureSuggestion } from "../../src/lib/capture/apply/apply-approved";
import { supabaseCaptureApplyHooks } from "../../src/lib/capture/apply/persist-execute";
import {
  runCaptureV2FromModelJson,
  worldFromCaptureState,
} from "../../src/lib/capture-v2";
import type { CreateProjectInput } from "../../src/lib/create-project";
import { loadMissionStateFromSupabase } from "../../src/lib/data/supabase/load-mission-state";
import {
  persistHistoryEvent,
  persistNewProject,
} from "../../src/lib/data/supabase/persist-mutations";
import type { MissionState } from "../../src/lib/types";
import { FakeWorkspaceClient } from "../lib/fake-supabase-workspace";

export const QUAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-ad0000000001";

export function asClient(fake: FakeWorkspaceClient) {
  return fake as unknown as Parameters<typeof persistNewProject>[0];
}

export async function load(fake: FakeWorkspaceClient): Promise<MissionState> {
  return (await loadMissionStateFromSupabase(asClient(fake))).state;
}

export function workspaceFrom(fake: FakeWorkspaceClient, state: MissionState) {
  return {
    workspaceId: fake.workspaceId,
    userId: fake.userId,
    state,
  };
}

export async function seedQualProject(
  fake: FakeWorkspaceClient,
  extra?: Partial<CreateProjectInput>,
) {
  await persistNewProject(asClient(fake), fake.workspaceId, fake.userId, {
    name: extra?.name ?? "Adversarial Qual",
    code: extra?.code ?? "ADQ",
    summary: extra?.summary ?? "Qualification fixture",
    currentFocus: extra?.currentFocus ?? "Prove trust edges",
    sourceMode: "talk",
    clientProjectId: extra?.clientProjectId ?? QUAL_ID,
    stakeholders: extra?.stakeholders,
    todos: extra?.todos,
    risks: extra?.risks,
    importantDates: extra?.importantDates,
    knowledgeRemember: extra?.knowledgeRemember,
  });
  return load(fake);
}

export function obs(partial: Record<string, unknown>) {
  return {
    id: String(partial.id ?? "obs"),
    statement: String(partial.statement ?? ""),
    evidence: String(partial.evidence ?? partial.statement ?? ""),
    domain: partial.domain ?? "todo",
    disposition: partial.disposition ?? "create_new",
    projectId: QUAL_ID,
    candidateTargetId: partial.candidateTargetId ?? null,
    candidateTargetTitle: partial.candidateTargetTitle ?? null,
    proposedValues: partial.proposedValues ?? null,
    commentary: partial.commentary ?? null,
    modelConfidence: partial.modelConfidence ?? 0,
    ...partial,
  };
}

export async function applyResolved(args: {
  fake: FakeWorkspaceClient;
  transcript: string;
  envelope: unknown;
  /** Production UI sends item.content. Pass "transcript" to simulate API footgun. */
  applyText?: "content" | "transcript" | ((content: string) => string);
}) {
  let state = await load(args.fake);
  const pipeline = runCaptureV2FromModelJson({
    transcript: args.transcript,
    rawModelJson: args.envelope,
    world: worldFromCaptureState(state),
    projectId: QUAL_ID,
  });
  const writes = pipeline.resolved.filter(
    (row) => row.decision.kind === "write" && row.suggestion,
  );
  let applied = 0;
  const executions: Array<{ kind: string; reason?: string }> = [];
  for (const row of writes) {
    const content = row.suggestion!.content;
    const text =
      args.applyText === "transcript"
        ? args.transcript
        : typeof args.applyText === "function"
          ? args.applyText(content)
          : content;
    const result = await applyApprovedCaptureSuggestion({
      item: row.suggestion!,
      text,
      projectId: QUAL_ID,
      expectedTarget: row.suggestion!.expectedTarget,
      loadWorkspace: async () => workspaceFrom(args.fake, await load(args.fake)),
      hooks: supabaseCaptureApplyHooks({
        client: asClient(args.fake),
        workspaceId: args.fake.workspaceId,
        userId: args.fake.userId,
        state: await load(args.fake),
      }),
      recordHistory: (event) =>
        persistHistoryEvent(asClient(args.fake), args.fake.workspaceId, args.fake.userId, event),
      reloadWorkspace: async () => load(args.fake),
    });
    executions.push({
      kind: result.executed.kind,
      reason: "reason" in result.executed ? String(result.executed.reason ?? "") : undefined,
    });
    if (result.executed.kind === "wrote") applied += 1;
  }
  state = await load(args.fake);
  return { pipeline, writes, applied, executions, state };
}
