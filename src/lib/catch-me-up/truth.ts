/**
 * Assemble Catch Me Up prompt material from canonical project truth.
 * Reuses serializeCanonicalTruth — no second truth store.
 */
import { knowledgeHasContent } from "@/lib/knowledge";
import { serializeCanonicalTruth } from "@/lib/canonical-truth/serialize";
import { isOpenRiskStatus } from "@/lib/risks/lifecycle";
import type { MissionState } from "@/lib/types";
import type { NeedsConfirmationItem } from "@/lib/canonical-truth/types";
import { CATCH_ME_UP_TRUTH_QUESTION } from "./prompt";
import { scopeMissionStateToProject } from "./scope";
import type { CatchMeUpFact } from "./types";

export type CatchMeUpTruthView = {
  projectId: string;
  projectName: string;
  projectCode: string;
  promptBlock: string;
  facts: CatchMeUpFact[];
  factIds: Set<string>;
  needsConfirmationHints: NeedsConfirmationItem[];
  thinProject: boolean;
  includedHistoryEvidence: boolean;
};

export function collectFactsFromPrompt(promptBlock: string): CatchMeUpFact[] {
  const facts: CatchMeUpFact[] = [];
  const seen = new Set<string>();
  for (const line of promptBlock.split("\n")) {
    const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (!match) continue;
    const id = match[1]!.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    facts.push({
      id,
      summary: (match[2] ?? "").trim() || id,
    });
  }
  return facts;
}

export function isCatchMeUpProjectThin(
  state: MissionState,
  projectId: string,
): boolean {
  const scoped = scopeMissionStateToProject(state, projectId);
  const knowledge = scoped.knowledge[0];
  const hasKnowledge = knowledgeHasContent(knowledge);
  const hasStructured = (knowledge?.structured ?? []).some(
    (item) => item.lifecycle === "current" && item.body.trim(),
  );
  const hasOpenTodos = scoped.todos.some((t) => !t.done);
  const hasOpenRisks = (scoped.risks ?? []).some((r) =>
    isOpenRiskStatus(r.status),
  );
  const hasDates = scoped.timeline.length > 0;
  const hasPeople = (scoped.projects[0]?.stakeholders.length ?? 0) > 0;
  return (
    !hasKnowledge &&
    !hasStructured &&
    !hasOpenTodos &&
    !hasOpenRisks &&
    !hasDates &&
    !hasPeople
  );
}

export function buildCatchMeUpTruthView(args: {
  state: MissionState;
  projectId: string;
}): CatchMeUpTruthView {
  const scoped = scopeMissionStateToProject(args.state, args.projectId);
  const project = scoped.projects[0];
  const bundle = serializeCanonicalTruth({
    state: scoped,
    projectId: args.projectId,
    question: CATCH_ME_UP_TRUTH_QUESTION,
  });
  const facts = collectFactsFromPrompt(bundle.promptBlock);
  for (const hint of bundle.needsConfirmationHints) {
    const id = hint.truthItemId || hint.id;
    if (!facts.some((f) => f.id === id)) {
      facts.push({ id, summary: hint.summary });
    }
  }
  return {
    projectId: args.projectId,
    projectName: project?.name ?? args.projectId,
    projectCode: project?.code ?? "",
    promptBlock: bundle.promptBlock,
    facts,
    factIds: new Set(facts.map((f) => f.id)),
    needsConfirmationHints: bundle.needsConfirmationHints,
    thinProject: isCatchMeUpProjectThin(scoped, args.projectId),
    includedHistoryEvidence: bundle.includedHistoryEvidence,
  };
}
