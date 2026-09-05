import type { CreateProjectInput } from "@/lib/create-project";

export type SetupNeedsYou = {
  id: string;
  question: string;
  frame: "issues" | "people" | "todo" | "knowledge";
  clientKey?: string;
};

function responsibilitiesOf(draft: {
  role?: string;
  responsibilities?: string[];
}): string[] {
  const fromList = (draft.responsibilities ?? [])
    .map((r) => r.trim())
    .filter(Boolean);
  if (fromList.length) return fromList;
  const role = draft.role?.trim();
  if (role && role.toLowerCase() !== "stakeholder") return [role];
  return [];
}

export function personResponsibilityQuestion(name: string): string {
  return `What is ${name.trim()} responsible for?`;
}

export function undatedMilestoneQuestion(label: string): string {
  const trimmed = label.trim();
  return /milestone/i.test(trimmed)
    ? `When is the ${trimmed}?`
    : `When is the ${trimmed} milestone?`;
}

export function uncertainRiskQuestion(title: string): string {
  return `Should “${title.trim()}” be treated as a project risk?`;
}

export function uncertainTodoQuestion(title: string): string {
  return `Should “${title.trim()}” be tracked as a To Do?`;
}

export function confirmedRiskDrafts(
  draft: CreateProjectInput,
): NonNullable<CreateProjectInput["risks"]> {
  return (draft.risks ?? []).filter((risk) => risk.title.trim() && !risk.needsReview);
}

export function confirmedTodoDrafts(
  draft: CreateProjectInput,
): NonNullable<CreateProjectInput["todos"]> {
  return (draft.todos ?? []).filter((todo) => todo.title.trim() && !todo.needsReview);
}

/**
 * Incomplete setup that can legally persist, but must not become Ready truth.
 * These are questions — not invented field values.
 * Draft-time only until Create; durable rows are materialised separately.
 */
export function needsYouFromDraft(draft: CreateProjectInput): SetupNeedsYou[] {
  const out: SetupNeedsYou[] = [];

  (draft.stakeholders ?? []).forEach((person, index) => {
    if (!person.name.trim()) return;
    if (responsibilitiesOf(person).length === 0 || person.needsReview) {
      out.push({
        id: person.clientKey ?? `person-${index}`,
        clientKey: person.clientKey,
        frame: "people",
        question: personResponsibilityQuestion(person.name),
      });
    }
  });

  (draft.importantDates ?? []).forEach((date, index) => {
    if (!date.label.trim()) return;
    if (!date.date || date.needsReview) {
      out.push({
        id: date.clientKey ?? `date-${index}`,
        clientKey: date.clientKey,
        frame: "knowledge",
        question: undatedMilestoneQuestion(date.label),
      });
    }
  });

  (draft.knowledgeRemember ?? []).forEach((item, index) => {
    if (item.remember === false || !item.text.trim()) return;
    if (item.needsReview && item.needsYouQuestion) {
      out.push({
        id: item.clientKey ?? `know-${index}`,
        clientKey: item.clientKey,
        frame: "knowledge",
        question: item.needsYouQuestion,
      });
    }
  });

  (draft.risks ?? []).forEach((risk, index) => {
    if (!risk.title.trim()) return;
    if (risk.needsReview) {
      out.push({
        id: risk.clientKey ?? `risk-${index}`,
        clientKey: risk.clientKey,
        frame: "issues",
        question: uncertainRiskQuestion(risk.title),
      });
    }
  });

  (draft.todos ?? []).forEach((todo, index) => {
    if (!todo.title.trim()) return;
    if (todo.needsReview) {
      out.push({
        id: todo.clientKey ?? `todo-${index}`,
        clientKey: todo.clientKey,
        frame: "todo",
        question: uncertainTodoQuestion(todo.title),
      });
    }
  });

  return out;
}
