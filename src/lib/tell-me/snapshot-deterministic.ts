/**
 * Deterministic Project Intelligence Snapshot — safe for client bundles.
 * No OpenAI imports.
 */
import { buildCaptureContext } from "@/lib/capture/context";
import { computeProjectRevision } from "@/lib/tell-me/revision";
import { buildSuggestedQuestions } from "@/lib/tell-me/suggestions";
import type { MissionState } from "@/lib/types";
import type { ProjectIntelligenceSnapshot } from "@/lib/tell-me/types";

export function buildDeterministicSnapshot(args: {
  state: MissionState;
  projectId: string;
  userDisplayName?: string | null;
  workspaceId?: string | null;
}): ProjectIntelligenceSnapshot {
  const project = args.state.projects.find((p) => p.id === args.projectId);
  const knowledge = args.state.knowledge.find(
    (k) => k.projectId === args.projectId,
  );
  const ctx = buildCaptureContext({
    state: args.state,
    projectId: args.projectId,
    captureText: "",
  });

  const keyState = [
    project?.currentFocus ? `Focus: ${project.currentFocus}` : null,
    project?.summary ? project.summary : null,
    ...(knowledge?.sections.now ?? []).slice(0, 6),
  ].filter(Boolean) as string[];

  const constraints = (knowledge?.sections.decisions ?? [])
    .filter((d) => /must|required|policy|lead time|governance|rule/i.test(d))
    .slice(0, 6);

  const majorRisks = [
    ...(knowledge?.sections.risks ?? []),
    ...ctx.risks.map((r) => r.title),
  ].slice(0, 8);

  const keyDependencies = args.state.todos
    .filter(
      (t) =>
        t.projectId === args.projectId &&
        !t.done &&
        (Boolean(t.waitingOn?.trim()) ||
          t.kind === "WAITING" ||
          t.kind === "CHASE"),
    )
    .map((t) =>
      t.waitingOn ? `Waiting on ${t.waitingOn}: ${t.title}` : t.title,
    )
    .slice(0, 8);

  const keyStakeholders = [
    ...(project?.stakeholders ?? []).map((s) => `${s.name} (${s.role})`),
    ...(knowledge?.sections.people ?? []),
    ...ctx.stakeholders.map((s) => s.title),
  ].slice(0, 8);

  const importantKnowledge = [
    ...(knowledge?.sections.decisions ?? []),
    ...(knowledge?.sections.openLoops ?? []),
  ].slice(0, 10);

  const significantDates = [
    ...ctx.milestones.map((m) => `${m.title}${m.date ? ` · ${m.date}` : ""}`),
    ...ctx.releases.map((r) => `${r.title}${r.date ? ` · ${r.date}` : ""}`),
    ...ctx.meetings.map((m) => `${m.title}${m.date ? ` · ${m.date}` : ""}`),
  ].slice(0, 10);

  const suggestedQuestions = buildSuggestedQuestions({
    state: args.state,
    projectId: args.projectId,
    userDisplayName: args.userDisplayName,
  });

  const summaryParts = [
    project ? `${project.code} — ${project.name}` : args.projectId,
    keyState[0] ?? "Limited project intelligence so far.",
    majorRisks[0] ? `Key risk: ${majorRisks[0]}` : null,
    keyDependencies[0] ?? null,
  ].filter(Boolean);

  return {
    id: `snap_${args.projectId}_${Date.now().toString(36)}`,
    workspaceId: args.workspaceId ?? null,
    projectId: args.projectId,
    summary: summaryParts.join(" · "),
    keyState,
    constraints,
    majorRisks,
    keyDependencies,
    keyStakeholders,
    importantKnowledge,
    significantDates,
    suggestedQuestions,
    sourceRevision: computeProjectRevision(args.state, args.projectId),
    createdAt: new Date().toISOString(),
    kind: "deterministic",
  };
}
