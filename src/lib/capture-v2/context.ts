import type { CaptureApplyWorld } from "@/lib/capture/apply";
import type {
  ObservationContextRecord,
  ObservationDomain,
} from "./types";

export function contextRecordsFromWorld(
  world: CaptureApplyWorld,
  scopedProjectId?: string | null,
): ObservationContextRecord[] {
  const rows: ObservationContextRecord[] = [];
  const inScope = (projectId: string) =>
    !scopedProjectId || projectId === scopedProjectId;

  for (const project of world.projects) {
    if (!inScope(project.id)) continue;
    for (const person of project.stakeholders) {
      rows.push({
        id: person.id,
        projectId: project.id,
        entityType: "person",
        title: person.name,
      });
    }
  }
  for (const risk of world.risks) {
    if (!inScope(risk.projectId)) continue;
    rows.push({
      id: risk.id,
      projectId: risk.projectId,
      entityType: "risk",
      title: risk.title,
    });
  }
  for (const todo of world.todos) {
    if (!todo.projectId || !inScope(todo.projectId)) continue;
    rows.push({
      id: todo.id,
      projectId: todo.projectId,
      entityType: "todo",
      title: todo.title,
    });
  }
  for (const item of world.timeline) {
    if (!inScope(item.projectId)) continue;
    rows.push({
      id: item.id,
      projectId: item.projectId,
      entityType: "milestone",
      title: item.label,
    });
  }
  return rows;
}

export function formatAuthoritativeStateForPrompt(
  records: ObservationContextRecord[],
  project: { id: string; name: string; code?: string },
): string {
  const lines = [
    `Current project: ${project.name} (${project.code ?? project.id}) id=${project.id}`,
    "Authoritative current records (use these IDs only; never invent IDs):",
  ];
  if (!records.length) {
    lines.push("(none)");
    return lines.join("\n");
  }
  for (const row of records) {
    lines.push(
      `- id=${row.id} domain=${row.entityType} title=${JSON.stringify(row.title)}`,
    );
  }
  return lines.join("\n");
}

export function domainFromEntityType(
  entityType: string,
): ObservationDomain | null {
  if (entityType === "stakeholder") return "person";
  if (entityType === "todo" || entityType === "risk" || entityType === "milestone") {
    return entityType;
  }
  if (entityType === "person") return "person";
  return null;
}
