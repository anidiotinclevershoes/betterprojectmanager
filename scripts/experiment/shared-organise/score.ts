/**
 * Experiment scoring. Not used by the model.
 * Unsafe Ready is a Ready write the case forbids, or a Ready write
 * that still carries a fail-closed safety tag.
 */
import type { CaptureLegalOperation } from "@/lib/capture/apply";
import { siblingCollision, type SharedOrganiseContext } from "./context";
import type { ReviewedChange } from "./validate";
import { isUnresolvedPersonReference } from "./validate";

export type MatchSpec = {
  type?: string;
  /** Substrings that must all appear in the operation JSON. */
  text?: string[];
};

export type ScoreFlag =
  | "unsafe_ready"
  | "avoidable_friction"
  | "omission"
  | "incorrect_domain"
  | "incorrect_target"
  | "incorrect_create_vs_update"
  | "contamination_local_copy"
  | "explicit_local_copy"
  | "contract_gap_role"
  | "unnecessary_clarification";

export type CaseScore = {
  flags: ScoreFlag[];
  unsafe: Array<{ id: string; type: string | null; evidence: string; why: string }>;
  hopedMet: number;
  hopedTotal: number;
  readyTypes: string[];
  labels: Record<string, number>;
};

function blob(operation: CaptureLegalOperation): string {
  return JSON.stringify(operation).toLowerCase();
}

export function matchesOperation(
  operation: CaptureLegalOperation | null,
  spec: MatchSpec,
): boolean {
  if (!operation) return false;
  if (spec.type && operation.type !== spec.type) return false;
  const text = blob(operation);
  return (spec.text ?? []).every((part) => text.includes(part.toLowerCase()));
}

function personName(operation: CaptureLegalOperation): string | null {
  if (operation.type === "ensure_person") return operation.name;
  if (operation.type === "confirm_responsibility") return operation.personName;
  if (operation.type === "write_availability") return operation.personName;
  return null;
}

export function scoreCaseRun(args: {
  context: SharedOrganiseContext;
  review: ReviewedChange[];
  sufficient: boolean;
  hoped: MatchSpec[];
  unsafe: MatchSpec[];
  unsafeAnyReady?: boolean;
  wrongCreate?: MatchSpec[];
  wrongDomain?: MatchSpec[];
  contamination?: "adversarial" | "explicit_local";
  roleUpdateUnsupported?: boolean;
  /** Ready milestone writes must use this ISO day. Any other milestone date is unsafe. */
  onlyReadyDate?: string;
  /** Any Ready milestone create or update is unsafe. */
  noReadyMilestone?: boolean;
}): CaseScore {
  const ready = args.review.filter((row) => row.label === "Ready" && row.operation);
  const labels: Record<string, number> = {};
  for (const row of args.review) labels[row.label] = (labels[row.label] ?? 0) + 1;
  const flags = new Set<ScoreFlag>();
  const unsafe: CaseScore["unsafe"] = [];

  for (const row of ready) {
    const operation = row.operation!;
    const name = personName(operation);
    if (name && isUnresolvedPersonReference(name)) {
      flags.add("unsafe_ready");
      unsafe.push({
        id: row.id,
        type: operation.type,
        evidence: row.evidence,
        why: "generic_person",
      });
    }
    const leaked = row.safety.filter((tag) =>
      [
        "invented_stable_id",
        "context_only_id",
        "wrong_existing_person",
        "knowledge_bypass",
        "unresolved_person",
        "not_on_this_project",
        "role_update_unsupported",
      ].includes(tag),
    );
    if (leaked.length) {
      flags.add("unsafe_ready");
      unsafe.push({
        id: row.id,
        type: operation.type,
        evidence: row.evidence,
        why: leaked.join(","),
      });
    }
    if (args.unsafeAnyReady || args.unsafe.some((spec) => matchesOperation(operation, spec))) {
      flags.add("unsafe_ready");
      unsafe.push({
        id: row.id,
        type: operation.type,
        evidence: row.evidence,
        why: args.unsafeAnyReady ? "forbidden_ready" : "case_rule",
      });
    }
    if (
      (operation.type === "create_milestone" || operation.type === "update_milestone") &&
      (args.noReadyMilestone ||
        (args.onlyReadyDate && !(operation.startAt ?? "").startsWith(args.onlyReadyDate)))
    ) {
      flags.add("unsafe_ready");
      unsafe.push({
        id: row.id,
        type: operation.type,
        evidence: row.evidence,
        why: args.noReadyMilestone ? "milestone_date" : "wrong_milestone_date",
      });
    }
    if (args.wrongCreate?.some((spec) => matchesOperation(operation, spec))) {
      flags.add("incorrect_create_vs_update");
    }
    if (args.wrongDomain?.some((spec) => matchesOperation(operation, spec))) {
      flags.add("incorrect_domain");
    }
    const collision = siblingCollision(args.context, operation);
    if (collision && args.contamination === "adversarial") flags.add("contamination_local_copy");
    if (collision && args.contamination === "explicit_local") flags.add("explicit_local_copy");
  }

  const hopedMet = args.hoped.filter((spec) =>
    ready.some((row) => matchesOperation(row.operation, spec)),
  ).length;
  if (args.hoped.length > 0 && hopedMet < args.hoped.length) flags.add("omission");
  const clarifying = args.review.some(
    (row) => row.label === "Needs You" || row.label === "Left untouched",
  );
  if (
    args.sufficient &&
    args.hoped.length > 0 &&
    hopedMet < args.hoped.length &&
    clarifying &&
    !flags.has("unsafe_ready")
  ) {
    flags.add("avoidable_friction");
    if (hopedMet === 0 && ready.length === 0) flags.add("unnecessary_clarification");
  }
  if (
    args.roleUpdateUnsupported &&
    args.review.some((row) => row.safety.includes("role_update_unsupported"))
  ) {
    flags.add("contract_gap_role");
  }

  return {
    flags: [...flags],
    unsafe,
    hopedMet,
    hopedTotal: args.hoped.length,
    readyTypes: ready.map((row) => row.operation!.type),
    labels,
  };
}
