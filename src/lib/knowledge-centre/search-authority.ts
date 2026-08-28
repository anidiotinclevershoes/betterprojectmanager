/**
 * Deterministic Search over the same authoritative rows Knowledge Centre shows.
 *
 * Search does not maintain a parallel project interpretation. It consumes the
 * KC frame builders (D-030 inclusive) and the existing substring matcher.
 *
 * In corpus / KC scan order:
 *   To Do, Risks & blockers, Current position, People & context,
 *   Dependencies, Decisions, Important dates, Waiting & open loops.
 *
 * Intentionally excluded (not thinner truth — not maintained Search cards):
 *   - Meeting Prep: derived meeting widget, not a maintained card list
 *   - Timeline frame: duplicate of Important dates; Timeline is not date authority
 *   - Done todos / closed-or-resolved domain risks (builders already omit them)
 *   - D-030 leftover Knowledge risk/date prose already excluded by builders
 *   - Coach / Capture / Ask answers, historical/superseded structured facts
 *
 * No RAG, embeddings, vector index, network, or second context model.
 */
import {
  buildCurrentPositionRows,
  buildDateRows,
  buildDecisionRows,
  buildDependencyRows,
  buildOpenRiskRows,
  buildPeopleRows,
  buildTodoRows,
  buildWaitingRows,
} from "@/lib/knowledge-centre/ocean-frames";
import { matchRangesFor } from "@/lib/tell-me/knowledge-search";
import type { MissionState } from "@/lib/types";

export type AuthoritativeSearchHit = {
  id: string;
  sectionLabel: string;
  bullet: string;
  matchRanges: Array<{ start: number; end: number }>;
};

type CorpusRow = { id: string; title: string; meta?: string | null };

function displayText(row: CorpusRow): string {
  const meta = row.meta?.trim();
  return meta ? `${row.title} · ${meta}` : row.title;
}

function corpusForProject(
  state: MissionState,
  projectId: string,
): Array<{ sectionLabel: string; rows: CorpusRow[] }> {
  return [
    { sectionLabel: "To Do", rows: buildTodoRows(state, projectId) },
    { sectionLabel: "Risks & blockers", rows: buildOpenRiskRows(state, projectId) },
    {
      sectionLabel: "Current position",
      rows: buildCurrentPositionRows(state, projectId),
    },
    { sectionLabel: "People & context", rows: buildPeopleRows(state, projectId) },
    {
      sectionLabel: "Dependencies",
      rows: buildDependencyRows(state, projectId),
    },
    { sectionLabel: "Decisions", rows: buildDecisionRows(state, projectId) },
    { sectionLabel: "Important dates", rows: buildDateRows(state, projectId) },
    {
      sectionLabel: "Waiting & open loops",
      rows: buildWaitingRows(state, projectId),
    },
  ];
}

/**
 * Project-scoped deterministic search. Callers must pass the active projectId;
 * builders never leak another project's rows.
 */
export function searchAuthoritativeProject(
  state: MissionState,
  projectId: string,
  query: string,
): AuthoritativeSearchHit[] {
  const q = query.trim();
  if (!q) return [];

  const hits: AuthoritativeSearchHit[] = [];
  const seen = new Set<string>();

  for (const { sectionLabel, rows } of corpusForProject(state, projectId)) {
    const sectionMatch = sectionLabel.toLowerCase().includes(q.toLowerCase());
    for (const row of rows) {
      const bullet = displayText(row);
      const matchRanges = matchRangesFor(bullet, q);
      if (!matchRanges.length && !sectionMatch) continue;
      const id = `${sectionLabel}:${row.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      hits.push({
        id,
        sectionLabel,
        bullet,
        matchRanges,
      });
    }
  }

  return hits;
}
