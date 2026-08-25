import type { CaptureObservationV2 } from "./types";
import type { ResolvedObservation } from "./resolve";

export type ObservationAccount = {
  total: number;
  proposedChanges: number;
  alreadyKnown: number;
  merged: number;
  needsYou: number;
  commentary: number;
  rejected: number;
};

export function accountObservations(args: {
  resolved: ResolvedObservation[];
  rejectedCount?: number;
}): ObservationAccount {
  const { resolved } = args;
  let proposedChanges = 0;
  let alreadyKnown = 0;
  let merged = 0;
  let needsYou = 0;
  let commentary = 0;

  for (const row of resolved) {
    const { observation, decision } = row;
    if (
      observation.disposition === "commentary" ||
      observation.disposition === "ignore" ||
      observation.domain === "commentary"
    ) {
      commentary += 1;
      continue;
    }
    if (observation.disposition === "merge") {
      merged += 1;
      continue;
    }
    if (decision.kind === "needs_you") {
      needsYou += 1;
      continue;
    }
    if (decision.kind === "no_change") {
      alreadyKnown += 1;
      continue;
    }
    if (decision.kind === "write") {
      proposedChanges += 1;
    }
  }

  return {
    total: resolved.length + (args.rejectedCount ?? 0),
    proposedChanges,
    alreadyKnown,
    merged,
    needsYou,
    commentary,
    rejected: args.rejectedCount ?? 0,
  };
}

export function formatObservationAccount(account: ObservationAccount): string {
  return [
    `${account.total} observation${account.total === 1 ? "" : "s"}`,
    `${account.proposedChanges} proposed change${account.proposedChanges === 1 ? "" : "s"}`,
    `${account.alreadyKnown} already known`,
    `${account.merged} merged`,
    `${account.needsYou} Needs you`,
    `${account.commentary} treated as commentary`,
  ].join("\n");
}

export function observationsForSummary(
  resolved: ResolvedObservation[],
): CaptureObservationV2[] {
  return resolved.map((row) => row.observation);
}
