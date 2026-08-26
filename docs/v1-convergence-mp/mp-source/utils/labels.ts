import type { Entity } from "../types/knowledge";

/** The object type shown in the inspector header. Plain language, never "entity". */
export function typeLabel(entity: Entity): string {
  if (entity.typeLabel) return entity.typeLabel;
  switch (entity.kind) {
    case "person":
      return "Person";
    case "risk":
      return "Risk";
    case "task":
      return "To do";
    case "milestone":
      return "Milestone";
    case "date":
      return "Date";
    case "decision":
      return "Decision";
    case "waiting":
      return "Waiting on";
    case "area":
      return "Area of work";
    case "position":
      return "Current position";
    case "meeting":
      return "Meeting";
    case "issue":
      return "Issue";
    default:
      return "Item";
  }
}
