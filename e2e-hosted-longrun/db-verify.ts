/**
 * Read-only canonical DB verification for the production long-run programme.
 * Never performs INSERT/UPDATE/DELETE. Not used by npm test.
 */
import { createHash } from "node:crypto";
import type { CanonicalSlice } from "./types";

export const LONGRUN_PRODUCTION_SUPABASE_REF = "exfftrxxinhduogcluce";
export const LONGRUN_PRODUCTION_SUPABASE_URL = `https://${LONGRUN_PRODUCTION_SUPABASE_REF}.supabase.co`;
export const LONGRUN_PRODUCTION_DB_HOST = `db.${LONGRUN_PRODUCTION_SUPABASE_REF}.supabase.co`;
export const LONGRUN_PRODUCTION_SUPABASE_NAME = "Lume";

/** Minimum cadence from the programme contract. 0 = after New Project. */
export const LONGRUN_DB_CHECKPOINTS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;

export type DbCheckpointN = (typeof LONGRUN_DB_CHECKPOINTS)[number];

export type CanonicalHashInput = {
  projectId: string;
  projectName: string;
  projectCode: string;
  people: Array<{ id: string; name: string }>;
  todos: Array<{ id: string; title: string; done: boolean; dueAt?: string }>;
  risks: Array<{ id: string; title: string; status: string }>;
  milestones: Array<{ id: string; label: string; startAt: string }>;
  knowledge: Array<{ id?: string; body: string; kind?: string }>;
  responsibilities: Array<{ personId?: string; personName?: string; scope: string }>;
};

export type DbDiscrepancyKind =
  | "expected_row_missing"
  | "unexpected_row_created"
  | "wrong_row_updated"
  | "expected_update_missing"
  | "unexpected_deletion"
  | "duplicate_row"
  | "changed_stable_id"
  | "wrong_relationship"
  | "cross_project_row"
  | "unexpected_semantic_field_change"
  | "receipt_mismatch"
  | "excluded_candidate_leak"
  | "unresolved_needs_you_leak";

export function isDbCheckpoint(n: number): boolean {
  return (LONGRUN_DB_CHECKPOINTS as readonly number[]).includes(n);
}

export function hashCanonicalSlice(slice: CanonicalHashInput): string {
  const stable = {
    projectId: slice.projectId,
    projectName: slice.projectName,
    projectCode: slice.projectCode,
    people: [...slice.people].map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.id.localeCompare(b.id)),
    todos: [...slice.todos]
      .map((t) => ({ id: t.id, title: t.title, done: t.done, dueAt: t.dueAt || "" }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    risks: [...slice.risks]
      .map((r) => ({ id: r.id, title: r.title, status: r.status }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    milestones: [...slice.milestones]
      .map((m) => ({ id: m.id, label: m.label, startAt: m.startAt }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    knowledge: [...slice.knowledge]
      .map((k) => ({ id: k.id || "", body: k.body, kind: k.kind || "" }))
      .sort((a, b) => (a.id || a.body).localeCompare(b.id || b.body)),
    responsibilities: [...slice.responsibilities]
      .map((r) => ({ personId: r.personId || "", personName: r.personName || "", scope: r.scope }))
      .sort((a, b) => `${a.personId}${a.scope}`.localeCompare(`${b.personId}${b.scope}`)),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function sliceCounts(slice: CanonicalHashInput) {
  return {
    people: slice.people.length,
    todos: slice.todos.length,
    todosDone: slice.todos.filter((t) => t.done).length,
    risks: slice.risks.length,
    risksResolved: slice.risks.filter((r) => /resolved|closed|accepted/i.test(r.status)).length,
    milestones: slice.milestones.length,
    knowledge: slice.knowledge.length,
    responsibilities: slice.responsibilities.length,
  };
}

export function compareHashes(api: string, sql: string): "match" | "mismatch" {
  return api === sql ? "match" : "mismatch";
}

export function threeWay(
  expectedEqualsSql: boolean,
  sqlEqualsUi: boolean,
  expectedEqualsUi: boolean,
): "A=B=C" | "A=B C differs" | "A=C B differs" | "B=C A differs" | "A B C all differ" {
  if (expectedEqualsSql && sqlEqualsUi) return "A=B=C";
  if (expectedEqualsSql && !sqlEqualsUi) return "A=B C differs";
  if (expectedEqualsUi && !expectedEqualsSql) return "A=C B differs";
  if (sqlEqualsUi && !expectedEqualsSql) return "B=C A differs";
  return "A B C all differ";
}

export function dbStopCondition(kind: DbDiscrepancyKind): boolean {
  return (
    kind === "cross_project_row" ||
    kind === "unexpected_deletion" ||
    kind === "changed_stable_id" ||
    kind === "excluded_candidate_leak" ||
    kind === "unresolved_needs_you_leak"
  );
}

export function sliceFromCanonical(slice: CanonicalSlice): CanonicalHashInput {
  return slice;
}
