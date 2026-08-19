"use client";

import { useMemo, useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import { useFrameExpand } from "@/components/workspace/FrameExpandContext";
import type { FrameSize } from "@/lib/workspace/layout";
import { itemLimitFor } from "@/lib/workspace/packing";
import { useMission } from "@/lib/store";
import {
  isClosedRiskStatus,
  isOpenRiskStatus,
  isResolvedProse,
  stripResolvedPrefix,
} from "@/lib/risks/lifecycle";

export type RiskRow = {
  id: string;
  title: string;
  status: "open" | "resolved";
  projectId: string;
  source: "risk" | "knowledge" | "recommendation";
  /** Present when source === "risk" — stable risks.id */
  riskId?: string;
};

export function RiskFrame({
  projectId,
  size = "standard",
  frameId = "risks",
}: {
  projectId?: string | null;
  size?: FrameSize | string;
  frameId?: string;
}) {
  const {
    state,
    addKnowledgeBullet,
    setRiskStatus,
    setKnowledgeOnlyRiskResolved,
    setRecommendationStatus,
  } = useMission();
  const { isExpanded, expand, collapse } = useFrameExpand();
  const expanded = isExpanded(frameId);
  const [draft, setDraft] = useState("");
  const [edit, setEdit] = useState<RiskRow | null>(null);
  const limit = itemLimitFor(size);

  const risks = useMemo(() => {
    const rows: RiskRow[] = [];
    const domainRisks = state.risks ?? [];
    const domainTitlesByProject = new Map<string, Set<string>>();

    for (const risk of domainRisks) {
      if (projectId && risk.projectId !== projectId) continue;
      const key = stripResolvedPrefix(risk.title).toLowerCase();
      if (!domainTitlesByProject.has(risk.projectId)) {
        domainTitlesByProject.set(risk.projectId, new Set());
      }
      domainTitlesByProject.get(risk.projectId)!.add(key);

      const closed = isClosedRiskStatus(risk.status);
      // Hide closed unless expanded (matches prior open-first frame behaviour).
      if (closed && !expanded) continue;
      if (!closed && !isOpenRiskStatus(risk.status)) continue;

      rows.push({
        id: risk.id,
        riskId: risk.id,
        title: risk.title,
        status: closed ? "resolved" : "open",
        projectId: risk.projectId,
        source: "risk",
      });
    }

    // Legacy Knowledge-only bullets (no matching risks-domain row).
    for (const k of state.knowledge ?? []) {
      if (projectId && k.projectId !== projectId) continue;
      const claimed = domainTitlesByProject.get(k.projectId) ?? new Set();
      for (const [index, title] of (k.sections.risks ?? []).entries()) {
        const cleaned = stripResolvedPrefix(title);
        if (!cleaned) continue;
        if (claimed.has(cleaned.toLowerCase())) continue;
        const resolved = isResolvedProse(title);
        if (resolved && !expanded) continue;
        rows.push({
          id: `know-risk-${k.projectId}-${index}`,
          title: cleaned,
          status: resolved ? "resolved" : "open",
          projectId: k.projectId,
          source: "knowledge",
        });
      }
    }

    for (const rec of state.recommendations ?? []) {
      if (rec.kind !== "risk") continue;
      if (!rec.projectId) continue;
      if (projectId && rec.projectId !== projectId) continue;
      if (rec.status === "done" || rec.status === "dismissed") continue;
      // Do not treat recommendations as maintained Risks.
      rows.push({
        id: rec.id,
        title: rec.title,
        status: "open",
        projectId: rec.projectId,
        source: "recommendation",
      });
    }

    return rows.sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }, [state.knowledge, state.risks, state.recommendations, projectId, expanded]);

  const openRisks = risks.filter((r) => r.status === "open");
  const visible = expanded ? risks : openRisks.slice(0, limit);
  const overflow = !expanded && openRisks.length > limit;

  function submitNew() {
    const title = draft.trim();
    if (!title || !projectId) return;
    addKnowledgeBullet(projectId, "risks", title);
    setDraft("");
  }

  function resolveRisk(row: RiskRow) {
    if (row.source === "recommendation") {
      setRecommendationStatus(row.id, "done");
      return;
    }
    if (row.source === "risk" && row.riskId) {
      setRiskStatus(row.riskId, "resolved", row.projectId);
      return;
    }
    // Legacy Knowledge-only — no Risk-domain fabrication.
    setKnowledgeOnlyRiskResolved(row.projectId, row.title, true);
  }

  function reopenRisk(row: RiskRow) {
    if (row.source === "recommendation") return;
    if (row.source === "risk" && row.riskId) {
      setRiskStatus(row.riskId, "open", row.projectId);
      return;
    }
    setKnowledgeOnlyRiskResolved(row.projectId, row.title, false);
  }

  return (
    <div className="frame-body">
      {projectId ? (
        <div className="frame-toolbar frame-toolbar-create">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New risk"
            aria-label="New risk"
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
            }}
          />
          <button
            type="button"
            className="primary-btn"
            onClick={submitNew}
            disabled={!draft.trim()}
          >
            Add
          </button>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="empty-copy">No open risks.</p>
      ) : (
        <ul className="frame-list risk-frame-list">
          {visible.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={`risk-row is-${row.status}`}
                onClick={() => setEdit(row)}
              >
                <span className="risk-row-title">{row.title}</span>
                <span className={`risk-row-status is-${row.status}`}>
                  {row.status === "open" ? "Open" : "Resolved"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {overflow ? (
        <button
          type="button"
          className="ghost-btn mt-2"
          onClick={() => expand(frameId)}
        >
          View all ({openRisks.length})
        </button>
      ) : null}
      {expanded ? (
        <button
          type="button"
          className="ghost-btn mt-2"
          onClick={() => collapse()}
        >
          Collapse
        </button>
      ) : null}

      {edit ? (
        <DetailModal
          open
          title={edit.title}
          onClose={() => setEdit(null)}
          footer={
            <div className="row-actions">
              {edit.status === "open" ? (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    resolveRisk(edit);
                    setEdit(null);
                  }}
                >
                  Resolve
                </button>
              ) : (
                <button
                  type="button"
                  className="muted-btn"
                  onClick={() => {
                    reopenRisk(edit);
                    setEdit(null);
                  }}
                >
                  Reopen
                </button>
              )}
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setEdit(null)}
              >
                Close
              </button>
            </div>
          }
        >
          <p className="meta">
            Destination: Risks frame ·{" "}
            {edit.status === "open" ? "Open" : "Resolved"}
            {edit.source === "recommendation"
              ? " · Suggestion"
              : edit.source === "knowledge"
                ? " · Knowledge only"
                : ""}
          </p>
        </DetailModal>
      ) : null}
    </div>
  );
}
