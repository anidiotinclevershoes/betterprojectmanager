/**
 * Intended New Project truth after Create — confirmed items only.
 * Uncertain Organise proposals are not part of the expected domain bundle.
 */
import type { CreateProjectInput } from "@/lib/create-project";
import { tagSlug } from "@/lib/tags";
import { scopesOf } from "./person-text";
import {
  confirmedRiskDrafts,
  confirmedTodoDrafts,
  uncertainRiskQuestion,
  uncertainTodoQuestion,
} from "./needs-you";

export type IntendedCreateTruth = {
  stakeholderNames: string[];
  todoTitles: string[];
  riskTitles: string[];
  milestoneLabels: string[];
  tagSlugs: string[];
  itemTagMin: number;
  responsibilityMin: number;
  pendingDateLabels: string[];
  ambiguityBodies: string[];
};

export function intendedCreateTruth(input: CreateProjectInput): IntendedCreateTruth {
  const people = (input.stakeholders ?? []).filter((s) => s.name.trim());
  const stakeholderNames = people.map((s) => s.name.trim());
  const todoTitles = confirmedTodoDrafts(input).map((t) => t.title.trim());
  const riskTitles = confirmedRiskDrafts(input).map((r) => r.title.trim());
  const milestoneLabels = (input.importantDates ?? [])
    .filter((d) => d.label.trim() && d.date)
    .map((d) => d.label.trim());
  const pendingDateLabels = (input.importantDates ?? [])
    .filter((d) => d.label.trim() && !d.date)
    .map((d) => d.label.trim());

  const ambiguityBodies: string[] = [];
  for (const note of input.knowledgeRemember ?? []) {
    if (note.remember === false || !note.text.trim()) continue;
    if (note.needsReview && note.needsYouQuestion?.trim()) {
      ambiguityBodies.push(note.needsYouQuestion.trim());
    }
  }
  for (const risk of input.risks ?? []) {
    if (risk.title.trim() && risk.needsReview) {
      ambiguityBodies.push(uncertainRiskQuestion(risk.title));
    }
  }
  for (const todo of input.todos ?? []) {
    if (todo.title.trim() && todo.needsReview) {
      ambiguityBodies.push(uncertainTodoQuestion(todo.title));
    }
  }

  const slugs = new Set<string>();
  const rememberSlug = (names: string[] | undefined) => {
    for (const name of names ?? []) {
      const slug = tagSlug(name);
      if (slug) slugs.add(slug);
    }
  };
  let itemTagMin = 0;
  const attach = (names: string[] | undefined) => {
    const unique = new Set(
      (names ?? []).map((n) => tagSlug(n)).filter(Boolean),
    );
    itemTagMin += unique.size;
    rememberSlug(names);
  };
  people.forEach((p) => attach(p.tags));
  confirmedTodoDrafts(input).forEach((t) => attach(t.tags));
  confirmedRiskDrafts(input).forEach((r) => attach(r.tags));
  (input.importantDates ?? [])
    .filter((d) => d.label.trim() && d.date)
    .forEach((d) => attach(d.tags));
  (input.knowledgeRemember ?? [])
    .filter((k) => k.remember !== false && k.text.trim() && !k.needsReview)
    .forEach((k) => attach(k.tags));

  let responsibilityMin = 0;
  for (const person of people) {
    responsibilityMin += scopesOf(person).length;
  }

  return {
    stakeholderNames,
    todoTitles,
    riskTitles,
    milestoneLabels,
    tagSlugs: [...slugs],
    itemTagMin,
    responsibilityMin,
    pendingDateLabels,
    ambiguityBodies,
  };
}
