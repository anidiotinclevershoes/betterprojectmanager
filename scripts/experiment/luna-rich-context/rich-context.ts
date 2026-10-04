/**
 * Experiment-only project block.
 * Evidence from the same CaptureApplyWorld the production resolver sees.
 * Does not decide who a name refers to, and is not used by production Capture.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply";

export const EXPERIMENT_REFERENCE_DATE = "2026-10-03";

export function formatRichCanonicalContext(args: {
  world: CaptureApplyWorld;
  projectId: string;
  referenceDate?: string;
}): string {
  const project = args.world.projects.find((p) => p.id === args.projectId);
  const referenceDate = args.referenceDate ?? EXPERIMENT_REFERENCE_DATE;
  const lines = [
    `Current project: ${project?.name ?? "(unknown)"} (${project?.code ?? args.projectId}) id=${args.projectId}`,
    `Reference date: ${referenceDate}`,
    "Authoritative current records (use these IDs only; never invent IDs):",
  ];
  if (!project) {
    lines.push("(project not found)");
    return lines.join("\n");
  }

  lines.push("People:");
  if (!project.stakeholders.length) lines.push("(none)");
  for (const person of project.stakeholders) {
    lines.push(
      `- id=${person.id} name=${JSON.stringify(person.name)} role=${JSON.stringify(person.role ?? "")}`,
    );
    const responsibilities = currentResponsibilities(
      args.world,
      args.projectId,
      person,
    );
    for (const row of responsibilities) {
      lines.push(
        `  responsibility id=${row.id} personId=${row.personId ?? ""} personName=${JSON.stringify(row.personName ?? "")} scope=${JSON.stringify(row.scope)} ownerConfirmed=${String(row.ownerConfirmed)}`,
      );
    }
  }

  lines.push("To dos:");
  const todos = args.world.todos.filter(
    (todo) => !todo.projectId || todo.projectId === args.projectId,
  );
  if (!todos.length) lines.push("(none)");
  for (const todo of todos) {
    lines.push(
      `- id=${todo.id} title=${JSON.stringify(todo.title)} done=${String(Boolean(todo.done))} due=${JSON.stringify(todo.dueAt ?? "")}`,
    );
  }

  lines.push("Risks:");
  const risks = args.world.risks.filter((risk) => risk.projectId === args.projectId);
  if (!risks.length) lines.push("(none)");
  for (const risk of risks) {
    lines.push(
      `- id=${risk.id} title=${JSON.stringify(risk.title)} status=${JSON.stringify(risk.status)}`,
    );
  }

  lines.push("Milestones:");
  const milestones = args.world.timeline.filter(
    (item) => item.projectId === args.projectId,
  );
  if (!milestones.length) lines.push("(none)");
  for (const item of milestones) {
    lines.push(
      `- id=${item.id} title=${JSON.stringify(item.label)} date=${JSON.stringify((item.startAt ?? "").slice(0, 10))} end=${JSON.stringify((item.endAt ?? "").slice(0, 10))}`,
    );
  }

  lines.push("Knowledge and decisions (current rows only):");
  const knowledge = args.world.knowledge.find((k) => k.projectId === args.projectId);
  const rows = (knowledge?.structured ?? []).filter(
    (row) => row.lifecycle === "current" && row.kind !== "responsibility",
  );
  if (!rows.length) lines.push("(none)");
  for (const row of rows) {
    lines.push(
      `- id=${row.id} kind=${JSON.stringify(row.kind)} body=${JSON.stringify(row.body)}`,
    );
  }

  return lines.join("\n");
}

function currentResponsibilities(
  world: CaptureApplyWorld,
  projectId: string,
  person: { id: string; name: string },
) {
  const knowledge = world.knowledge.find((k) => k.projectId === projectId);
  const hits: Array<{
    id: string;
    personId?: string | null;
    personName?: string | null;
    scope: string;
    ownerConfirmed: boolean;
  }> = [];
  for (const row of knowledge?.structured ?? []) {
    if (row.lifecycle !== "current" || row.kind !== "responsibility") continue;
    const resp = row.meta?.responsibility;
    if (!resp?.scope) continue;
    const sameId = resp.personId && resp.personId === person.id;
    const sameName =
      resp.personName &&
      resp.personName.trim().replace(/\s+/g, " ").toLowerCase() ===
        person.name.trim().replace(/\s+/g, " ").toLowerCase();
    if (!sameId && !sameName) continue;
    hits.push({
      id: row.id,
      personId: resp.personId,
      personName: resp.personName,
      scope: resp.scope,
      ownerConfirmed: Boolean(resp.ownerConfirmed),
    });
  }
  return hits;
}
