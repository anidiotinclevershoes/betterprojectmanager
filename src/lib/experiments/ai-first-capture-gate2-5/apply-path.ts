/**
 * Gate 2.5 deterministic path after the one Astra call:
 *   inspect (caller)
 *   → Gate 2 legal-type boundary
 *   → exact same-value UPDATE → no_change
 *
 * No semantic repair. No planner outcome adoption.
 */
import type { CaptureApplyWorld } from "@/lib/capture/apply";
import type { Gate1V2Item } from "@/lib/experiments/ai-first-capture-gate1-v2/types";
import {
  applyLegalWriteBoundary,
  type LegalBoundaryTrace,
} from "@/lib/experiments/ai-first-capture-gate2/legal-boundary";
import {
  applyExactSameValueNoChange,
  type SameValueDecision,
} from "./same-value";

export type Gate25Trace = LegalBoundaryTrace & {
  sameValueComparable: boolean | null;
  sameValueMatch: boolean | null;
  sameValueConverted: boolean;
};

export function applyGate25DeterministicPath(
  items: Gate1V2Item[],
  world: CaptureApplyWorld,
  projectId: string,
): { items: Gate1V2Item[]; traces: Gate25Trace[] } {
  const legal = applyLegalWriteBoundary(items, world, projectId);
  const out: Gate1V2Item[] = [];
  const traces: Gate25Trace[] = [];

  for (let i = 0; i < legal.items.length; i += 1) {
    const item = legal.items[i];
    const legalTrace = legal.traces[i];
    if (item.operation !== "update") {
      traces.push({
        ...legalTrace,
        sameValueComparable: null,
        sameValueMatch: null,
        sameValueConverted: false,
      });
      out.push(item);
      continue;
    }
    const same = applyExactSameValueNoChange(item, world, projectId);
    traces.push({
      ...legalTrace,
      sameValueComparable: same.decision.comparable,
      sameValueMatch: same.decision.exactMatch,
      sameValueConverted: same.converted,
    });
    out.push(same.item);
  }

  return { items: out, traces };
}

export type { SameValueDecision };
