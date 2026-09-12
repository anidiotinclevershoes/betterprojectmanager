import type { SemanticAtom } from "./types";

export function atomKey(atom: Pick<SemanticAtom, keyof SemanticAtom>): string {
  return [
    atom.domain,
    atom.disposition,
    atom.truthIntent,
    atom.decisionKind,
    atom.writeType ?? "",
    atom.legalDomain ?? "",
    atom.targetId ?? "",
    (atom.personName ?? "").toLowerCase(),
    (atom.scope ?? "").toLowerCase(),
    atom.date ?? "",
    atom.rejected ? "rejected" : "kept",
    atom.reviewReadiness ?? "",
    atom.reasonClass,
  ].join("|");
}

export function atomsEqual(a: SemanticAtom[], b: SemanticAtom[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x.observationId.localeCompare(y.observationId));
  const right = [...b].sort((x, y) => x.observationId.localeCompare(y.observationId));
  return left.every((row, i) => {
    const other = right[i]!;
    return (
      row.observationId === other.observationId && atomKey(row) === atomKey(other)
    );
  });
}

export function describeDiff(expected: SemanticAtom[], actual: SemanticAtom[]): string {
  const exp = new Map(expected.map((row) => [row.observationId, row]));
  const act = new Map(actual.map((row) => [row.observationId, row]));
  const ids = [...new Set([...exp.keys(), ...act.keys()])].sort();
  const lines: string[] = [];
  for (const id of ids) {
    const left = exp.get(id);
    const right = act.get(id);
    if (!left) {
      lines.push(`${id}: unexpected ${atomKey(right!)}`);
      continue;
    }
    if (!right) {
      lines.push(`${id}: missing (expected ${atomKey(left)})`);
      continue;
    }
    if (atomKey(left) !== atomKey(right)) {
      lines.push(`${id}: ${atomKey(left)} → ${atomKey(right)}`);
    }
  }
  return lines.join("; ") || "(no atom diff)";
}
